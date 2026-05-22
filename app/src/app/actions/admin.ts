'use server';

/**
 * actions/admin.ts — 진행자 전용 Server Actions
 *
 * 모든 Action은 Service Role 권한으로 실행합니다 (RLS 우회).
 * 인증은 URL의 secret token으로 처리되므로, 이 Action을 호출하는 쪽이
 * 이미 비밀 경로를 통과했다고 신뢰합니다.
 *
 * 만약 외부에서 직접 호출될 우려가 있다면 token 인자를 추가하세요.
 */

import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/admin';
import type { Team, TeamStatus, Settings } from '@/types/db';

export type ActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };


// =====================================================================
// 팀 관리
// =====================================================================

/** 팀 이름 변경 */
export async function renameTeam(teamId: string, newName: string): Promise<ActionResult> {
  const trimmed = newName.trim();
  if (!trimmed) {
    return { ok: false, error: '팀 이름은 비울 수 없습니다.' };
  }
  if (trimmed.length > 50) {
    return { ok: false, error: '팀 이름은 50자 이내여야 합니다.' };
  }

  const supabase = getAdminClient();
  const { error } = await supabase
    .from('teams')
    .update({ name: trimmed })
    .eq('id', teamId);

  if (error) {
    console.error('[renameTeam]', error);
    return { ok: false, error: error.message };
  }

  return { ok: true, data: undefined };
}

/**
 * 팀 순서 재배치
 *   - orderedTeamIds: 새 순서대로 정렬된 팀 id 배열
 *   - 단순 UPDATE는 UNIQUE 제약(presentation_order)에 충돌하므로
 *     2-pass 방식으로 처리: ① 임시값(음수)로 전환 ② 최종값 적용
 */
export async function reorderTeams(orderedTeamIds: string[]): Promise<ActionResult> {
  const supabase = getAdminClient();

  // Pass 1: 모든 팀의 순서를 음수로 변경 (충돌 회피)
  for (let i = 0; i < orderedTeamIds.length; i++) {
    const tempOrder = -(i + 1);
    const { error } = await supabase
      .from('teams')
      .update({ presentation_order: tempOrder })
      .eq('id', orderedTeamIds[i]);
    if (error) {
      console.error('[reorderTeams pass1]', error);
      return { ok: false, error: `순서 변경 1단계 실패: ${error.message}` };
    }
  }

  // Pass 2: 최종 순서로 다시 변경
  for (let i = 0; i < orderedTeamIds.length; i++) {
    const finalOrder = i + 1;
    const { error } = await supabase
      .from('teams')
      .update({ presentation_order: finalOrder })
      .eq('id', orderedTeamIds[i]);
    if (error) {
      console.error('[reorderTeams pass2]', error);
      return { ok: false, error: `순서 변경 2단계 실패: ${error.message}` };
    }
  }

  return { ok: true, data: undefined };
}


// =====================================================================
// 발표 진행 제어
// =====================================================================

/**
 * 현재 발표 중인 팀을 '발표완료'로 마감하고, 다음 팀을 '발표중'으로 변경
 * (active_team_id도 자동 업데이트)
 *
 * 이 함수 한 번 호출 = "다음 팀" 버튼 한 번 클릭
 */
export async function advanceToNextTeam(): Promise<ActionResult<{
  finishedTeam: Team | null;
  nextTeam:     Team | null;
}>> {
  const supabase = getAdminClient();

  // 1) 현재 active_team_id 조회
  const { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('active_team_id')
    .eq('id', 1)
    .single<Settings>();

  if (settingsErr) {
    return { ok: false, error: `settings 조회 실패: ${settingsErr.message}` };
  }

  const currentTeamId = settings?.active_team_id ?? null;
  let finishedTeam: Team | null = null;
  let nextOrderStart = 1;

  // 2) 현재 active 팀이 있다면 '발표완료'로 마감
  if (currentTeamId) {
    const { data: finished, error: finErr } = await supabase
      .from('teams')
      .update({ status: '발표완료' as TeamStatus })
      .eq('id', currentTeamId)
      .select('*')
      .single<Team>();

    if (finErr) {
      return { ok: false, error: `현재 팀 마감 실패: ${finErr.message}` };
    }
    finishedTeam = finished;
    nextOrderStart = (finished?.presentation_order ?? 0) + 1;
  }

  // 3) 다음 발표 순서의 '대기' 팀 찾기 (현재 팀의 다음 순서부터)
  const { data: nextCandidate, error: nextErr } = await supabase
    .from('teams')
    .select('*')
    .eq('status', '대기' as TeamStatus)
    .gte('presentation_order', nextOrderStart)
    .order('presentation_order')
    .limit(1)
    .maybeSingle<Team>();

  if (nextErr) {
    return { ok: false, error: `다음 팀 조회 실패: ${nextErr.message}` };
  }

  let nextTeam: Team | null = null;

  if (nextCandidate) {
    // 4) 다음 팀을 '발표중'으로 변경 + active_team_id 업데이트
    const { data: started, error: startErr } = await supabase
      .from('teams')
      .update({ status: '발표중' as TeamStatus })
      .eq('id', nextCandidate.id)
      .select('*')
      .single<Team>();

    if (startErr) {
      return { ok: false, error: `다음 팀 시작 실패: ${startErr.message}` };
    }
    nextTeam = started;

    const { error: updErr } = await supabase
      .from('settings')
      .update({ active_team_id: nextCandidate.id })
      .eq('id', 1);
    if (updErr) {
      return { ok: false, error: `active_team_id 갱신 실패: ${updErr.message}` };
    }
  } else {
    // 다음 팀이 없으면 active_team_id를 NULL로
    const { error: updErr } = await supabase
      .from('settings')
      .update({ active_team_id: null })
      .eq('id', 1);
    if (updErr) {
      return { ok: false, error: `active_team_id 해제 실패: ${updErr.message}` };
    }
  }

  return { ok: true, data: { finishedTeam, nextTeam } };
}

/**
 * 특정 팀을 강제로 '발표중'으로 지정 (순서 무시)
 * 이전 active 팀은 자동으로 '발표완료' 처리
 */
export async function setActiveTeam(teamId: string): Promise<ActionResult> {
  const supabase = getAdminClient();

  // 1) 현재 active 팀 마감
  const { data: settings } = await supabase
    .from('settings').select('active_team_id').eq('id', 1).single<Settings>();
  if (settings?.active_team_id && settings.active_team_id !== teamId) {
    await supabase.from('teams').update({ status: '발표완료' as TeamStatus }).eq('id', settings.active_team_id);
  }

  // 2) 선택한 팀을 발표중으로
  const { error: teamErr } = await supabase
    .from('teams').update({ status: '발표중' as TeamStatus }).eq('id', teamId);
  if (teamErr) return { ok: false, error: teamErr.message };

  // 3) active_team_id 갱신
  const { error: setErr } = await supabase
    .from('settings').update({ active_team_id: teamId }).eq('id', 1);
  if (setErr) return { ok: false, error: setErr.message };

  return { ok: true, data: undefined };
}

/** 모든 팀을 '대기'로 리셋 + active_team_id 해제 (리허설/재시작용) */
export async function resetAllTeams(): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error: teamsErr } = await supabase
    .from('teams').update({ status: '대기' as TeamStatus }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (teamsErr) return { ok: false, error: teamsErr.message };

  const { error: setErr } = await supabase
    .from('settings').update({ active_team_id: null, reveal_stage: 0 }).eq('id', 1);
  if (setErr) return { ok: false, error: setErr.message };

  return { ok: true, data: undefined };
}


// =====================================================================
// 스테이지 제어 (settings 토글)
// =====================================================================

type SettingsToggleKey =
  | 'scoring_open'
  | 'special_voting_open'
  | 'empathy_voting_open';

/** scoring/special_voting/empathy_voting 토글 */
export async function toggleStage(
  key: SettingsToggleKey,
  value: boolean
): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from('settings').update({ [key]: value }).eq('id', 1);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** reveal_stage 변경 (0=미공개, 1=특별상4종, 2=3위, 3=2위, 4=1위, 5=완료) */
export async function setRevealStage(stage: 0 | 1 | 2 | 3 | 4 | 5): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from('settings').update({ reveal_stage: stage }).eq('id', 1);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}


// =====================================================================
// 점수·투표 데이터 리셋 (리허설 후 본 행사 직전에 사용)
// =====================================================================

export async function clearAllScores(): Promise<ActionResult> {
  const supabase = getAdminClient();
  const { error } = await supabase.from('scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function clearAllVotes(): Promise<ActionResult> {
  const supabase = getAdminClient();
  const e1 = await supabase.from('special_votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e1.error) return { ok: false, error: e1.error.message };
  const e2 = await supabase.from('empathy_votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (e2.error) return { ok: false, error: e2.error.message };
  return { ok: true, data: undefined };
}

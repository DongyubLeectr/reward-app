'use server';

/**
 * actions/votes.ts — 특별상·공감상 투표 관련 Server Actions
 *
 *   특별상 (강상우=협력상, 김형욱=도전상, Goos=토큰상):
 *     - selectSpecialAward : 본인 담당 특별상으로 한 팀 선정 (UPSERT)
 *     - getSpecialVote     : 본인이 이미 선정한 팀 조회
 *
 *   공감상 (청중 1인 1표):
 *     - castEmpathyVote     : 특정 팀에 공감상 1표 행사 (fingerprint 중복 차단)
 *     - getEmpathyVoteState : 현재 fingerprint의 투표 여부 + 토글 가능 여부 조회
 *
 *   공통:
 *     - getTop3TeamIds : 현재 시점의 1~3위 팀 id 배열 (특별상 후보에서 제외)
 */

import { getServerClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import type {
  SpecialVote, EmpathyVote, AwardType, JudgeAwardType,
} from '@/types/db';

export type ActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };


// =====================================================================
// 공통: 1~3위 팀 id 조회
// =====================================================================

export async function getTop3TeamIds(): Promise<ActionResult<string[]>> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('v_top3')
    .select('team_id')
    .order('rank');

  if (error) {
    console.error('[getTop3TeamIds]', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: (data ?? []).map((r) => r.team_id as string) };
}


// =====================================================================
// 특별상
// =====================================================================

/**
 * 심사위원이 본인 담당 특별상으로 한 팀을 선정
 *   - 협력상=강상우, 도전상=김형욱, 토큰상=Goos만 호출 가능
 *   - 같은 심사위원이 다시 호출하면 선정 팀 변경 (UPSERT: unique(judge_id, award_type))
 *   - 1~3위 팀 선정은 거부
 */
export async function selectSpecialAward(input: {
  judge_id:   string;
  team_id:    string;
  award_type: Exclude<AwardType, '공감상'>;
}): Promise<ActionResult<SpecialVote>> {
  const supabase = await getServerClient();

  // 1) 심사위원 검증 — 해당 award_type 담당자가 맞는지
  const { data: judge, error: judgeErr } = await supabase
    .from('judges').select('special_award_type').eq('id', input.judge_id).single();

  if (judgeErr || !judge) {
    return { ok: false, error: '심사위원 정보를 찾을 수 없습니다.' };
  }
  if ((judge.special_award_type as JudgeAwardType) !== input.award_type) {
    return { ok: false, error: `${input.award_type} 담당 심사위원이 아닙니다.` };
  }

  // 2) 1~3위 팀에 투표하려는 경우 차단
  const top3 = await getTop3TeamIds();
  if (top3.ok && top3.data.includes(input.team_id)) {
    return { ok: false, error: '1~3위 팀은 특별상 후보가 될 수 없습니다.' };
  }

  // 3) UPSERT (judge_id + award_type 유일 키)
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('special_votes')
    .upsert(
      {
        judge_id:   input.judge_id,
        team_id:    input.team_id,
        award_type: input.award_type,
      },
      { onConflict: 'judge_id,award_type' }
    )
    .select('*')
    .single();

  if (error) {
    console.error('[selectSpecialAward]', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as SpecialVote };
}

/** 본인이 이미 선정한 특별상 팀 조회 */
export async function getSpecialVote(
  judgeId: string,
  awardType: Exclude<AwardType, '공감상'>
): Promise<ActionResult<SpecialVote | null>> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('special_votes')
    .select('*')
    .eq('judge_id',   judgeId)
    .eq('award_type', awardType)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: (data as SpecialVote | null) };
}


// =====================================================================
// 공감상 (청중 투표)
// =====================================================================

/**
 * 공감상 투표
 *   - fingerprint로 중복 차단 (UNIQUE 제약)
 *   - 같은 fingerprint가 다시 호출하면 투표 팀 변경 (UPDATE)
 *   - empathy_voting_open이 OFF면 거부
 *   - 1~3위 팀에 투표 시도 시 거부 (UI에서는 1~3위가 안 보이도록 가려두지만 안전망)
 */
export async function castEmpathyVote(input: {
  fingerprint: string;
  team_id:     string;
}): Promise<ActionResult<EmpathyVote>> {
  const supabase = await getServerClient();

  // 1) settings 확인
  const { data: settings, error: setErr } = await supabase
    .from('settings').select('empathy_voting_open').eq('id', 1).single();
  if (setErr) return { ok: false, error: 'settings 조회 실패' };
  if (!settings?.empathy_voting_open) {
    return { ok: false, error: '공감상 투표가 아직 열리지 않았습니다.' };
  }

  // 2) 1~3위 차단
  const top3 = await getTop3TeamIds();
  if (top3.ok && top3.data.includes(input.team_id)) {
    return { ok: false, error: '1~3위 팀은 공감상 대상이 아닙니다.' };
  }

  // 3) UPSERT (fingerprint UNIQUE)
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('empathy_votes')
    .upsert(
      {
        voter_fingerprint: input.fingerprint,
        team_id:           input.team_id,
        voted_at:          new Date().toISOString(),
      },
      { onConflict: 'voter_fingerprint' }
    )
    .select('*')
    .single();

  if (error) {
    console.error('[castEmpathyVote]', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data as EmpathyVote };
}

/** fingerprint의 현재 투표 상태 조회 */
export async function getEmpathyVoteState(fingerprint: string): Promise<ActionResult<{
  myVote: EmpathyVote | null;
  votingOpen: boolean;
}>> {
  const supabase = await getServerClient();

  const [{ data: vote, error: vErr }, { data: settings, error: sErr }] = await Promise.all([
    supabase.from('empathy_votes').select('*').eq('voter_fingerprint', fingerprint).maybeSingle(),
    supabase.from('settings').select('empathy_voting_open').eq('id', 1).single(),
  ]);

  if (sErr) return { ok: false, error: sErr.message };
  if (vErr) return { ok: false, error: vErr.message };

  return {
    ok: true,
    data: {
      myVote: vote as EmpathyVote | null,
      votingOpen: Boolean(settings?.empathy_voting_open),
    },
  };
}

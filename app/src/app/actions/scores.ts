'use server';

/**
 * actions/scores.ts — 점수 입력 관련 Server Actions
 *
 * /judge/score 페이지에서 호출됩니다.
 *   - saveScoreDraft : 슬라이더 조작 시 자동 저장 (드래프트)
 *   - submitScore    : "제출" 버튼 클릭 시 확정
 *   - getMyScores    : 본인이 입력한 점수 전체 조회 (페이지 진입 시)
 *
 * 모든 Action은 Server Action(서버 사이드)에서 실행됩니다.
 * 인증은 별도로 두지 않고, judge_id를 파라미터로 받아 신뢰 기반 운영.
 * (5/27 행사 단일 운영 환경, 5명 심사위원이라 신뢰 모델로 충분)
 */

import { getServerClient } from '@/lib/supabase/server';
import { validateScoreInput } from '@/types/db';
import type { Score, UpsertScoreInput } from '@/types/db';

// =====================================================================
// 결과 타입 (성공/실패 명시)
// =====================================================================

export type ActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };


// =====================================================================
// 1. saveScoreDraft — 드래프트 자동 저장
//   슬라이더 조작 후 debounce(2초)로 호출됨
// =====================================================================
export async function saveScoreDraft(
  input: UpsertScoreInput
): Promise<ActionResult<Score>> {
  // 1) 입력 검증
  const validationError = validateScoreInput(input);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  // 2) RPC 호출 (upsert_score는 is_submitted=false로 호출)
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('upsert_score', {
    p_judge_id:         input.judge_id,
    p_team_id:          input.team_id,
    p_roi_score:        input.roi_score,
    p_efficiency_score: input.efficiency_score,
    p_completion_score: input.completion_score,
    p_is_submitted:     false,
  });

  if (error) {
    console.error('[saveScoreDraft] RPC 실패', error);
    return { ok: false, error: `드래프트 저장 실패: ${error.message}` };
  }

  return { ok: true, data: data as Score };
}


// =====================================================================
// 2. submitScore — 제출 확정
//   "제출" 버튼 클릭 시 호출. 점수 값은 그대로, is_submitted만 TRUE로 변경.
//   드래프트가 없으면 입력값으로 INSERT 후 즉시 제출 처리.
// =====================================================================
export async function submitScore(
  input: UpsertScoreInput
): Promise<ActionResult<Score>> {
  // 1) 입력 검증
  const validationError = validateScoreInput(input);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  // 2) upsert_score를 is_submitted=true로 호출 (드래프트가 있든 없든 일괄 처리)
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('upsert_score', {
    p_judge_id:         input.judge_id,
    p_team_id:          input.team_id,
    p_roi_score:        input.roi_score,
    p_efficiency_score: input.efficiency_score,
    p_completion_score: input.completion_score,
    p_is_submitted:     true,
  });

  if (error) {
    console.error('[submitScore] RPC 실패', error);
    return { ok: false, error: `제출 실패: ${error.message}` };
  }

  return { ok: true, data: data as Score };
}


// =====================================================================
// 3. getMyScores — 본인이 입력한 점수 전체 조회
//   페이지 진입 시 호출. 팀별 입력 상태(드래프트/제출) 복원용.
// =====================================================================
export async function getMyScores(
  judgeId: string
): Promise<ActionResult<Score[]>> {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('judge_id', judgeId);

  if (error) {
    console.error('[getMyScores] 조회 실패', error);
    return { ok: false, error: `점수 조회 실패: ${error.message}` };
  }

  return { ok: true, data: (data ?? []) as Score[] };
}

'use server';

/**
 * actions/results.ts — 결과 발표 화면용 데이터 조회 Server Actions
 *
 * 핵심:
 *   - DB의 get_final_results() RPC + 보조 View들을 조합해
 *     "최종 결과" 화면에서 바로 쓸 수 있는 구조로 정규화
 *   - 충돌 처리: 특별상이 이미 1~3위에 든 경우 is_conflict=true 노출
 */

import { getServerClient } from '@/lib/supabase/server';

export type ActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// 1~3위 한 팀 (Top1/Top2/Top3)
export interface RankWinner {
  rank:        1 | 2 | 3;
  team_id:     string;
  team_name:   string;
  total_sum:   number;
  roi_sum:     number;
  prize_won:   number; // 100/50/30 (만원)
}

// 특별상 1건
export interface SpecialAwardWinner {
  award_type:  '협력상' | '도전상' | '토큰상' | '공감상';
  team_id:     string | null;
  team_name:   string | null;
  detail:      string;   // "선정: 강상우 심사위원" or "득표 N표" or "선정자 없음"
  prize_won:   number;   // 10 (만원)
}

// 통합 결과
export interface FinalResults {
  ranks:   RankWinner[];          // 1~3위 (최대 3건, 점수 미입력 상태면 빈 배열)
  specials: SpecialAwardWinner[]; // 4종 특별상 (없으면 detail에 "선정자 없음")
}

const PRIZE_BY_RANK   = { 1: 100, 2: 50, 3: 30 } as const;
const SPECIAL_PRIZE   = 10;
const SPECIAL_LABELS  = ['협력상', '도전상', '토큰상', '공감상'] as const;


// =====================================================================
// 메인 조회
// =====================================================================
export async function getFinalResults(): Promise<ActionResult<FinalResults>> {
  const supabase = await getServerClient();

  // 1~3위는 v_team_ranking에서 정밀하게 조회 (RPC가 score_info 문자열로 합쳐버려서 분리 어려움)
  const [
    { data: rankRows,    error: rankErr    },
    { data: specialRows, error: specialErr },
    { data: empathyRows, error: empErr     },
  ] = await Promise.all([
    supabase.from('v_team_ranking').select('*').lte('rank', 3).order('rank'),
    supabase.from('v_special_award_winners').select('*'),
    supabase.from('v_empathy_ranking').select('*').eq('rank', 1).limit(1),
  ]);

  if (rankErr)    return { ok: false, error: `1~3위 조회 실패: ${rankErr.message}` };
  if (specialErr) return { ok: false, error: `특별상 조회 실패: ${specialErr.message}` };
  if (empErr)     return { ok: false, error: `공감상 조회 실패: ${empErr.message}` };

  // 1~3위 정규화 (점수가 모두 0인 경우 의미 있는 순위가 아니므로 제외)
  const ranks: RankWinner[] = (rankRows ?? [])
    .filter((r) => (r.total_sum ?? 0) > 0)
    .slice(0, 3)
    .map((r) => ({
      rank:      r.rank as 1 | 2 | 3,
      team_id:   r.team_id as string,
      team_name: r.team_name as string,
      total_sum: r.total_sum as number,
      roi_sum:   r.roi_sum as number,
      prize_won: PRIZE_BY_RANK[r.rank as 1 | 2 | 3],
    }));

  // 특별상 4종 정규화 (선정 안 된 항목은 detail에 "선정자 없음")
  const specialMap = new Map<string, { team_id: string; team_name: string; judge_name: string; is_conflict: boolean }>();
  for (const row of (specialRows ?? [])) {
    specialMap.set(row.award_type as string, {
      team_id:     row.team_id     as string,
      team_name:   row.team_name   as string,
      judge_name:  row.judge_name  as string,
      is_conflict: Boolean(row.is_conflict),
    });
  }

  const specials: SpecialAwardWinner[] = SPECIAL_LABELS.map((label) => {
    if (label === '공감상') {
      const top = (empathyRows ?? [])[0];
      if (!top) {
        return { award_type: '공감상', team_id: null, team_name: null, detail: '득표 없음', prize_won: SPECIAL_PRIZE };
      }
      return {
        award_type: '공감상',
        team_id:    top.team_id as string,
        team_name:  top.team_name as string,
        detail:     `청중 ${top.vote_count}표`,
        prize_won:  SPECIAL_PRIZE,
      };
    }

    // 협력상/도전상/토큰상
    const v = specialMap.get(label);
    if (!v) {
      return { award_type: label, team_id: null, team_name: null, detail: '선정자 없음', prize_won: SPECIAL_PRIZE };
    }
    return {
      award_type: label,
      team_id:    v.team_id,
      team_name:  v.team_name,
      detail:     v.is_conflict
        ? `⚠ ${v.judge_name} 심사위원 선정 (1~3위 충돌)`
        : `선정: ${v.judge_name} 심사위원`,
      prize_won:  SPECIAL_PRIZE,
    };
  });

  return { ok: true, data: { ranks, specials } };
}

/**
 * db.ts — DB 테이블·뷰·함수의 TypeScript 타입 정의
 *
 * 이 파일은 db/01_schema.sql, 03_views_functions.sql 과 1:1로 대응합니다.
 * SQL 스키마를 변경하면 이 파일도 함께 업데이트하세요.
 */

// =====================================================================
// ENUM
// =====================================================================

export type TeamStatus = '대기' | '발표중' | '발표완료';

export type AwardType = '협력상' | '도전상' | '토큰상' | '공감상';

// 심사위원이 담당할 수 있는 특별상 (공감상은 청중 투표이므로 제외)
export type JudgeAwardType = Exclude<AwardType, '공감상'> | null;


// =====================================================================
// 테이블
// =====================================================================

export interface Team {
  id: string;                   // UUID
  name: string;
  presentation_order: number;
  status: TeamStatus;
  created_at: string;           // ISO timestamp
  updated_at: string;
}

export interface Judge {
  id: string;
  name: string;
  special_award_type: JudgeAwardType;
  display_order: number;
  created_at: string;
}

export interface Score {
  id: string;
  judge_id: string;
  team_id: string;
  roi_score: number;            // 0-40
  efficiency_score: number;     // 0-30
  completion_score: number;     // 0-30
  total_score: number;          // 자동 계산 (GENERATED column)
  is_submitted: boolean;        // false=드래프트(자동저장), true=제출 확정
  created_at: string;
  updated_at: string;
}

export interface SpecialVote {
  id: string;
  judge_id: string;
  team_id: string;
  award_type: Exclude<AwardType, '공감상'>;
  created_at: string;
  updated_at: string;
}

export interface EmpathyVote {
  id: string;
  voter_fingerprint: string;
  team_id: string;
  voted_at: string;
}

export interface Settings {
  id: 1;                        // 항상 1 (단일 행)
  active_team_id: string | null;
  scoring_open: boolean;
  special_voting_open: boolean;
  empathy_voting_open: boolean;
  reveal_stage: 0 | 1 | 2 | 3 | 4 | 5;
  updated_at: string;
}


// =====================================================================
// View (집계용)
// =====================================================================

export interface TeamScoreRow {
  team_id: string;
  team_name: string;
  presentation_order: number;
  status: TeamStatus;
  total_sum: number;            // 5명 제출 점수 합산 (최대 500)
  roi_sum: number;              // 동점 처리용
  efficiency_sum: number;
  completion_sum: number;
  scored_judges: number;        // 드래프트 포함 입력 시작한 심사위원 수 (0~5)
  submitted_judges: number;     // 제출 확정한 심사위원 수 (0~5)
}

export interface TeamRankingRow {
  team_id: string;
  team_name: string;
  presentation_order: number;
  total_sum: number;
  roi_sum: number;
  rank: number;                 // 1부터 시작
}

export interface EmpathyRankingRow {
  team_id: string;
  team_name: string;
  presentation_order: number;
  vote_count: number;
  rank: number;
}

export interface SpecialAwardWinnerRow {
  award_type: Exclude<AwardType, '공감상'>;
  judge_name: string;
  team_id: string;
  team_name: string;
  is_conflict: boolean;         // true면 1~3위와 겹쳐 충돌
}


// =====================================================================
// Function 반환 타입
// =====================================================================

export interface FinalResultRow {
  award_label: string;          // 'Top1' | 'Top2' | 'Top3' | '협력상' | '도전상' | '토큰상' | '공감상'
  team_id: string;
  team_name: string;
  score_info: string;
}

export interface ScoreProgressRow {
  team_id: string;
  team_name: string;
  presentation_order: number;
  scored_judges: number;        // 드래프트 포함
  submitted_judges: number;     // 제출 확정만
  total_judges: number;
  is_complete: boolean;         // submitted_judges >= total_judges
}


// =====================================================================
// 유틸 타입
// =====================================================================

/** 점수 UPSERT 입력값 */
export interface UpsertScoreInput {
  judge_id: string;
  team_id: string;
  roi_score: number;            // 0-40
  efficiency_score: number;     // 0-30
  completion_score: number;     // 0-30
  is_submitted?: boolean;       // 기본 false (드래프트)
}

/** 점수 입력 검증 (클라이언트·서버 공용) */
export function validateScoreInput(input: UpsertScoreInput): string | null {
  const { roi_score, efficiency_score, completion_score } = input;
  if (!Number.isInteger(roi_score) || roi_score < 0 || roi_score > 40) {
    return 'ROI 점수는 0~40 사이의 정수여야 합니다.';
  }
  if (!Number.isInteger(efficiency_score) || efficiency_score < 0 || efficiency_score > 30) {
    return '업무효율화 점수는 0~30 사이의 정수여야 합니다.';
  }
  if (!Number.isInteger(completion_score) || completion_score < 0 || completion_score > 30) {
    return '과제 완성도 점수는 0~30 사이의 정수여야 합니다.';
  }
  return null;
}

-- =====================================================================
-- 03_views_functions.sql
-- 집계용 View와 Function
--   - 팀별 합산 점수
--   - 1~3위 자동 산정 (동점 시 ROI 합산 우선)
--   - 특별상 / 공감상 집계
--   - 최종 수상 결과
-- =====================================================================


-- =====================================================================
-- v_team_scores : 팀별 합산 점수 (5명 점수의 단순 합 = 최대 500점)
--                  동점 처리를 위해 ROI 합산도 함께 노출
-- =====================================================================
CREATE OR REPLACE VIEW v_team_scores AS
SELECT
  t.id                                            AS team_id,
  t.name                                          AS team_name,
  t.presentation_order,
  t.status,
  COALESCE(SUM(s.total_score),       0)::INT      AS total_sum,        -- 핵심: 5명 점수 합산
  COALESCE(SUM(s.roi_score),         0)::INT      AS roi_sum,          -- 동점 처리용 (ROI 합산)
  COALESCE(SUM(s.efficiency_score),  0)::INT      AS efficiency_sum,
  COALESCE(SUM(s.completion_score),  0)::INT      AS completion_sum,
  COUNT(s.id)::INT                                AS scored_judges     -- 입력 완료한 심사위원 수 (0~5)
FROM teams t
LEFT JOIN scores s ON s.team_id = t.id
GROUP BY t.id, t.name, t.presentation_order, t.status;

COMMENT ON VIEW v_team_scores IS '팀별 합산 점수 (총점 + ROI 합산) — 1~3위 산정의 핵심 뷰';


-- =====================================================================
-- v_team_ranking : 1~3위 산정 (동점 시 ROI 합산 높은 팀 우선)
--                   - dense_rank가 아닌 row_number로 처리해 동점 시에도 1, 2, 3을 명확히 결정
-- =====================================================================
CREATE OR REPLACE VIEW v_team_ranking AS
SELECT
  team_id,
  team_name,
  presentation_order,
  total_sum,
  roi_sum,
  ROW_NUMBER() OVER (
    ORDER BY total_sum DESC,         -- 1차: 합산 점수
             roi_sum   DESC,         -- 2차: ROI 합산 (동점 처리)
             presentation_order ASC  -- 3차: 발표 순서 (최후의 동점 처리)
  )::INT AS rank
FROM v_team_scores;

COMMENT ON VIEW v_team_ranking IS '팀 순위 (1, 2, 3, ... 행 단위로 결정). 동점 시 ROI 합산이 우선.';


-- =====================================================================
-- v_top3 : 1~3위만 추출 (UI에서 쉽게 쓰기 위한 편의 뷰)
-- =====================================================================
CREATE OR REPLACE VIEW v_top3 AS
SELECT * FROM v_team_ranking WHERE rank <= 3;

COMMENT ON VIEW v_top3 IS '상위 3개 팀 (1, 2, 3위)';


-- =====================================================================
-- v_empathy_ranking : 공감상 득표 집계 (1~3위 제외)
--                      동점 시 무작위 처리 대신 발표 순서 빠른 팀 우선
-- =====================================================================
CREATE OR REPLACE VIEW v_empathy_ranking AS
WITH top3 AS (
  SELECT team_id FROM v_top3
),
vote_counts AS (
  SELECT
    t.id                       AS team_id,
    t.name                     AS team_name,
    t.presentation_order,
    COUNT(ev.id)::INT          AS vote_count
  FROM teams t
  LEFT JOIN empathy_votes ev ON ev.team_id = t.id
  WHERE t.id NOT IN (SELECT team_id FROM top3)
  GROUP BY t.id, t.name, t.presentation_order
)
SELECT
  team_id,
  team_name,
  presentation_order,
  vote_count,
  ROW_NUMBER() OVER (
    ORDER BY vote_count        DESC,
             presentation_order ASC
  )::INT AS rank
FROM vote_counts;

COMMENT ON VIEW v_empathy_ranking IS '공감상 후보 (1~3위 제외) 득표 순위';


-- =====================================================================
-- v_special_award_winners : 심사위원이 선정한 특별상 결과 (1~3위에 들어간 팀은 무효 처리)
--                           충돌 시 진행자가 차순위를 직접 지정해야 함
-- =====================================================================
CREATE OR REPLACE VIEW v_special_award_winners AS
WITH top3 AS (
  SELECT team_id FROM v_top3
)
SELECT
  sv.award_type,
  j.name                                AS judge_name,
  t.id                                  AS team_id,
  t.name                                AS team_name,
  (t.id IN (SELECT team_id FROM top3))  AS is_conflict  -- TRUE면 1~3위와 겹쳐 충돌
FROM special_votes sv
JOIN judges j ON j.id = sv.judge_id
JOIN teams  t ON t.id = sv.team_id;

COMMENT ON VIEW v_special_award_winners IS '특별상 선정 결과 (1~3위 충돌 여부 표시)';


-- =====================================================================
-- get_final_results() : 최종 수상 결과 통합 조회
--   리턴: 7개 행 (1위, 2위, 3위, 협력상, 도전상, 토큰상, 공감상)
--   진행자 대시보드의 "결과 확정" 화면에서 호출
-- =====================================================================
CREATE OR REPLACE FUNCTION get_final_results()
RETURNS TABLE (
  award_label   TEXT,
  team_id       UUID,
  team_name     TEXT,
  score_info    TEXT
) AS $$
BEGIN
  -- 1~3위
  RETURN QUERY
    SELECT
      ('Top' || rank::TEXT) AS award_label,
      r.team_id,
      r.team_name,
      ('합산 ' || r.total_sum || '점 / ROI ' || r.roi_sum || '점') AS score_info
    FROM v_team_ranking r
    WHERE r.rank <= 3
    ORDER BY r.rank;

  -- 협력상 / 도전상 / 토큰상 (충돌 시 NULL 반환)
  RETURN QUERY
    SELECT
      sv.award_type::TEXT,
      sv.team_id,
      sv.team_name,
      CASE WHEN sv.is_conflict
           THEN '⚠ 1~3위 충돌 — 진행자 확인 필요'
           ELSE ('선정: ' || sv.judge_name || ' 심사위원')
      END
    FROM v_special_award_winners sv
    WHERE sv.award_type <> '공감상';

  -- 공감상 (1등)
  RETURN QUERY
    SELECT
      '공감상'::TEXT,
      er.team_id,
      er.team_name,
      ('득표 ' || er.vote_count || '표')
    FROM v_empathy_ranking er
    WHERE er.rank = 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_final_results() IS '최종 수상 결과 통합 조회 (1~3위 + 특별상 4종)';


-- =====================================================================
-- get_score_progress() : 심사위원별 / 팀별 점수 입력 진행률
--   진행자 대시보드 실시간 모니터링용
-- =====================================================================
CREATE OR REPLACE FUNCTION get_score_progress()
RETURNS TABLE (
  team_id              UUID,
  team_name            TEXT,
  presentation_order   INT,
  scored_judges        INT,
  total_judges         INT,
  is_complete          BOOLEAN
) AS $$
DECLARE
  total INT;
BEGIN
  SELECT COUNT(*) INTO total FROM judges;
  RETURN QUERY
    SELECT
      vs.team_id,
      vs.team_name,
      vs.presentation_order,
      vs.scored_judges,
      total,
      (vs.scored_judges >= total)
    FROM v_team_scores vs
    ORDER BY vs.presentation_order;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_score_progress() IS '팀별 점수 입력 진행률 (n명 중 m명 입력 완료)';


-- =====================================================================
-- upsert_score() : 점수 UPSERT (Next.js Server Action에서 호출)
-- =====================================================================
CREATE OR REPLACE FUNCTION upsert_score(
  p_judge_id          UUID,
  p_team_id           UUID,
  p_roi_score         INT,
  p_efficiency_score  INT,
  p_completion_score  INT
)
RETURNS scores AS $$
DECLARE
  result scores;
BEGIN
  INSERT INTO scores (judge_id, team_id, roi_score, efficiency_score, completion_score)
  VALUES (p_judge_id, p_team_id, p_roi_score, p_efficiency_score, p_completion_score)
  ON CONFLICT (judge_id, team_id) DO UPDATE
    SET roi_score        = EXCLUDED.roi_score,
        efficiency_score = EXCLUDED.efficiency_score,
        completion_score = EXCLUDED.completion_score,
        updated_at       = NOW()
  RETURNING * INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_score IS '심사위원 점수 UPSERT (judge_id + team_id 유일)';


-- =====================================================================
-- 검증 쿼리 (실행 후 확인용)
-- =====================================================================
-- SELECT * FROM v_team_scores       ORDER BY total_sum DESC;
-- SELECT * FROM v_team_ranking      LIMIT 5;
-- SELECT * FROM v_empathy_ranking   LIMIT 5;
-- SELECT * FROM get_final_results();
-- SELECT * FROM get_score_progress();

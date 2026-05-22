-- =====================================================================
-- 05_add_is_submitted.sql
-- 마이그레이션: scores 테이블에 is_submitted 컬럼 추가
--   - 드래프트(자동 저장) vs 제출(확정) 구분
--   - 진행자 대시보드의 "5명 중 N명 입력 완료" 카운트는 is_submitted = TRUE 기준
-- 적용 시점: 2026-05-21
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. 컬럼 추가
-- ---------------------------------------------------------------------
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS is_submitted BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN scores.is_submitted IS
  '심사위원이 "제출" 버튼을 눌러 확정한 점수인지 여부. FALSE는 자동 저장된 드래프트.';

-- 제출 상태 변경 시 updated_at 자동 갱신은 기존 trg_set_updated_at 트리거가 처리함


-- ---------------------------------------------------------------------
-- 2. View 갱신: 진행자 대시보드용 "제출 완료 심사위원 수" 카운트
--    - 기존 scored_judges (드래프트 포함)는 그대로 두고
--    - submitted_judges (제출 확정만) 컬럼을 추가
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_team_scores AS
SELECT
  t.id                                                                  AS team_id,
  t.name                                                                AS team_name,
  t.presentation_order,
  t.status,
  -- 합산은 제출된 점수만 카운트 (드래프트는 미반영)
  COALESCE(SUM(CASE WHEN s.is_submitted THEN s.total_score      END), 0)::INT AS total_sum,
  COALESCE(SUM(CASE WHEN s.is_submitted THEN s.roi_score        END), 0)::INT AS roi_sum,
  COALESCE(SUM(CASE WHEN s.is_submitted THEN s.efficiency_score END), 0)::INT AS efficiency_sum,
  COALESCE(SUM(CASE WHEN s.is_submitted THEN s.completion_score END), 0)::INT AS completion_sum,
  -- 카운트는 드래프트/제출 모두 노출
  COUNT(s.id)::INT                                                              AS scored_judges,      -- 드래프트 포함 (입력 시작한 심사위원 수)
  COUNT(CASE WHEN s.is_submitted THEN 1 END)::INT                              AS submitted_judges   -- 제출 완료한 심사위원 수
FROM teams t
LEFT JOIN scores s ON s.team_id = t.id
GROUP BY t.id, t.name, t.presentation_order, t.status;

COMMENT ON VIEW v_team_scores IS
  '팀별 점수 집계. 합산은 제출된 점수만 반영, 카운트는 드래프트(scored_judges)와 제출(submitted_judges)을 분리.';


-- ---------------------------------------------------------------------
-- 3. get_score_progress() 갱신: 제출 기준으로 is_complete 판정
--    PostgreSQL은 반환 타입이 바뀌면 CREATE OR REPLACE를 거부하므로 DROP 먼저
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_score_progress();
CREATE OR REPLACE FUNCTION get_score_progress()
RETURNS TABLE (
  team_id              UUID,
  team_name            TEXT,
  presentation_order   INT,
  scored_judges        INT,       -- 드래프트 포함 입력 시작
  submitted_judges     INT,       -- 제출 완료
  total_judges         INT,
  is_complete          BOOLEAN    -- 모든 심사위원이 제출을 마쳤는가
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
      vs.submitted_judges,
      total,
      (vs.submitted_judges >= total)
    FROM v_team_scores vs
    ORDER BY vs.presentation_order;
END;
$$ LANGUAGE plpgsql STABLE;


-- ---------------------------------------------------------------------
-- 4. upsert_score() 갱신: is_submitted 파라미터 추가
--    파라미터 시그니처가 바뀌므로 DROP 먼저 (기존 시그니처도 지움)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS upsert_score(UUID, UUID, INT, INT, INT);
DROP FUNCTION IF EXISTS upsert_score(UUID, UUID, INT, INT, INT, BOOLEAN);
CREATE OR REPLACE FUNCTION upsert_score(
  p_judge_id          UUID,
  p_team_id           UUID,
  p_roi_score         INT,
  p_efficiency_score  INT,
  p_completion_score  INT,
  p_is_submitted      BOOLEAN DEFAULT FALSE
)
RETURNS scores AS $$
DECLARE
  result scores;
BEGIN
  INSERT INTO scores (judge_id, team_id, roi_score, efficiency_score, completion_score, is_submitted)
  VALUES (p_judge_id, p_team_id, p_roi_score, p_efficiency_score, p_completion_score, p_is_submitted)
  ON CONFLICT (judge_id, team_id) DO UPDATE
    SET roi_score        = EXCLUDED.roi_score,
        efficiency_score = EXCLUDED.efficiency_score,
        completion_score = EXCLUDED.completion_score,
        is_submitted     = EXCLUDED.is_submitted,
        updated_at       = NOW()
  RETURNING * INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_score IS
  '심사위원 점수 UPSERT. p_is_submitted를 FALSE로 호출하면 드래프트, TRUE면 제출 확정.';


-- ---------------------------------------------------------------------
-- 5. 새 함수: submit_score()
--   드래프트로 저장된 점수를 제출 확정 상태로만 변경 (값은 그대로)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_score(
  p_judge_id  UUID,
  p_team_id   UUID
)
RETURNS scores AS $$
DECLARE
  result scores;
BEGIN
  UPDATE scores
     SET is_submitted = TRUE,
         updated_at   = NOW()
   WHERE judge_id = p_judge_id
     AND team_id  = p_team_id
  RETURNING * INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION '제출할 드래프트 점수가 없습니다. 점수를 먼저 입력해주세요. (judge_id=%, team_id=%)', p_judge_id, p_team_id;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION submit_score IS '드래프트로 저장된 점수를 제출 확정 처리. 값 변경 없이 is_submitted만 TRUE로.';


-- =====================================================================
-- 검증 쿼리
-- =====================================================================
-- 1. 컬럼 추가 확인
--   SELECT column_name, data_type, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'scores' AND column_name = 'is_submitted';
--
-- 2. View 갱신 확인 (모든 팀의 submitted_judges = 0이 정상)
--   SELECT team_name, scored_judges, submitted_judges FROM v_team_scores ORDER BY presentation_order LIMIT 5;
--
-- 3. 새 함수 시그니처 확인
--   \df upsert_score
--   \df submit_score

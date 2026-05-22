-- =====================================================================
-- 01_schema.sql
-- 포상 진행 시스템 - Supabase 스키마 (테이블 정의)
-- 실행 순서: 01_schema.sql → 02_seed.sql → 03_views_functions.sql → 04_rls_realtime.sql
-- =====================================================================

-- 안전한 재실행을 위해 기존 테이블/타입 제거 (개발 단계에서만 사용)
-- 프로덕션 적용 시 이 DROP 블록은 주석 처리하거나 삭제하세요.
DROP TABLE IF EXISTS empathy_votes CASCADE;
DROP TABLE IF EXISTS special_votes CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS judges CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TYPE IF EXISTS team_status;
DROP TYPE IF EXISTS award_type;

-- =====================================================================
-- ENUM 타입 정의
-- =====================================================================

-- 발표팀 상태
CREATE TYPE team_status AS ENUM ('대기', '발표중', '발표완료');

-- 특별상 종류 (1~3위는 별도 산정이므로 enum에 포함하지 않음)
CREATE TYPE award_type AS ENUM ('협력상', '도전상', '토큰상', '공감상');


-- =====================================================================
-- teams : 발표팀
-- =====================================================================
CREATE TABLE teams (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT         NOT NULL,
  presentation_order  INT          NOT NULL UNIQUE,         -- 발표 순서 (1, 2, 3, ...)
  status              team_status  NOT NULL DEFAULT '대기',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teams_order  ON teams(presentation_order);
CREATE INDEX idx_teams_status ON teams(status);

COMMENT ON TABLE  teams                     IS '발표팀 목록 (약 20팀)';
COMMENT ON COLUMN teams.presentation_order  IS '발표 순서 (1부터 시작, UNIQUE)';
COMMENT ON COLUMN teams.status              IS '대기 / 발표중 / 발표완료';


-- =====================================================================
-- judges : 심사위원 (사전 입력, 5명 고정)
-- =====================================================================
CREATE TABLE judges (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT         NOT NULL UNIQUE,
  special_award_type  award_type,                           -- 담당 특별상 (NULL 허용: 이동옥/정향모)
  display_order       INT          NOT NULL DEFAULT 0,      -- 화면 표시 순서
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 같은 특별상을 두 명이 담당할 수 없음 (공감상 제외: 공감상은 청중 투표)
CREATE UNIQUE INDEX uq_judges_special_award
  ON judges(special_award_type)
  WHERE special_award_type IS NOT NULL AND special_award_type <> '공감상';

COMMENT ON TABLE  judges                     IS '심사위원 (5명 사전 등록)';
COMMENT ON COLUMN judges.special_award_type  IS '담당 특별상 (협력상/도전상/토큰상). NULL이면 1~3위 심사만 담당.';


-- =====================================================================
-- scores : 1~3위 산정용 점수 (judge_id × team_id = 1행)
--           5명 × 약 20팀 = 최대 100행
-- =====================================================================
CREATE TABLE scores (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_id          UUID         NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  team_id           UUID         NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
  roi_score         INT          NOT NULL DEFAULT 0  CHECK (roi_score        BETWEEN 0 AND 40),
  efficiency_score  INT          NOT NULL DEFAULT 0  CHECK (efficiency_score BETWEEN 0 AND 30),
  completion_score  INT          NOT NULL DEFAULT 0  CHECK (completion_score BETWEEN 0 AND 30),
  -- 총점은 GENERATED 컬럼으로 자동 계산 (DB 일관성 보장)
  total_score       INT          GENERATED ALWAYS AS (roi_score + efficiency_score + completion_score) STORED,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- 한 심사위원이 한 팀에 대해 입력하는 점수는 1행 (UPSERT 대상)
  CONSTRAINT uq_scores_judge_team UNIQUE (judge_id, team_id)
);

CREATE INDEX idx_scores_team_id  ON scores(team_id);
CREATE INDEX idx_scores_judge_id ON scores(judge_id);

COMMENT ON TABLE  scores              IS '1~3위 산정용 점수 (UPSERT 운영)';
COMMENT ON COLUMN scores.roi_score    IS 'ROI 점수 (0~40)';
COMMENT ON COLUMN scores.total_score  IS '자동 계산: roi + efficiency + completion (최대 100)';


-- =====================================================================
-- special_votes : 심사위원의 특별상 선정 (협력상/도전상/토큰상)
--                  공감상은 empathy_votes 테이블 사용
-- =====================================================================
CREATE TABLE special_votes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_id    UUID         NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  team_id     UUID         NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
  award_type  award_type   NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- 공감상은 이 테이블에 들어오면 안 됨
  CONSTRAINT chk_special_votes_no_empathy CHECK (award_type <> '공감상'),

  -- 한 심사위원이 같은 상에 대해 선정한 팀은 1행 (변경 시 UPSERT)
  CONSTRAINT uq_special_votes_judge_award UNIQUE (judge_id, award_type)
);

CREATE INDEX idx_special_votes_award ON special_votes(award_type);
CREATE INDEX idx_special_votes_team  ON special_votes(team_id);

COMMENT ON TABLE special_votes IS '심사위원 특별상 선정 (협력상=강상우, 도전상=김형욱, 토큰상=Goos)';


-- =====================================================================
-- empathy_votes : 공감상 청중 투표 (1인 1표)
-- =====================================================================
CREATE TABLE empathy_votes (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_fingerprint   TEXT         NOT NULL UNIQUE,         -- 브라우저 fingerprint (중복 방지)
  team_id             UUID         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  voted_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_empathy_votes_team ON empathy_votes(team_id);

COMMENT ON TABLE empathy_votes IS '청중 공감상 투표 (브라우저 fingerprint로 1인 1표 보장)';


-- =====================================================================
-- settings : 전역 상태 (단일 행, 진행자가 제어)
-- =====================================================================
CREATE TABLE settings (
  id                    INT          PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- 단일 행 강제
  active_team_id        UUID         REFERENCES teams(id) ON DELETE SET NULL,
  scoring_open          BOOLEAN      NOT NULL DEFAULT FALSE,
  special_voting_open   BOOLEAN      NOT NULL DEFAULT FALSE,
  empathy_voting_open   BOOLEAN      NOT NULL DEFAULT FALSE,
  reveal_stage          INT          NOT NULL DEFAULT 0 CHECK (reveal_stage BETWEEN 0 AND 5),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  settings                     IS '전역 상태 (단일 행: id=1 강제)';
COMMENT ON COLUMN settings.active_team_id      IS '현재 발표 중인 팀';
COMMENT ON COLUMN settings.reveal_stage        IS '0=미공개, 1=특별상4종, 2=3위, 3=2위, 4=1위, 5=전체완료';

-- 초기 행 1건 삽입
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- =====================================================================
-- updated_at 자동 갱신 트리거
-- =====================================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_set_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER scores_set_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER special_votes_set_updated_at
  BEFORE UPDATE ON special_votes
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER settings_set_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();


-- =====================================================================
-- 검증 쿼리 (실행 후 확인용)
-- =====================================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;

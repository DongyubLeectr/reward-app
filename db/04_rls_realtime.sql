-- =====================================================================
-- 04_rls_realtime.sql
-- Row Level Security (RLS) 정책 + Supabase Realtime 발행
-- =====================================================================
--
-- 설계 방침:
--   - 이 시스템은 5/27 단일 행사용으로, 별도 Auth(로그인)를 두지 않는다.
--   - 익명(anon) 사용자도 점수 입력 / 투표가 가능해야 한다.
--   - 보안은 "공통 링크 + 이름 선택"으로 사실상 신뢰 기반 운영.
--   - 단, 무차별 INSERT/DELETE 방지를 위해 최소 정책은 둔다.
--   - 진행자 대시보드의 민감 작업(팀 status 변경, settings 변경)은
--     Service Role Key(서버 사이드)에서만 수행한다.
-- =====================================================================


-- =====================================================================
-- RLS 활성화
-- =====================================================================
ALTER TABLE teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE empathy_votes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings        ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- teams : 모두 읽기 가능, 쓰기는 service_role만
-- =====================================================================
CREATE POLICY teams_select_all ON teams
  FOR SELECT TO anon, authenticated USING (TRUE);

-- 쓰기는 service_role(서버)에서만 (정책 미정의 = 기본 거부)


-- =====================================================================
-- judges : 모두 읽기 가능, 쓰기는 service_role만
-- =====================================================================
CREATE POLICY judges_select_all ON judges
  FOR SELECT TO anon, authenticated USING (TRUE);


-- =====================================================================
-- scores : 모두 읽기 + UPSERT 가능 (행사 운영 편의)
--           ※ 실제 운영에선 Next.js Server Action 경유 권장
-- =====================================================================
CREATE POLICY scores_select_all ON scores
  FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY scores_insert_all ON scores
  FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY scores_update_all ON scores
  FOR UPDATE TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);


-- =====================================================================
-- special_votes : 모두 읽기 + UPSERT 가능
-- =====================================================================
CREATE POLICY special_votes_select_all ON special_votes
  FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY special_votes_insert_all ON special_votes
  FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY special_votes_update_all ON special_votes
  FOR UPDATE TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);


-- =====================================================================
-- empathy_votes : 모두 읽기 + 1회 INSERT 가능
--                  UPDATE는 정책 없음 (수정 불가, 1인 1표 고정)
-- =====================================================================
CREATE POLICY empathy_votes_select_all ON empathy_votes
  FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY empathy_votes_insert_all ON empathy_votes
  FOR INSERT TO anon, authenticated WITH CHECK (TRUE);


-- =====================================================================
-- settings : 모두 읽기, 쓰기는 service_role만 (진행자 대시보드 서버에서)
-- =====================================================================
CREATE POLICY settings_select_all ON settings
  FOR SELECT TO anon, authenticated USING (TRUE);


-- =====================================================================
-- Supabase Realtime 발행 등록
-- (Dashboard → Database → Replication에서 GUI로도 설정 가능)
-- =====================================================================
-- 기본적으로 supabase_realtime publication이 존재한다고 가정
DO $$
BEGIN
  -- 이미 등록되어 있어도 에러 나지 않도록 IF NOT EXISTS 패턴
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE teams, judges, scores, special_votes, empathy_votes, settings;
  ELSE
    -- 이미 존재하면 테이블만 추가 (에러 무시)
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE teams;          EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE judges;         EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE scores;         EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE special_votes;  EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE empathy_votes;  EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE settings;       EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;


-- =====================================================================
-- 검증
-- =====================================================================
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

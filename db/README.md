# db/ — Supabase 스키마 적용 가이드

이 폴더는 포상 진행 시스템의 Supabase(PostgreSQL) 스키마를 담고 있습니다.
4개 SQL 파일을 **순서대로** 실행하면 DB가 완성됩니다.

## 파일 구성

| 순서 | 파일 | 역할 |
|---|---|---|
| 1 | `01_schema.sql` | 테이블 6개 + ENUM + 트리거 생성 |
| 2 | `02_seed.sql` | 심사위원 5명 + 더미 팀 20개 INSERT |
| 3 | `03_views_functions.sql` | 집계 View + 1~3위 산정 로직 + UPSERT 함수 |
| 4 | `04_rls_realtime.sql` | RLS 정책 + Realtime 발행 등록 |

## 적용 절차 (Supabase 대시보드)

1. Supabase 프로젝트 생성 후 좌측 메뉴 **SQL Editor** 진입
2. **New query** 클릭
3. `01_schema.sql` 내용 전체 복사 → 붙여넣기 → **Run**
4. 같은 방식으로 `02 → 03 → 04` 순서로 실행
5. 좌측 **Table Editor**에서 6개 테이블이 생성되었는지 확인

## 적용 후 검증 쿼리 (SQL Editor에서 실행)

```sql
-- 1. 테이블 6개가 모두 생겼는지
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name;
-- 예상: empathy_votes, judges, scores, settings, special_votes, teams

-- 2. 심사위원 5명 / 팀 20개 확인
SELECT name, special_award_type FROM judges ORDER BY display_order;
SELECT COUNT(*) AS team_count FROM teams;  -- 20이 나와야 함

-- 3. View 동작 확인 (모두 0점으로 나오는 게 정상 — 아직 점수 미입력)
SELECT * FROM v_team_ranking LIMIT 5;
SELECT * FROM get_score_progress();

-- 4. Realtime 발행 확인
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- 예상: teams, judges, scores, special_votes, empathy_votes, settings
```

## 핵심 비즈니스 로직 매핑

| 요구사항 | 구현 위치 |
|---|---|
| 5명 점수 단순 합산 (최대 500점) | `v_team_scores.total_sum` |
| 동점 시 ROI 합산 우선 | `v_team_ranking` ORDER BY 절 |
| 1~3위 자동 산정 | `v_top3` View |
| 특별상 (협력/도전/토큰) | `v_special_award_winners` + 1~3위 충돌 alert |
| 공감상 (1~3위 제외 청중 투표 최다) | `v_empathy_ranking` |
| 점수 UPSERT | `upsert_score()` 함수 |
| 실시간 입력 현황 | `get_score_progress()` 함수 |
| 최종 결과 통합 조회 | `get_final_results()` 함수 |

## 운영 시 주의사항

- **재실행 주의**: `01_schema.sql`은 `DROP TABLE ... CASCADE`로 시작합니다. 프로덕션 데이터가 있는 상태에서 재실행하면 모두 사라집니다. 행사 당일에는 절대 재실행하지 마세요.
- **`.env.local` 환경변수** (Next.js 프로젝트에서 사용):
  - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
  - `SUPABASE_SERVICE_ROLE_KEY` = service role (서버 전용, 절대 클라이언트 노출 금지)
- **백업**: 행사 직전(5/26 저녁)에 Supabase Dashboard → Database → Backups에서 수동 백업 권장.

## 데이터 모델 ERD (간단)

```
teams ─┬─< scores >─┬── judges
       │            │
       ├─< special_votes >──┘
       │
       ├─< empathy_votes
       │
       └─< settings.active_team_id
```

- `<` 화살표는 N:1 관계 (왼쪽이 N)
- `scores` / `special_votes`는 (judge_id, team_id) 또는 (judge_id, award_type) 유니크 제약으로 UPSERT 운영

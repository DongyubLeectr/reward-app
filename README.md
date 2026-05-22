# Claude Cowork 사례발표회 — 포상 진행 시스템

2026-05-27 사내 발표회에서 사용할 **웹 기반 포상 진행 시스템**입니다.

심사위원 5명이 모바일로 점수를 입력하고, 진행자가 PC에서 실시간 집계를 보며 발표회를 운영하고, 결과는 대형 스크린에 드라마틱하게 송출됩니다.

## 주요 화면

| URL | 역할 |
|---|---|
| `/judge` | 심사위원 진입 (5명 이름 선택) |
| `/judge/score` | 심사위원 점수 입력 (슬라이더 + 특별상 선정) |
| `/vote` | 청중 공감상 투표 (QR로 접속) |
| `/result` | 결과 발표 화면 (대형 스크린, 단계별 공개) |
| `/[adminToken]` | 진행자 관리 대시보드 (비밀 URL) |

## 기술 스택

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL + Realtime)
- **드래그앤드롭**: @dnd-kit
- **배포**: Vercel

## 핵심 비즈니스 로직

- 5명 심사위원 × 약 20팀 점수 입력 → 합산 500점 만점
- 동점 시 ROI 점수 합산이 높은 팀 우선
- 1~3위 자동 산정, 특별상 4종은 1~3위 제외 팀 중 선정
- 결과 공개: 특별상 → 3위 → 2위 → 1위 순서 (드라마틱)

## 로컬 개발

```bash
cd app
npm install
cp .env.local.example .env.local
# .env.local 파일을 열어 Supabase URL/키, ADMIN_TOKEN 채우기
npm run dev
```

`http://localhost:3000` 에서 확인.

## 환경변수

자세한 설정은 `app/.env.local.example` 파일을 참고하세요.

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (브라우저 노출 OK) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (서버 전용) |
| `ADMIN_TOKEN` | 진행자 대시보드 비밀 경로 |

## DB 스키마 적용

Supabase 대시보드 SQL Editor에서 `db/01_schema.sql` → `02_seed.sql` → `03_views_functions.sql` → `04_rls_realtime.sql` → `05_add_is_submitted.sql` 순서대로 실행.

자세한 내용은 `db/README.md` 참고.

## 작업 지침

이 프로젝트의 작업 규칙과 핵심 로직은 [`CLAUDE.md`](./CLAUDE.md)에 정리되어 있습니다.

/**
 * /test — Supabase 연결 확인 페이지
 *
 * Phase 2 마무리용 스모크 테스트. 다음을 확인합니다:
 *   1. 환경변수가 잡혔는지
 *   2. judges 테이블에서 5명이 조회되는지
 *   3. teams 테이블에서 20팀이 조회되는지
 *   4. v_team_ranking View가 동작하는지
 *   5. settings 단일 행이 존재하는지
 *
 * Phase 3 이후에는 이 페이지를 지우거나 보호 처리하세요.
 */

import { getServerClient } from '@/lib/supabase/server';
import type {
  Judge,
  Team,
  TeamRankingRow,
  Settings,
} from '@/types/db';

// 서버 사이드에서 매 요청마다 새로 조회 (캐시 비활성화)
export const dynamic = 'force-dynamic';

export default async function TestPage() {
  const supabase = await getServerClient();

  // 병렬 조회
  const [
    { data: judges,   error: judgesErr   },
    { data: teams,    error: teamsErr    },
    { data: ranking,  error: rankingErr  },
    { data: settings, error: settingsErr },
  ] = await Promise.all([
    supabase.from('judges').select('*').order('display_order'),
    supabase.from('teams').select('*').order('presentation_order'),
    supabase.from('v_team_ranking').select('*').limit(5),
    supabase.from('settings').select('*').eq('id', 1).single(),
  ]);

  const checks = [
    {
      name: '심사위원 (judges)',
      ok: !judgesErr && judges?.length === 5,
      detail: judgesErr ? `에러: ${judgesErr.message}` : `${judges?.length ?? 0}명 조회됨`,
    },
    {
      name: '발표팀 (teams)',
      ok: !teamsErr && (teams?.length ?? 0) >= 1,
      detail: teamsErr ? `에러: ${teamsErr.message}` : `${teams?.length ?? 0}개 조회됨`,
    },
    {
      name: '순위 View (v_team_ranking)',
      ok: !rankingErr && Array.isArray(ranking),
      detail: rankingErr ? `에러: ${rankingErr.message}` : `${ranking?.length ?? 0}개 행 조회됨`,
    },
    {
      name: '전역 설정 (settings)',
      ok: !settingsErr && settings?.id === 1,
      detail: settingsErr ? `에러: ${settingsErr.message}` : `reveal_stage = ${settings?.reveal_stage}`,
    },
  ];

  const allOk = checks.every((c) => c.ok);

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">
          🔌 Supabase 연결 테스트
        </h1>
        <p className="mb-8 text-slate-600">
          Phase 2 스모크 테스트 페이지입니다. 모두 ✅이면 DB 연동 완료.
        </p>

        {/* 전체 상태 */}
        <div
          className={`mb-6 rounded-lg p-4 text-lg font-semibold ${
            allOk
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {allOk ? '✅ 모든 연결 정상' : '❌ 일부 항목 실패 — 아래 상세 확인'}
        </div>

        {/* 항목별 결과 */}
        <ul className="mb-8 space-y-3">
          {checks.map((c) => (
            <li
              key={c.name}
              className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4"
            >
              <div>
                <div className="font-medium text-slate-900">{c.name}</div>
                <div className="text-sm text-slate-600">{c.detail}</div>
              </div>
              <div className="text-2xl">{c.ok ? '✅' : '❌'}</div>
            </li>
          ))}
        </ul>

        {/* 심사위원 목록 */}
        <Section title="심사위원 목록">
          {judges && judges.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm text-slate-500">
                  <th className="py-2">순서</th>
                  <th>이름</th>
                  <th>담당 특별상</th>
                </tr>
              </thead>
              <tbody>
                {(judges as Judge[]).map((j) => (
                  <tr key={j.id} className="border-b border-slate-100">
                    <td className="py-2">{j.display_order}</td>
                    <td className="font-medium">{j.name}</td>
                    <td className="text-slate-600">
                      {j.special_award_type ?? '— (1~3위 심사만)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty />
          )}
        </Section>

        {/* 발표팀 목록 (최대 10개만 미리보기) */}
        <Section title={`발표팀 목록 (총 ${teams?.length ?? 0}팀)`}>
          {teams && teams.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {(teams as Team[]).slice(0, 12).map((t) => (
                <div
                  key={t.id}
                  className="rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <span className="text-slate-400">#{t.presentation_order}</span>{' '}
                  <span className="font-medium">{t.name}</span>
                </div>
              ))}
              {teams.length > 12 && (
                <div className="col-span-full text-center text-sm text-slate-500">
                  ... 외 {teams.length - 12}팀
                </div>
              )}
            </div>
          ) : (
            <Empty />
          )}
        </Section>

        {/* 순위 미리보기 */}
        <Section title="순위 View 미리보기 (점수 입력 전이라 모두 0점이 정상)">
          {ranking && ranking.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm text-slate-500">
                  <th className="py-2">순위</th>
                  <th>팀</th>
                  <th className="text-right">총점</th>
                  <th className="text-right">ROI 합</th>
                </tr>
              </thead>
              <tbody>
                {(ranking as TeamRankingRow[]).map((r) => (
                  <tr key={r.team_id} className="border-b border-slate-100">
                    <td className="py-2">{r.rank}</td>
                    <td className="font-medium">{r.team_name}</td>
                    <td className="text-right">{r.total_sum}</td>
                    <td className="text-right text-slate-500">{r.roi_sum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty />
          )}
        </Section>

        {/* 전역 설정 */}
        <Section title="전역 설정 (settings)">
          {settings ? (
            <pre className="overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">
              {JSON.stringify(settings as Settings, null, 2)}
            </pre>
          ) : (
            <Empty />
          )}
        </Section>

        <p className="mt-8 text-center text-xs text-slate-400">
          이 페이지는 Phase 2 스모크 테스트용입니다. 행사 전에는 삭제하거나 접근 차단하세요.
        </p>
      </div>
    </main>
  );
}

// =====================================================================
// 내부 컴포넌트
// =====================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <div className="text-sm text-slate-400">데이터 없음</div>;
}

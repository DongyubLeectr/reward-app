/**
 * /result — 결과 발표 화면 (대형 스크린 송출용)
 *
 * 1920×1080 풀스크린 기준. 진행자가 다른 창의 admin 대시보드에서
 * reveal_stage를 변경하면 Realtime으로 즉시 화면이 전환됩니다.
 *
 * reveal_stage:
 *   0 = 미공개 (대기 화면)
 *   1 = 특별상 4종
 *   2 = 3위
 *   3 = 2위
 *   4 = 1위 (드럼롤 + 컨페티)
 *   5 = 전체 요약
 */

import { getServerClient } from '@/lib/supabase/server';
import { getFinalResults } from '@/app/actions/results';
import type { Settings } from '@/types/db';
import { ResultDisplay } from './ResultDisplay';

export const dynamic = 'force-dynamic';

export default async function ResultPage() {
  const supabase = await getServerClient();

  const [{ data: settings, error: setErr }, results] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).single(),
    getFinalResults(),
  ]);

  if (setErr || !results.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="rounded-lg bg-rose-900 p-6">
          <h1 className="mb-2 text-lg font-bold">결과 데이터 로드 실패</h1>
          <pre className="text-xs">{setErr?.message ?? (results.ok ? '' : results.error)}</pre>
        </div>
      </main>
    );
  }

  return (
    <ResultDisplay
      initialSettings={settings as Settings}
      initialResults={results.data}
    />
  );
}

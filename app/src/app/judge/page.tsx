/**
 * /judge — 심사위원 진입 화면 (이름 선택)
 *
 * 모든 심사위원이 같은 URL로 접속합니다.
 * 본인 이름 카드를 누르면 쿠키에 judge_id가 저장되고 /judge/score로 리다이렉트.
 *
 * 이미 쿠키가 있으면 자동으로 /judge/score로 이동.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getServerClient } from '@/lib/supabase/server';
import type { Judge } from '@/types/db';
import { JudgeCard } from './JudgeCard';

export const dynamic = 'force-dynamic';

export default async function JudgeSelectPage() {
  // 1. 이미 선택된 심사위원이 있으면 바로 점수 입력 페이지로
  const cookieStore = await cookies();
  const existingJudgeId = cookieStore.get('judge_id')?.value;
  if (existingJudgeId) {
    redirect('/judge/score');
  }

  // 2. 심사위원 5명 조회
  const supabase = await getServerClient();
  const { data: judges, error } = await supabase
    .from('judges')
    .select('*')
    .order('display_order');

  if (error || !judges) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-lg bg-rose-50 p-6 text-rose-800">
          <h1 className="mb-2 text-lg font-bold">심사위원 정보를 불러올 수 없습니다.</h1>
          <p className="text-sm">{error?.message ?? '알 수 없는 오류'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-2 text-5xl">🏆</div>
          <h1 className="text-2xl font-bold text-slate-900">
            발표회 심사
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            본인 이름을 선택해주세요
          </p>
        </div>

        <div className="space-y-3">
          {(judges as Judge[]).map((judge) => (
            <JudgeCard key={judge.id} judge={judge} />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          2026.05.27 · Claude Cowork 사례발표회
        </p>
      </div>
    </main>
  );
}

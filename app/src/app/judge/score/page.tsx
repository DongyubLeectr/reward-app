/**
 * /judge/score — 심사위원 점수 입력 메인 화면
 *
 * Server Component에서 초기 데이터를 로드한 뒤
 * Client Component(ScoreEditor)에 넘겨 상호작용을 처리합니다.
 *
 * Phase 5에서 추가: special_votes (본인 선정) + v_top3 (1~3위 후보 제외용)
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getServerClient } from '@/lib/supabase/server';
import type { Judge, Team, Score, Settings, SpecialVote } from '@/types/db';
import { ScoreEditor } from './ScoreEditor';

export const dynamic = 'force-dynamic';

export default async function ScorePage() {
  // 1. 쿠키에서 judge_id 확인
  const cookieStore = await cookies();
  const judgeId     = cookieStore.get('judge_id')?.value;
  if (!judgeId) {
    redirect('/judge');
  }

  const supabase = await getServerClient();

  // 2. 병렬 조회
  const [
    { data: judge,        error: judgeErr    },
    { data: teams,        error: teamsErr    },
    { data: myScores,                         },
    { data: settings,     error: settingsErr },
    { data: mySpecial,                        },
    { data: top3,                             },
  ] = await Promise.all([
    supabase.from('judges').select('*').eq('id', judgeId).single(),
    supabase.from('teams').select('*').order('presentation_order'),
    supabase.from('scores').select('*').eq('judge_id', judgeId),
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('special_votes').select('*').eq('judge_id', judgeId),
    supabase.from('v_top3').select('team_id').order('rank'),
  ]);

  // 3. 본인 정보 못 찾으면 쿠키가 오염된 것 → 다시 선택 화면으로
  if (judgeErr || !judge) {
    redirect('/judge');
  }

  if (teamsErr || settingsErr) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-lg bg-rose-50 p-6 text-rose-800">
          <h1 className="mb-2 text-lg font-bold">데이터 로드 실패</h1>
          <p className="text-sm">{teamsErr?.message ?? settingsErr?.message}</p>
        </div>
      </main>
    );
  }

  return (
    <ScoreEditor
      judge={judge as Judge}
      teams={(teams ?? []) as Team[]}
      initialScores={(myScores ?? []) as Score[]}
      initialSettings={settings as Settings}
      initialSpecialVotes={(mySpecial ?? []) as SpecialVote[]}
      initialTop3TeamIds={(top3 ?? []).map((r) => r.team_id as string)}
    />
  );
}

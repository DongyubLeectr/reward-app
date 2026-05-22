/**
 * /vote — 공감상 청중 투표 페이지
 *
 * QR 코드로 접속하는 단일 페이지.
 * Server에서 팀 목록 + 1~3위 + settings를 로드하고,
 * Client(VotePanel)에서 fingerprint 기반 1인 1표를 처리합니다.
 *
 * empathy_voting_open이 OFF이면 안내 화면만 표시.
 */

import { getServerClient } from '@/lib/supabase/server';
import type { Team, Settings } from '@/types/db';
import { VotePanel } from './VotePanel';

export const dynamic = 'force-dynamic';

export default async function VotePage() {
  const supabase = await getServerClient();

  const [
    { data: teams,    error: teamsErr    },
    { data: settings, error: settingsErr },
    { data: top3,                         },
  ] = await Promise.all([
    supabase.from('teams').select('*').order('presentation_order'),
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('v_top3').select('team_id').order('rank'),
  ]);

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
    <VotePanel
      teams={(teams ?? []) as Team[]}
      initialSettings={settings as Settings}
      initialTop3TeamIds={(top3 ?? []).map((r) => r.team_id as string)}
    />
  );
}

/**
 * /[adminToken] — 진행자 대시보드 (비밀 URL)
 *
 * URL의 토큰이 ADMIN_TOKEN 환경변수와 일치할 때만 페이지 렌더링.
 * 일치하지 않으면 notFound() 호출 → 일반적인 404 페이지로 응답.
 *
 * Service Role 키로 데이터를 조회하기 위해 admin 클라이언트 사용.
 */

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getAdminClient } from '@/lib/supabase/admin';
import type { Team, Judge, Settings, TeamScoreRow } from '@/types/db';
import { AdminDashboard } from './AdminDashboard';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ adminToken: string }>;
}

export default async function AdminPage({ params }: Props) {
  const { adminToken } = await params;

  // 1) 토큰 검증
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || adminToken !== expected) {
    notFound(); // 404로 응답 — 외부에는 토큰 존재 여부도 노출되지 않음
  }

  // 1.5) 공감상 투표 URL 계산 (브라우저에 안내할 절대 URL)
  const reqHeaders = await headers();
  const host       = reqHeaders.get('host') ?? 'localhost:3000';
  const proto      = reqHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const voteUrl    = `${proto}://${host}/vote`;

  // 2) 데이터 조회 (Service Role 권한)
  const supabase = getAdminClient();
  const [
    { data: teams,    error: teamsErr   },
    { data: judges,   error: judgesErr  },
    { data: settings, error: settingsErr },
    { data: scoreView, error: viewErr   },
  ] = await Promise.all([
    supabase.from('teams').select('*').order('presentation_order'),
    supabase.from('judges').select('*').order('display_order'),
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('v_team_scores').select('*').order('presentation_order'),
  ]);

  if (teamsErr || judgesErr || settingsErr || viewErr) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-white">
        <div className="rounded-lg bg-rose-950 p-6">
          <h1 className="mb-2 text-lg font-bold">데이터 로드 실패</h1>
          <pre className="text-xs">
            {teamsErr?.message || judgesErr?.message || settingsErr?.message || viewErr?.message}
          </pre>
        </div>
      </main>
    );
  }

  return (
    <AdminDashboard
      initialTeams={(teams ?? []) as Team[]}
      judges={(judges ?? []) as Judge[]}
      initialSettings={settings as Settings}
      initialScoreView={(scoreView ?? []) as TeamScoreRow[]}
      voteUrl={voteUrl}
    />
  );
}

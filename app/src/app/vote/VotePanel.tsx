'use client';

/**
 * VotePanel — 공감상 청중 투표 UI (Client Component)
 *
 * 흐름:
 *   1. 마운트 시 fingerprint 생성/조회 + 서버에서 본인 투표 상태 조회
 *   2. empathy_voting_open이 OFF → 대기 안내 화면
 *   3. ON → 1~3위 제외 팀 카드 그리드 표시, 클릭하면 castEmpathyVote
 *   4. 이미 투표한 팀이 있으면 강조 표시, 다른 팀 클릭 시 변경 가능
 *   5. Realtime: settings.empathy_voting_open 변경 감지 + 1~3위 갱신
 */

import { useEffect, useState, useTransition } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { getOrCreateFingerprint } from '@/lib/fingerprint';
import { castEmpathyVote, getEmpathyVoteState } from '@/app/actions/votes';
import type { Team, Settings, EmpathyVote } from '@/types/db';

interface Props {
  teams: Team[];
  initialSettings: Settings;
  initialTop3TeamIds: string[];
}

export function VotePanel({ teams, initialSettings, initialTop3TeamIds }: Props) {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [votingOpen,  setVotingOpen]  = useState<boolean>(initialSettings.empathy_voting_open);
  const [top3,        setTop3]        = useState<string[]>(initialTop3TeamIds);
  const [myVote,      setMyVote]      = useState<EmpathyVote | null>(null);
  const [pending,     startTransition] = useTransition();
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);

  // -------------------------------------------------------------------
  // 마운트: fingerprint + 본인 투표 상태 로드
  // -------------------------------------------------------------------
  useEffect(() => {
    const fp = getOrCreateFingerprint();
    setFingerprint(fp);

    (async () => {
      const result = await getEmpathyVoteState(fp);
      if (result.ok) {
        setMyVote(result.data.myVote);
        setVotingOpen(result.data.votingOpen);
      }
      setLoading(false);
    })();
  }, []);

  // -------------------------------------------------------------------
  // Realtime: settings + scores 구독
  // -------------------------------------------------------------------
  useEffect(() => {
    const supabase = getBrowserClient();

    const refetchTop3 = async () => {
      const { data } = await supabase.from('v_top3').select('team_id').order('rank');
      if (data) setTop3(data.map((r) => r.team_id as string));
    };

    const channel = supabase
      .channel('vote-watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'id=eq.1' },
        (payload: { new: Settings }) => {
          setVotingOpen(payload.new.empathy_voting_open);
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        () => { void refetchTop3(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // -------------------------------------------------------------------
  // 투표 핸들러
  // -------------------------------------------------------------------
  const handleVote = (teamId: string) => {
    if (!fingerprint) return;
    if (top3.includes(teamId)) {
      setError('1~3위 팀은 공감상 대상이 아닙니다.');
      return;
    }
    if (teamId === myVote?.team_id) return;

    startTransition(async () => {
      setError(null);
      const result = await castEmpathyVote({ fingerprint, team_id: teamId });
      if (result.ok) {
        setMyVote(result.data);
      } else {
        setError(result.error);
      }
    });
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">불러오는 중...</div>
      </main>
    );
  }

  if (!votingOpen) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-pink-50 to-rose-50 px-6">
        <div className="text-center">
          <div className="mb-3 text-6xl">💗</div>
          <h1 className="mb-2 text-2xl font-bold text-rose-900">공감상 투표</h1>
          <p className="text-sm text-rose-700">
            아직 투표가 시작되지 않았습니다.
            <br />
            진행자의 안내를 기다려주세요.
          </p>
        </div>
      </main>
    );
  }

  const top3Set = new Set(top3);
  const candidates = teams.filter((t) => !top3Set.has(t.id));

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-rose-200 bg-rose-500 px-4 py-4 text-white shadow-md">
        <div className="mx-auto max-w-md text-center">
          <div className="text-2xl">💗 공감상 투표</div>
          <div className="mt-1 text-xs text-rose-100">
            1인 1표 · 가장 인상 깊었던 팀에 투표해주세요
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        {myVote ? (
          <div className="mb-4 rounded-lg bg-emerald-100 px-4 py-3 text-center text-sm text-emerald-800">
            ✓ 투표 완료 — 다른 팀을 클릭하면 변경할 수 있습니다
          </div>
        ) : (
          <p className="mb-4 px-1 text-sm text-rose-800">
            아래 팀 중 한 곳을 선택해주세요.
          </p>
        )}

        {error && (
          <div className="mb-3 rounded bg-rose-100 px-3 py-2 text-sm text-rose-700">
            ⚠ {error}
          </div>
        )}

        {candidates.length === 0 ? (
          <div className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">
            아직 후보 팀이 결정되지 않았습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {candidates.map((team) => {
              const isSelected = myVote?.team_id === team.id;
              return (
                <button
                  key={team.id}
                  onClick={() => handleVote(team.id)}
                  disabled={pending}
                  className={`
                    rounded-xl px-4 py-5 text-center transition shadow-sm
                    ${isSelected
                      ? 'bg-rose-500 text-white ring-2 ring-rose-300 scale-105'
                      : 'bg-white text-slate-800 hover:bg-rose-50'}
                    ${pending && !isSelected ? 'opacity-50' : ''}
                  `}
                >
                  <div className={`text-xs ${isSelected ? 'text-rose-100' : 'text-slate-400'}`}>
                    #{team.presentation_order}
                  </div>
                  <div className="mt-1 text-base font-bold">{team.name}</div>
                  {isSelected && (
                    <div className="mt-2 text-xs text-rose-100">✓ 선택됨</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-rose-400">
          1~3위 팀은 자동 제외됩니다 · 본인 기기만으로 1표 행사 가능
        </p>
      </div>
    </main>
  );
}

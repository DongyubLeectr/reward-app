'use client';

/**
 * ResultDisplay — 결과 발표 메인 UI (Client Component)
 *
 * - reveal_stage에 따라 5개 화면 분기 (대기/특별상/3위/2위/1위/요약)
 * - settings UPDATE Realtime 구독으로 화면 자동 전환
 * - scores·votes 변경 시 결과 재조회
 */

import { useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { getFinalResults, type FinalResults } from '@/app/actions/results';
import type { Settings } from '@/types/db';
import { WaitingStage }   from './stages/WaitingStage';
import { SpecialsStage }  from './stages/SpecialsStage';
import { RankStage }      from './stages/RankStage';
import { GrandPrizeStage } from './stages/GrandPrizeStage';
import { SummaryStage }   from './stages/SummaryStage';

interface Props {
  initialSettings: Settings;
  initialResults: FinalResults;
}

export function ResultDisplay({ initialSettings, initialResults }: Props) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [results,  setResults]  = useState<FinalResults>(initialResults);

  // Realtime: settings 변경 → 화면 전환 / scores·votes 변경 → 결과 재조회
  useEffect(() => {
    const supabase = getBrowserClient();

    const refetchResults = async () => {
      const r = await getFinalResults();
      if (r.ok) setResults(r.data);
    };

    const channel = supabase
      .channel('result-watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'id=eq.1' },
        (payload: { new: Settings }) => setSettings(payload.new)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        () => { void refetchResults(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'special_votes' },
        () => { void refetchResults(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'empathy_votes' },
        () => { void refetchResults(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // -------------------------------------------------------------------
  // 단계별 화면 분기
  // -------------------------------------------------------------------
  const stage = settings.reveal_stage;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-400 via-violet-500 to-orange-400 text-white">
      {/* 배경 장식 (모든 단계 공통) */}
      <BackgroundDecor />

      {/* 단계별 내용 */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-12 py-16">
        {stage === 0 && <WaitingStage />}
        {stage === 1 && <SpecialsStage specials={results.specials} />}
        {stage === 2 && (
          results.ranks.find((r) => r.rank === 3)
            ? <RankStage rank={3} winner={results.ranks.find((r) => r.rank === 3)!} />
            : <NoResultMessage />
        )}
        {stage === 3 && (
          results.ranks.find((r) => r.rank === 2)
            ? <RankStage rank={2} winner={results.ranks.find((r) => r.rank === 2)!} />
            : <NoResultMessage />
        )}
        {stage === 4 && (
          results.ranks.find((r) => r.rank === 1)
            ? <GrandPrizeStage winner={results.ranks.find((r) => r.rank === 1)!} />
            : <NoResultMessage />
        )}
        {stage === 5 && <SummaryStage results={results} />}
      </div>

      {/* 좌하단 표시 (디버깅용 - 발표회 직전엔 숨김 처리해도 됨) */}
      <div className="fixed bottom-3 left-3 z-50 rounded bg-black/20 px-2 py-1 text-xs text-white/70 backdrop-blur-sm">
        Stage {stage}
      </div>
    </main>
  );
}

// =====================================================================
// 공통 컴포넌트
// =====================================================================

/** 배경 장식: 떠다니는 빛 원 */
function BackgroundDecor() {
  return (
    <>
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-amber-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-pink-400/30 blur-3xl" />
    </>
  );
}

function NoResultMessage() {
  return (
    <div className="text-center">
      <div className="mb-4 text-7xl">🤔</div>
      <div className="text-3xl font-bold">아직 결과가 산정되지 않았습니다</div>
      <div className="mt-2 text-xl text-white/80">심사위원이 점수를 모두 제출했는지 확인해주세요</div>
    </div>
  );
}

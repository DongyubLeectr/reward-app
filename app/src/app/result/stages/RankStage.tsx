'use client';

/**
 * RankStage — reveal_stage=2 (3위) / reveal_stage=3 (2위)
 *
 * 메달 이모지 + 큰 팀명 + 점수 + 상금.
 * 등장 시 살짝 줌 인 + 페이드.
 */

import type { RankWinner } from '@/app/actions/results';

const RANK_CONFIG = {
  1: { emoji: '🥇', label: '1위', color: 'from-yellow-200 to-yellow-500' },
  2: { emoji: '🥈', label: '2위', color: 'from-slate-100 to-slate-400' },
  3: { emoji: '🥉', label: '3위', color: 'from-amber-200 to-orange-500' },
} as const;

export function RankStage({ rank, winner }: { rank: 1 | 2 | 3; winner: RankWinner }) {
  const cfg = RANK_CONFIG[rank];

  return (
    <div className="w-full max-w-5xl text-center">
      <div
        className="animate-[zoomFade_0.8s_ease-out_both] mb-8 text-9xl drop-shadow-2xl"
        style={{ animationDelay: '0ms' }}
      >
        {cfg.emoji}
      </div>

      <div
        className="animate-[zoomFade_0.8s_ease-out_both] mb-4"
        style={{ animationDelay: '300ms' }}
      >
        <span className={`bg-gradient-to-r ${cfg.color} bg-clip-text text-7xl font-black text-transparent drop-shadow`}>
          {cfg.label}
        </span>
      </div>

      <div
        className="animate-[zoomFade_0.8s_ease-out_both]"
        style={{ animationDelay: '700ms' }}
      >
        <div className="mb-6 text-[8rem] font-black leading-tight drop-shadow-2xl">
          {winner.team_name}
        </div>

        <div className="inline-flex items-baseline gap-6 rounded-full bg-white/20 px-10 py-4 text-3xl font-bold backdrop-blur">
          <span>합산 {winner.total_sum}점 / 500점</span>
          <span className="text-white/70">·</span>
          <span className="text-yellow-100">상금 {winner.prize_won}만원</span>
        </div>
      </div>

      <style>{`
        @keyframes zoomFade {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

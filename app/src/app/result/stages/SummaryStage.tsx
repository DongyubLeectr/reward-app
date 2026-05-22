'use client';

/**
 * SummaryStage — reveal_stage=5
 *
 * 1~3위 + 특별상 4종을 한 화면에 정리해서 표시.
 * 사진 촬영이나 행사 마무리 멘트 시 띄워둘 수 있음.
 */

import type { FinalResults } from '@/app/actions/results';

const AWARD_EMOJI: Record<string, string> = {
  '협력상': '🤝',
  '도전상': '🚀',
  '토큰상': '🪙',
  '공감상': '💗',
};

const RANK_EMOJI = { 1: '🥇', 2: '🥈', 3: '🥉' } as const;

export function SummaryStage({ results }: { results: FinalResults }) {
  return (
    <div className="w-full max-w-7xl">
      <h1 className="mb-10 text-center text-6xl font-black drop-shadow-lg">
        🎊 수상자 명단 🎊
      </h1>

      {/* 1~3위 */}
      <section className="mb-10">
        <h2 className="mb-4 text-center text-2xl font-bold text-white/80">대상</h2>
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((r) => {
            const w = results.ranks.find((x) => x.rank === r);
            return (
              <div
                key={r}
                className={`
                  rounded-2xl bg-white/20 p-6 text-center backdrop-blur
                  ${r === 1 ? 'ring-4 ring-yellow-300' : ''}
                `}
              >
                <div className="mb-3 text-6xl">{RANK_EMOJI[r as 1 | 2 | 3]}</div>
                <div className="mb-2 text-2xl font-bold text-white/80">
                  {r === 1 ? '대상' : `${r}위`}
                </div>
                <div className="mb-2 text-3xl font-black drop-shadow">
                  {w?.team_name ?? '—'}
                </div>
                {w && (
                  <div className="text-sm text-white/80">
                    {w.total_sum}점 · {w.prize_won}만원
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 특별상 4종 */}
      <section>
        <h2 className="mb-4 text-center text-2xl font-bold text-white/80">특별상</h2>
        <div className="grid grid-cols-4 gap-4">
          {results.specials.map((s) => (
            <div
              key={s.award_type}
              className="rounded-2xl bg-white/15 p-5 text-center backdrop-blur"
            >
              <div className="mb-2 text-4xl">{AWARD_EMOJI[s.award_type]}</div>
              <div className="mb-1 text-lg font-bold text-white/80">{s.award_type}</div>
              <div className="text-xl font-black drop-shadow">
                {s.team_name ?? '—'}
              </div>
              <div className="mt-1 text-xs text-white/70">{s.detail}</div>
              <div className="mt-2 text-xs text-yellow-100">{s.prize_won}만원</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

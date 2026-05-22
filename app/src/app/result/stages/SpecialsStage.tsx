'use client';

/**
 * SpecialsStage — reveal_stage=1
 *
 * 협력상 → 도전상 → 토큰상 → 공감상 순서로 카드가 자동 등장.
 * 각 카드는 1초 간격으로 페이드 인 + 살짝 위로 슬라이드.
 */

import type { SpecialAwardWinner } from '@/app/actions/results';

const AWARD_EMOJI: Record<SpecialAwardWinner['award_type'], string> = {
  '협력상': '🤝',
  '도전상': '🚀',
  '토큰상': '🪙',
  '공감상': '💗',
};

const AWARD_COLOR: Record<SpecialAwardWinner['award_type'], string> = {
  '협력상': 'from-emerald-300 to-teal-500',
  '도전상': 'from-orange-300 to-red-500',
  '토큰상': 'from-yellow-300 to-amber-500',
  '공감상': 'from-pink-300 to-rose-500',
};

export function SpecialsStage({ specials }: { specials: SpecialAwardWinner[] }) {
  return (
    <div className="w-full">
      <h1 className="mb-12 text-center text-6xl font-black drop-shadow-lg">
        ✨ 특별상 ✨
      </h1>

      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8">
        {specials.map((s, i) => (
          <SpecialCard key={s.award_type} award={s} delay={i * 700} />
        ))}
      </div>
    </div>
  );
}

function SpecialCard({ award, delay }: { award: SpecialAwardWinner; delay: number }) {
  return (
    <div
      className={`
        rounded-3xl bg-gradient-to-br ${AWARD_COLOR[award.award_type]}
        p-8 shadow-2xl
        animate-[slideUpFade_0.8s_ease-out_both]
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-2 flex items-baseline gap-4">
        <span className="text-6xl drop-shadow-lg">{AWARD_EMOJI[award.award_type]}</span>
        <span className="text-4xl font-black drop-shadow">{award.award_type}</span>
        <span className="ml-auto rounded-full bg-white/30 px-3 py-1 text-lg font-bold backdrop-blur">
          {award.prize_won}만원
        </span>
      </div>

      <div className="mt-6">
        {award.team_name ? (
          <>
            <div className="text-5xl font-black drop-shadow-lg">{award.team_name}</div>
            <div className="mt-3 text-lg text-white/90">{award.detail}</div>
          </>
        ) : (
          <div className="text-3xl font-bold text-white/70">{award.detail}</div>
        )}
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

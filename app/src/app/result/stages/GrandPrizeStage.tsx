'use client';

/**
 * GrandPrizeStage — reveal_stage=4 (1위)
 *
 * 연출 흐름 (총 약 4초):
 *   ① 0~2.5초: 드럼롤 — "두구두구두구" 텍스트 + 진동하는 트로피
 *   ② 2.5초~: 트로피 확대 + 팀명 등장 (대문자, 발광)
 *   ③ 컨페티 파티클 + 반짝이는 별들이 화면 전체에 흩어짐
 *
 * 외부 라이브러리 없이 순수 CSS/SVG 애니메이션으로 구현.
 */

import { useEffect, useState, useMemo } from 'react';
import type { RankWinner } from '@/app/actions/results';

const DRUMROLL_DURATION_MS = 2500;

export function GrandPrizeStage({ winner }: { winner: RankWinner }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), DRUMROLL_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* 컨페티 + 반짝임 (reveal 후에만 표시) */}
      {revealed && (
        <>
          <ConfettiRain />
          <SparkleField />
        </>
      )}

      <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
        {!revealed ? <Drumroll /> : <Reveal winner={winner} />}
      </div>
    </div>
  );
}

// =====================================================================
// 드럼롤 단계
// =====================================================================
function Drumroll() {
  return (
    <>
      <div className="mb-8 animate-[shake_0.15s_infinite] text-[14rem] drop-shadow-2xl">
        🏆
      </div>
      <div className="text-6xl font-black tracking-wider text-white drop-shadow-lg">
        대상 발표
      </div>
      <div className="mt-8 flex gap-3 text-5xl font-black tracking-wide">
        <DrumDot delay={0}   text="두" />
        <DrumDot delay={150} text="구" />
        <DrumDot delay={300} text="두" />
        <DrumDot delay={450} text="구" />
        <DrumDot delay={600} text="두" />
        <DrumDot delay={750} text="구" />
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          25%      { transform: translate(-4px, 2px); }
          50%      { transform: translate(4px, -2px); }
          75%      { transform: translate(-2px, 4px); }
        }
        @keyframes bounceFade {
          0%, 100% { opacity: 0.5; transform: translateY(0); }
          50%      { opacity: 1; transform: translateY(-8px); }
        }
      `}</style>
    </>
  );
}

function DrumDot({ delay, text }: { delay: number; text: string }) {
  return (
    <span
      className="animate-[bounceFade_0.8s_ease-in-out_infinite] drop-shadow"
      style={{ animationDelay: `${delay}ms` }}
    >
      {text}
    </span>
  );
}

// =====================================================================
// 공개 단계
// =====================================================================
function Reveal({ winner }: { winner: RankWinner }) {
  return (
    <>
      <div className="animate-[zoomBounce_0.9s_ease-out] mb-6 text-[18rem] leading-none drop-shadow-2xl">
        🏆
      </div>
      <div className="animate-[fadeIn_0.6s_ease-out_0.5s_both] mb-4 text-6xl font-black text-yellow-100 drop-shadow">
        🎉 대상 🎉
      </div>
      <div
        className="animate-[fadeInUp_0.8s_ease-out_0.8s_both] text-[10rem] font-black leading-none drop-shadow-[0_0_30px_rgba(253,224,71,0.8)]"
        style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 50%, #f59e0b 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {winner.team_name}
      </div>
      <div className="animate-[fadeIn_0.6s_ease-out_1.3s_both] mt-8 inline-flex items-baseline gap-6 rounded-full bg-white/20 px-12 py-5 text-3xl font-bold backdrop-blur">
        <span>합산 {winner.total_sum}점 / 500점</span>
        <span className="text-white/70">·</span>
        <span className="text-yellow-200">상금 {winner.prize_won}만원</span>
      </div>

      <style>{`
        @keyframes zoomBounce {
          0%   { opacity: 0; transform: scale(0.3); }
          60%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// =====================================================================
// 컨페티 (떨어지는 색종이 조각)
// =====================================================================
function ConfettiRain() {
  // 60개 조각, 각자 다른 위치/색/지연/회전 속도
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, () => ({
        left:     Math.random() * 100,
        delay:    Math.random() * 3,
        duration: 3 + Math.random() * 3,
        rotate:   Math.random() * 360,
        color: [
          '#fde047', // yellow
          '#f472b6', // pink
          '#60a5fa', // blue
          '#34d399', // emerald
          '#fb923c', // orange
          '#a78bfa', // violet
        ][Math.floor(Math.random() * 6)],
        size: 8 + Math.random() * 8,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute -top-4 block"
          style={{
            left:             `${p.left}%`,
            width:            `${p.size}px`,
            height:           `${p.size * 0.5}px`,
            background:       p.color,
            animation:        `confettiFall ${p.duration}s linear ${p.delay}s infinite`,
            transform:        `rotate(${p.rotate}deg)`,
          }}
        />
      ))}

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

// =====================================================================
// 반짝임 별 효과 (배경에 흩뿌려진 작은 별들)
// =====================================================================
function SparkleField() {
  const sparkles = useMemo(
    () =>
      Array.from({ length: 30 }, () => ({
        top:   Math.random() * 100,
        left:  Math.random() * 100,
        delay: Math.random() * 2,
        size:  4 + Math.random() * 6,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0">
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="absolute block"
          style={{
            top:        `${s.top}%`,
            left:       `${s.left}%`,
            width:      `${s.size}px`,
            height:     `${s.size}px`,
            background: 'radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 70%)',
            animation:  `sparkle 1.5s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      <style>{`
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50%      { opacity: 1; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}

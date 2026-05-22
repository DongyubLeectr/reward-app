'use client';

/**
 * WaitingStage — reveal_stage=0
 *
 * 결과 발표 시작 전에 띄워두는 대기 화면.
 * 발표회 시작 ~ 심사 마감 동안 풀스크린에 띄워둘 수 있음.
 */

export function WaitingStage() {
  return (
    <div className="text-center">
      <div className="mb-6 animate-bounce text-9xl drop-shadow-2xl">🏆</div>
      <h1 className="mb-4 text-7xl font-black tracking-tight drop-shadow-lg">
        Claude Cowork 사례발표회
      </h1>
      <p className="text-3xl font-medium text-white/90 drop-shadow">
        잠시 후 결과를 발표하겠습니다
      </p>
      <div className="mt-10 flex justify-center gap-3">
        <Dot delay={0} />
        <Dot delay={200} />
        <Dot delay={400} />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <div
      className="h-4 w-4 animate-pulse rounded-full bg-white"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

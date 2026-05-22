'use client';

/**
 * VoteQRSection — 공감상 투표 QR 코드 표시 섹션
 *
 * - 진행자가 발표회장 스크린에 송출할 수 있도록 큼지막한 QR 표시
 * - 클릭 시 풀스크린 모달로 확대 (관객이 멀리서도 스캔 가능)
 * - QR 이미지는 외부 무료 API(api.qrserver.com) 사용 — 별도 라이브러리 불필요
 * - 사내 네트워크에서 외부 API 차단되어 있으면 폴백으로 URL 텍스트만 표시
 */

import { useEffect, useState } from 'react';

interface Props {
  voteUrl: string; // 예: http://10.10.164.167:3000/vote 또는 https://[도메인]/vote
}

export function VoteQRSection({ voteUrl }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // QR 코드 이미지 URL (외부 API)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(voteUrl)}`;

  // ESC로 풀스크린 닫기
  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expanded]);

  return (
    <>
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-slate-900">📱 공감상 투표 QR</h2>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* QR 이미지 */}
          <div className="shrink-0">
            {imgError ? (
              <div className="flex h-40 w-40 items-center justify-center rounded border border-rose-200 bg-rose-50 text-center text-xs text-rose-600">
                QR 이미지를 불러올 수 없습니다.
                <br />
                URL을 직접 공유하세요.
              </div>
            ) : (
              <button
                onClick={() => setExpanded(true)}
                className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-50"
                title="클릭하면 풀스크린으로 확대"
              >
                <img
                  src={qrSrc}
                  width={160}
                  height={160}
                  alt="공감상 투표 QR 코드"
                  className="block"
                  onError={() => setImgError(true)}
                />
              </button>
            )}
          </div>

          <div className="flex-1 space-y-2 text-sm text-slate-600">
            <div>
              <div className="text-xs text-slate-400">접속 URL</div>
              <div className="break-all font-mono text-slate-900">{voteUrl}</div>
            </div>
            <p className="text-xs text-slate-500">
              발표회장 스크린에 QR을 띄우려면 위 QR 이미지를 클릭해 풀스크린으로 확대하세요.
              <br />
              참석자가 스마트폰 카메라로 스캔하면 투표 페이지가 열립니다.
            </p>
            <button
              onClick={() => setExpanded(true)}
              className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              풀스크린으로 표시
            </button>
          </div>
        </div>
      </section>

      {/* 풀스크린 모달 */}
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-8"
        >
          <div className="mb-6 text-center">
            <div className="text-3xl font-bold text-slate-900">💗 공감상 투표</div>
            <div className="mt-2 text-base text-slate-600">
              스마트폰 카메라로 QR을 스캔해 주세요
            </div>
          </div>
          <img
            src={qrSrc}
            alt="공감상 투표 QR 코드 (풀스크린)"
            className="h-[60vh] max-h-[600px] w-auto"
          />
          <div className="mt-6 break-all font-mono text-lg text-slate-700">{voteUrl}</div>
          <div className="mt-8 text-sm text-slate-400">화면 아무 곳이나 클릭하면 닫힙니다 (ESC)</div>
        </div>
      )}
    </>
  );
}

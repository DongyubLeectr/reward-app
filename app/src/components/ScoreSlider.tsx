'use client';

/**
 * ScoreSlider — 점수 입력용 슬라이더 (모바일 친화적)
 *
 * - 정수 단위만 (step=1)
 * - 큰 터치 영역 (h-3 슬라이더 + 큰 thumb)
 * - 현재 값 우상단에 큼지막하게 표시
 * - 색상은 값에 따라 그라데이션 (낮을수록 회색, 높을수록 강조색)
 */

import { useId } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  hint?: string;          // 항목 설명 (예: "반복성, 투입공수 절감 가치")
  disabled?: boolean;
  accent?: 'sky' | 'emerald' | 'amber'; // 색깔 테마
}

const ACCENT_CLASSES: Record<NonNullable<Props['accent']>, {
  bar:   string;
  thumb: string;
  text:  string;
}> = {
  sky:     { bar: 'accent-sky-600',     thumb: 'bg-sky-600',     text: 'text-sky-700' },
  emerald: { bar: 'accent-emerald-600', thumb: 'bg-emerald-600', text: 'text-emerald-700' },
  amber:   { bar: 'accent-amber-600',   thumb: 'bg-amber-600',   text: 'text-amber-700' },
};

export function ScoreSlider({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  disabled = false,
  accent = 'sky',
}: Props) {
  const id     = useId();
  const colors = ACCENT_CLASSES[accent];
  const ratio  = (value - min) / (max - min); // 0~1

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-base font-semibold text-slate-800">
          {label}
        </label>
        <div className={`flex items-baseline gap-1 ${colors.text}`}>
          <span className="text-4xl font-bold tabular-nums">{value}</span>
          <span className="text-sm text-slate-400">/ {max}</span>
        </div>
      </div>

      {hint && (
        <p className="mb-4 text-xs text-slate-500">{hint}</p>
      )}

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`
          h-3 w-full cursor-pointer appearance-none rounded-full
          bg-slate-200 ${colors.bar}
          disabled:cursor-not-allowed disabled:opacity-50
        `}
        // iOS 사파리 등에서 슬라이더 터치 영역을 키우기 위한 추가 스타일
        style={{
          // 가능하면 모바일에서 thumb이 손가락에 잘 잡히도록
          WebkitAppearance: 'none',
        }}
      />

      {/* 0 / 중간값 / max 라벨 (시각적 가이드) */}
      <div className="mt-2 flex justify-between text-xs text-slate-400 tabular-nums">
        <span>{min}</span>
        <span>{Math.round((min + max) / 2)}</span>
        <span>{max}</span>
      </div>

      {/* 진행 비율 표시 (배경 바 — 슬라이더는 그대로 두고 시각적 보조) */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${colors.thumb} transition-all`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

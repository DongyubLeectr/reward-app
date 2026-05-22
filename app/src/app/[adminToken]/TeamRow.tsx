'use client';

/**
 * TeamRow — 발표 순서 리스트의 한 행
 *   - 좌측 드래그 핸들
 *   - 발표 순서 #N
 *   - 팀 이름 (클릭 시 인라인 편집)
 *   - 상태 뱃지
 *   - 점수 입력 진행 표시 (N/5)
 */

import { useState, useTransition, forwardRef, type HTMLAttributes } from 'react';
import { renameTeam, setActiveTeam } from '@/app/actions/admin';
import type { Team, TeamScoreRow } from '@/types/db';

interface Props extends HTMLAttributes<HTMLDivElement> {
  team: Team;
  score: TeamScoreRow | undefined;
  isActive: boolean;
  totalJudges: number;
  /** 드래그 핸들 전용 listeners (dnd-kit에서 주입) */
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

const STATUS_BADGE: Record<Team['status'], { label: string; cls: string }> = {
  '대기':     { label: '대기',     cls: 'bg-slate-100 text-slate-600' },
  '발표중':   { label: '발표중',   cls: 'bg-sky-100 text-sky-700 ring-1 ring-sky-300' },
  '발표완료': { label: '완료',     cls: 'bg-emerald-100 text-emerald-700' },
};

export const TeamRow = forwardRef<HTMLDivElement, Props>(function TeamRow(
  { team, score, isActive, totalJudges, dragHandleProps, ...rest },
  ref
) {
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(team.name);
  const [pending,  startTransition] = useTransition();

  const handleSaveName = () => {
    if (draft.trim() === team.name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const r = await renameTeam(team.id, draft);
      if (!r.ok) {
        alert(`팀명 변경 실패: ${r.error}`);
        setDraft(team.name);
      }
      setEditing(false);
    });
  };

  const handleSetActive = () => {
    if (!confirm(`"${team.name}"을(를) 강제로 발표 중 상태로 만들까요? 이전 발표 중 팀은 완료 처리됩니다.`)) return;
    startTransition(async () => {
      const r = await setActiveTeam(team.id);
      if (!r.ok) alert(`실패: ${r.error}`);
    });
  };

  const submitted = score?.submitted_judges ?? 0;
  const drafted   = (score?.scored_judges ?? 0) - submitted;
  const badge     = STATUS_BADGE[team.status];

  return (
    <div
      ref={ref}
      {...rest}
      className={`
        flex items-center gap-3 rounded-lg border bg-white px-3 py-3 transition
        ${isActive ? 'border-sky-400 ring-1 ring-sky-200' : 'border-slate-200'}
        ${rest.className ?? ''}
      `}
    >
      {/* 드래그 핸들 */}
      <button
        {...dragHandleProps}
        className="cursor-grab touch-none px-1 text-slate-400 hover:text-slate-700 active:cursor-grabbing"
        aria-label="드래그로 순서 변경"
      >
        ⋮⋮
      </button>

      {/* 순서 */}
      <div className="w-10 text-center text-sm font-bold text-slate-400 tabular-nums">
        #{team.presentation_order}
      </div>

      {/* 팀 이름 (인라인 편집) */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  handleSaveName();
              if (e.key === 'Escape') { setDraft(team.name); setEditing(false); }
            }}
            disabled={pending}
            className="w-full rounded border border-sky-400 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="truncate text-left text-sm font-semibold text-slate-900 hover:text-sky-600"
          >
            {team.name}
          </button>
        )}
      </div>

      {/* 진행 상태 표시 */}
      <div className="hidden items-center gap-1 sm:flex">
        {Array.from({ length: submitted }).map((_, i) => (
          <span key={`s-${i}`} className="text-sm text-emerald-500">●</span>
        ))}
        {Array.from({ length: drafted }).map((_, i) => (
          <span key={`d-${i}`} className="text-sm text-amber-500">●</span>
        ))}
        {Array.from({ length: Math.max(totalJudges - submitted - drafted, 0) }).map((_, i) => (
          <span key={`r-${i}`} className="text-sm text-slate-300">○</span>
        ))}
      </div>

      <div className="w-14 text-right text-xs text-slate-500 tabular-nums">
        {submitted}/{totalJudges}
      </div>

      {/* 상태 뱃지 */}
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
        {badge.label}
      </span>

      {/* 강제 활성화 버튼 (대기/완료 팀에서만) */}
      {!isActive && (
        <button
          onClick={handleSetActive}
          disabled={pending}
          className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-sky-600"
          title="이 팀을 강제로 발표중 상태로"
        >
          ▶
        </button>
      )}
    </div>
  );
});

'use client';

/**
 * TeamSortableList — 발표 순서 리스트 (드래그앤드롭 가능)
 *
 * @dnd-kit/core + @dnd-kit/sortable 기반.
 * 드래그가 끝나면 reorderTeams Server Action을 호출해 DB에 반영.
 */

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderTeams } from '@/app/actions/admin';
import { TeamRow } from './TeamRow';
import type { Team, TeamScoreRow } from '@/types/db';

interface Props {
  teams: Team[];
  scoreView: TeamScoreRow[];
  activeTeamId: string | null;
  totalJudges: number;
  onTeamsChange: (teams: Team[]) => void;
}

export function TeamSortableList({
  teams, scoreView, activeTeamId, totalJudges, onTeamsChange,
}: Props) {
  const [saving, setSaving] = useState(false);

  // 모바일·키보드 접근성 함께 지원
  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,    { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const scoreById = new Map(scoreView.map((s) => [s.team_id, s]));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = teams.findIndex((t) => t.id === active.id);
    const newIndex = teams.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Optimistic UI: 먼저 화면을 갱신
    const reordered = arrayMove(teams, oldIndex, newIndex).map((t, i) => ({
      ...t,
      presentation_order: i + 1,
    }));
    onTeamsChange(reordered);

    // 서버에 반영
    setSaving(true);
    const r = await reorderTeams(reordered.map((t) => t.id));
    setSaving(false);
    if (!r.ok) {
      alert(`순서 변경 실패: ${r.error}`);
      // 실패 시 Realtime 구독이 곧 원본을 다시 받아오므로 별도 롤백 불필요
    }
  };

  return (
    <>
      {saving && (
        <div className="mb-2 text-xs text-amber-600">⏳ 순서 저장 중...</div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={teams.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {teams.map((team) => (
              <SortableTeamRow
                key={team.id}
                team={team}
                score={scoreById.get(team.id)}
                isActive={team.id === activeTeamId}
                totalJudges={totalJudges}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
}

// =====================================================================
// SortableTeamRow — useSortable 훅을 적용한 래퍼
// =====================================================================
function SortableTeamRow({
  team, score, isActive, totalJudges,
}: {
  team: Team; score: TeamScoreRow | undefined; isActive: boolean; totalJudges: number;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: team.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:  isDragging ? 0.6 : 1,
    zIndex:   isDragging ? 10 : 'auto' as const,
  };

  return (
    <TeamRow
      ref={setNodeRef}
      style={style}
      team={team}
      score={score}
      isActive={isActive}
      totalJudges={totalJudges}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

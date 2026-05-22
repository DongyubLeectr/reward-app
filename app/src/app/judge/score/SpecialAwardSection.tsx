'use client';

/**
 * SpecialAwardSection — 특별상 후보 선정 섹션
 *
 *   - special_voting_open이 ON이고 본인이 담당 특별상이 있을 때만 렌더링
 *   - 1~3위 팀은 카드 회색 처리 + 클릭 불가
 *   - 선택한 팀은 강조 표시 (UPSERT)
 *
 * 대상 심사위원: 강상우(협력상), 김형욱(도전상), Goos(토큰상)
 */

import { useState, useTransition } from 'react';
import { selectSpecialAward } from '@/app/actions/votes';
import type { Judge, Team, SpecialVote, AwardType } from '@/types/db';

interface Props {
  judge: Judge;
  teams: Team[];
  top3TeamIds: string[];
  mySpecialVote: SpecialVote | null;
  onVoted: (vote: SpecialVote) => void;
}

export function SpecialAwardSection({
  judge, teams, top3TeamIds, mySpecialVote, onVoted,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error,   setError]        = useState<string | null>(null);

  // 본인 담당 특별상이 없으면 (이동옥/정향모) 섹션 자체를 렌더링하지 않음
  // judge.special_award_type 타입이 이미 '공감상'을 제외하므로 null 체크만 하면 충분
  if (!judge.special_award_type) {
    return null;
  }
  const awardType: Exclude<AwardType, '공감상'> = judge.special_award_type;

  const selectedTeamId = mySpecialVote?.team_id ?? null;
  const top3Set = new Set(top3TeamIds);

  const handleSelect = (teamId: string) => {
    if (top3Set.has(teamId)) {
      setError('1~3위에 든 팀은 특별상 후보가 될 수 없습니다.');
      return;
    }
    if (teamId === selectedTeamId) return; // 이미 선택된 팀

    startTransition(async () => {
      setError(null);
      const result = await selectSpecialAward({
        judge_id:   judge.id,
        team_id:    teamId,
        award_type: awardType,
      });
      if (result.ok) {
        onVoted(result.data);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <section className="mt-8 rounded-xl bg-amber-50 p-5 ring-1 ring-amber-200">
      <h2 className="mb-1 text-lg font-bold text-amber-900">
        ★ {awardType} 선정
      </h2>
      <p className="mb-4 text-sm text-amber-800">
        1~3위에 들지 못한 팀 중에서 한 팀을 선정해주세요. 언제든지 다시 바꿀 수 있습니다.
      </p>

      {error && (
        <div className="mb-3 rounded bg-rose-100 px-3 py-2 text-sm text-rose-700">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {teams.map((team) => {
          const isTop3    = top3Set.has(team.id);
          const isSelected = selectedTeamId === team.id;
          const disabled   = isTop3 || pending;

          return (
            <button
              key={team.id}
              onClick={() => handleSelect(team.id)}
              disabled={disabled}
              className={`
                relative flex items-center justify-between rounded-lg border px-3 py-3 text-left text-sm transition
                ${isSelected
                  ? 'border-amber-500 bg-amber-100 font-semibold text-amber-900 ring-2 ring-amber-400'
                  : isTop3
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                    : 'border-amber-300 bg-white text-slate-800 hover:bg-amber-50'}
                ${pending && !isSelected ? 'opacity-50' : ''}
              `}
              title={isTop3 ? '1~3위 팀은 선정할 수 없습니다' : ''}
            >
              <span className="truncate">
                <span className="mr-1 text-xs text-slate-400">#{team.presentation_order}</span>
                {team.name}
              </span>
              {isSelected && <span className="text-amber-600">✓</span>}
              {isTop3     && !isSelected && <span className="text-xs text-slate-400">1~3위</span>}
            </button>
          );
        })}
      </div>

      {selectedTeamId && (
        <p className="mt-4 text-sm font-semibold text-amber-900">
          ✓ 현재 선정 팀: {teams.find((t) => t.id === selectedTeamId)?.name ?? '?'}
        </p>
      )}
    </section>
  );
}

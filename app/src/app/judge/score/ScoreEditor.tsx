'use client';

/**
 * ScoreEditor — 심사위원 점수 입력 메인 UI (Client Component)
 *
 * 주요 책임:
 *   1. 슬라이더 상태 관리 (선택된 팀의 ROI/효율화/완성도)
 *   2. 자동 저장 (debounce 2초) → saveScoreDraft Server Action
 *   3. 제출 버튼 → submitScore Server Action
 *   4. Realtime 구독: settings.active_team_id가 바뀌면 화면 자동 전환
 *   5. 본인 점수 팀 리스트 (제출/드래프트/미입력 상태 구분)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import { ScoreSlider } from '@/components/ScoreSlider';
import { saveScoreDraft, submitScore } from '@/app/actions/scores';
import { clearJudgeCookie } from '../actions';
import { SpecialAwardSection } from './SpecialAwardSection';
import type { Judge, Team, Score, Settings, SpecialVote } from '@/types/db';

const AUTOSAVE_DEBOUNCE_MS = 2000;

interface Props {
  judge: Judge;
  teams: Team[];
  initialScores: Score[];
  initialSettings: Settings;
  initialSpecialVotes: SpecialVote[];
  initialTop3TeamIds: string[];
}

interface ScoreState {
  roi:        number;
  efficiency: number;
  completion: number;
}

const ZERO_SCORE: ScoreState = { roi: 0, efficiency: 0, completion: 0 };

export function ScoreEditor({
  judge,
  teams,
  initialScores,
  initialSettings,
  initialSpecialVotes,
  initialTop3TeamIds,
}: Props) {
  const router = useRouter();

  // -------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------
  const [scoresByTeam, setScoresByTeam] = useState<Map<string, Score>>(() => {
    const m = new Map<string, Score>();
    initialScores.forEach((s) => m.set(s.team_id, s));
    return m;
  });
  const [activeTeamId,    setActiveTeamId]    = useState<string | null>(initialSettings.active_team_id);
  const [selectedTeamId,  setSelectedTeamId]  = useState<string | null>(
    initialSettings.active_team_id ?? teams[0]?.id ?? null
  );

  // 현재 편집 중인 점수 (로컬 상태, DB 값과 다를 수 있음)
  const [draft, setDraft] = useState<ScoreState>(() => {
    if (!selectedTeamId) return ZERO_SCORE;
    const s = initialScores.find((x) => x.team_id === selectedTeamId);
    return s
      ? { roi: s.roi_score, efficiency: s.efficiency_score, completion: s.completion_score }
      : ZERO_SCORE;
  });

  const [saving,    setSaving]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError,  setSaveError]  = useState<string | null>(null);

  // 특별상 관련 state
  const [specialVotingOpen, setSpecialVotingOpen] = useState<boolean>(initialSettings.special_voting_open);
  const [top3TeamIds,       setTop3TeamIds]       = useState<string[]>(initialTop3TeamIds);
  const [mySpecialVote,     setMySpecialVote]     = useState<SpecialVote | null>(() => {
    // 본인 담당 특별상 1건만 (협력/도전/토큰 중 하나)
    // judge.special_award_type 타입이 이미 '공감상'을 제외하므로 null 체크만 하면 충분
    if (!judge.special_award_type) return null;
    return initialSpecialVotes.find((v) => v.award_type === judge.special_award_type) ?? null;
  });

  // -------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------
  const teamById = useMemo(() => {
    const m = new Map<string, Team>();
    teams.forEach((t) => m.set(t.id, t));
    return m;
  }, [teams]);

  const selectedTeam   = selectedTeamId ? teamById.get(selectedTeamId) ?? null : null;
  const activeTeam     = activeTeamId   ? teamById.get(activeTeamId)   ?? null : null;
  const currentScore   = selectedTeamId ? scoresByTeam.get(selectedTeamId) ?? null : null;
  const isSubmitted    = currentScore?.is_submitted ?? false;
  const totalDraft     = draft.roi + draft.efficiency + draft.completion;

  // -------------------------------------------------------------------
  // 팀 선택 변경 시 draft 동기화
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!selectedTeamId) return;
    const s = scoresByTeam.get(selectedTeamId);
    setDraft(
      s
        ? { roi: s.roi_score, efficiency: s.efficiency_score, completion: s.completion_score }
        : ZERO_SCORE
    );
    setSaveStatus('idle');
    setSaveError(null);
    // pending debounce 타이머 취소 (이전 팀의 저장이 새 팀에 잘못 들어가지 않도록)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, [selectedTeamId, scoresByTeam]);

  // -------------------------------------------------------------------
  // 자동 저장 (debounce)
  //   slider 조작 → 2초 후 saveScoreDraft 호출
  // -------------------------------------------------------------------
  const triggerAutoSave = useCallback(
    (next: ScoreState) => {
      if (!selectedTeamId) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      setSaveStatus('saving');
      debounceTimer.current = setTimeout(async () => {
        setSaving(true);
        const result = await saveScoreDraft({
          judge_id:         judge.id,
          team_id:          selectedTeamId,
          roi_score:        next.roi,
          efficiency_score: next.efficiency,
          completion_score: next.completion,
        });
        setSaving(false);

        if (result.ok) {
          setScoresByTeam((prev) => {
            const m = new Map(prev);
            m.set(selectedTeamId, result.data);
            return m;
          });
          setSaveStatus('saved');
          setSaveError(null);
        } else {
          setSaveStatus('error');
          setSaveError(result.error);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [judge.id, selectedTeamId]
  );

  const handleSliderChange = (field: keyof ScoreState, v: number) => {
    setDraft((prev) => {
      const next = { ...prev, [field]: v };
      triggerAutoSave(next);
      return next;
    });
  };

  // -------------------------------------------------------------------
  // 제출
  // -------------------------------------------------------------------
  const handleSubmit = async () => {
    if (!selectedTeamId) return;

    // pending debounce 타이머 취소 (제출이 자동저장과 경합하지 않도록)
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    setSubmitting(true);
    const result = await submitScore({
      judge_id:         judge.id,
      team_id:          selectedTeamId,
      roi_score:        draft.roi,
      efficiency_score: draft.efficiency,
      completion_score: draft.completion,
    });
    setSubmitting(false);

    if (result.ok) {
      setScoresByTeam((prev) => {
        const m = new Map(prev);
        m.set(selectedTeamId, result.data);
        return m;
      });
      setSaveStatus('saved');
    } else {
      alert(`제출 실패: ${result.error}`);
    }
  };

  // -------------------------------------------------------------------
  // Realtime: settings 변경 구독 (active_team_id, special_voting_open) +
  //           scores 변경 시 1~3위(top3) 재계산
  // -------------------------------------------------------------------
  useEffect(() => {
    const supabase = getBrowserClient();

    const refetchTop3 = async () => {
      const { data } = await supabase.from('v_top3').select('team_id').order('rank');
      if (data) setTop3TeamIds(data.map((r) => r.team_id as string));
    };

    const channel  = supabase
      .channel('settings-watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'id=eq.1' },
        (payload: { new: Settings }) => {
          const newSettings = payload.new;
          setActiveTeamId(newSettings.active_team_id);
          setSpecialVotingOpen(newSettings.special_voting_open);

          // 진행자가 새 팀으로 바꾸면 선택된 팀도 자동 이동
          // (단, 사용자가 다른 팀을 보고 있던 중에 강제로 끌고가지 않기 위해
          //  현재 선택과 직전 active가 같았을 때만 자동 전환)
          setSelectedTeamId((prevSelected) => {
            if (prevSelected === activeTeamId && newSettings.active_team_id) {
              return newSettings.active_team_id;
            }
            return prevSelected;
          });
        }
      )
      // 다른 심사위원의 점수 변경 → 1~3위 계산이 바뀔 수 있으므로 top3 재조회
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        () => { void refetchTop3(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // activeTeamId가 바뀔 때마다 새로 구독해야 위 비교가 최신 값으로 동작
  }, [activeTeamId]);

  // -------------------------------------------------------------------
  // 로그아웃 (다른 심사위원으로 전환)
  // -------------------------------------------------------------------
  const handleLogout = async () => {
    if (!confirm('다른 심사위원으로 전환하시겠어요? 입력한 점수는 서버에 그대로 남아있습니다.')) return;
    await clearJudgeCookie();
    router.push('/judge');
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-100 pb-32">
      {/* 상단 고정 헤더: 현재 발표 중인 팀 */}
      <header className="sticky top-0 z-10 border-b border-sky-700 bg-sky-600 px-4 py-3 text-white shadow-md">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-sky-200">
              ▶ 현재 발표중
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-sky-200 underline-offset-2 hover:underline"
            >
              {judge.name} · 전환
            </button>
          </div>
          <div className="mt-1 text-2xl font-bold">
            {activeTeam ? activeTeam.name : '대기 중'}
            {activeTeam && (
              <span className="ml-2 text-sm text-sky-200">#{activeTeam.presentation_order}</span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        {/* 편집 대상 팀 표시 (active와 다를 수 있음) */}
        {selectedTeam && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
            <div>
              <div className="text-xs text-slate-500">점수를 입력 중인 팀</div>
              <div className="text-lg font-bold text-slate-900">
                {selectedTeam.name}
                <span className="ml-2 text-sm text-slate-400">#{selectedTeam.presentation_order}</span>
              </div>
            </div>
            {isSubmitted && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                ✓ 제출 완료
              </span>
            )}
          </div>
        )}

        {/* 슬라이더 3개 */}
        {selectedTeamId && (
          <div className="space-y-3">
            <ScoreSlider
              label="ROI · 기대효과"
              hint="얼마의 가치가 있는가? 반복성, 투입공수 절감"
              value={draft.roi}
              onChange={(v) => handleSliderChange('roi', v)}
              min={0}
              max={40}
              accent="sky"
              disabled={submitting}
            />
            <ScoreSlider
              label="업무효율화"
              hint="워크플로우의 폭을 개선시키는 정도"
              value={draft.efficiency}
              onChange={(v) => handleSliderChange('efficiency', v)}
              min={0}
              max={30}
              accent="emerald"
              disabled={submitting}
            />
            <ScoreSlider
              label="과제 완성도"
              hint="발표 과제 자체의 완성된 정도"
              value={draft.completion}
              onChange={(v) => handleSliderChange('completion', v)}
              min={0}
              max={30}
              accent="amber"
              disabled={submitting}
            />

            {/* 합계 + 저장 상태 */}
            <div className="rounded-xl bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-400">합계</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tabular-nums">{totalDraft}</span>
                  <span className="text-sm text-slate-400">/ 100</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                <SaveStatusLabel status={saveStatus} saving={saving} error={saveError} />
              </div>
            </div>

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`
                mt-2 w-full rounded-xl px-5 py-4 text-lg font-bold shadow-md transition
                ${isSubmitted
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-sky-600 text-white hover:bg-sky-700'}
                disabled:opacity-50
              `}
            >
              {submitting
                ? '⏳ 제출 중...'
                : isSubmitted
                  ? '✓ 제출 완료 (수정 후 다시 제출 가능)'
                  : '제출하기'}
            </button>
          </div>
        )}

        {/* 본인이 입력한 팀 리스트 */}
        <div className="mt-8">
          <h2 className="mb-3 px-1 text-sm font-semibold text-slate-700">
            전체 팀 ({teams.length}팀) · 본인 입력 상태
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {teams.map((team) => {
              const s        = scoresByTeam.get(team.id);
              const isActive = team.id === selectedTeamId;
              const status   = !s
                ? 'empty'
                : s.is_submitted
                  ? 'submitted'
                  : 'draft';

              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`
                    rounded-lg border px-3 py-3 text-left transition
                    ${isActive
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'}
                  `}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-slate-900">
                      {team.name}
                    </span>
                    <StatusBadge status={status} />
                  </div>
                  {s && (
                    <div className="mt-1 text-xs text-slate-500 tabular-nums">
                      {s.total_score}점
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 특별상 선정 섹션 — 담당자(강상우/김형욱/Goos)만 + 진행자가 ON 했을 때만 */}
        {specialVotingOpen && (
          <SpecialAwardSection
            judge={judge}
            teams={teams}
            top3TeamIds={top3TeamIds}
            mySpecialVote={mySpecialVote}
            onVoted={setMySpecialVote}
          />
        )}
      </div>
    </main>
  );
}

// =====================================================================
// 보조 컴포넌트
// =====================================================================

function SaveStatusLabel({
  status,
  saving,
  error,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  saving: boolean;
  error:  string | null;
}) {
  if (saving) return <>💾 저장 중...</>;
  if (status === 'saving') return <>⏱ 잠시 후 자동 저장됩니다...</>;
  if (status === 'saved')  return <>✓ 자동 저장됨</>;
  if (status === 'error')  return <span className="text-rose-300">⚠ 저장 실패: {error}</span>;
  return <>슬라이더를 조정하세요</>;
}

function StatusBadge({ status }: { status: 'empty' | 'draft' | 'submitted' }) {
  if (status === 'submitted') {
    return <span className="text-xs text-emerald-600">✓</span>;
  }
  if (status === 'draft') {
    return <span className="text-xs text-amber-600">●</span>;
  }
  return <span className="text-xs text-slate-300">○</span>;
}

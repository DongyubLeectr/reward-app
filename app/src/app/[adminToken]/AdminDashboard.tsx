'use client';

/**
 * AdminDashboard — 진행자 메인 대시보드 (Client Component)
 *
 * 구성:
 *   ┌─────────────────────────────────────┐
 *   │ [현재 발표 중] Team N #5            │ ← 핵심 헤더 (큼지막)
 *   │ 5명 중 ◉◉◉○○ 3명 제출              │
 *   │ [ 다음 팀으로 넘어가기 ]            │ ← 한 번 클릭으로 전환
 *   ├─────────────────────────────────────┤
 *   │ 발표 순서 (드래그로 재배치 가능)    │
 *   │ #1 Team 01 ✓ (완료) 5/5            │
 *   │ #2 Team 02 ◐ (발표중) 3/5          │ ← active
 *   │ #3 Team 03 ○ (대기)                │
 *   │ ...                                 │
 *   ├─────────────────────────────────────┤
 *   │ 스테이지 제어                       │
 *   │ [심사 ON] [특별상 OFF] [공감상 OFF]│
 *   │ 결과 공개: [미공개][특상][3위]...   │
 *   └─────────────────────────────────────┘
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import {
  advanceToNextTeam,
  resetAllTeams,
  toggleStage,
  setRevealStage,
  clearAllScores,
  clearAllVotes,
} from '@/app/actions/admin';
import { TeamRow } from './TeamRow';
import { TeamSortableList } from './TeamSortableList';
import { VoteQRSection } from './VoteQRSection';
import type { Team, Judge, Settings, TeamScoreRow, Score } from '@/types/db';

interface Props {
  initialTeams: Team[];
  judges: Judge[];
  initialSettings: Settings;
  initialScoreView: TeamScoreRow[];
  voteUrl: string;
}

const REVEAL_STAGE_LABELS = ['미공개', '특별상', '3위', '2위', '1위', '완료'] as const;

export function AdminDashboard({
  initialTeams,
  judges,
  initialSettings,
  initialScoreView,
  voteUrl,
}: Props) {
  // -------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------
  const [teams,     setTeams]     = useState<Team[]>(initialTeams);
  const [settings,  setSettings]  = useState<Settings>(initialSettings);
  const [scoreView, setScoreView] = useState<TeamScoreRow[]>(initialScoreView);
  const [pending,   startTransition] = useTransition();

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------
  const totalJudges = judges.length; // 5명
  const activeTeam  = useMemo(
    () => teams.find((t) => t.id === settings.active_team_id) ?? null,
    [teams, settings.active_team_id]
  );
  const activeScore = useMemo(
    () => scoreView.find((s) => s.team_id === activeTeam?.id) ?? null,
    [scoreView, activeTeam]
  );

  // -------------------------------------------------------------------
  // Realtime 구독: teams / settings / scores 변경 감지
  // -------------------------------------------------------------------
  useEffect(() => {
    const supabase = getBrowserClient();

    const channel = supabase
      .channel('admin-dashboard')
      // settings 갱신
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'id=eq.1' },
        (payload: { new: Settings }) => setSettings(payload.new)
      )
      // teams 갱신 (이름·순서·status)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        async () => {
          const { data } = await supabase.from('teams').select('*').order('presentation_order');
          if (data) setTeams(data as Team[]);
        }
      )
      // scores 변경 시 v_team_scores 다시 조회
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        async () => {
          const { data } = await supabase.from('v_team_scores').select('*').order('presentation_order');
          if (data) setScoreView(data as TeamScoreRow[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // -------------------------------------------------------------------
  // 액션 핸들러
  // -------------------------------------------------------------------
  /** Service Role 변경 후 Realtime이 지연될 수 있어 명시적으로 다시 fetch */
  const refetchAll = async () => {
    const supabase = getBrowserClient();
    const [t, s, v] = await Promise.all([
      supabase.from('teams').select('*').order('presentation_order'),
      supabase.from('settings').select('*').eq('id', 1).single(),
      supabase.from('v_team_scores').select('*').order('presentation_order'),
    ]);
    if (t.data) setTeams(t.data as Team[]);
    if (s.data) setSettings(s.data as Settings);
    if (v.data) setScoreView(v.data as TeamScoreRow[]);
  };

  const handleAdvance = () => {
    if (!confirm('다음 팀 발표를 시작할까요? 현재 발표 중인 팀은 자동으로 완료 처리됩니다.')) return;
    startTransition(async () => {
      const r = await advanceToNextTeam();
      if (!r.ok) alert(`실패: ${r.error}`);
      else      await refetchAll();
    });
  };

  const handleReset = () => {
    if (!confirm('모든 팀을 "대기" 상태로 리셋합니다. 점수 데이터는 유지됩니다. 계속할까요?')) return;
    startTransition(async () => {
      const r = await resetAllTeams();
      if (!r.ok) alert(`실패: ${r.error}`);
      else      await refetchAll();
    });
  };

  const handleClearScores = () => {
    if (!confirm('⚠ 모든 심사 점수를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?')) return;
    if (!confirm('정말로 모든 점수를 지우시겠어요? (마지막 확인)')) return;
    startTransition(async () => {
      const r = await clearAllScores();
      if (!r.ok) alert(`실패: ${r.error}`);
    });
  };

  const handleClearVotes = () => {
    if (!confirm('⚠ 모든 특별상·공감상 투표를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?')) return;
    if (!confirm('정말로 모든 투표를 지우시겠어요? (마지막 확인)')) return;
    startTransition(async () => {
      const r = await clearAllVotes();
      if (!r.ok) alert(`실패: ${r.error}`);
    });
  };

  const handleToggle = (key: 'scoring_open' | 'special_voting_open' | 'empathy_voting_open') => {
    const nextValue = !settings[key];
    // Optimistic update: UI를 즉시 갱신 (Realtime 도착을 기다리지 않음)
    setSettings((prev) => ({ ...prev, [key]: nextValue }));
    startTransition(async () => {
      const r = await toggleStage(key, nextValue);
      if (!r.ok) {
        alert(`실패: ${r.error}`);
        // 실패 시 롤백
        setSettings((prev) => ({ ...prev, [key]: !nextValue }));
      }
    });
  };

  const handleReveal = (stage: 0 | 1 | 2 | 3 | 4 | 5) => {
    const prevStage = settings.reveal_stage;
    // Optimistic update
    setSettings((prev) => ({ ...prev, reveal_stage: stage }));
    startTransition(async () => {
      const r = await setRevealStage(stage);
      if (!r.ok) {
        alert(`실패: ${r.error}`);
        // 실패 시 롤백
        setSettings((prev) => ({ ...prev, reveal_stage: prevStage }));
      }
    });
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      {/* 상단 헤더 */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">🎤 발표회 진행 대시보드</h1>
          <div className="text-xs text-slate-500">
            심사위원 {totalJudges}명 · 발표팀 {teams.length}팀
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        {/* ───────── 핵심 카드: 현재 발표 중 ───────── */}
        <section className="rounded-2xl bg-slate-900 p-8 text-white shadow-lg">
          <div className="mb-2 text-sm uppercase tracking-wider text-slate-400">
            ▶ 현재 발표 중
          </div>
          {activeTeam ? (
            <>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-5xl font-bold">{activeTeam.name}</h2>
                <span className="text-2xl text-slate-400">#{activeTeam.presentation_order}</span>
              </div>
              <ProgressIndicator
                submitted={activeScore?.submitted_judges ?? 0}
                drafted={(activeScore?.scored_judges ?? 0) - (activeScore?.submitted_judges ?? 0)}
                total={totalJudges}
              />
            </>
          ) : (
            <div className="text-3xl font-semibold text-slate-500">대기 중</div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleAdvance}
              disabled={pending}
              className="rounded-lg bg-sky-500 px-6 py-3 text-base font-bold text-white shadow hover:bg-sky-400 disabled:opacity-50"
            >
              {activeTeam ? '✓ 발표 종료 + 다음 팀 시작' : '▶ 첫 팀 발표 시작'}
            </button>
            <button
              onClick={handleReset}
              disabled={pending}
              className="rounded-lg bg-slate-700 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
            >
              모든 팀 상태 리셋
            </button>
          </div>
        </section>

        {/* ───────── 발표 순서 (드래그 재배치) ───────── */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-slate-900">발표 순서 ({teams.length}팀)</h2>
            <p className="text-xs text-slate-500">드래그로 순서 변경 · 이름 클릭으로 수정</p>
          </div>

          <TeamSortableList
            teams={teams}
            scoreView={scoreView}
            activeTeamId={settings.active_team_id}
            totalJudges={totalJudges}
            onTeamsChange={setTeams}
          />
        </section>

        {/* ───────── 스테이지 제어 ───────── */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">스테이지 제어</h2>

          <div className="space-y-3">
            <ToggleRow
              label="1~3위 심사 입력 받기"
              hint="OFF로 두면 심사위원이 점수를 더 이상 변경할 수 없음 (행사 후반 잠금용)"
              value={settings.scoring_open}
              onToggle={() => handleToggle('scoring_open')}
              disabled={pending}
            />
            <ToggleRow
              label="특별상 선정 입력 받기"
              hint="강상우/김형욱/Goos 심사위원이 특별상 후보를 고를 수 있는 단계"
              value={settings.special_voting_open}
              onToggle={() => handleToggle('special_voting_open')}
              disabled={pending}
            />
            <ToggleRow
              label="공감상 청중 투표 받기"
              hint="모든 참석자가 공감상 후보에 투표할 수 있는 단계"
              value={settings.empathy_voting_open}
              onToggle={() => handleToggle('empathy_voting_open')}
              disabled={pending}
            />
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <label className="text-sm font-semibold text-slate-700">결과 공개 단계</label>
              <span className="text-xs text-slate-500">
                현재: <strong>{REVEAL_STAGE_LABELS[settings.reveal_stage]}</strong>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {REVEAL_STAGE_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => handleReveal(i as 0 | 1 | 2 | 3 | 4 | 5)}
                  disabled={pending}
                  className={`
                    rounded-lg px-3 py-2 text-sm font-semibold transition
                    ${settings.reveal_stage === i
                      ? 'bg-sky-600 text-white shadow'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}
                    disabled:opacity-50
                  `}
                >
                  {i}. {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── 공감상 투표 QR ───────── */}
        <VoteQRSection voteUrl={voteUrl} />

        {/* ───────── 위험 구역 (리허설 후 데이터 정리) ───────── */}
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="mb-2 text-sm font-bold text-rose-800">⚠ 위험 구역</h2>
          <p className="mb-4 text-xs text-rose-700">
            리허설 종료 후 본 행사 직전에만 사용하세요. 되돌릴 수 없습니다.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleClearScores}
              disabled={pending}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-100 disabled:opacity-50"
            >
              모든 점수 삭제
            </button>
            <button
              onClick={handleClearVotes}
              disabled={pending}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-100 disabled:opacity-50"
            >
              모든 투표 삭제
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

// =====================================================================
// 보조 컴포넌트
// =====================================================================

/** 5명 중 N명 제출 진행 표시 */
function ProgressIndicator({
  submitted, drafted, total,
}: { submitted: number; drafted: number; total: number }) {
  const remaining = total - submitted - drafted;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-2xl">
        {Array.from({ length: submitted }).map((_, i) => (
          <span key={`s-${i}`} className="text-emerald-400">●</span>
        ))}
        {Array.from({ length: drafted }).map((_, i) => (
          <span key={`d-${i}`} className="text-amber-400">●</span>
        ))}
        {Array.from({ length: Math.max(remaining, 0) }).map((_, i) => (
          <span key={`r-${i}`} className="text-slate-600">○</span>
        ))}
      </div>
      <div className="text-sm text-slate-300">
        <span className="font-bold text-white">{submitted}</span>
        <span className="text-slate-500"> / {total} 제출</span>
        {drafted > 0 && (
          <span className="ml-2 text-amber-300">(드래프트 {drafted})</span>
        )}
      </div>
    </div>
  );
}

/** 토글 ON/OFF 행 */
function ToggleRow({
  label, hint, value, onToggle, disabled,
}: {
  label: string; hint?: string; value: boolean;
  onToggle: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="flex w-full items-start justify-between rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-50"
    >
      <div>
        <div className="font-semibold text-slate-900">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
      <div className={`
        ml-4 mt-1 flex h-6 w-12 items-center rounded-full px-1 transition
        ${value ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}
      `}>
        <div className="h-4 w-4 rounded-full bg-white shadow" />
      </div>
    </button>
  );
}

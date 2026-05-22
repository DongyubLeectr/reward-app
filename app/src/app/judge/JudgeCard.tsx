'use client';

/**
 * JudgeCard — 심사위원 1명 선택 카드
 *
 * 클릭 시 Server Action으로 쿠키 저장 후 /judge/score로 리다이렉트.
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Judge } from '@/types/db';
import { setJudgeCookie } from './actions';

interface Props {
  judge: Judge;
}

const AWARD_LABEL: Record<string, string> = {
  '협력상': '협력상 담당',
  '도전상': '도전상 담당',
  '토큰상': '토큰상 담당',
};

export function JudgeCard({ judge }: Props) {
  const router    = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSelect = () => {
    startTransition(async () => {
      const result = await setJudgeCookie(judge.id);
      if (result.ok) {
        router.push('/judge/score');
      } else {
        alert(`오류: ${result.error}`);
      }
    });
  };

  const subtitle = judge.special_award_type
    ? AWARD_LABEL[judge.special_award_type] ?? ''
    : '';

  return (
    <button
      onClick={handleSelect}
      disabled={pending}
      className="
        flex w-full items-center justify-between rounded-xl bg-white px-5 py-5
        text-left shadow-sm transition
        hover:bg-slate-50 hover:shadow active:scale-[0.98]
        disabled:opacity-50
      "
    >
      <div>
        <div className="text-xl font-bold text-slate-900">{judge.name}</div>
        {subtitle && (
          <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>
        )}
      </div>
      <div className="text-2xl text-slate-300">{pending ? '⏳' : '→'}</div>
    </button>
  );
}

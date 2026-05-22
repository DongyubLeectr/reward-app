'use server';

/**
 * /judge 관련 Server Actions
 *   - setJudgeCookie  : 심사위원 선택 시 judge_id 쿠키 저장
 *   - clearJudgeCookie: 로그아웃(다른 심사위원으로 전환) 시 쿠키 제거
 */

import { cookies } from 'next/headers';
import { getServerClient } from '@/lib/supabase/server';

const COOKIE_NAME = 'judge_id';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24시간 (행사 당일만 유효)

export type CookieActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function setJudgeCookie(judgeId: string): Promise<CookieActionResult> {
  // judgeId가 실제로 존재하는 심사위원인지 검증
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('judges')
    .select('id')
    .eq('id', judgeId)
    .single();

  if (error || !data) {
    return { ok: false, error: '존재하지 않는 심사위원입니다.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, judgeId, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });

  return { ok: true };
}

export async function clearJudgeCookie(): Promise<CookieActionResult> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return { ok: true };
}

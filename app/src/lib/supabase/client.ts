/**
 * lib/supabase/client.ts
 *
 * 브라우저(Client Component)용 Supabase 클라이언트.
 *   - Publishable key 사용 (RLS로 보호)
 *   - 실시간 구독, 클라이언트 측 점수 입력 등에 사용
 *
 * Server Component / Server Action에서는 절대 사용하지 말 것.
 * 그쪽은 lib/supabase/server.ts를 사용하세요.
 */

import { createBrowserClient } from '@supabase/ssr';

let _client: ReturnType<typeof createBrowserClient> | null = null;

/** 싱글톤 브라우저 클라이언트 */
export function getBrowserClient() {
  if (_client) return _client;

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      '[supabase/client] NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.'
    );
  }

  _client = createBrowserClient(url, anonKey);
  return _client;
}

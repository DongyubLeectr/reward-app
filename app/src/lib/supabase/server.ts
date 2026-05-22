/**
 * lib/supabase/server.ts
 *
 * Server Component / Server Action / Route Handler용 Supabase 클라이언트.
 *   - Publishable key 사용 (일반 권한)
 *   - 쿠키 기반 세션을 사용해야 할 때 활용
 *
 * 관리자 권한이 필요한 경우(팀 status 변경, settings 변경 등)는
 * lib/supabase/admin.ts를 사용하세요.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// types/db.ts로 명시적 타입을 따로 관리하므로 Database 제네릭은 any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function getServerClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      '[supabase/server] NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.'
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Db>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component에서 호출된 경우 set이 동작하지 않을 수 있음 — 무시 가능
        }
      },
    },
  });
}

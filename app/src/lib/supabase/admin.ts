/**
 * lib/supabase/admin.ts
 *
 * ⚠ Service Role 권한 Supabase 클라이언트.
 *   - RLS 정책을 우회하는 슈퍼유저 권한입니다.
 *   - 절대 클라이언트(브라우저)에 노출되면 안 됩니다.
 *   - Server Action / Route Handler / 진행자 대시보드 서버 사이드 등에서만 사용.
 *
 * 사용 예:
 *   - 팀 status 변경 ('대기' → '발표중' → '발표완료')
 *   - settings 테이블 변경 (active_team_id, reveal_stage 등)
 *   - 데이터 시드/리셋 같은 어드민 작업
 */

import 'server-only';                     // 클라이언트 import 시 빌드 에러 발생시킴
import { createClient } from '@supabase/supabase-js';

let _admin: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (_admin) return _admin;

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      '[supabase/admin] NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.'
    );
  }

  _admin = createClient(url, serviceKey, {
    auth: {
      persistSession:   false,
      autoRefreshToken: false,
    },
  });
  return _admin;
}

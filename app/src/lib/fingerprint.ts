/**
 * lib/fingerprint.ts
 *
 * 브라우저 fingerprint 생성/조회 헬퍼.
 *
 * 정책:
 *   - localStorage에 UUID 1회 생성 후 영속화.
 *   - 시크릿모드/캐시삭제 시 새 fingerprint가 발급되므로 절대적 차단은 아니지만,
 *     5/27 단일 사내 행사 컨텍스트에서는 충분.
 *   - 더 강한 차단이 필요해지면 향후 @fingerprintjs/fingerprintjs로 교체 가능.
 */

const LS_KEY = 'reward_voter_fp';

/** UUID v4 생성 (crypto.randomUUID이 있으면 그쪽 사용) */
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // fallback (구형 브라우저용)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 브라우저별 고유 fingerprint 반환 (없으면 새로 생성해서 저장) */
export function getOrCreateFingerprint(): string {
  if (typeof window === 'undefined') {
    throw new Error('[fingerprint] 서버 사이드에서 호출할 수 없습니다.');
  }
  const existing = localStorage.getItem(LS_KEY);
  if (existing) return existing;

  const fresh = uuid();
  localStorage.setItem(LS_KEY, fresh);
  return fresh;
}

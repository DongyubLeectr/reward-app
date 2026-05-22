import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // 워크스페이스 루트를 명시해 lockfile 추론 경고 제거
  // (홈 폴더에 잘못된 package-lock.json이 있어도 무시하고 이 폴더를 루트로 사용)
  outputFileTracingRoot: path.resolve(__dirname),

  // Turbopack 한글 경로 panic 회피용 — package.json scripts에서 --webpack 플래그 사용 중
  // 이 옵션은 turbopack 사용 시 루트 명시에만 영향 (현재 webpack 모드라 부수적)
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

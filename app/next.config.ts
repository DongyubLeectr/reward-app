import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 빈 설정으로 두기 — Vercel의 자동 감지와 Root Directory 설정을 따른다.
  // 로컬 dev에서는 package.json의 "dev": "next dev --webpack"로 한글 경로 buggy Turbopack 회피.
};

export default nextConfig;

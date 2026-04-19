/**
 * 🛡️ S-Guard AI — Cloudflare Pages Edge Device Router
 *
 * `sguard-frontend.pages.dev` 진입 시 User-Agent를 분석하여
 *  - 모바일(Android / iPhone / iPad) → sguard-mobile.pages.dev 로 302 리다이렉트
 *  - PC / 태블릿               → 현재 Pages 정적 빌드(env.ASSETS) 그대로 서빙
 *
 * 파일 위치: frontend/public/_worker.js
 * → Vite 빌드 시 dist/_worker.js 로 복사됨
 * → Cloudflare Pages 배포 시 Edge Worker 로 자동 인식됨
 */

const MOBILE_ORIGIN = 'https://sguard-mobile.pages.dev';

/** User-Agent 기반 모바일 판별 */
function isMobileUA(ua = '') {
  return /Mobile|Android|iPhone|iPod/i.test(ua) &&
    // iPad + desktop mode(iOS 13+)는 desktop으로 처리
    !/iPad/i.test(ua);
}

export default {
  async fetch(request, env) {
    const ua = request.headers.get('user-agent') || '';
    const url = new URL(request.url);

    // ── 모바일 감지 → 모바일 앱으로 리다이렉트 ──────────────────────────
    // 🚩 루프 방지: 이미 모바일 도메인(sguard-mobile)인 경우 리다이렉트 생략
    if (isMobileUA(ua) && url.origin !== MOBILE_ORIGIN) {
      // Hash(#)는 서버에 전달되지 않으므로 경로+쿼리만 전달
      const target = `${MOBILE_ORIGIN}${url.pathname}${url.search}`;
      return Response.redirect(target, 302);
    }

    // ── PC / 태블릿 → 정적 빌드 그대로 서빙 ────────────────────────────
    // env.ASSETS : Cloudflare Pages 빌드 결과물에 대한 바인딩
    return env.ASSETS.fetch(request);
  },
};

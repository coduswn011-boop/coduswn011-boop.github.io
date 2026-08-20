/* ================================================================
   NOBEL GYM 24 — 사이트 설정
   ▸ 배포 후 이 파일만 고치면 실서비스로 전환됩니다.
   ▸ 이 파일은 브라우저에 그대로 노출됩니다. 비밀 값을 넣지 마세요.
     (어드민 토큰은 Netlify 환경변수에 두고 함수가 대신 붙입니다)
   ================================================================ */
window.NOBEL_CONFIG = {

  /* ── 1. 지원서 접수 · 공고 조회 (Google Apps Script 웹앱 URL) ──
     비워두면 "로컬 모드"로 동작합니다 (브라우저에만 저장).
     이 주소는 공개돼도 안전합니다 — 토큰 없이는 지원 접수와
     공고 조회만 가능하고 지원자 목록은 열람할 수 없습니다.
     예) "https://script.google.com/macros/s/AKfycb..../exec"        */
  applyEndpoint: "https://script.google.com/macros/s/AKfycbxV2-FbxQjW8qXcuaJ0BRGU9Hu754C1MmNT1ReWztZg-qq47qC8rHM545XKwQ8ZS7QvmA/exec",

  /* ── 2. 어드민 API 중계 서버 ──────────────────────────────────
     비워두면 브라우저가 위 웹앱에 직접 요청합니다 (정적 호스팅용).
     Netlify 같은 서버리스 함수를 쓸 때만 "/.netlify/functions/admin"
     처럼 채워 넣으세요.                                             */
  adminApi: "",

  /* ── 3. 어드민 비밀번호 검증 위치 ─────────────────────────────
     "server" : Apps Script 의 ADMIN_PASS 로 검증 (현재 설정)
     "client" : 아래 adminPass 로 브라우저 검증 (로컬 테스트용)      */
  adminAuth: "server",
  adminPass: "nobel2026",   // adminAuth: "client" 일 때만 사용

  /* ── 4. 준비중 안내 바 ────────────────────────────────────────
     샘플 데이터로 먼저 배포할 때 true. 실제 정보로 교체하면 false. */
  previewNotice: true,

  /* ── 5. 내부 저장소 키 (변경 불필요) ─────────────────────────── */
  storageKey: "nobelgym.recruit.v1",
};

/* ============================================================
   2026 K예술영재 프로젝트 — gateway.js
   관문(Google Apps Script 웹앱) 주소 — 관리자 페이지(admin.js)와 페이지 직접 편집(editor.js)이 함께 쓴다.
   관문을 새로 배포해 주소가 바뀌면 여기 한 곳만 고친다 (docs/setup-new-account.md 4단계).
   자동 배포(.github/workflows/gateway.yml)도 이 줄에서 배포 ID를 읽는다.
   주소는 공개돼도 되는 값이다 — 저장 권한은 관문이 요청마다 토큰으로 확인한다(CLAUDE.md 보안 1 · 2).
   ============================================================ */
window.HP_GATEWAY = 'https://script.google.com/macros/s/AKfycbwPIFQhd7WS_Lrc_ab0o4VORrhfL4En-VlkHN4gdEdG1wx3cBATWw3uq26WnnjeXU-j/exec';

# K예술영재 홍보 사이트

## 개요
- 2026 K예술영재 프로젝트를 일반에 알리는 **공개 홍보 사이트**다. 차장님이 만든 정적 페이지 5개(`index` · `about` · `programs` · `course` · `news`)를 그대로 쓰면서 디자인을 다듬고, 운영진이 관리자 페이지에서 **게시판형 글(공지사항 · 언론홍보 · 갤러리)과 표지 사진**을 올리도록 만든다.
- 구성: 화면은 HTML·CSS·바닐라 JS(GitHub Pages), 관문은 Google Apps Script 웹앱, 데이터는 Google Sheets, 사진·첨부는 Google Drive. 아카이빙 사이트(`../archive`)와 같은 구성이지만 **시트·관문·드라이브 폴더는 따로 만든다.** 서버·DB·프레임워크를 새로 도입하지 않는다.
- 방문자는 관문을 거치지 않는다. 운영진이 저장하면 관문이 공개 글을 `data/posts.json`으로 만들어 이 저장소에 커밋하고, 방문자 화면은 그 파일을 읽는다(`docs/decisions.md` 3절).
- 고정 문구(사업소개 · 프로그램 설명 등)는 HTML에 있다. 2026-11-04부터 운영진이 **페이지 직접 편집**(관리자 페이지 [사이트에서 직접 편집], WBS 18)으로 글자 · 목록 항목 · 사진을 화면에서 고칠 수 있고, 고친 글은 `data/posts.json`의 `pages`로 HTML 위에 덮인다. HTML의 편집 열쇠(`data-e` · `data-list` · `data-ei`)는 손으로 바꾸지 않는다 — 문장을 더하면 `docs/tools/annotate-edit.py`를 다시 돌린다.
- 저장소 구조: 공개 페이지는 루트, 관문 코드는 `apps-script/`, 기준 문서는 `docs/`, 기존 간이 CMS 보관본은 `_legacy/`.
- 홍보 사이트에서는 아카이빙 사이트로 링크하지 않는다(2026-10-14 차장님 피드백으로 아카이브 탭 · 링크 삭제. 그 전에는 서로 링크했음).

## 보안 (반드시 지킬 것)
1. 화면 코드에는 데이터·비밀값·권한 판단을 두지 않는다. 화면 코드와 관문 주소는 공개된다고 가정한다.
2. 인증 · 토큰 · 저장 권한은 관문이 **요청마다** 검증한다. `data/posts.json`에는 공개여부가 `공개`인 글만 넣는다.
3. 서명 키와 GitHub 토큰은 Script Properties에만 둔다. 토큰은 요청 본문으로만 보낸다(URL 금지).
4. 관리자 토큰은 `sessionStorage`에 둔다. `localStorage`에는 기기ID만 둔다.
5. 운영진이 입력한 값(제목 · 본문 · 파일명 등)은 `textContent`로 출력한다. `innerHTML`에 넣지 않는다. 본문의 링크는 DOM으로 만든다.
6. 시트에 쓰는 값은 수식 주입을 막는다(`=` `+` `-` `@`로 시작하면 앞에 `'`).
7. 실제 접근코드, 서명 키, GitHub 토큰, 시트 ID, 드라이브 폴더 ID, 관문 배포 주소는 어떤 파일에도 쓰지 않는다. 이런 값은 `.gitignore`에 등록된 `docs/private/`에만 둔다.
8. `docs/` · `apps-script/` · `CLAUDE.md`는 `_config.yml`로 게시에서 뺀다. `_legacy/`는 `_`로 시작해 자동으로 빠진다. 루트에 `.nojekyll`을 만들지 않는다(만들면 제외 설정이 무효가 됨).
9. 외부 라이브러리를 추가하기 전에 먼저 묻는다.
10. class · id 이름을 광고처럼 짓지 않는다(`ad-` · `ads` · `banner` · `sponsor` 등). 광고 차단(네이버 웨일 내장 등)이 숨긴다. 새 이름을 만들면 `docs/private/tools/adblock-scan.mjs`로 확인한다.

## 작업 방식
- 작업 브랜치는 `home/parkjiheon`이다. **커밋은 사용자가 WBS 한 절(0 · 1 · 2 …)이 끝날 때마다 직접 한다.** 절이 끝나면 바뀐 내용을 정리해 알린다.
- 배포는 main에 push하면 GitHub Pages가 자동으로 한다. 관문이 main에 공지 목록(`data/posts.json`)을 커밋하므로, push 전에 `git fetch origin` → `git merge origin/main`으로 받아 합친다. **main에 강제 push(`--force`)하지 않는다.** `data/posts.json`은 손으로 고치지 않는다.
- 작업 전에 `docs/wbs.md`에서 해당 ID를 확인하고, 끝나면 상태를 바꾼다.
- 조금이라도 확실하지 않으면 먼저 묻는다. 설계와 다르게 구현해야 하면 먼저 묻고, 합의되면 `docs/decisions.md`도 함께 고친다.
- 문서에 없는 사실은 지어내지 말고 "확인 필요"로 표시한다.
- 파일을 지우거나 덮어쓰기 전에 먼저 묻는다. `_legacy/`는 고치지 않는다.
- 다른 저장소(`../archive`)는 사용자 확인 없이 고치지 않는다.

## 참고 문서 (해당 작업 전에 읽을 것)
- `docs/wbs.md` — 작업 목록과 진행 상태
- `docs/decisions.md` — 확정 결정사항과 이유, 남은 결정
- `docs/sheet-schema.md` — 시트 탭 · 열 · 선택 목록, `data/posts.json` 모양 (시트·발행 작업 시)
- `docs/api.md` — 관문 요청 · 응답 · 오류 코드, 토큰 · 실패 제한 (관문·관리자 페이지 작업 시)

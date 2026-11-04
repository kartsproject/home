# 관문 API 명세

> 관문 = Google Apps Script 웹앱. **관리자 페이지(`admin.html`)만** 호출한다.
> 방문자 화면은 관문을 부르지 않고 `data/posts.json`을 읽는다(`docs/decisions.md` 3절).

---

## 1. 확정 사항

| 항목 | 규칙 |
|---|---|
| 응답 | JSON만, `{ ok, error, data }` 고정 (아카이빙과 같음) |
| 요청 | auth · ping · list · upload · save · remove · publish |
| 전송 | 모두 POST. 본문에 `action`으로 종류를 담는다. `Content-Type: text/plain`(사전 요청 없이 보내기 위함) |
| 토큰 | 2시간, 사용 중 연장, 코드 `버전` 변경 시 전부 무효 |
| 실패 제한 | 기기별 5회 → 10분 잠금 |
| 로그 | 로그인 · 저장 · 삭제 · 업로드 · 발행을 모두 기록 |

**보안 원칙**

- 인증 · 토큰 · 저장 권한은 **모두 관문에서 매 요청 검증**한다. 관리자 화면을 믿지 않는다.
- 서명 키와 GitHub 토큰은 Script Properties에만 둔다. 토큰은 **요청 본문으로만** 전달한다(URL 금지).
- 관문은 HTML을 내보내지 않는다.
- 시트에 기록하는 값은 수식 주입을 막는다(`=` `+` `-` `@`로 시작하면 앞에 `'`).
- 입력 길이 · 형식 · 개수 한도(`sheet-schema.md` 2 · 4절)는 관리자 화면에서도 막지만 **관문이 다시 확인한다.**
- 인증부(`auth` 처리와 토큰 발급)는 따로 떼어 둔다. 구글 로그인으로 바꿀 때 이 부분만 교체한다(`decisions.md` 6절).

---

## 2. 응답 형식

```json
{ "ok": true,  "error": null,  "data": { } }
{ "ok": false, "error": "코드", "data": null }
```

---

## 3. 요청별 명세

| 요청 | 용도 | 토큰 |
|---|---|---|
| `auth` | 접근코드로 로그인하고 토큰을 받는다 | 없음 |
| `ping` | 토큰 유효시간을 연장한다 | 필요 |
| `list` | 관리용 글 목록(비공개 포함)과 설정을 받는다 | 필요 |
| `upload` | 사진 · 파일 하나를 드라이브에 올린다 | 필요 |
| `save` | 글 하나를 새로 쓰거나 고친다 → 발행 | 필요 |
| `remove` | 글 하나를 지운다 → 발행 | 필요 |
| `publish` | 발행만 다시 한다 (발행 실패 후 [다시 반영]) | 필요 |
| `savePage` | 페이지 직접 편집 — 한 페이지의 고친 글자 · 목록을 저장한다 → 발행 (2026-11-04 WBS 18) | 필요 |

### 3-1. auth

| 요청 필드 | 설명 |
|---|---|
| `action` | `"auth"` |
| `requestId` | 요청마다 새로 만드는 값. 같은 값이 다시 오면 먼저 만든 응답을 돌려준다(예비 요청 대비) |
| `code` | 접근코드 |
| `name` | 이름 (필수, 20자 이내). 작성자 · 수정자 · 로그 기록용이며 명단과 대조하지 않는다. **관리자 화면은 늘 `운영자`를 보낸다** (2026-10-14, 이름 칸 삭제) |
| `deviceId` | `localStorage`의 기기ID |

| 응답 `data` | 설명 |
|---|---|
| `token` | 서명된 토큰 |
| `expiresAt` | 만료 시각 (발급 + 2시간) |
| `name` | 받은 이름 (토큰에도 담김). 관리자 화면은 이 값 대신 늘 「운영자 님」을 표시 |

**검증 순서**: 기기 잠금 여부 → 코드 존재 → 상태 "사용" → 사용기한 이내 → 토큰 발급, 「로그」 기록. 실패하면 기기별 실패 횟수를 올린다.

### 3-2. ping

| 요청 필드 | 설명 |
|---|---|
| `action` · `token` | |

응답 `data`: `token`(새 토큰) · `expiresAt`. 화면은 기존 토큰을 바꿔 저장한다.

### 3-3. list

관리자 페이지가 로그인 직후 한 번, 저장 · 삭제 뒤마다 다시 부른다.

| 응답 `data` | 설명 |
|---|---|
| `notices` | 「공지」 전체(비공개 포함) + 각 글의 `photos` · `files` + 관리용 값(`visibility` · `author` · `updatedAt` 등) |
| `press` | 「언론홍보」 전체(비공개 포함) + 관리용 값 (2026-10-14) |
| `gallery` | 「갤러리」 전체 + `photos` + `course` · `field`(과정 · 분야 코드, 2026-10-16 — `sheet-schema.md` 「갤러리 과정 · 분야」) |
| `hero` | 「표지」 4칸 `{ id, slot, label, photos(0~1장), cutouts(누끼 0~1장), videos(동영상 0~1개 `{ src, w, h, attachmentId, name, size }`), depth(2.5D 켬), center({x, y} %), updatedBy, updatedAt }` (2026-10-14, 누끼 · 2.5D는 2026-10-15, 동영상은 2026-10-16 2안) |
| `photos` | 「사진」 30자리 `{ id, slot, label, photos(0~1장), pos({x, y} % 또는 null), updatedBy, updatedAt }` (2026-11-04 WBS 15). 「사진」 탭이 없거나 자리가 빠졌으면 이때 만든다(잠금 안에서) |
| `guides` | 「모집요강」 연도별 `{ id, year, title, files, visibility, … }`, 연도 큰 순 (2026-11-04). 탭이 없으면 이때 만든다 |
| `pages` · `pageMeta` | 페이지 직접 편집 내용 `{ about:{ t, l }, … }`(3-8) · 페이지마다 `{ updatedBy, updatedAt }` (2026-11-04 WBS 18). 편집 화면은 발행 전 내용도 이것으로 맞춘다 |
| `categories` | 공지 분류 목록 (「설정」) |
| `limits` | 업로드 형식 · 크기 · 개수 한도 (`sheet-schema.md` 4절) — 화면이 미리 막는 데 쓴다. 표지 사진을 줄일 크기 `heroPhotoSide`(2400), 누끼 크기 한도 `cutoutBytes`(8MB), 표지 동영상 `videoBytes`(20MB) · `videoPartBytes`(조각 크기) · `videoTypes`도 여기 |
| `lastPublish` | 마지막 발행 결과 `{ ok, at }` — 실패 상태면 화면이 [다시 반영] 버튼을 보인다 |

### 3-4. upload

파일 하나를 올린다. 응답이 JSON만이고 요청도 JSON이므로 파일은 base64로 담는다. 여러 개는 화면이 하나씩 차례로 보낸다.

| 요청 필드 | 설명 |
|---|---|
| `action` · `token` | |
| `kind` | `photo` · `file` · `cutout`(표지 2.5D용 누끼, PNG만 — 「첨부」 구분 `누끼`, 2026-10-15) · `video`(표지 동영상, 조각으로 — 아래, 2026-10-16) |
| `name` | 원래 파일명 |
| `mimeType` | |
| `base64` | 파일 내용. 사진은 브라우저가 줄인 JPEG, 누끼는 원본 사진과 같은 크기로 맞춘 PNG |
| `width` · `height` | 사진 · 누끼만 |

| 응답 `data` | 설명 |
|---|---|
| `attachmentId` | 「첨부」에 새로 생긴 첨부ID (글ID는 빈칸) |
| `fileId` | Drive 파일 ID (관리자 화면 미리보기용) |
| `size` | 바이트 |

- 관문이 확장자 · MIME · 크기를 다시 확인하고, 홍보용 폴더(공유 안 함)에 저장한 뒤 **그 파일만** 「링크가 있는 사용자 — 보기」로 공유한다(`decisions.md` 5절).
- 이 단계에서는 어떤 글에도 연결되지 않는다. `save`가 연결한다.

**표지 동영상 `kind: "video"`** (2026-10-16 2안, `apps-script/Media.js`) — 관문 요청 크기 한도 때문에 조각으로 나눠 **차례로** 보낸다.

| 요청 필드 | 설명 |
|---|---|
| `name` · `mimeType` | `….mp4` · `video/mp4`만 |
| `uploadId` | 영상 하나마다 화면이 새로 만드는 값(영숫자 · `-` · `_` 8~64자) |
| `part` · `parts` | 조각 번호(0부터) · 조각 수(최대 `ceil(videoBytes / videoPartBytes)`) |
| `base64` | 그 조각의 base64. 마지막이 아닌 조각은 정확히 `videoPartBytes`바이트(3의 배수라 패딩 없음) — 이어 붙이면 파일 전체의 base64가 된다. 첫 조각은 MP4 머리(`ftyp`)를 확인 |
| `width` · `height` | 영상 크기(마지막 조각에 필수) |

- 조각마다 드라이브 폴더에 base64 글자 그대로 저장(**공유 안 함**), 응답 `data`: `{ part }`.
- 마지막 조각 응답 `data`: `{ attachmentId, size }` — 「첨부」에 구분 `동영상` 한 줄. 조각이 빠졌거나(6시간 안에 모두 와야 함) 합계가 `videoBytes`를 넘으면 받은 조각을 버리고 `FILE_REJECTED`.
- 공개는 `save` 때 한다(3-5).

### 3-5. save

| 요청 필드 | 설명 |
|---|---|
| `action` · `token` | |
| `board` | `notice` · `press` · `gallery` · `hero` · `photo`(사이트 사진 자리, 2026-11-04) · `guide`(모집요강, 2026-11-04 — `post`: `year`(네 자리) · `title`(선택) · `visibility`, `files` 최대 5개, 같은 연도가 이미 있으면 `DUPLICATE_YEAR`) |
| `id` | 고칠 글ID. 새 글이면 빈 값 → 관문이 만든다. **표지는 늘 칸 ID(`H-dance` 등)**, **사이트 사진은 늘 자리 ID(`S-step1` 등)** — 새로 만들 수 없음. 다만 페이지 직접 편집에서 복제한 항목의 사진 자리 `S-{원래 자리}-x{영소문자 · 숫자 4자}`(예 `S-mu1-x4k2`, 50자 이내)는 처음 저장할 때 관문이 「사진」 행을 만든다(`createPhotoSlot_`, 기본 30자리 + 200자리까지, 2026-11-04 WBS 18) |
| `post` | 공지: `category` · `title` · `body` · `date` · `pinned` · `photoPosition` · `photoLink` · `visibility` / 언론홍보: `source` · `title` · `date` · `url` · `visibility` / 갤러리: `title` · `desc` · `date` · `visibility` · `course`(과정 코드 `workshop` · `mentoring` · `camp` · `""`) · `field`(분야 코드 `dance` · `music` · `art` · `trad` · `""`=공통). 시트에는 `워크숍 · 무용`처럼 쓰고, `course` · `field`가 모두 `""`이면 지정 안 함(빈칸). **둘 다 보내지 않으면 기존 값 유지** — 분야 칸이 없는 1안 관리자 화면이 저장해도 지워지지 않게. 하나만 보내거나, 목록에 없는 값 · 문자열이 아닌 값이거나, `course`가 `""`인데 `field`가 있으면 `INVALID_INPUT` (2026-10-16 WBS 8.10, 그 전 8.5의 `field` 하나만 보내는 요청도 이제 `INVALID_INPUT`) / 표지: `depth`(2.5D 입체 효과 켬, true/false) · `center`(`{ x, y }` 0~100 %, 누끼 인물 영역의 가운데 — 누끼가 없으면 `null`) / 사이트 사진: `pos`(`{ x, y }` 0~100 % 보이는 위치, `null`이면 기본 위치) |
| `photos` | 첨부ID 배열 — **이 순서가 화면 순서**. 언론홍보는 빈 배열, 표지 · 사이트 사진은 0~1개(빈 배열이면 기본 사진으로) |
| `files` | 첨부ID 배열 (공지만) |
| `cutouts` | 누끼 첨부ID 배열 (표지만, 0~1개). `depth`가 true면 1개여야 하고 원본(`photos`)과 가로 · 세로가 같아야 한다. 아니면 `INVALID_INPUT` |
| `videos` | 동영상 첨부ID 배열 (표지만, 0~1개, 2026-10-16 2안). 있으면 `photos`(대기 사진)가 있어야 하고 `depth`는 false여야 한다(아니면 `INVALID_INPUT`). 새로 붙는 동영상은 시트를 고치기 **전에** 영상 저장소(`MEDIA_REPO`)의 `hero/{첨부ID}.mp4`로 커밋하고, 실패하면 아무것도 바꾸지 않고 `MEDIA_FAILED`. 빠진 동영상은 저장소에서 지우고(이력에는 남음) 드라이브 조각은 휴지통으로. **보내지 않으면**(1안 관리자 화면) 기존 동영상을 두되, 사진을 빼거나 `depth`를 켜면 뺀다 |

처리 순서:
1. 토큰 확인 · 입력 검증
2. 첨부ID 확인 — 「첨부」에 있고, 구분(사진·파일)이 맞고, 글ID가 빈칸이거나 이 글의 것이어야 한다. 다른 글의 첨부는 거절. **새 글 번호는 이 확인까지 통과한 뒤에 만든다**
3. 글 행 쓰기 (작성자 · 수정자는 토큰에 담긴 이름) · 첨부 행에 글ID와 순서 기록
4. 이 글에서 빠진 기존 첨부는 공유를 끊고 휴지통으로
   - 표지: 원본을 빼거나 바꿨는데 `cutouts`가 예전 누끼면 누끼도 빠진 것으로 보고 휴지통으로 보낸 뒤 2.5D를 끈다(2단계 전에 처리, 2026-10-15)
5. 발행 (3-7)

| 응답 `data` | 설명 |
|---|---|
| `id` | 글ID |
| `published` | 발행 성공 여부. `false`면 저장은 된 것이고 화면은 [다시 반영] 버튼을 보인다 |

### 3-6. remove

| 요청 필드 | 설명 |
|---|---|
| `action` · `token` · `board` · `id` | |

글 행을 지우고, 첨부 파일의 공유를 끊어 휴지통으로 보내고, 발행한다. 응답 `data`: `published`. **표지 칸 · 사이트 사진 자리는 지울 수 없다**(`INVALID_INPUT`) — 사진을 빼려면 `save`에 빈 `photos`.

### 3-7. publish

`save` · `remove` 끝에서 자동으로 하고, 실패했을 때만 화면이 따로 부른다.

1. 「공지」 · 「언론홍보」 · 「갤러리」에서 공개 글만, 「표지」에서 사진을 올린 칸만(동영상 칸은 `heroVideo`에도) 모아 `data/posts.json`을 만든다 (`sheet-schema.md` 3절)
2. GitHub API로 현재 파일의 `sha`를 받아 새 내용으로 커밋한다. 커밋 메시지: `[Data]: 게시글 발행 - {이름}`
3. 결과를 Script Properties(`LAST_PUBLISH`)와 「로그」에 남긴다

| Script Properties | 값 |
|---|---|
| `GITHUB_TOKEN` | Fine-grained 토큰 (`kartsproject/home` · `kartsproject/home-media` Contents 읽기·쓰기, 2026-10-30 저장소 이전 뒤 kartsproject 계정 발급) |
| `GITHUB_REPO` | `kartsproject/home` (2026-10-30 전에는 `kartsgifted/home`) |
| `GITHUB_BRANCH` | 발행 대상 브랜치. 개발 중 `data-test`, **2026-10-14부터 `main`** |
| `GITHUB_PATH` | `data/posts.json` |
| `MEDIA_REPO` · `MEDIA_BRANCH` | 표지 동영상을 올리는 영상 전용 공개 저장소(GitHub Pages) · 브랜치. `setup()`이 기본값 `kartsproject/home-media` · `main`을 넣는다 (2026-10-16 2안). 커밋 메시지 `[Media]: 표지 동영상 올림 - {이름}` · `[Media]: 표지 동영상 내림` |
| `MEDIA_GITHUB_TOKEN` | (선택) 영상 저장소용 토큰. 없으면 `GITHUB_TOKEN`을 쓴다 — 그 토큰에 영상 저장소 Contents 읽기 · 쓰기를 더해야 함 |

- 동시에 두 사람이 저장해도 커밋이 엇갈리지 않게 `LockService`로 한 번에 하나만 발행한다.
- 내용이 직전 발행과 같으면 커밋하지 않는다(빌드 한도 절약, `decisions.md` 3절).

응답 `data`: `published`.

### 3-8. savePage (2026-11-04 WBS 18)

사이트 화면 위에서 고친 글자 · 목록을 페이지 한 줄로 저장한다(「페이지」 탭, `sheet-schema.md` 2-10). 사진은 이 요청이 아니라 `save`(`photo` · `hero`)로 바로 저장한다.

| 요청 필드 | 설명 |
|---|---|
| `action` · `token` | |
| `page` | `index` · `about` · `recruit` · `programs` · `mentoring` · `camp` · `news` (그 밖은 `INVALID_INPUT`) |
| `content` | `{ t:{ k12:"글" }, l:{ l1:[ { s, t, p } ] } }` — 페이지의 고친 것 전체(바꾸지 않은 칸 · 목록은 넣지 않음) |

검증 (하나라도 어기면 `INVALID_INPUT`, 아무것도 쓰지 않음):
- `t` 열쇠 `k` + 숫자 1~4자리, 400개까지. 값은 문자열 3,000자까지 — 줄바꿈은 `\n`으로 맞추고 제어 문자는 뺀다
- `l` 열쇠 `l` + 숫자 1~3자리, 30개까지. 값은 배열 60개까지, 항목은 `s`(0~199 정수, HTML의 몇 번째 항목을 본뜬 것) · `t`(열쇠 숫자 1~3자리, 40개까지, 값은 위와 같음) · `p`(복제한 항목의 사진 자리, 영소문자 · 숫자 · `-` 48자까지)
- `a`(더한 문단, WBS 18.7): 열쇠 `k` + 숫자, 100개까지. 값은 문자열 배열 20개까지(각 3,000자)
- `x`(더한 구역, WBS 18.7): 열쇠 `s` + 숫자 1~3자리, 60개까지. 값은 구역 배열 10개까지. 구역 `k`는 `text` · `photo` · `table` · `cards` · `steps`, `h` · `d` 문자열, `p` 문자열 배열 30개까지, `i` `[문자열, 문자열]` 배열 60개까지, `ph` 사진 자리(영소문자 · 숫자 · `-` 48자까지)
- 정리한 JSON이 45,000자를 넘으면 거절(시트 한 칸 5만 자)

처리: 「페이지」 탭이 없으면 만들고, 그 페이지 줄을 고치거나 새로 쓴 뒤 발행한다. 응답 `data`: `published`.
글 서식은 `**굵게**` · `==형광==` · 줄바꿈만이고, 화면(`content.js`)은 textContent · DOM으로만 넣는다.

---

## 4. 오류 코드

| 코드 | 상황 |
|---|---|
| `AUTH_INVALID` | 접근코드가 없거나 상태가 "사용"이 아님 |
| `AUTH_EXPIRED` | 접근코드 사용기한이 지남 |
| `AUTH_LOCKED` | 기기별 실패 5회로 10분 잠금 |
| `TOKEN_INVALID` | 토큰이 없거나 서명이 맞지 않음 |
| `TOKEN_EXPIRED` | 토큰 만료(2시간 경과 또는 코드 버전 변경) |
| `INVALID_INPUT` | 필수값 없음 · 길이 초과 · 분류가 목록에 없음 · 주소 형식 오류 |
| `FILE_REJECTED` | 허용하지 않는 형식 · 크기 초과 · 개수 초과 |
| `NOT_FOUND` | 고치거나 지우려는 글 · 첨부가 없음, 다른 글의 첨부를 연결하려 함 |
| `BUSY` | 다른 저장 · 발행이 끝나지 않아 잠금을 얻지 못함 (화면은 잠시 뒤 다시 시도 안내) |
| `MEDIA_FAILED` | 표지 동영상을 영상 저장소에 커밋하지 못함 — 저장은 하지 않음 (2026-10-16 2안) |
| `SERVER_ERROR` | 그 외 관문 내부 오류 |

발행 실패는 오류 코드로 돌려주지 않는다. 저장은 성공이므로 `ok: true`에 `published: false`로 알린다.

---

## 5. 토큰

아카이빙(`../archive/docs/api.md` 5절)과 같다.

| 항목 | 규칙 |
|---|---|
| 형태 | `{ code, ver, exp, name }`을 HMAC 서명한 자체 완결형 토큰 (아카이빙에 `name` 추가) |
| 유효시간 | 2시간, `ping`으로 연장 |
| 서명 키 | Script Properties `TOKEN_SECRET` |
| 보관 | 화면 `sessionStorage` (탭을 닫으면 로그아웃) |
| 일괄 무효화 | 「접근코드」의 버전을 올리면 그 코드의 접속이 모두 끊김 |

---

## 6. 실패 제한

| 항목 | 규칙 |
|---|---|
| 기기별 | 5회 실패 시 10분 잠금 (「설정」에서 조정) |
| 알림 | 「설정」의 운영진 알림 메일이 있으면 실패 급증 · 발행 실패 시 메일 |
| 기기ID | `localStorage`의 무작위 값. **인증 수단이 아니며** 실패 제한 · 로그 구분용 |

---

## 7. 방문자 화면 (참고)

관문을 부르지 않는다. 같은 사이트의 `data/posts.json`을 `fetch`로 읽는다.

| 화면 | 사용 |
|---|---|
| `news.html` 공지 탭 | `notices` 목록 · 페이지 나누기 · `#notice/글ID` 상세 |
| `news.html` 언론홍보 탭 | `press` 목록 · 페이지 나누기 · 누르면 기사 주소를 새 탭으로 |
| `news.html` 갤러리 탭 | `gallery` 목록 · 사이트 안 확대 보기 |
| `index.html` 표지 | `hero` — 올린 사진이 있는 칸은 그 사진, 없으면 기본 사진, 둘 다 없으면 건너뜀. `fg`가 있는 칸은 누끼를 겹쳐 2.5D로 (누끼를 받지 못하면 보통의 확대 · 축소). `heroVideo`가 있는 칸(2안)은 사진을 대기 사진으로 깔고 영상 저장소의 영상을 소리 없이 튼다 — 영상 길이만큼(6~20초) 머물고, 3초 안에 시작 못 하면 사진처럼 6초. 움직임 줄이기 · 데이터 절약 · 2G/3G면 대기 사진만 |
| `index.html` 소식 | `notices` · `press` 앞쪽 3개씩 (`decisions.md` 4절) |

사진 · 첨부 주소 만드는 규칙은 `decisions.md` 5절.

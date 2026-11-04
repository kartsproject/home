/**
 * 관문 진입점. 관리자 페이지(admin.html)만 이 관문을 부른다 — 방문자 화면은 data/posts.json을 읽는다.
 * docs/api.md 1절: 응답은 JSON만, { ok, error, data } 고정. 모든 요청은 POST 본문의 action으로 구분한다.
 */

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    return route_(req);
  } catch (err) {
    console.error(err);
    return jsonResponse_(false, 'SERVER_ERROR', null);
  }
}

function doGet(e) {
  // docs/api.md 1절: 토큰은 요청 본문으로만 전달한다(URL 금지). GET은 지원하지 않는다.
  return jsonResponse_(false, 'SERVER_ERROR', null);
}

function route_(req) {
  switch (req && req.action) {
    case 'auth':    return handleAuth_(req);
    case 'ping':    return handlePing_(req);
    case 'list':    return handleList_(req);
    case 'upload':  return handleUpload_(req);
    case 'save':    return handleSave_(req);
    case 'remove':  return handleRemove_(req);
    case 'publish': return handlePublish_(req);
    case 'savePage': return handleSavePage_(req);   // 페이지 직접 편집 (Pages.js, WBS 18)
    default:        return jsonResponse_(false, 'SERVER_ERROR', null);
  }
}

function jsonResponse_(ok, error, data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: ok, error: error, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 저장·삭제·업로드·발행은 한 번에 하나만 처리한다(글ID 중복, 행 어긋남, 커밋 엇갈림 방지).
// 잠금을 못 잡으면 BUSY — 화면은 잠시 뒤 다시 시도하라고 안내한다.
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return jsonResponse_(false, 'BUSY', null);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

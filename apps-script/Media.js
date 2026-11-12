/**
 * 표지 동영상 (2안 WBS 8.6, docs/decisions.md 2절 「2안 posts.json 약속」).
 * 드라이브의 영상은 다른 사이트의 <video>에서 재생되지 않는다(2026-10-16 시험: 페이지 안 요청은 403 · Chrome ERR_BLOCKED_BY_ORB).
 * 그래서 영상 전용 공개 저장소(MEDIA_REPO, GitHub Pages)에 올린다. 사이트 저장소(home)와 따로 둬서,
 * 학생 영상을 완전히 지워야 할 때 그 저장소만 이력을 정리하거나 새로 만들면 되게 한다.
 *
 * 흐름: 화면이 영상을 LIMITS_.videoPartBytes 조각으로 나눠 upload(kind 'video')로 차례로 보낸다
 *    → 조각마다 base64 글자 그대로 드라이브 폴더에 저장(공유 안 함)
 *    → 마지막 조각에서 「첨부」에 구분 「동영상」 한 줄(파일ID = 조각 파일ID들, 쉼표로)
 *    → 표지를 **저장할 때만** 조각을 이어 영상 저장소 hero/{첨부ID}.mp4로 커밋한다 (저장하지 않은 영상은 공개되지 않음)
 * Script Properties: MEDIA_REPO · MEDIA_BRANCH(setup()이 기본값을 넣음). 토큰은 MEDIA_GITHUB_TOKEN이 있으면 그것, 없으면 GITHUB_TOKEN
 */

var VIDEO_PART_TTL_ = 6 * 60 * 60;   // 조각 파일ID를 기억하는 시간(초). 이 안에 마지막 조각이 와야 한다

function handleVideoPart_(req, auth) {
  var name = cleanFileName_(req.name);
  var uploadId = String(req.uploadId || '');
  var parts = Number(req.parts), part = Number(req.part);
  var b64 = typeof req.base64 === 'string' ? req.base64 : '';
  var partChars = LIMITS_.videoPartBytes / 3 * 4;
  var maxParts = Math.ceil(LIMITS_.videoBytes / LIMITS_.videoPartBytes);
  var reject = function () { return jsonResponse_(false, 'FILE_REJECTED', null); };

  if (!/\.mp4$/i.test(name) || LIMITS_.videoTypes.indexOf(String(req.mimeType || '').toLowerCase()) === -1) return reject();
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(uploadId)) return reject();
  if (!(parts % 1 === 0 && part % 1 === 0 && parts >= 1 && parts <= maxParts && part >= 0 && part < parts)) return reject();
  var last = part === parts - 1;
  // 마지막이 아닌 조각은 정확히 조각 크기(패딩 없음)여야 조각별 base64를 이어 붙인 것이 파일 전체의 base64가 된다
  if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b64) || b64.length % 4 || (last ? b64.length > partChars : b64.length !== partChars)) return reject();
  if (part === 0) {
    var head = Utilities.base64Decode(b64.slice(0, 12));   // MP4는 4~7바이트가 'ftyp'
    if (!(head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70)) return reject();
  }
  var width = Math.round(Number(req.width)) || 0, height = Math.round(Number(req.height)) || 0;
  if (last && (width < 1 || height < 1 || width > 10000 || height > 10000)) return reject();

  // 드라이브 저장은 잠금 밖에서 (사진 업로드와 같음). 폴더가 공유되지 않으므로 조각도 공유되지 않는다
  var file = getBoardFolder_('hero').createFile(Utilities.newBlob(b64, 'text/plain', 'video-' + uploadId + '-' + part + '.b64.txt'));
  var cache = CacheService.getScriptCache();
  cache.put('vpart_' + uploadId + '_' + part, file.getId(), VIDEO_PART_TTL_);
  if (!last) return jsonResponse_(true, null, { part: part });

  var ids = [];
  for (var i = 0; i < parts; i++) ids.push(cache.get('vpart_' + uploadId + '_' + i));
  var size = (parts - 1) * LIMITS_.videoPartBytes + b64.length / 4 * 3 - b64.match(/=*$/)[0].length;
  if (ids.some(function (id) { return !id; }) || size > LIMITS_.videoBytes) {
    ids.forEach(function (id) { if (id) discardFile_(id); });
    return reject();
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    ids.forEach(discardFile_);
    return jsonResponse_(false, 'BUSY', null);
  }
  try {
    var id = nextId_('A', 5, readTab_('첨부').map(function (r) { return r['첨부ID']; }));
    writeRow_('첨부', {
      '첨부ID': id, '글ID': '', '구분': KIND_LABELS_.video, '순서': '',
      '파일ID': ids.join(','), '파일명': name, '크기': size,
      '가로': width, '세로': height, '공유': '',
      '올린사람': auth.name, '올린시각': new Date()
    });
  } finally {
    lock.releaseLock();
  }
  logAccess_('성공', auth.code, auth.name, '', 'upload', id);
  return jsonResponse_(true, null, { attachmentId: id, size: size });
}

// 영상 저장소 안의 경로. 화면(main.js · admin.js)이 MEDIA_BASE를 앞에 붙인다
function mediaPath_(attachmentId) {
  return 'hero/' + attachmentId + '.mp4';
}

// 「첨부」 동영상 한 줄의 조각을 이어 영상 저장소에 커밋한다. 실패하면 예외 — 저장이 MEDIA_FAILED로 멈춘다
function commitVideo_(a, name) {
  var b64 = String(a['파일ID']).split(',').map(function (id) {
    return DriveApp.getFileById(id).getBlob().getDataAsString();
  }).join('');
  githubPutFile_(mediaTarget_(), mediaPath_(a['첨부ID']), b64, '[Media]: 표지 동영상 올림 - ' + name);
}

// 영상 저장소에서 지운다(이력에는 남음). 실패해도 저장은 계속한다 — 지우지 못한 파일은 화면에서 쓰지 않으므로 보이지 않음
function removeVideo_(attachmentId) {
  try {
    githubDeleteFile_(mediaTarget_(), mediaPath_(attachmentId), '[Media]: 표지 동영상 내림');
  } catch (err) {
    console.error(err);
  }
}

function mediaTarget_() {
  var props = PropertiesService.getScriptProperties();
  var t = {
    token: props.getProperty('MEDIA_GITHUB_TOKEN') || props.getProperty('GITHUB_TOKEN'),
    repo: props.getProperty('MEDIA_REPO'),
    branch: props.getProperty('MEDIA_BRANCH')
  };
  if (!t.token || !t.repo || !t.branch) throw new Error('MEDIA_* 스크립트 속성이 비어 있음 — setup()을 실행할 것');
  return t;
}

function githubContents_(t, path) {
  return {
    url: 'https://api.github.com/repos/' + t.repo + '/contents/' + path,
    headers: { Authorization: 'Bearer ' + t.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  };
}

// 지금 파일의 sha (없으면 null)
function githubSha_(c, t) {
  var res = UrlFetchApp.fetch(c.url + '?ref=' + encodeURIComponent(t.branch), { headers: c.headers, muteHttpExceptions: true });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) throw new Error('GitHub 읽기 ' + res.getResponseCode());
  return JSON.parse(res.getContentText()).sha;
}

function githubPutFile_(t, path, b64, message) {
  var c = githubContents_(t, path);
  var body = { message: message, content: b64, branch: t.branch };
  var sha = githubSha_(c, t);
  if (sha) body.sha = sha;
  var res = UrlFetchApp.fetch(c.url, { method: 'put', headers: c.headers, contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200 && res.getResponseCode() !== 201) throw new Error('GitHub 영상 쓰기 ' + res.getResponseCode());
}

function githubDeleteFile_(t, path, message) {
  var c = githubContents_(t, path);
  var sha = githubSha_(c, t);
  if (!sha) return;
  var res = UrlFetchApp.fetch(c.url, { method: 'delete', headers: c.headers, contentType: 'application/json',
    payload: JSON.stringify({ message: message, sha: sha, branch: t.branch }), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('GitHub 영상 지우기 ' + res.getResponseCode());
}

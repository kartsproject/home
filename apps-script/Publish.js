/**
 * 발행: 공개 글만 모아 data/posts.json을 만들어 GitHub API로 저장소에 커밋한다.
 * docs/api.md 3-7, docs/decisions.md 3절. 방문자 화면은 관문을 거치지 않고 이 파일만 읽는다.
 *
 * Script Properties: GITHUB_TOKEN · GITHUB_REPO · GITHUB_BRANCH · GITHUB_PATH
 * 저장·삭제가 이미 잠금(withLock_) 안에서 부르므로 여기서는 잠금을 다시 잡지 않는다.
 */

function handlePublish_(req) {
  var auth = requireAuth_(req);
  if (!auth.ok) return jsonResponse_(false, auth.error, null);
  return withLock_(function () {
    var result = publish_(auth.name, true);
    return jsonResponse_(true, null, { published: result.ok });
  });
}

// 반환: { ok }. 실패해도 예외를 던지지 않는다 — 저장은 이미 끝났으므로 화면이 [다시 반영]으로 재시도한다.
function publish_(name, force) {
  var props = PropertiesService.getScriptProperties();
  try {
    var payload = buildPublicPosts_();
    var body = JSON.stringify(payload.posts, null, 2) + '\n';

    // 내용이 직전 발행과 같으면 커밋하지 않는다(GitHub Pages 빌드 한도 절약). updatedAt은 비교에서 뺀다.
    var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload.compareKey, Utilities.Charset.UTF_8));
    var target = props.getProperty('GITHUB_BRANCH') + ':' + props.getProperty('GITHUB_PATH');
    if (!force && props.getProperty('LAST_PUBLISH_HASH') === hash + '@' + target) {
      return recordPublish_(true, name, '변경 없음');
    }

    commitToGitHub_(body, '[Data]: 게시글 발행 - ' + name);
    props.setProperty('LAST_PUBLISH_HASH', hash + '@' + target);
    return recordPublish_(true, name, '');
  } catch (err) {
    console.error(err);
    notifyStaff_('사이트 반영 실패', '게시글은 저장됐지만 사이트 반영(발행)에 실패했습니다. 관리자 페이지에서 [다시 반영]을 눌러 주세요.\n\n' + err.message);
    return recordPublish_(false, name, String(err.message).slice(0, 200));
  }
}

function recordPublish_(ok, name, note) {
  var at = Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
  PropertiesService.getScriptProperties().setProperty('LAST_PUBLISH', JSON.stringify({ ok: ok, at: at }));
  logAccess_(ok ? '성공' + (note ? '(' + note + ')' : '') : '실패(' + note + ')', '', name, '', 'publish', '');
  return { ok: ok };
}

function getLastPublish_() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty('LAST_PUBLISH') || 'null');
  } catch (err) {
    return null;
  }
}

// docs/sheet-schema.md 3절 모양. 공개 글만(표지는 늘 공개), 관리용 값(작성자·시각·첨부ID)은 넣지 않는다.
function buildPublicPosts_() {
  var attachments = readTab_('첨부');
  var isPublic = function (r) { return r['공개여부'] === '공개'; };
  var notices = sortNotices_(readTab_('공지').filter(isPublic).map(function (r) { return noticeFromRow_(r, attachments, false); }));
  var press = sortByDate_(readTab_('언론홍보').filter(isPublic).map(function (r) { return pressFromRow_(r, false); }));
  var gallery = sortByDate_(readTab_('갤러리').filter(isPublic).map(function (r) { return galleryFromRow_(r, attachments, false); }));
  // 표지: 사진을 올린 칸만 { dance: { fileId, w, h }, … }. 빈 칸은 화면이 기본 사진을 쓰거나 건너뛴다.
  // 2.5D 입체 효과를 켠 칸은 누끼(fg)와 확대 중심(depth, 사진의 %)을 더한다
  // 동영상을 올린 칸은 heroVideo에 { src(영상 저장소 경로), w, h }를 더하고, hero에는 대기 사진(첫 장면)이 그대로 들어간다 —
  // 1안 화면(heroVideo를 모름)은 그 사진을 보인다 (2안 WBS 8.6, docs/decisions.md 「2안 posts.json 약속」)
  var hero = {}, heroVideo = {};
  readTab_('표지').forEach(function (r) {
    var slot = String(r['글ID']).replace(/^H-/, '');
    var photo = attachmentsOf_(r['글ID'], '사진', attachments, false)[0];
    if (!photo) return;
    var cutout = attachmentsOf_(r['글ID'], '누끼', attachments, false)[0];
    if (r['입체효과'] === '예' && cutout) {
      photo.fg = { fileId: cutout.fileId };
      photo.depth = parseCenter_(r['입체중심']);
    }
    hero[slot] = photo;
    var video = attachmentsOf_(r['글ID'], '동영상', attachments, false)[0];
    if (video) heroVideo[slot] = video;
  });
  // 사이트 사진 자리: 바꾼 자리만 { step1: { fileId, w, h, pos }, … } (Photos.js, WBS 15). 없는 자리는 화면의 기본 사진
  var photos = buildPublicPhotos_(attachments);
  // 모집요강: 공개 연도만 { "2026": { title, files } } (Guides.js, WBS 17.4)
  var guides = buildPublicGuides_(attachments);
  return {
    compareKey: JSON.stringify({ notices: notices, press: press, gallery: gallery, hero: hero, heroVideo: heroVideo, photos: photos, guides: guides, photoMode: getPhotoMode_() }),
    posts: {
      updatedAt: Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX"),
      notices: notices,
      press: press,
      gallery: gallery,
      hero: hero,
      heroVideo: heroVideo,
      photos: photos,
      guides: guides,
      // 'attached': 기본 사진 없이 올린 사진만 — 사진을 뺀 자리는 비워 둔다 (ImportPhotos.js, 2026-11-04). 빈 값이면 예전처럼 기본 사진
      photoMode: getPhotoMode_()
    }
  };
}

// GitHub Contents API: 현재 파일의 sha를 받아 새 내용으로 덮어쓴다. 그사이 다른 커밋으로 sha가 바뀌었으면 한 번 다시 시도한다.
function commitToGitHub_(text, message) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('GITHUB_TOKEN');
  var repo = props.getProperty('GITHUB_REPO');
  var branch = props.getProperty('GITHUB_BRANCH');
  var path = props.getProperty('GITHUB_PATH');
  if (!token || !repo || !branch || !path) throw new Error('GITHUB_* 스크립트 속성이 비어 있음');

  var url = 'https://api.github.com/repos/' + repo + '/contents/' + path;
  var headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  var content = Utilities.base64Encode(text, Utilities.Charset.UTF_8);

  for (var attempt = 0; attempt < 2; attempt++) {
    var current = UrlFetchApp.fetch(url + '?ref=' + encodeURIComponent(branch), { headers: headers, muteHttpExceptions: true });
    var sha = null;
    if (current.getResponseCode() === 200) sha = JSON.parse(current.getContentText()).sha;
    else if (current.getResponseCode() !== 404) throw new Error('GitHub 읽기 ' + current.getResponseCode());

    var body = { message: message, content: content, branch: branch };
    if (sha) body.sha = sha;
    var res = UrlFetchApp.fetch(url, {
      method: 'put', headers: headers, contentType: 'application/json',
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code === 200 || code === 201) return;
    if (code !== 409 && code !== 422) throw new Error('GitHub 쓰기 ' + code);
  }
  throw new Error('GitHub 쓰기 충돌 — 다시 시도 필요');
}

/**
 * 게시글 목록·저장·삭제. docs/api.md 3-3 · 3-5 · 3-6, docs/sheet-schema.md 2-1 ~ 2-3 · 2-7 · 2-8.
 * 공지(N-0001) · 언론홍보(P-0001) · 갤러리(G-0001) · 표지(H-dance 등)는 같은 흐름으로 처리하고, 차이는 BOARDS_와 검증 함수에만 둔다.
 * 표지는 칸이 고정(fixed)이라 새로 만들거나 지우지 않고, 사진 한 장(+ 2.5D용 누끼 한 장 또는 동영상 한 개)만 바꾼다 (Setup.js HERO_SLOTS_).
 * 사이트 사진 자리(S-step1 등, WBS 15)도 고정이고 사진 한 장 + 보이는 위치만 바꾼다 (Photos.js PHOTO_SLOTS_).
 */

var BOARDS_ = {
  notice:  { tab: '공지',     prefix: 'N', validate: function (p) { return validateNotice_(p); },
             maxPhotos: function () { return LIMITS_.noticePhotos; },  maxFiles: function () { return LIMITS_.noticeFiles; }, maxCutouts: function () { return 0; }, maxVideos: function () { return 0; } },
  press:   { tab: '언론홍보', prefix: 'P', validate: function (p) { return validatePress_(p); },
             maxPhotos: function () { return 0; }, maxFiles: function () { return 0; }, maxCutouts: function () { return 0; }, maxVideos: function () { return 0; } },
  gallery: { tab: '갤러리',   prefix: 'G', validate: function (p) { return validateGallery_(p); },
             maxPhotos: function () { return LIMITS_.galleryPhotos; }, maxFiles: function () { return 0; }, maxCutouts: function () { return 0; }, maxVideos: function () { return 0; } },
  hero:    { tab: '표지', fixed: true, hero: true, validate: function (p) { return validateHero_(p); },
             maxPhotos: function () { return 1; }, maxFiles: function () { return 0; }, maxCutouts: function () { return 1; }, maxVideos: function () { return 1; } },
  guide:   { tab: '모집요강', prefix: 'R', ensure: function () { ensureGuideTab_(); }, check: function (f, rows, ownId) { return checkGuideYear_(f, rows, ownId); },
             validate: function (p) { return validateGuide_(p); },
             maxPhotos: function () { return 0; }, maxFiles: function () { return LIMITS_.guideFiles; }, maxCutouts: function () { return 0; }, maxVideos: function () { return 0; } },
  photo:   { tab: '사진', fixed: true, ensure: function () { ensurePhotoSlots_(); }, validate: function (p) { return validatePhotoSlot_(p); },
             maxPhotos: function () { return 1; }, maxFiles: function () { return 0; }, maxCutouts: function () { return 0; }, maxVideos: function () { return 0; } }
};

function handleList_(req) {
  var auth = requireAuth_(req);
  if (!auth.ok) return jsonResponse_(false, auth.error, null);

  // 「사진」 탭은 관문을 새로 배포한 뒤 처음 목록을 열 때 만든다 — setup을 다시 돌리지 않아도 되게 (Photos.js)
  if (photoSlotsMissing_()) withLock_(function () { ensurePhotoSlots_(); return null; });
  if (guideTabMissing_()) withLock_(function () { ensureGuideTab_(); return null; });

  var attachments = readTab_('첨부');
  var notices = readTab_('공지').map(function (r) { return noticeFromRow_(r, attachments, true); });
  var press = readTab_('언론홍보').map(function (r) { return pressFromRow_(r, true); });
  var gallery = readTab_('갤러리').map(function (r) { return galleryFromRow_(r, attachments, true); });
  var hero = readTab_('표지').map(function (r) { return heroFromRow_(r, attachments); });
  var photos = readPhotoTab_().map(function (r) { return photoSlotFromRow_(r, attachments); });
  var guides = readGuideTab_().map(function (r) { return guideFromRow_(r, attachments, true); })
    .sort(function (a, b) { return a.year < b.year ? 1 : -1; });
  return jsonResponse_(true, null, {
    notices: sortNotices_(notices),
    press: sortByDate_(press),
    gallery: sortByDate_(gallery),
    hero: hero,
    photos: photos,
    guides: guides,
    photoMode: getPhotoMode_(),
    categories: getCategories_(),
    limits: LIMITS_,
    lastPublish: getLastPublish_()
  });
}

function handleSave_(req) {
  var auth = requireAuth_(req);
  if (!auth.ok) return jsonResponse_(false, auth.error, null);
  var board = BOARDS_[req.board];
  if (!board) return jsonResponse_(false, 'INVALID_INPUT', null);

  var fields = board.validate(req.post);
  if (!fields || (board.fixed && !req.id)) return jsonResponse_(false, 'INVALID_INPUT', null);

  var photoIds = idList_(req.photos), fileIds = idList_(req.files), cutoutIds = idList_(req.cutouts), videoIds = idList_(req.videos);
  if (!photoIds || !fileIds || !cutoutIds || !videoIds) return jsonResponse_(false, 'INVALID_INPUT', null);
  if (photoIds.length > board.maxPhotos() || fileIds.length > board.maxFiles() || cutoutIds.length > board.maxCutouts() || videoIds.length > board.maxVideos()) return jsonResponse_(false, 'FILE_REJECTED', null);

  return withLock_(function () {
    if (board.ensure) board.ensure();
    var rows = readTab_(board.tab);
    var existing = null;
    if (req.id) {
      existing = rows.filter(function (r) { return r['글ID'] === req.id; })[0];
      if (!existing) return jsonResponse_(false, 'NOT_FOUND', null);
    }
    if (board.check) {
      var checkError = board.check(fields, rows, existing ? existing['글ID'] : '');
      if (checkError) return jsonResponse_(false, checkError, null);
    }
    // 첨부 확인: 「첨부」에 있고, 구분이 맞고, 아직 어느 글에도 붙지 않았거나 이 글의 것이어야 한다.
    var ownId = existing ? existing['글ID'] : '';
    var attachments = readTab_('첨부');
    var byId = {};
    attachments.forEach(function (a) { byId[a['첨부ID']] = a; });
    if (board.hero) {
      cutoutIds = checkHeroDepth_(fields, photoIds, cutoutIds, ownId, attachments, byId);
      if (!cutoutIds) return jsonResponse_(false, 'INVALID_INPUT', null);
      // 동영상을 모르는 화면(1안 관리자 페이지)은 videos를 보내지 않는다 — 기존 동영상을 그대로 두되, 사진을 빼거나 2.5D를 켜면 뺀다
      if (req.videos === undefined) {
        var kept = attachments.filter(function (a) { return a['글ID'] === ownId && a['구분'] === '동영상'; })[0];
        videoIds = kept && photoIds.length && !fields['입체효과'] ? [kept['첨부ID']] : [];
      }
      // 동영상 칸은 대기 사진(첫 장면)이 있어야 하고 2.5D를 쓰지 않는다 (2026-10-16 사용자 결정)
      if (videoIds.length && (!photoIds.length || fields['입체효과'])) return jsonResponse_(false, 'INVALID_INPUT', null);
    }
    var seen = {};
    var ok = [[photoIds, '사진'], [fileIds, '파일'], [cutoutIds, '누끼'], [videoIds, '동영상']].every(function (pair) {
      return pair[0].every(function (aid) {
        var a = byId[aid];
        if (!a || seen[aid] || a['구분'] !== pair[1] || (a['글ID'] && a['글ID'] !== ownId)) return false;
        seen[aid] = true;
        return true;
      });
    });
    if (!ok) return jsonResponse_(false, 'NOT_FOUND', null);

    // 새로 붙는 동영상(표지)은 이때 영상 저장소에 올린다 — 시트를 고치기 전이라 실패하면 아무것도 바꾸지 않고 멈춘다 (Media.js)
    try {
      videoIds.forEach(function (aid) { if (!byId[aid]['글ID']) commitVideo_(byId[aid], auth.name); });
    } catch (err) {
      console.error(err);
      return jsonResponse_(false, 'MEDIA_FAILED', null);
    }

    // 새 글 번호는 검증을 모두 통과한 뒤에 받는다(실패한 저장이 번호를 쓰지 않게). 표지 칸 · 사진 자리는 늘 기존 행이다.
    var id = ownId || nextId_(board.prefix, 4, rows.map(function (r) { return r['글ID']; }));
    if (board.fixed) fields['칸'] = existing['칸'];

    // 요청에 없는 열은 기존 값을 그대로 쓴다 — 새 열(예: 갤러리 분야)을 모르는 화면(1안 관리자 페이지)이 저장해도 지워지지 않게
    if (existing) Object.keys(existing).forEach(function (h) { if (h !== '_row' && !(h in fields)) fields[h] = existing[h]; });

    var now = new Date();
    fields['글ID'] = id;
    fields['작성자'] = existing ? existing['작성자'] : auth.name;
    fields['작성시각'] = existing ? existing['작성시각'] : now;
    fields['수정자'] = auth.name;
    fields['수정시각'] = now;
    writeRow_(board.tab, fields, existing && existing._row);

    // 첨부 행에 글ID·순서를 적고, 이 글에서 빠진 첨부는 휴지통으로 보낸다.
    [photoIds, fileIds, cutoutIds, videoIds].forEach(function (ids) {
      ids.forEach(function (aid, i) {
        var a = byId[aid];
        if (a['글ID'] === id && Number(a['순서']) === i + 1) return;
        a['글ID'] = id;
        a['순서'] = i + 1;
        writeRow_('첨부', a, a._row);
      });
    });
    var dropped = attachments.filter(function (a) { return a['글ID'] === id && !seen[a['첨부ID']]; });
    dropped.forEach(discardAttachment_);
    deleteRows_('첨부', dropped.map(function (a) { return a._row; }));

    logAccess_('성공', auth.code, auth.name, '', 'save', id);
    var published = publish_(auth.name);
    return jsonResponse_(true, null, { id: id, published: published.ok });
  });
}

function handleRemove_(req) {
  var auth = requireAuth_(req);
  if (!auth.ok) return jsonResponse_(false, auth.error, null);
  var board = BOARDS_[req.board];
  if (!board || board.fixed || !req.id) return jsonResponse_(false, 'INVALID_INPUT', null);

  return withLock_(function () {
    if (board.ensure) board.ensure();
    var row = readTab_(board.tab).filter(function (r) { return r['글ID'] === req.id; })[0];
    if (!row) return jsonResponse_(false, 'NOT_FOUND', null);

    var mine = readTab_('첨부').filter(function (a) { return a['글ID'] === req.id; });
    mine.forEach(discardAttachment_);
    deleteRows_('첨부', mine.map(function (a) { return a._row; }));
    deleteRows_(board.tab, [row._row]);

    logAccess_('성공', auth.code, auth.name, '', 'remove', req.id);
    var published = publish_(auth.name);
    return jsonResponse_(true, null, { published: published.ok });
  });
}

/* ---------- 검증 (docs/sheet-schema.md 2-1 · 2-2 · 2-7 · 2-8) ---------- */

// 통과하면 시트에 쓸 { 머리글: 값 }, 아니면 null
function validateNotice_(p) {
  if (!p) return null;
  var title = cleanText_(p.title), body = cleanText_(p.body, true), link = cleanText_(p.photoLink);
  var date = cleanDate_(p.date), vis = cleanVisibility_(p.visibility);
  if (getCategories_().indexOf(p.category) === -1) return null;
  if (!title || title.length > LIMITS_.noticeTitle || body.length > LIMITS_.noticeBody) return null;
  if (!date || !vis) return null;
  if (p.photoPosition !== 'top' && p.photoPosition !== 'bottom') return null;
  if (link && (link.length > LIMITS_.link || !/^https?:\/\/\S+$/i.test(link))) return null;
  return {
    '분류': p.category, '제목': title, '본문': body, '게시일': date,
    '상단고정': p.pinned === true ? '예' : '', '사진위치': p.photoPosition === 'bottom' ? '아래' : '위',
    '사진링크': link, '공개여부': vis
  };
}

// 과정 · 분야(course · field)는 코드로 받아 시트 「분야」 열에 「워크숍 · 무용」으로 쓴다(Setup.js GALLERY_COURSES_ · GALLERY_FIELDS_).
// 둘 다 보내지 않으면(분야 칸을 모르는 1안 관리자 화면) 기존 값을 둔다 — handleSave_
function validateGallery_(p) {
  if (!p) return null;
  var title = cleanText_(p.title), desc = cleanText_(p.desc);
  var date = cleanDate_(p.date), vis = cleanVisibility_(p.visibility);
  if (!title || title.length > LIMITS_.galleryTitle || desc.length > LIMITS_.galleryDesc) return null;
  if (!date || !vis) return null;
  var fields = { '제목': title, '설명': desc, '게시일': date, '공개여부': vis };
  if (p.course !== undefined || p.field !== undefined) {
    var label = galleryLabel_(p.course, p.field);
    if (label === null) return null;
    fields['분야'] = label;
  }
  return fields;
}

// ('workshop', 'dance') → '워크숍 · 무용', ('mentoring', '') → '심화멘토링 · 공통', ('', '') → ''(지정 안 함).
// 하나만 보냈거나, 목록에 없는 코드거나, 과정 없이 분야만 있으면 null
function galleryLabel_(course, field) {
  if (typeof course !== 'string' || typeof field !== 'string') return null;
  if (course === '') return field === '' ? '' : null;
  var c = codeKey_(GALLERY_COURSES_, course), f = codeKey_(GALLERY_FIELDS_, field);
  return c === null || f === null ? null : c + ' · ' + f;
}

function codeKey_(map, code) {
  var keys = Object.keys(map).filter(function (k) { return map[k] === code; });
  return keys.length ? keys[0] : null;
}

// 시트 값 → { course, field }. 8.5 때의 옛 값(「무용」 · 「심화멘토링」 등)도 읽는다. 빈칸이나 모르는 값은 지정 안 함
function galleryCodes_(label) {
  var s = String(label == null ? '' : label).trim(), has = Object.prototype.hasOwnProperty;
  if (has.call(GALLERY_OLD_VALUES_, s)) return { course: GALLERY_OLD_VALUES_[s][0], field: GALLERY_OLD_VALUES_[s][1] };
  var parts = s.split('·').map(function (x) { return x.trim(); });
  if (parts.length === 2 && has.call(GALLERY_COURSES_, parts[0]) && has.call(GALLERY_FIELDS_, parts[1])) {
    return { course: GALLERY_COURSES_[parts[0]], field: GALLERY_FIELDS_[parts[1]] };
  }
  return { course: '', field: '' };
}

// 언론홍보: 기사 한 건. 목록에서 누르면 기사 주소가 새 탭으로 열린다 (사이트 안 상세 화면 없음)
function validatePress_(p) {
  if (!p) return null;
  var title = cleanText_(p.title), source = cleanText_(p.source), url = cleanText_(p.url);
  var date = cleanDate_(p.date), vis = cleanVisibility_(p.visibility);
  if (!title || title.length > LIMITS_.pressTitle || !source || source.length > LIMITS_.pressSource) return null;
  if (!date || !vis) return null;
  if (!url || url.length > LIMITS_.link || !/^https?:\/\/\S+$/i.test(url)) return null;
  return { '언론사': source, '제목': title, '게시일': date, '기사주소': url, '공개여부': vis };
}

// 표지: 2.5D 입체 효과 켬/끔과 확대 중심(누끼 인물 영역의 가운데, 사진 가로 · 세로의 %).
// 칸 이름은 handleSave_가 기존 행에서 옮기고, 사진 · 누끼와 맞는지는 checkHeroDepth_가 본다
function validateHero_(p) {
  if (!p) return null;
  var center = '';
  if (p.center != null) {
    var x = Number(p.center.x), y = Number(p.center.y);
    if (!isFinite(x) || !isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return null;
    center = x.toFixed(1) + ',' + y.toFixed(1);
  }
  return { '입체효과': p.depth === true ? '예' : '', '입체중심': center };
}

// 표지 2.5D (docs/decisions.md 2절). 저장할 누끼 첨부ID 목록을 돌려주고, 맞지 않으면 null(INVALID_INPUT).
// - 원본을 빼거나 바꿨는데 누끼가 예전 것이면 누끼를 빼고 효과를 끈다 — 새 사진 위에 옛 인물이 겹치지 않게 (2026-10-15 사용자 결정)
// - 효과를 켜려면 누끼가 있어야 하고, 원본과 크기가 같아야 한다(관리자 화면이 원본 크기로 맞춰 올린다)
function checkHeroDepth_(fields, photoIds, cutoutIds, ownId, attachments, byId) {
  var oldPhoto = attachments.filter(function (a) { return a['글ID'] === ownId && a['구분'] === '사진'; })[0];
  var photoChanged = !oldPhoto || photoIds[0] !== oldPhoto['첨부ID'];
  var cut = cutoutIds.length ? byId[cutoutIds[0]] : null;
  if (cut && (!photoIds.length || (photoChanged && cut['글ID'] === ownId))) {
    fields['입체효과'] = '';
    cutoutIds = [];
  }
  if (!cutoutIds.length) {
    if (fields['입체효과']) return null;
    fields['입체중심'] = '';
    return cutoutIds;
  }
  var photo = byId[photoIds[0]];
  if (fields['입체효과'] && photo && cut &&
      (Number(photo['가로']) !== Number(cut['가로']) || Number(photo['세로']) !== Number(cut['세로']))) return null;
  if (!fields['입체중심']) fields['입체중심'] = '50.0,50.0';
  return cutoutIds;
}

// "64.2,55.0" → { x: 64.2, y: 55 }. 비었거나 잘못되면 가운데
function parseCenter_(value) {
  var m = String(value == null ? '' : value).match(/^\s*([\d.]+)\s*,\s*([\d.]+)\s*$/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 50, y: 50 };
}

// 여러 줄을 허용하지 않으면 줄바꿈을 공백으로 바꾼다. 줄바꿈은 \n 하나로 맞춘다.
function cleanText_(value, multiline) {
  var s = String(value == null ? '' : value).replace(/\r\n?/g, '\n');
  if (!multiline) s = s.replace(/\n/g, ' ');
  return s.trim();
}

function cleanDate_(value) {
  var s = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  var d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
}

function cleanVisibility_(value) {
  return value === '공개' || value === '비공개' ? value : '';
}

function idList_(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  return value.every(function (v) { return typeof v === 'string' && /^A-\d+$/.test(v); }) ? value : null;
}

/* ---------- 시트 행 → 화면용 객체 (admin=true면 관리용 값 포함) ---------- */

function attachmentsOf_(postId, kind, attachments, admin) {
  return attachments
    .filter(function (a) { return a['글ID'] === postId && a['구분'] === kind; })
    .sort(function (a, b) { return Number(a['순서']) - Number(b['순서']); })
    .map(function (a) {
      // 동영상은 드라이브 조각(공유 안 함) 대신 영상 저장소 경로를 준다 (Media.js)
      var o = kind === '동영상' ? { src: mediaPath_(a['첨부ID']) } : { fileId: String(a['파일ID']) };
      if (kind !== '파일') { o.w = Number(a['가로']) || 0; o.h = Number(a['세로']) || 0; }
      else { o.name = String(a['파일명']); o.size = Number(a['크기']) || 0; }
      if (admin) { o.attachmentId = a['첨부ID']; o.name = String(a['파일명']); o.size = Number(a['크기']) || 0; }
      return o;
    });
}

function noticeFromRow_(r, attachments, admin) {
  var o = {
    id: r['글ID'], category: String(r['분류']), title: String(r['제목']), body: String(r['본문']),
    date: formatDateCell_(r['게시일']), pinned: r['상단고정'] === '예',
    photoPosition: r['사진위치'] === '아래' ? 'bottom' : 'top', photoLink: String(r['사진링크']),
    photos: attachmentsOf_(r['글ID'], '사진', attachments, admin),
    files: attachmentsOf_(r['글ID'], '파일', attachments, admin)
  };
  if (admin) addAdminFields_(o, r);
  return o;
}

function galleryFromRow_(r, attachments, admin) {
  var cf = galleryCodes_(r['분야']);
  var o = {
    id: r['글ID'], title: String(r['제목']), desc: String(r['설명']), date: formatDateCell_(r['게시일']),
    course: cf.course, field: cf.field,
    photos: attachmentsOf_(r['글ID'], '사진', attachments, admin)
  };
  if (admin) addAdminFields_(o, r);
  return o;
}

function pressFromRow_(r, admin) {
  var o = { id: r['글ID'], source: String(r['언론사']), title: String(r['제목']), date: formatDateCell_(r['게시일']), url: String(r['기사주소']) };
  if (admin) addAdminFields_(o, r);
  return o;
}

// 관리용만 — 방문자용은 Publish.js가 { dance: 사진, … } 모양으로 만든다. photos · cutouts는 0장 또는 1장
function heroFromRow_(r, attachments) {
  return {
    id: r['글ID'], slot: String(r['글ID']).replace(/^H-/, ''), label: String(r['칸']),
    photos: attachmentsOf_(r['글ID'], '사진', attachments, true),
    cutouts: attachmentsOf_(r['글ID'], '누끼', attachments, true),
    videos: attachmentsOf_(r['글ID'], '동영상', attachments, true),
    depth: r['입체효과'] === '예', center: parseCenter_(r['입체중심']),
    updatedBy: String(r['수정자']), updatedAt: formatDateTimeCell_(r['수정시각'])
  };
}

function addAdminFields_(o, r) {
  o.visibility = r['공개여부'];
  o.author = String(r['작성자']);
  o.createdAt = formatDateTimeCell_(r['작성시각']);
  o.updatedBy = String(r['수정자']);
  o.updatedAt = formatDateTimeCell_(r['수정시각']);
}

/* ---------- 정렬 (docs/sheet-schema.md 3절) ---------- */

function sortNotices_(list) {
  return list.sort(function (a, b) {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

// 갤러리 · 언론홍보: 게시일 최신순(같으면 글ID 큰 순)
function sortByDate_(list) {
  return list.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

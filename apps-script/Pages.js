/**
 * 페이지 직접 편집 (2026-11-04 WBS 18). 운영진이 사이트 화면에서 고친 글자 · 목록을 페이지마다 한 줄로 둔다.
 * 「페이지」 탭: 페이지(index · about …) | 내용(JSON) | 수정자 | 수정시각. 공개 사이트에 그대로 나가는 글이라 공개여부가 없다.
 *
 * 내용 모양 (assets/js/content.js가 읽는다 — docs/sheet-schema.md 2-11)
 *   { t: { k12: "고친 글", … },                         // 글자 칸(data-e) — 고친 칸만
 *     l: { l1: [ { s: 0, t: { "2": "글" }, p: "mu1-x4k2" }, … ] } }   // 목록(data-list) — 바꾼 목록만, 화면 순서대로
 *        s: HTML의 몇 번째 항목을 본뜬 것인지(0부터), t: 항목 안 글자 칸(data-ei) 중 고친 것, p: 복제한 항목의 새 사진 자리
 * 글은 **굵게** · ==형광== · 줄바꿈(\n)만 쓴다. 화면은 textContent · DOM으로만 넣는다(CLAUDE.md 보안 5).
 * 탭은 처음 저장할 때 만든다(setup을 다시 돌리지 않아도 되게, 사진 · 모집요강 탭과 같은 방식).
 */
var PAGE_TAB_ = '페이지';
var PAGE_IDS_ = ['index', 'about', 'recruit', 'programs', 'mentoring', 'camp', 'news'];
var PAGE_LIMITS_ = { text: 3000, texts: 400, lists: 30, items: 60, itemTexts: 40, json: 45000 };   // 시트 한 칸은 5만 자까지

function pageTabMissing_() {
  return !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PAGE_TAB_);
}

// 잠금 안에서만 부른다
function ensurePageTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PAGE_TAB_);
  var headers = TAB_HEADERS_[PAGE_TAB_];
  if (sheet) { addMissingHeaders_(sheet, PAGE_TAB_); return; }
  sheet = ss.insertSheet(PAGE_TAB_, ss.getSheets().length);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  (TEXT_COLUMNS_[PAGE_TAB_] || []).forEach(function (h) {
    sheet.getRange(2, headers.indexOf(h) + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
  });
}

// 글 한 칸: 문자열만, 줄바꿈은 \n 하나로, 보이지 않는 제어 문자는 뺀다. 너무 길면 null
function cleanPageText_(v) {
  if (typeof v !== 'string') return null;
  var s = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return s.length > PAGE_LIMITS_.text ? null : s;
}

function isPlainObject_(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// 통과하면 정리한 내용, 아니면 null(INVALID_INPUT). 빈 칸 · 빈 목록도 그대로 둔다(운영진이 일부러 비운 것)
function validatePageContent_(c) {
  if (!isPlainObject_(c)) return null;
  var out = { t: {}, l: {} };
  var t = c.t == null ? {} : c.t, l = c.l == null ? {} : c.l;
  if (!isPlainObject_(t) || !isPlainObject_(l)) return null;
  var tk = Object.keys(t), lk = Object.keys(l);
  if (tk.length > PAGE_LIMITS_.texts || lk.length > PAGE_LIMITS_.lists) return null;
  for (var i = 0; i < tk.length; i++) {
    if (!/^k\d{1,4}$/.test(tk[i])) return null;
    var s = cleanPageText_(t[tk[i]]);
    if (s === null) return null;
    out.t[tk[i]] = s;
  }
  for (var j = 0; j < lk.length; j++) {
    var items = l[lk[j]];
    if (!/^l\d{1,3}$/.test(lk[j]) || !Array.isArray(items) || items.length > PAGE_LIMITS_.items) return null;
    var list = [];
    for (var n = 0; n < items.length; n++) {
      var it = items[n];
      if (!isPlainObject_(it)) return null;
      var src = it.s;
      if (typeof src !== 'number' || src !== Math.floor(src) || src < 0 || src > 199) return null;
      var o = { s: src };
      if (it.t != null) {
        if (!isPlainObject_(it.t)) return null;
        var rk = Object.keys(it.t);
        if (rk.length > PAGE_LIMITS_.itemTexts) return null;
        o.t = {};
        for (var r = 0; r < rk.length; r++) {
          if (!/^\d{1,3}$/.test(rk[r])) return null;
          var rs = cleanPageText_(it.t[rk[r]]);
          if (rs === null) return null;
          o.t[rk[r]] = rs;
        }
      }
      if (it.p != null) {
        if (typeof it.p !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(it.p) || it.p.length > 48) return null;
        o.p = it.p;
      }
      list.push(o);
    }
    out.l[lk[j]] = list;
  }
  return JSON.stringify(out).length > PAGE_LIMITS_.json ? null : out;
}

// { index: { t, l }, … } — 탭이 없거나 내용이 깨진 줄은 넣지 않는다(화면은 HTML 글 그대로)
function readPages_() {
  var out = {};
  if (pageTabMissing_()) return out;
  readTab_(PAGE_TAB_).forEach(function (r) {
    var id = String(r['페이지']);
    if (PAGE_IDS_.indexOf(id) === -1) return;
    try {
      var c = validatePageContent_(JSON.parse(String(r['내용'] || '{}')));
      if (c) out[id] = c;
    } catch (err) { console.error('페이지 내용 읽기 실패: ' + id); }
  });
  return out;
}

// 관리용 — 페이지마다 마지막으로 고친 사람 · 때
function readPageMeta_() {
  var out = {};
  if (pageTabMissing_()) return out;
  readTab_(PAGE_TAB_).forEach(function (r) {
    out[String(r['페이지'])] = { updatedBy: String(r['수정자']), updatedAt: formatDateTimeCell_(r['수정시각']) };
  });
  return out;
}

// docs/api.md 3-8: { action:'savePage', token, page, content } → { published }
function handleSavePage_(req) {
  var auth = requireAuth_(req);
  if (!auth.ok) return jsonResponse_(false, auth.error, null);
  if (PAGE_IDS_.indexOf(req.page) === -1) return jsonResponse_(false, 'INVALID_INPUT', null);
  var content = validatePageContent_(req.content);
  if (!content) return jsonResponse_(false, 'INVALID_INPUT', null);

  return withLock_(function () {
    ensurePageTab_();
    var row = readTab_(PAGE_TAB_).filter(function (r) { return String(r['페이지']) === req.page; })[0];
    writeRow_(PAGE_TAB_, { '페이지': req.page, '내용': JSON.stringify(content), '수정자': auth.name, '수정시각': new Date() }, row && row._row);
    logAccess_('성공', auth.code, auth.name, '', 'savePage', req.page);
    var published = publish_(auth.name);
    return jsonResponse_(true, null, { published: published.ok });
  });
}

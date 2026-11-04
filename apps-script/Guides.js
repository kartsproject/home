/**
 * 모집요강 (2026-11-04 WBS 17.4). 연도마다 한 줄 — 관리자 페이지 「모집요강」 탭에서 파일(PDF · 한글 등)을 올리고,
 * 모집 및 선발 페이지의 그 연도 탭에 「모집요강 내려받기」로 나온다. 공개여부가 「공개」인 연도만 data/posts.json에 나간다.
 * 탭은 관문을 새로 배포한 뒤 처음 목록을 열 때 만든다(setup을 다시 돌리지 않아도 되게, 사진 탭과 같은 방식).
 */
var GUIDE_TAB_ = '모집요강';

function guideTabMissing_() {
  return !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUIDE_TAB_);
}

// 잠금 안에서만 부른다. 없으면 머리글과 함께 만들고, 있으면 빠진 머리글만 붙인다
function ensureGuideTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GUIDE_TAB_);
  var headers = TAB_HEADERS_[GUIDE_TAB_];
  if (sheet) { addMissingHeaders_(sheet, GUIDE_TAB_); return; }
  sheet = ss.insertSheet(GUIDE_TAB_, ss.getSheets().length);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  (TEXT_COLUMNS_[GUIDE_TAB_] || []).forEach(function (h) {
    sheet.getRange(2, headers.indexOf(h) + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
  });
}

function readGuideTab_() {
  return guideTabMissing_() ? [] : readTab_(GUIDE_TAB_);
}

// 연도는 2020~2099의 네 자리, 제목은 선택(비우면 화면이 「{연도} 모집요강」)
function validateGuide_(p) {
  if (!p) return null;
  var year = String(p.year == null ? '' : p.year).trim(), title = cleanText_(p.title), vis = cleanVisibility_(p.visibility);
  if (!/^20[2-9]\d$/.test(year) || title.length > LIMITS_.guideTitle || !vis) return null;
  return { '연도': year, '제목': title, '공개여부': vis };
}

// 같은 연도는 한 줄만 (저장 잠금 안, handleSave_가 부른다)
function checkGuideYear_(fields, rows, ownId) {
  var dup = rows.some(function (r) { return r['글ID'] !== ownId && String(r['연도']) === fields['연도']; });
  return dup ? 'DUPLICATE_YEAR' : null;
}

function guideFromRow_(r, attachments, admin) {
  var o = {
    id: r['글ID'], year: String(r['연도']), title: String(r['제목'] || ''),
    files: attachmentsOf_(r['글ID'], '파일', attachments, admin)
  };
  if (admin) addAdminFields_(o, r);
  return o;
}

// 방문자용 { "2026": { title, files:[{ fileId, name, size }] } } — 공개이고 파일이 있는 연도만
function buildPublicGuides_(attachments) {
  var out = {};
  readGuideTab_().forEach(function (r) {
    if (r['공개여부'] !== '공개') return;
    var g = guideFromRow_(r, attachments, false);
    if (g.files.length) out[g.year] = { title: g.title, files: g.files };
  });
  return out;
}

/**
 * 사이트 사진 자리 (WBS 15). 표지(「표지」 탭) · 공지 · 갤러리 밖에서 페이지에 박혀 있던 사진을 관리자 페이지 「사이트 사진」 탭에서 바꾼다.
 * 자리마다 사진 한 장 + 보이는 위치(초점, 사진 가로 · 세로의 %). 사진이 없으면 화면은 HTML · CSS에 적힌 기본 사진을 쓴다.
 * 자리는 고정이라 글처럼 새로 만들거나 지우지 않는다 — 행은 이 목록대로 관문이 만든다(setup을 다시 돌리지 않아도 되게).
 *
 * id의 S- 뒤가 data/posts.json의 photos 키 · 화면의 data-photo 값과 같다. 자리를 늘리면 이 목록, 관리자 페이지 PHOTO_PAGES(admin.js),
 * 해당 페이지의 data-photo 세 곳을 함께 고친다 (docs/sheet-schema.md 2-9).
 */

var PHOTO_SLOTS_ = [
  { id: 'S-step1',        label: '메인 · 여정 01 워크숍' },
  { id: 'S-step2',        label: '메인 · 여정 02 심화 멘토링' },
  { id: 'S-step3',        label: '메인 · 여정 03 겨울캠프' },
  { id: 'S-recruit',      label: '메인 · 모집 및 선발 띠' },
  { id: 'S-sv-about',     label: '사업소개 · 위 사진 띠' },
  { id: 'S-ab-music',     label: '사업소개 · 분야 음악' },
  { id: 'S-ab-dance',     label: '사업소개 · 분야 무용' },
  { id: 'S-ab-trad',      label: '사업소개 · 분야 전통예술' },
  { id: 'S-ab-art',       label: '사업소개 · 분야 미술' },
  { id: 'S-sv-programs',  label: '워크숍 · 위 사진 띠' },
  { id: 'S-mu1',          label: '워크숍 음악 01 전공별 1:1 레슨' },
  { id: 'S-mu2',          label: '워크숍 음악 02 마스터클래스 · 특강' },
  { id: 'S-mu3',          label: '워크숍 음악 03 연주회' },
  { id: 'S-da1',          label: '워크숍 무용 01 발레 클라스' },
  { id: 'S-da2',          label: '워크숍 무용 02 발레 레퍼토리' },
  { id: 'S-da3',          label: '워크숍 무용 03 발레 클라스의 역사' },
  { id: 'S-da4',          label: '워크숍 무용 04 피지컬 트레이닝' },
  { id: 'S-tr1',          label: '워크숍 전통예술 01 전공 실기' },
  { id: 'S-tr2',          label: '워크숍 전통예술 02 전공 심화' },
  { id: 'S-tr3',          label: '워크숍 전통예술 03 신체·음악 표현' },
  { id: 'S-tr4',          label: '워크숍 전통예술 04 소리 탐색 및 창작' },
  { id: 'S-tr5',          label: '워크숍 전통예술 05 현장 체험' },
  { id: 'S-ar1',          label: '워크숍 미술 01 관찰과 탐구' },
  { id: 'S-ar2',          label: '워크숍 미술 02 예술가 특강 및 창작 실습' },
  { id: 'S-ar3',          label: '워크숍 미술 03 주제 탐색 및 작품 구상' },
  { id: 'S-ar4',          label: '워크숍 미술 04 개별 작품 제작' },
  { id: 'S-ar5',          label: '워크숍 미술 05 작품 발표 및 공유' },
  { id: 'S-sv-recruit',   label: '모집 및 선발 · 위 사진 띠' },
  { id: 'S-sv-mentoring', label: '심화 멘토링 · 위 사진 띠' },
  { id: 'S-sv-camp',      label: '겨울캠프 · 위 사진 띠' }
];

var PHOTO_TAB_ = '사진';

// 탭이 없거나 목록의 자리가 빠졌으면 true. 목록(list)은 잠금 없이 부르므로, 고칠 것이 있을 때만 잠금을 잡고 ensurePhotoSlots_를 부른다
function photoSlotsMissing_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PHOTO_TAB_);
  if (!sheet) return true;
  var have = {};
  readTab_(PHOTO_TAB_).forEach(function (r) { have[r['글ID']] = true; });
  var headers = headersOf_(PHOTO_TAB_);
  return PHOTO_SLOTS_.some(function (s) { return !have[s.id]; }) || TAB_HEADERS_[PHOTO_TAB_].some(function (h) { return headers.indexOf(h) === -1; });
}

// 잠금 안에서만 부른다. 탭 · 머리글 · 빠진 자리 행을 만들고, 이미 있는 행은 건드리지 않는다
function ensurePhotoSlots_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PHOTO_TAB_);
  var headers = TAB_HEADERS_[PHOTO_TAB_];
  if (!sheet) {
    sheet = ss.insertSheet(PHOTO_TAB_, ss.getSheets().length);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    (TEXT_COLUMNS_[PHOTO_TAB_] || []).forEach(function (h) {
      sheet.getRange(2, headers.indexOf(h) + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  } else {
    addMissingHeaders_(sheet, PHOTO_TAB_);
  }
  var have = {};
  readTab_(PHOTO_TAB_).forEach(function (r) { have[r['글ID']] = true; });
  PHOTO_SLOTS_.forEach(function (s) {
    if (!have[s.id]) writeRow_(PHOTO_TAB_, { '글ID': s.id, '칸': s.label });
  });
}

// 페이지 직접 편집(WBS 18)에서 목록 항목을 복제하면 그 항목의 사진 자리는 「원래 자리-x네 글자」(editor.js newSlot)다.
// 그 자리에 처음 사진을 넣을 때(저장 잠금 안) 행을 만들어 돌려준다. 이름이 맞지 않거나 자리가 너무 많으면 null(NOT_FOUND)
var PHOTO_EXTRA_MAX_ = 200;
function createPhotoSlot_(id, rows) {
  var m = /^S-([a-z0-9]+(?:-[a-z0-9]+)*)-x[a-z0-9]{4}$/.exec(String(id || ''));
  if (!m || id.length > 50 || rows.length >= PHOTO_SLOTS_.length + PHOTO_EXTRA_MAX_) return null;
  var base = PHOTO_SLOTS_.filter(function (s) { return s.id === 'S-' + m[1]; })[0];
  writeRow_(PHOTO_TAB_, { '글ID': id, '칸': '페이지 편집 · ' + (base ? base.label : m[1]) + ' (복제)' });
  return readTab_(PHOTO_TAB_).filter(function (r) { return r['글ID'] === id; })[0] || null;
}

function readPhotoTab_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PHOTO_TAB_) ? readTab_(PHOTO_TAB_) : [];
}

// 보이는 위치: { x, y } (0~100, 사진의 %) 또는 null(가운데 · 기본 위치). 통과하면 시트에 쓸 값, 아니면 null(INVALID_INPUT)
function validatePhotoSlot_(p) {
  if (!p) return null;
  var pos = '';
  if (p.pos != null) {
    var x = Number(p.pos.x), y = Number(p.pos.y);
    if (!isFinite(x) || !isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return null;
    pos = x.toFixed(1) + ',' + y.toFixed(1);
  }
  return { '위치': pos };
}

function parsePos_(value) {
  return /^\s*[\d.]+\s*,\s*[\d.]+\s*$/.test(String(value == null ? '' : value)) ? parseCenter_(value) : null;
}

// 관리용 — 자리 이름은 시트가 아니라 PHOTO_SLOTS_를 따른다(시트 「칸」은 사람이 읽기 위한 값)
function photoSlotFromRow_(r, attachments) {
  var known = PHOTO_SLOTS_.filter(function (s) { return s.id === r['글ID']; })[0];
  return {
    id: r['글ID'], slot: String(r['글ID']).replace(/^S-/, ''), label: known ? known.label : String(r['칸']),
    photos: attachmentsOf_(r['글ID'], '사진', attachments, true),
    pos: parsePos_(r['위치']),
    updatedBy: String(r['수정자']), updatedAt: formatDateTimeCell_(r['수정시각'])
  };
}

// 방문자용 { step1: { fileId, w, h, pos }, ab-dance: { pos }, … } — 사진도 위치도 없는 자리는 넣지 않는다(화면이 기본 사진 · 기본 위치를 쓴다).
// 사진 없이 위치만 있으면 기본 사진의 보이는 위치만 바꾼다
function buildPublicPhotos_(attachments) {
  var out = {};
  readPhotoTab_().forEach(function (r) {
    var id = String(r['글ID']);
    if (!/^S-/.test(id)) return;
    var photo = attachmentsOf_(id, '사진', attachments, false)[0] || {};
    var pos = parsePos_(r['위치']);
    if (pos) photo.pos = pos;
    if (photo.fileId || photo.pos) out[id.replace(/^S-/, '')] = photo;
  });
  return out;
}

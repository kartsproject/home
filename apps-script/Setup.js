/**
 * 처음 한 번 Apps Script 편집기에서 setup을 골라 ▶로 실행한다. 이때 구글이 권한 승인 창을 띄운다.
 * 탭 · 머리글 · 선택 목록 · 기본 설정값 · 드라이브 폴더 · 서명 키 · 발행 설정을 만든다 (docs/sheet-schema.md 2절).
 * 머리글을 손으로 입력하면 오타가 나기 쉬워(관문은 머리글 글자로 열을 찾음) 여기서만 만든다.
 * 이미 있는 탭 · 폴더 · 값은 건드리지 않으므로 여러 번 실행해도 안전하다.
 */

var TAB_HEADERS_ = {
  '읽어보기': [],
  '공지':     ['글ID', '분류', '제목', '본문', '게시일', '상단고정', '사진위치', '사진링크', '공개여부', '작성자', '작성시각', '수정자', '수정시각'],
  '갤러리':   ['글ID', '제목', '설명', '게시일', '공개여부', '작성자', '작성시각', '수정자', '수정시각', '분야'],
  '언론홍보': ['글ID', '언론사', '제목', '게시일', '기사주소', '공개여부', '작성자', '작성시각', '수정자', '수정시각'],
  '표지':     ['글ID', '칸', '작성자', '작성시각', '수정자', '수정시각', '입체효과', '입체중심'],
  '사진':     ['글ID', '칸', '위치', '작성자', '작성시각', '수정자', '수정시각'],
  '모집요강': ['글ID', '연도', '제목', '공개여부', '작성자', '작성시각', '수정자', '수정시각'],
  '페이지':   ['페이지', '내용', '수정자', '수정시각'],
  '첨부':     ['첨부ID', '글ID', '구분', '순서', '파일ID', '파일명', '크기', '가로', '세로', '공유', '올린사람', '올린시각'],
  '접근코드': ['코드', '이름', '상태', '사용기한', '버전', '비고'],
  '설정':     ['항목', '값', '설명'],
  '로그':     ['일시', '결과', '코드', '이름', '기기ID', '요청', '대상']
};

// 시트가 날짜·숫자처럼 보이는 값을 마음대로 바꾸지 않도록 일반 텍스트로 둘 열
var TEXT_COLUMNS_ = {
  '공지': ['글ID', '게시일', '사진링크'],
  '갤러리': ['글ID', '게시일'],
  '언론홍보': ['글ID', '게시일', '기사주소'],
  '표지': ['글ID', '입체중심'],
  '사진': ['글ID', '위치'],
  '모집요강': ['글ID', '연도'],
  '페이지': ['페이지', '내용'],
  '첨부': ['첨부ID', '글ID', '파일ID'],
  '접근코드': ['코드', '사용기한']
};

// 갤러리 앨범의 과정 · 분야 (2026-10-16 WBS 8.10). 시트 「분야」 열에는 「워크숍 · 무용」처럼 한글 두 값을 이어 쓰고(지정 안 함은 빈칸),
// data/posts.json에는 course · field 코드로 나간다. 분야 「공통」(코드 '')은 그 과정 전체. 프로그램 페이지가 이 코드로 앨범 사진을 모은다
var GALLERY_COURSES_ = { '워크숍': 'workshop', '심화멘토링': 'mentoring', '겨울캠프': 'camp' };
var GALLERY_FIELDS_ = { '무용': 'dance', '음악': 'music', '미술': 'art', '전통예술': 'trad', '공통': '' };
// 8.5 때(과정 없이 분야 하나) 쓰던 시트 값 → [과정, 분야]. 읽기만 하고, 저장하면 새 모양으로 쓴다
var GALLERY_OLD_VALUES_ = { '무용': ['workshop', 'dance'], '음악': ['workshop', 'music'], '미술': ['workshop', 'art'], '전통예술': ['workshop', 'trad'],
  '심화멘토링': ['mentoring', ''], '겨울캠프': ['camp', ''] };

var DROPDOWNS_ = {
  '접근코드': { '상태': ['사용', '정지'] }
};

// 표지 사진 칸 — 분야마다 한 장, 이 순서로 넘어간다 (2026-10-14 사용자 결정). 칸은 고정이라 글처럼 새로 만들거나 지우지 않는다.
// id의 H- 뒤가 data/posts.json의 hero 키 · 화면의 슬라이드 이름(main.css .s-dance 등)과 같다.
var HERO_SLOTS_ = [
  { id: 'H-dance', label: '무용' },
  { id: 'H-music', label: '음악' },
  { id: 'H-art',   label: '미술' },
  { id: 'H-trad',  label: '전통예술' }
];

var DEFAULT_SETTINGS_ = [
  ['공지 분류', '공지,워크숍,심화과정', '쉼표로 구분. 관리자 페이지의 분류 선택 목록'],
  ['기기별 실패 잠금 기준', '5', '로그인 실패가 이 횟수가 되면 그 기기를 잠근다'],
  ['기기별 잠금 시간(분)', '10', ''],
  ['운영진 알림 메일', '', '로그인 실패 급증 · 사이트 반영 실패 때 메일. 비우면 보내지 않음']
];

var README_LINES_ = [
  ['K예술영재 홍보 사이트 — 게시글 관리 시트'],
  [''],
  ['• 공지 · 언론홍보 · 갤러리 · 모집요강 · 표지 · 사진 · 페이지 · 첨부 탭은 관리자 페이지가 씁니다. 여기서 직접 고치지 마세요.'],
  ['• 접근코드 탭: 관리자 로그인 코드. 코드가 새면 「버전」 숫자를 올리면 모든 접속이 끊깁니다.'],
  ['• 설정 탭: 공지 분류 등 운영 값. 값을 비우면 기본값으로 동작합니다.'],
  ['• 로그 탭: 자동 기록입니다.'],
  ['• 탭 이름과 1행 머리글은 바꾸지 마세요. 관문이 이 이름으로 값을 찾습니다.']
];

function setup() {
  setupTabs_();
  setupDriveFolder_();
  setupScriptProperties_();
  Logger.log('완료. 접근코드 탭에 코드를 한 줄 넣고, 스크립트 속성 GITHUB_TOKEN을 넣으세요.');
}

function setupTabs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TAB_HEADERS_).forEach(function (name) {
    var existing = ss.getSheetByName(name);
    if (existing) { addMissingHeaders_(existing, name); return; }
    var sheet = ss.insertSheet(name, ss.getSheets().length);
    var headers = TAB_HEADERS_[name];
    if (headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    (TEXT_COLUMNS_[name] || []).forEach(function (h) {
      sheet.getRange(2, headers.indexOf(h) + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
    });
    var dropdowns = DROPDOWNS_[name] || {};
    Object.keys(dropdowns).forEach(function (h) {
      var rule = SpreadsheetApp.newDataValidation().requireValueInList(dropdowns[h], true).setAllowInvalid(false).build();
      sheet.getRange(2, headers.indexOf(h) + 1, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
    });
    if (name === '설정') sheet.getRange(2, 1, DEFAULT_SETTINGS_.length, 3).setValues(DEFAULT_SETTINGS_);
    if (name === '표지') sheet.getRange(2, 1, HERO_SLOTS_.length, 2).setValues(HERO_SLOTS_.map(function (h) { return [h.id, h.label]; }));
    if (name === '읽어보기') sheet.getRange(1, 1, README_LINES_.length, 1).setValues(README_LINES_);
    Logger.log(name + ': 만듦');
  });

  ensurePhotoSlots_();   // 「사진」 탭의 자리 행 (Photos.js PHOTO_SLOTS_)

  // 새 시트를 만들 때 생기는 빈 기본 탭(시트1 / Sheet1)은 지운다. 지운 탭은 이름을 읽을 수 없으므로 먼저 읽어 둔다.
  ss.getSheets().forEach(function (sheet) {
    var name = sheet.getName();
    if (!TAB_HEADERS_.hasOwnProperty(name) && sheet.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sheet);
      Logger.log(name + ': 빈 기본 탭이라 지움');
    }
  });
}

// 이미 있는 탭은 내용을 건드리지 않고, 나중에 생긴 머리글(예: 표지 입체효과 · 입체중심 2026-10-15, 갤러리 분야 2026-10-16)만 1행 맨 뒤에 붙인다.
// 관문은 머리글 글자로 열을 찾으므로 열 순서는 상관없다.
function addMissingHeaders_(sheet, name) {
  var lastCol = sheet.getLastColumn();
  var have = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var missing = TAB_HEADERS_[name].filter(function (h) { return have.indexOf(h) === -1; });
  if (!missing.length) { Logger.log(name + ': 이미 있어 건드리지 않음'); return; }
  sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  missing.forEach(function (h, i) {
    if ((TEXT_COLUMNS_[name] || []).indexOf(h) > -1) sheet.getRange(2, lastCol + 1 + i, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  Logger.log(name + ': 머리글 추가 — ' + missing.join(', '));
}

function setupDriveFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DRIVE_FOLDER_ID');
  if (id) {
    try { DriveApp.getFolderById(id); Logger.log('드라이브 폴더: 이미 있음'); return; } catch (err) { /* 지워졌으면 새로 만든다 */ }
  }
  var folder = DriveApp.createFolder('K예술영재 홍보 사이트 첨부');
  props.setProperty('DRIVE_FOLDER_ID', folder.getId());
  Logger.log('드라이브 폴더: 만듦 (내 드라이브 › K예술영재 홍보 사이트 첨부, 공유 안 함)');
}

function setupScriptProperties_() {
  var props = PropertiesService.getScriptProperties();
  // 서명 키는 이미 있으면 다시 만들지 않는다 — 바뀌면 발급된 토큰이 전부 무효가 된다.
  if (!props.getProperty('TOKEN_SECRET')) {
    props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
    Logger.log('TOKEN_SECRET: 만듦');
  }
  // 발행 대상 기본값. 운영 사이트는 main (2026-11-04 새 계정 이전 때 data-test → main. 시험용으로 따로 돌릴 때만 바꾼다, docs/decisions.md 3절).
  // MEDIA_*: 표지 동영상을 올리는 영상 전용 공개 저장소(GitHub Pages, 2안 WBS 8.6 — Media.js). 토큰은 GITHUB_TOKEN이
  // 이 저장소에도 쓰기 권한이 있으면 그대로 쓰고, 따로 만들었으면 MEDIA_GITHUB_TOKEN에 넣는다
  var defaults = { GITHUB_REPO: 'kartsproject/home', GITHUB_BRANCH: 'main', GITHUB_PATH: 'data/posts.json',
                   MEDIA_REPO: 'kartsproject/home-media', MEDIA_BRANCH: 'main' };
  Object.keys(defaults).forEach(function (key) {
    if (!props.getProperty(key)) { props.setProperty(key, defaults[key]); Logger.log(key + ': ' + defaults[key]); }
  });
  if (!props.getProperty('GITHUB_TOKEN')) Logger.log('GITHUB_TOKEN: 비어 있음 — 프로젝트 설정 › 스크립트 속성에서 직접 넣을 것');
}

/**
 * 「설정」 탭(항목-값 구조)에서 운영 값을 읽는다. 값이 없으면 fallback을 쓴다 —
 * 담당자가 시트에 행을 안 넣어도 기본값으로 동작하고, 넣으면 코드 수정 없이 바뀐다 (docs/sheet-schema.md 2-5).
 * 한 번의 실행 안에서는 처음 읽은 값을 재사용한다.
 */

var settingsMap_ = null;

function getSetting_(key, fallback) {
  if (!settingsMap_) {
    settingsMap_ = {};
    readTab_('설정').forEach(function (row) { settingsMap_[String(row['항목']).trim()] = row['값']; });
  }
  var value = settingsMap_[key];
  return (value === '' || value == null) ? fallback : value;
}

function getCategories_() {
  return String(getSetting_('공지 분류', '공지,워크숍,심화과정'))
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

/**
 * 업로드·글 한도 (docs/sheet-schema.md 2·4절). 관리자 화면도 list 응답으로 같은 값을 받아 미리 막지만,
 * 관문이 다시 확인한다. 개수·용량은 임시값(확인 필요)이라 바꾸기 쉽게 한곳에 둔다.
 */
var LIMITS_ = {
  noticeTitle: 200,
  noticeBody: 5000,
  galleryTitle: 100,
  galleryDesc: 100,
  pressTitle: 200,
  pressSource: 50,
  link: 500,
  noticePhotos: 10,
  noticeFiles: 10,
  guideFiles: 10,     // 모집요강 한 연도에 파일 10개까지 — 1번은 「{연도} 모집요강 내려받기」 단추, 2번부터 「함께 내는 서류」(양식 등). 2026-11-04 「하나만」 → 2026-11-11 사용자 「양식 등도 첨부」
  guideTitle: 100,
  galleryPhotos: 50,
  heroPhotoSide: 2400,   // 표지 사진은 넓은 화면용이라 올리기 전 긴 변을 더 크게 (공지 · 갤러리는 화면이 1600으로 줄임)
  photoBytes: 5 * 1024 * 1024,
  cutoutBytes: 8 * 1024 * 1024,   // 표지 누끼는 투명도 때문에 PNG로 두어 JPEG보다 크다(2400px에 보통 1~4MB)
  fileBytes: 10 * 1024 * 1024,
  // 표지 동영상 (2안 WBS 8.6) — MP4 한 개 20MB 이하. 관문 요청 크기 한도 때문에 화면이 조각으로 나눠 보낸다.
  // 조각 크기는 3의 배수여야 조각별 base64를 이어 붙인 것이 파일 전체의 base64와 같다 (Media.js)
  videoBytes: 20 * 1024 * 1024,
  videoPartBytes: 3 * 1398101,   // 4,194,303바이트(약 4MB) → base64 5,592,404자
  videoTypes: ['video/mp4'],
  fileName: 150,
  photoTypes: ['image/jpeg', 'image/png', 'image/webp'],
  fileExts: ['hwp', 'hwpx', 'doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx']
};

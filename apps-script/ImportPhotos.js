/**
 * 기본 사진을 「올린 사진」으로 바꾸기 (2026-11-04 사용자 결정 — 홈페이지에서 「기본 사진」 개념을 없앤다).
 *
 * 지금 사이트에 보이는 기본 사진(저장소 assets/img/real/ — preview4와 같은 실사진)을 드라이브 첨부로 올려 각 자리에 붙인다.
 * 그 뒤로 사진은 관리자 페이지에서 올린 것만 보이고, 관리자가 사진을 빼면 그 자리는 비워 둔다(사이트에는 사진 없음,
 * 관리자 화면에는 「이미지 첨부 예정」). 공개 파일 data/posts.json에 photoMode: 'attached'가 나가면 화면이 이 방식으로 바뀐다.
 *
 * 쓰는 법: Apps Script 편집기에서 ImportPhotos.gs → importSitePhotos ▶ 실행. 여러 번 실행해도 이미 사진이 있는 자리는 건너뛴다.
 *  - 표지 4칸(H-…)과 사이트 사진 30곳(S-…) 가운데 올린 사진이 없는 자리만 채운다(관리자가 이미 바꾼 표지 · 사진은 그대로)
 *  - 기본 사진에 정해 두었던 보이는 위치(예: 여정 02는 가로 50% · 세로 30%)도 같이 적는다
 *  - 다 되면 PHOTO_MODE=attached로 두고 사이트에 반영(발행)한다
 */
var IMPORT_RAW_BASE_ = 'https://raw.githubusercontent.com/kartsproject/home/main/assets/img/real/';

// 자리 → 파일 이름 · 보이는 위치(없으면 가운데). admin.js PHOTO_PAGES · main.css · common.css 기본값과 같다
var IMPORT_PHOTOS_ = {
  'H-music': ['hero-music.jpg'], 'H-dance': ['hero-dance.jpg'], 'H-trad': ['hero-trad.jpg'], 'H-art': ['hero-art.jpg'],
  'S-step1': ['step1.jpg'], 'S-step2': ['step2.jpg', '50.0,30.0'], 'S-step3': ['step3.jpg', '50.0,70.0'], 'S-recruit': ['band.jpg', '50.0,35.0'],
  'S-sv-about': ['sv-about.jpg', '50.0,45.0'], 'S-sv-programs': ['sv-programs.jpg', '50.0,40.0'], 'S-sv-recruit': ['sv-recruit.jpg', '50.0,55.0'],
  'S-sv-mentoring': ['sv-mentoring.jpg', '50.0,45.0'], 'S-sv-camp': ['sv-camp.jpg', '50.0,50.0'],
  'S-ab-music': ['ab-music.jpg'], 'S-ab-dance': ['ab-dance.jpg'], 'S-ab-trad': ['ab-trad.jpg'], 'S-ab-art': ['ab-art.jpg'],
  'S-mu1': ['mu1.jpg'], 'S-mu2': ['mu2.jpg'], 'S-mu3': ['mu3.jpg'],
  'S-da1': ['da1.jpg'], 'S-da2': ['da2.jpg', '50.0,45.0'], 'S-da3': ['da3.jpg'], 'S-da4': ['da4.jpg'],
  'S-tr1': ['tr1.jpg'], 'S-tr2': ['tr2.jpg'], 'S-tr3': ['tr3.jpg', '50.0,30.0'], 'S-tr4': ['tr4.jpg'], 'S-tr5': ['tr5.jpg'],
  'S-ar1': ['ar1.jpg'], 'S-ar2': ['ar2.jpg'], 'S-ar3': ['ar3.jpg'], 'S-ar4': ['ar4.jpg'], 'S-ar5': ['ar5.jpg', '50.0,40.0']
};

function importSitePhotos() {
  ensurePhotoSlots_();
  var folder = getUploadFolder_();
  var attachments = readTab_('첨부');
  var has = {};
  attachments.forEach(function (a) { if (a['구분'] === '사진' && a['글ID']) has[a['글ID']] = true; });
  var made = 0, kept = 0, failed = [];

  Object.keys(IMPORT_PHOTOS_).forEach(function (postId) {
    if (has[postId]) { kept++; return; }
    var spec = IMPORT_PHOTOS_[postId];
    try {
      var res = UrlFetchApp.fetch(IMPORT_RAW_BASE_ + spec[0], { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) throw new Error('사진을 받지 못함 ' + res.getResponseCode());
      var bytes = res.getContent(), size = jpegSize_(bytes);
      var file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', spec[0]));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var busy = withLock_(function () {
        var id = nextId_('A', 5, readTab_('첨부').map(function (r) { return r['첨부ID']; }));
        writeRow_('첨부', {
          '첨부ID': id, '글ID': postId, '구분': '사진', '순서': 1,
          '파일ID': file.getId(), '파일명': spec[0], '크기': bytes.length,
          '가로': size.w || '', '세로': size.h || '', '공유': '공유',
          '올린사람': '기본 사진 옮기기', '올린시각': new Date()
        });
        if (spec[1] && /^S-/.test(postId)) {
          var row = readTab_(PHOTO_TAB_).filter(function (r) { return r['글ID'] === postId; })[0];
          if (row && !row['위치']) { row['위치'] = spec[1]; writeRow_(PHOTO_TAB_, row, row._row); }
        }
        return null;
      });
      if (busy) { file.setTrashed(true); throw new Error('다른 저장이 진행 중 — 잠시 뒤 다시 실행'); }
      made++;
    } catch (err) {
      failed.push(postId + ' (' + spec[0] + '): ' + err.message);
    }
  });

  Logger.log('올림 ' + made + ' · 이미 사진 있음 ' + kept + ' · 실패 ' + failed.length);
  failed.forEach(function (f) { Logger.log('❌ ' + f); });
  if (failed.length) { Logger.log('→ 한 번 더 실행하면 실패한 자리만 다시 합니다.'); return; }

  PropertiesService.getScriptProperties().setProperty('PHOTO_MODE', 'attached');
  var out = withLock_(function () { return jsonResponse_(publish_('기본 사진 옮기기', true).ok, null, null); });
  Logger.log(JSON.parse(out.getContent()).ok
    ? '✅ 끝 — 사이트에 반영했습니다. 이제 사진은 관리자 페이지에서 올린 것만 보이고, 빼면 그 자리는 비워 둡니다.'
    : '❌ 사진은 붙였지만 사이트 반영에 실패 — 관리자 페이지 [다시 반영] 또는 checkSetup으로 GitHub 토큰 확인');
}

function getPhotoMode_() {
  return PropertiesService.getScriptProperties().getProperty('PHOTO_MODE') || '';
}

// JPEG 머리에서 가로 · 세로를 읽는다(SOF0~SOF15, DHT · JPG · DAC 제외). 못 읽으면 { w: 0, h: 0 }
function jpegSize_(bytes) {
  var b = function (i) { return bytes[i] & 0xFF; };
  var i = 2;
  while (i + 9 < bytes.length) {
    if (b(i) !== 0xFF) { i++; continue; }
    var m = b(i + 1), len = (b(i + 2) << 8) | b(i + 3);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: (b(i + 5) << 8) | b(i + 6), w: (b(i + 7) << 8) | b(i + 8) };
    }
    i += 2 + len;
  }
  return { w: 0, h: 0 };
}

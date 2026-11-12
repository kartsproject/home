/**
 * 설정 점검 (2026-11-04 WBS 16 새 구글 계정 이전 — docs/setup-new-account.md).
 * Apps Script 편집기에서 checkSetup을 골라 ▶로 실행하면, 관문 · 발행에 필요한 것을 하나씩 확인해
 * 실행 기록에 ✅ / ❌ 로 남긴다. 아무것도 바꾸지 않으므로 몇 번이고 실행해도 된다.
 * 비밀값(서명 키 · GitHub 토큰)은 있는지만 보고 값은 적지 않는다.
 */
function checkSetup() {
  var ok = 0, bad = 0;
  function pass(msg) { ok++; Logger.log('✅ ' + msg); }
  function fail(msg) { bad++; Logger.log('❌ ' + msg); }
  var props = PropertiesService.getScriptProperties();
  Logger.log('실행 계정: ' + Session.getEffectiveUser().getEmail());

  // 1. 탭
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var missing = Object.keys(TAB_HEADERS_).filter(function (t) { return t !== '사진' && !ss.getSheetByName(t); });
  if (missing.length) fail('탭이 없음: ' + missing.join(', ') + ' → setup 실행');
  else pass('시트 탭 모두 있음');

  // 2. 서명 키 · 드라이브 폴더
  if (props.getProperty('TOKEN_SECRET')) pass('TOKEN_SECRET 있음'); else fail('TOKEN_SECRET 없음 → setup 실행');
  try {
    var folder = getUploadFolder_();
    var owner = folder.getOwner();
    if (owner && owner.getEmail() !== Session.getEffectiveUser().getEmail()) fail('첨부 폴더가 다른 계정 것임(' + owner.getEmail() + ') → 스크립트 속성 DRIVE_FOLDER_ID를 지우고 setup 다시 실행');
    else pass('첨부 폴더 있음 (' + folder.getName() + ')');
  } catch (err) { fail('첨부 폴더를 열 수 없음 → 스크립트 속성 DRIVE_FOLDER_ID를 지우고 setup 다시 실행'); }

  // 3. 접근코드
  var codes = readTab_('접근코드').filter(function (r) { return String(r['코드']).trim() && r['상태'] !== '정지'; });
  if (codes.length) pass('사용 중인 접근코드 ' + codes.length + '개'); else fail('사용 중인 접근코드가 없음 — 「접근코드」 탭에 줄을 넣을 것');

  // 4. 첨부가 새 계정 드라이브에 있는지 (이전 도구 moveAttachments) · 게시판별 폴더로 정리됐는지 (sortUploads, Folders.js)
  try {
    var here = uploadFolderIds_(), props4 = PropertiesService.getScriptProperties(), old = 0, loose = 0;
    readTab_('첨부').forEach(function (a) {
      var id = String(a['파일ID']).split(',')[0];
      if (!id) return;
      try {
        var parents = parentIds_(DriveApp.getFileById(id));
        if (!parents.some(function (p) { return here[p]; })) { old++; return; }
        var board = boardOfPostId_(a['글ID']), sub = board && props4.getProperty('DRIVE_SUB_' + board);
        if (board && parents.indexOf(sub) === -1) loose++;
      } catch (err) { old++; }
    });
    if (old) fail('예전 드라이브(또는 열 수 없는 곳)에 있는 첨부 ' + old + '개 → moveAttachments 실행');
    else pass('첨부가 모두 새 계정 드라이브에 있음');
    if (!old) {
      if (loose) fail('게시판별 폴더(공지사항 · 갤러리 · 모집요강 …)에 아직 정리되지 않은 첨부 ' + loose + '개 → sortUploads 실행');
      else pass('첨부가 게시판별 폴더로 정리돼 있음');
    }
  } catch (err) { /* 폴더 문제는 2번에서 알림 */ }

  // 5. GitHub 발행
  var repo = props.getProperty('GITHUB_REPO'), branch = props.getProperty('GITHUB_BRANCH'), path = props.getProperty('GITHUB_PATH');
  var token = props.getProperty('GITHUB_TOKEN');
  if (!token) fail('GITHUB_TOKEN 없음 → 스크립트 속성에 GitHub 토큰을 넣을 것');
  if (branch !== 'main') fail('GITHUB_BRANCH가 「' + branch + '」 — 운영 사이트는 main');
  if (token && repo) {
    var res = UrlFetchApp.fetch('https://api.github.com/repos/' + repo, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code !== 200) fail('GitHub 저장소 ' + repo + '에 들어가지 못함(' + code + ') — 토큰의 저장소 · 만료일 확인');
    else {
      var perm = JSON.parse(res.getContentText()).permissions;
      if (perm && perm.push === false) fail('토큰에 ' + repo + ' 쓰기 권한이 없음 — Contents: Read and write');
      else pass('GitHub ' + repo + ' 연결됨 (발행 위치 ' + branch + ':' + path + ')');
    }
  }
  var media = props.getProperty('MEDIA_REPO');
  if (media) Logger.log('ℹ️ 표지 동영상 저장소 ' + media + ' — 표지 동영상을 쓸 때만 필요(토큰에 이 저장소 쓰기 권한도)');

  // 6. 웹앱 배포
  var url = ScriptApp.getService().getUrl();
  if (url) Logger.log('ℹ️ 이 스크립트의 웹앱 주소: ' + url + '\n   → 저장소 assets/js/admin.js의 GATEWAY가 이 주소와 같아야 함 (끝이 /exec)');
  else fail('웹앱 배포가 아직 없음 → 배포 › 새 배포 › 웹 앱 (실행: 나, 액세스: 모든 사용자)');

  Logger.log('— 결과: 통과 ' + ok + ' · 확인 필요 ' + bad + (bad ? ' (❌ 줄의 → 안내대로 고친 뒤 다시 실행)' : ' — 준비 끝'));
}

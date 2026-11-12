/**
 * 새 구글 계정으로 옮길 때 한 번 쓰는 도구 (2026-11-04 WBS 16 — docs/setup-new-account.md).
 *
 * 전제
 *  1. 예전 계정의 게시글 시트를 새 계정에서 「파일 › 사본 만들기」로 복사했고, 이 스크립트는 그 사본에 붙어 있다.
 *     (사본에는 공지 · 언론홍보 · 갤러리 · 첨부 줄이 그대로 들어 있지만, 첨부의 사진 · 파일은 아직 예전 계정 드라이브에 있다)
 *  2. setup()을 먼저 실행해 새 계정 드라이브에 첨부 폴더(DRIVE_FOLDER_ID)가 만들어져 있다.
 *  3. 예전 계정의 「K예술영재 홍보 사이트 첨부」 폴더를 새 계정에 「뷰어」로 공유했다(동영상 조각은 공유돼 있지 않아서).
 *
 * moveAttachments()
 *  - 「첨부」의 각 줄의 드라이브 파일을 새 폴더로 복사하고, 파일ID를 새 파일로 바꾼다.
 *    사진 · 파일 · 누끼는 올릴 때처럼 「링크가 있는 사용자 — 보기」로 공유한다(동영상 조각은 공유 안 함).
 *  - 표지(글ID H-…) 첨부는 옮기지 않고 줄을 지우고 2.5D도 끈다 — 표지는 사이트 기본 실사진(preview4와 같은 사진)을 쓴다(2026-11-04 사용자 결정).
 *    예전 표지 사진도 옮기려면 MIGRATE_KEEP_HERO_를 true로.
 *  - 어느 글에도 붙지 않은 첨부(글ID 빈칸)는 옮기지 않고 줄만 지운다.
 *  - 이미 새 폴더에 있는 파일은 건너뛴다 — 시간이 모자라 멈추면(실행 기록에 안내) 한 번 더 실행하면 이어서 한다.
 *  - 다 옮기면 사이트에 반영(발행)한다.
 *  예전 계정의 파일은 건드리지 않는다. 사이트가 새 파일로 바뀐 것을 확인한 뒤 예전 계정에서 정리한다.
 */
var MIGRATE_KEEP_HERO_ = false;

function moveAttachments() {
  var folder = getUploadFolder_(), here = uploadFolderIds_();   // 새 첨부 폴더와 그 안의 게시판별 하위 폴더 (Folders.js)
  var started = Date.now(), timeLimit = 4.5 * 60 * 1000;
  var rows = readTab_('첨부');
  var drop = [], moved = 0, already = 0, failed = [], stopped = false;

  for (var i = 0; i < rows.length; i++) {
    if (Date.now() - started > timeLimit) { stopped = true; break; }
    var a = rows[i], postId = String(a['글ID'] || '');
    if (!postId || (!MIGRATE_KEEP_HERO_ && /^H-/.test(postId))) { drop.push(a); continue; }
    var ids = String(a['파일ID']).split(',').filter(Boolean);
    try {
      var newIds = ids.map(function (id) {
        var file = DriveApp.getFileById(id);
        if (parentIds_(file).some(function (p) { return here[p]; })) return id;
        var copy = file.makeCopy(file.getName(), folder);
        if (a['구분'] !== '동영상') copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return copy.getId();
      });
      if (newIds.join(',') === ids.join(',')) { already++; continue; }
      a['파일ID'] = newIds.join(',');
      writeRow_('첨부', a, a._row);
      moved++;
    } catch (err) {
      failed.push(a['첨부ID'] + ' (' + a['구분'] + ', 글 ' + postId + '): ' + err.message);
    }
  }

  // 줄 지우기는 맨 끝에 — 위에서 쓴 줄 번호가 밀리지 않게
  if (drop.length) {
    deleteRows_('첨부', drop.map(function (a) { return a._row; }));
    if (!MIGRATE_KEEP_HERO_) clearHeroDepth_();
  }

  Logger.log('옮김 ' + moved + ' · 이미 옮김 ' + already + ' · 지운 줄(표지 · 글 없는 첨부) ' + drop.length + ' · 실패 ' + failed.length);
  failed.forEach(function (f) { Logger.log('❌ ' + f); });
  if (failed.length) Logger.log('→ 예전 계정의 첨부 폴더를 이 계정에 공유했는지 확인하고 moveAttachments를 다시 실행하세요.');
  if (stopped) { Logger.log('⏸ 시간이 모자라 멈췄습니다. moveAttachments를 한 번 더 실행하면 이어서 합니다.'); return; }
  if (failed.length) return;

  var result = withLock_(function () { return jsonResponse_(publish_('이전 도구', true).ok, null, null); });
  Logger.log(JSON.parse(result.getContent()).ok
    ? '✅ 끝 — 사이트에 반영했습니다. 1~2분 뒤 사이트의 사진이 새 계정 드라이브의 사진으로 바뀝니다.'
    : '❌ 옮기기는 끝났지만 사이트 반영에 실패 — GITHUB_TOKEN을 확인한 뒤 관리자 페이지 [다시 반영] 또는 checkSetup');
}

// 표지 첨부를 지웠으니 2.5D 표시도 끈다(누끼가 없는 2.5D는 저장 때 거절되므로)
function clearHeroDepth_() {
  readTab_('표지').forEach(function (r) {
    if (r['입체효과'] || r['입체중심']) { r['입체효과'] = ''; r['입체중심'] = ''; writeRow_('표지', r, r._row); }
  });
}

/**
 * 첨부 폴더를 게시판별 하위 폴더로 나눈다 (2026-11-12 사용자 요청 — docs/decisions.md 5절).
 *
 *  「K예술영재 홍보 사이트 첨부」(DRIVE_FOLDER_ID)
 *    ├ 공지사항 · 언론홍보 · 갤러리 · 모집요강   ← 관리자 페이지 게시판에서 올린 사진 · 파일
 *    ├ 표지 사진 · 사이트 사진                   ← 사이트에서 직접 편집으로 바꾼 사진
 *    └ (바로 아래)                                ← 어느 게시판에서 올렸는지 모르는 것(예전 화면이 올린 것)
 *
 * - 올릴 때 화면이 보내는 board로 하위 폴더를 고른다(Files.js handleUpload_). 모르는 값이면 바로 아래에 둔다.
 * - 하위 폴더는 처음 쓸 때 만들고 ID를 스크립트 속성 DRIVE_SUB_<board>에 적어 둔다. 지워졌으면(휴지통) 다시 만든다.
 * - 하위 폴더도 공유하지 않는다. 파일마다 「링크가 있는 사용자 — 보기」로 공유돼 있어 폴더를 옮겨도 사이트 주소는 그대로다.
 *
 * sortUploads(): 이미 올린 첨부를 「첨부」 탭의 글ID 머리글자로 하위 폴더에 옮긴다 (Apps Script 편집기에서 ▶ 실행).
 *   파일ID가 바뀌지 않으므로 사이트에 다시 반영할 필요가 없다. 시간이 모자라 멈추면 한 번 더 실행하면 이어서 한다.
 *   어느 글에도 붙지 않은 첨부(글ID 빈칸 — 올리고 저장하지 않은 것)는 그대로 둔다.
 */
var UPLOAD_SUBFOLDERS_ = {
  notice:  { prefix: 'N', name: '공지사항' },
  press:   { prefix: 'P', name: '언론홍보' },
  gallery: { prefix: 'G', name: '갤러리' },
  guide:   { prefix: 'R', name: '모집요강' },
  hero:    { prefix: 'H', name: '표지 사진' },
  photo:   { prefix: 'S', name: '사이트 사진' }
};

function isUploadBoard_(board) {
  return typeof board === 'string' && Object.prototype.hasOwnProperty.call(UPLOAD_SUBFOLDERS_, board);
}

// 글ID(G-0001 · H-dance · S-step1 …) → board. 모르면 null
function boardOfPostId_(postId) {
  var m = String(postId || '').match(/^([A-Z])-/);
  if (!m) return null;
  for (var b in UPLOAD_SUBFOLDERS_) if (UPLOAD_SUBFOLDERS_[b].prefix === m[1]) return b;
  return null;
}

// board의 하위 폴더. 모르는 board면 첨부 폴더 바로 아래
function getBoardFolder_(board) {
  if (!isUploadBoard_(board)) return getUploadFolder_();
  var props = PropertiesService.getScriptProperties(), key = 'DRIVE_SUB_' + board;
  var found = openSubfolder_(props.getProperty(key));
  if (found) return found;

  // 처음이거나 폴더가 지워졌다 — 사진 여러 장을 동시에 올려도 폴더가 하나만 생기게 잠근다
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return getUploadFolder_();
  try {
    found = openSubfolder_(props.getProperty(key));
    if (found) return found;
    var root = getUploadFolder_(), name = UPLOAD_SUBFOLDERS_[board].name;
    var same = root.getFoldersByName(name), folder = null;
    while (!folder && same.hasNext()) { var f = same.next(); if (!f.isTrashed()) folder = f; }
    if (!folder) folder = root.createFolder(name);
    props.setProperty(key, folder.getId());
    return folder;
  } finally {
    lock.releaseLock();
  }
}

function openSubfolder_(id) {
  if (!id) return null;
  try {
    var f = DriveApp.getFolderById(id);
    return f.isTrashed() ? null : f;
  } catch (err) {
    return null;
  }
}

// 첨부 폴더와 지금 쓰는 하위 폴더들의 ID
function uploadFolderIds_() {
  var props = PropertiesService.getScriptProperties(), ids = {};
  ids[getUploadFolder_().getId()] = true;
  Object.keys(UPLOAD_SUBFOLDERS_).forEach(function (b) {
    var id = props.getProperty('DRIVE_SUB_' + b);
    if (id) ids[id] = true;
  });
  return ids;
}

function parentIds_(file) {
  var out = [], it = file.getParents();
  while (it.hasNext()) out.push(it.next().getId());
  return out;
}

function sortUploads() {
  var started = Date.now(), timeLimit = 4.5 * 60 * 1000;
  var rows = readTab_('첨부');
  var moved = 0, already = 0, loose = 0, failed = [], stopped = false, folders = {};

  for (var i = 0; i < rows.length; i++) {
    if (Date.now() - started > timeLimit) { stopped = true; break; }
    var a = rows[i], board = boardOfPostId_(a['글ID']);
    if (!board) { loose++; continue; }
    try {
      var folder = folders[board] || (folders[board] = getBoardFolder_(board)), target = folder.getId();
      String(a['파일ID']).split(',').filter(Boolean).forEach(function (id) {
        var file = DriveApp.getFileById(id);
        if (parentIds_(file).indexOf(target) !== -1) { already++; return; }
        file.moveTo(folder);
        moved++;
      });
    } catch (err) {
      failed.push(a['첨부ID'] + ' (' + a['구분'] + ', 글 ' + a['글ID'] + '): ' + err.message);
    }
  }

  Logger.log('옮김 ' + moved + ' · 이미 제자리 ' + already + ' · 글에 붙지 않아 그대로 둠 ' + loose + ' · 실패 ' + failed.length);
  failed.forEach(function (f) { Logger.log('❌ ' + f); });
  if (stopped) { Logger.log('⏸ 시간이 모자라 멈췄습니다 — sortUploads를 한 번 더 실행하면 이어서 합니다.'); return; }
  if (failed.length) { Logger.log('→ 실패한 줄은 파일이 지워졌거나 다른 계정 드라이브에 있는 경우입니다. checkSetup으로 확인하세요.'); return; }
  Logger.log('✅ 끝 — 첨부 폴더 안의 공지사항 · 갤러리 · 모집요강 · 표지 사진 · 사이트 사진 폴더로 정리했습니다. 사이트 주소는 그대로입니다.');
}

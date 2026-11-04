/* ============================================================
   2026 K예술영재 프로젝트 — recruit.js
   모집 및 선발 페이지의 「모집요강 내려받기」(WBS 17.4). 관리자 페이지 「모집요강」 탭에서 연도별로 올린 파일이
   data/posts.json의 guides에 { "2026": { title, files:[{ fileId, name, size }] } }로 나온다.
   연도 탭 안의 <p class="rc-guide" data-guide-year="2026">에 내려받기 단추 하나를 넣고, 파일이 없으면 숨긴 채로 둔다.
   ▣ 운영진이 입력한 값(제목 · 파일명)은 textContent로만 넣는다 (CLAUDE.md 보안 5).
   ============================================================ */
(function(){
  var boxes = [].slice.call(document.querySelectorAll('.rc-guide[data-guide-year]'));
  if(!boxes.length || !window.Board) return;

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }

  // 파일 이름은 보이지 않고 연도마다 「{연도} 모집요강 내려받기」 단추 하나 (2026-11-04 사용자 요청)
  Board.load().then(function(d){
    var guides = (d && d.guides) || {};
    boxes.forEach(function(box){
      var year = box.getAttribute('data-guide-year'), g = guides[year], f = g && g.files && g.files[0];
      if(!f) return;
      var a = el('a', 'rc-dl');
      a.href = Board.fileUrl(f.fileId);
      a.appendChild(el('span', null, year + ' 모집요강 내려받기'));
      a.appendChild(el('span', 'ic', '↓'));
      a.setAttribute('aria-label', year + ' 모집요강 내려받기 (' + Board.formatSize(f.size || 0) + ')');
      box.appendChild(a);
      box.hidden = false;
    });
  });
})();

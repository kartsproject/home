/* ============================================================
   2026 K예술영재 프로젝트 — recruit.js
   모집 및 선발 페이지의 「모집요강 내려받기」(WBS 17.4). 관리자 페이지 「모집요강」 탭에서 연도별로 올린 파일이
   data/posts.json의 guides에 { "2026": { title, files:[{ fileId, name, size }] } }로 나온다.
   연도 탭 안의 <section class="rc-guide" data-guide-year="2026">을 채우고, 파일이 없으면 숨긴 채로 둔다.
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

  Board.load().then(function(d){
    var guides = (d && d.guides) || {};
    boxes.forEach(function(box){
      var year = box.getAttribute('data-guide-year'), g = guides[year];
      if(!g || !g.files || !g.files.length) return;
      box.appendChild(el('h3', null, g.title || year + ' 모집요강'));
      var ul = el('ul');
      g.files.forEach(function(f){
        var li = el('li'), a = el('a');
        a.href = Board.fileUrl(f.fileId);
        a.appendChild(el('span', 'nm', f.name));
        if(f.size) a.appendChild(el('span', 'sz', Board.formatSize(f.size)));
        a.appendChild(el('span', 'dl', '내려받기'));
        li.appendChild(a); ul.appendChild(li);
      });
      box.appendChild(ul);
      box.hidden = false;
    });
  });
})();

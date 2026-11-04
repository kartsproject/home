/* ============================================================
   2026 K예술영재 프로젝트 — program-photos.js
   프로그램 페이지(워크숍 4분야 · 심화 멘토링 · 겨울캠프)의 「갤러리」 사진 줄.
   data/posts.json의 gallery[] 공개 앨범 중 칸의 data-course · data-field에 맞는 앨범의 사진을 모아
   메인 WORKSHOP 칸처럼 가로로 나열한다. 사진이 없거나 목록을 읽지 못하면 칸을 숨긴 채로 둔다.
     워크숍 분야 탭(data-course="workshop" data-field="dance") — 그 분야 앨범 + 워크숍 · 공통(field "") 앨범
     심화 멘토링 · 겨울캠프(data-course만) — 그 과정의 앨범 모두, 제목 앞에 분야(「전통예술 · 제목」, 공통이면 제목만)
   ▣ 운영진이 입력한 값(앨범 제목 · 설명)은 textContent로만 넣는다 (CLAUDE.md 보안 5).
   ============================================================ */
(function(){
  var boxes = [].slice.call(document.querySelectorAll('.pg-photos[data-course]'));
  if(!boxes.length || !window.Board) return;
  var FIELD_NAMES = { dance:'무용', music:'음악', art:'미술', trad:'전통예술' };

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }

  // 최근 앨범부터(갤러리 순서 그대로), 앨범 안에서는 올린 순서. 개수 제한 없음
  function collect(gallery, box){
    var course = box.dataset.course, field = box.dataset.field, items = [];
    gallery.forEach(function(g){
      if(g.course !== course) return;
      if(field !== undefined && g.field !== field && g.field !== '') return;   // 워크숍 탭: 그 분야 + 공통
      var title = g.title || '';
      if(field === undefined && FIELD_NAMES[g.field]) title = FIELD_NAMES[g.field] + ' · ' + title;   // 과정 한 줄: 분야를 앞에
      g.photos.forEach(function(p){ if(p && p.fileId) items.push({ photo:p, album:g, title:title }); });
    });
    return items;
  }

  function fill(box, items){
    var rail = box.querySelector('.pg-rail'),
        arrows = box.querySelector('.pg-arrows'),
        photos = items.map(function(it){ return it.photo; }),
        caps = items.map(function(it){ return it.title; });   // 확대 보기에서 넘길 때마다 그 사진의 앨범 제목(사진 밑 글자와 같게)

    items.forEach(function(it, i){
      var fig = el('figure', 'pg-item'), th = el('button', 'th'), img = el('img');
      th.type = 'button';
      th.setAttribute('aria-label', (it.title || '사진') + ' — 크게 보기');
      img.src = Board.photoUrl(it.photo.fileId, 640); img.alt = ''; img.loading = 'lazy';
      th.appendChild(img);
      th.addEventListener('click', function(){ Board.viewer(photos, i, caps); });
      fig.appendChild(th);
      fig.appendChild(el('figcaption', null, it.title));
      if(it.album.desc) fig.appendChild(el('p', 'm', it.album.desc));
      rail.appendChild(fig);
    });

    // 사진이 모두 보이면 화살표를 숨긴다. 탭을 바꿔 칸이 보이게 될 때 · 창 크기가 바뀔 때 다시 잰다
    function sync(){ arrows.style.visibility = rail.scrollWidth - rail.clientWidth > 4 ? 'visible' : 'hidden'; }
    if(window.ResizeObserver) new ResizeObserver(sync).observe(rail);
    else window.addEventListener('resize', sync);
    arrows.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click', function(){
        var step = rail.querySelector('.pg-item').offsetWidth + 20;
        rail.scrollBy({ left:b.dataset.dir === 'next' ? step : -step, behavior:'smooth' });
      });
    });
    box.hidden = false;
    sync();
  }

  Board.load().then(function(d){
    if(!d) return;
    boxes.forEach(function(box){
      var items = collect(d.gallery, box);
      if(items.length) fill(box, items);
    });
  });
})();

/* ============================================================
   2026 K예술영재 프로젝트 — recruit.js
   모집 및 선발 페이지의 「모집요강 내려받기」(WBS 17.4)와 분야 카드 넘김 띠(WBS 21.1, 맨 아래). 관리자 페이지 「모집요강」 탭에서 연도별로 올린 파일이
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

/* ---------- 분야 카드 넘김 띠 (2026-11-10 사용자 · WBS 21.1) ----------
   .rc-cards(카드 띠, 가로 스크롤 · 카드마다 멈춤 — common.css) 밑에 쪽수 · 진행 막대 · ← → 단추를 만든다.
   카드가 다 들어가 넘길 것이 없으면 막대를 숨긴다. PC 마우스는 끌어서도 넘긴다(손가락 · 터치패드는 브라우저 기본 스크롤).
   띠는 오른쪽으로 화면 끝까지 뻗는다(--bleed). 편집 화면(html.ed-on)은 격자라 아무것도 하지 않는다.
   카드 수는 편집에서 늘거나 줄 수 있어 그때그때 센다 */
(function(){
  var root = document.documentElement;
  [].forEach.call(document.querySelectorAll('.rc-cards'), function(track){
    if(root.classList.contains('ed-on')) return;
    var nav = document.createElement('div'); nav.className = 'rc-nav'; nav.hidden = true;
    var cnt = document.createElement('p'); cnt.className = 'cnt'; cnt.setAttribute('aria-live', 'polite');
    var cur = document.createElement('b'), tot = document.createElement('span');
    cnt.appendChild(cur); cnt.appendChild(document.createTextNode(' / ')); cnt.appendChild(tot);
    var bar = document.createElement('div'); bar.className = 'bar'; bar.setAttribute('aria-hidden', 'true');
    var fill = document.createElement('i'); bar.appendChild(fill);
    var btns = document.createElement('div'); btns.className = 'btns';
    function btn(cls, label, txt){ var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('aria-label', label); b.textContent = txt; btns.appendChild(b); return b; }
    var prev = btn('prev', '이전 분야 카드', '←'), next = btn('next', '다음 분야 카드', '→');
    nav.appendChild(btns); nav.appendChild(cnt); nav.appendChild(bar);   /* 단추는 왼쪽 — 오른쪽 아래는 페이지 위 · 아래 단추 자리 */
    track.parentNode.insertBefore(nav, track.nextSibling);

    function cards(){ return [].slice.call(track.children).filter(function(c){ return c.classList.contains('rc-card') && c.offsetParent !== null; }); }
    function pad(n){ return (n < 10 ? '0' : '') + n; }
    function step(){ var c = cards(); return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : (c[0] ? c[0].offsetWidth : 300); }
    function bleed(){
      // 띠 부모(본문 폭)의 오른쪽 끝에서 화면 오른쪽 끝까지 — 스크롤 막대 폭을 빼려고 100vw 대신 clientWidth
      var r = track.parentNode.getBoundingClientRect();
      track.style.setProperty('--bleed', Math.max(0, Math.round(root.clientWidth - r.right)) + 'px');
    }
    function update(){
      var c = cards(), max = track.scrollWidth - track.clientWidth, s = step();
      var shown = Math.max(1, Math.round((track.clientWidth - parseFloat(getComputedStyle(track).paddingRight || 0)) / s));
      var first = Math.min(c.length - 1, Math.round(track.scrollLeft / s));
      nav.hidden = max < 4 || c.length <= shown;
      cur.textContent = pad(Math.min(c.length, first + 1)); tot.textContent = pad(c.length);
      var w = Math.min(1, shown / Math.max(1, c.length));
      fill.style.setProperty('--w', (w * 100) + '%');
      fill.style.setProperty('--x', (max > 0 ? (track.scrollLeft / max) * ((1 - w) / w) * 100 : 0) + '%');
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    }
    prev.addEventListener('click', function(){ track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function(){ track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', function(){ window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', function(){ bleed(); update(); });

    // 마우스로 끌어 넘기기 — 놓으면 가까운 카드에 멈춘다. 조금만 움직였으면 누르기(링크)로 둔다
    var down = null;
    track.addEventListener('pointerdown', function(e){
      if(e.pointerType !== 'mouse' || e.button !== 0) return;
      down = { x: e.clientX, left: track.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', function(e){
      if(!down) return;
      var dx = e.clientX - down.x;
      if(!down.moved && Math.abs(dx) < 6) return;
      if(!down.moved){ down.moved = true; track.classList.add('drag'); }
      track.scrollLeft = down.left - dx;
    });
    window.addEventListener('pointerup', function(){
      if(!down) return;
      var moved = down.moved; down = null;
      if(!moved) return;
      var s = step(), to = Math.round(track.scrollLeft / s) * s;
      track.classList.remove('drag');
      track.scrollTo({ left: to, behavior: 'smooth' });
    });
    track.addEventListener('dragstart', function(e){ e.preventDefault(); });   /* 사진을 끌면 브라우저가 그림 끌기로 가로채지 않게 */
    // 키보드: 띠에 초점이 있으면 ← → 로 한 장씩
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', '분야별 모집 요강 — 좌우로 넘겨 보기');
    track.addEventListener('keydown', function(e){
      if(e.key === 'ArrowRight'){ e.preventDefault(); next.click(); }
      if(e.key === 'ArrowLeft'){ e.preventDefault(); prev.click(); }
    });
    // 숨은 연도 탭 안에 있으면 크기가 0 — 탭을 바꾸거나 사진이 들어오면 다시 잰다
    document.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('.yr-tabs')) setTimeout(function(){ bleed(); update(); }, 60); });
    track.addEventListener('load', function(){ update(); }, true);
    bleed(); update();
    setTimeout(function(){ bleed(); update(); }, 400);
  });
})();

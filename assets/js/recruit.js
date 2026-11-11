/* ============================================================
   2026 K예술영재 프로젝트 — recruit.js
   모집 및 선발 페이지의 「모집요강 내려받기」(WBS 17.4)와 분야 카드 넘김 띠(WBS 21.1, 맨 아래). 관리자 페이지 「모집요강」 탭에서 연도별로 올린 파일이
   data/posts.json의 guides에 { "2026": { title, files:[{ fileId, name, size }] } }로 나온다.
   연도 탭 안의 <div class="rc-guide" data-guide-year="2026">에 내려받기 단추를 넣는다. 파일이 하나면 누르면 바로 받고,
   여럿이면 누를 때 목록이 펼쳐진다(이름 · 형식 · 크기). 이름은 관리자가 파일마다 적은 「목록에 보일 이름」(label),
   비우면 1번은 「{연도} 모집요강」 · 2번부터 파일 이름 — 2026-11-11 사용자, WBS 22.8 · 22.9 · 22.10.
   파일이 없으면 숨긴 채로 둔다.
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

  // 파일이 하나면 단추를 누르면 바로 받고, 여럿이면 단추 아래로 목록이 펼쳐진다(2026-11-11 사용자).
  function row(x, label){   // 관리자가 적은 「목록에 보일 이름」(x.label)이 먼저, 없으면 넘겨받은 기본 이름 · 파일 이름
    var name = String(x.name || '첨부파일'), m = name.match(/^(.*)\.([A-Za-z0-9]{2,5})$/);
    label = String(x.label || '').trim() || label;
    var li = el('li'), link = el('a');
    link.href = Board.fileUrl(x.fileId);
    link.setAttribute('role', 'menuitem');
    link.appendChild(el('span', 'nm', label || (m ? m[1] : name)));
    if(m) link.appendChild(el('span', 'ext', m[2].toUpperCase()));
    link.appendChild(el('span', 'sz', Board.formatSize(x.size || 0)));
    link.appendChild(el('span', 'ic', '↓'));
    link.setAttribute('aria-label', (label || name) + ' 내려받기 (' + Board.formatSize(x.size || 0) + ')');
    li.setAttribute('role', 'none');
    li.appendChild(link);
    return li;
  }
  var openBox = null;
  function close(box){
    if(!box) return;
    box.classList.remove('open');
    box.querySelector('.rc-dl').setAttribute('aria-expanded', 'false');
    if(openBox === box) openBox = null;
  }
  document.addEventListener('click', function(e){ if(openBox && !openBox.contains(e.target)) close(openBox); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && openBox){ var b = openBox; close(b); b.querySelector('.rc-dl').focus(); }
  });

  Board.load().then(function(d){
    var guides = (d && d.guides) || {};
    boxes.forEach(function(box, bi){
      var year = box.getAttribute('data-guide-year'), g = guides[year], files = (g && g.files) || [], f = files[0];
      if(!f) return;
      if(files.length === 1){   // 하나면 예전처럼 바로 받기
        var a = el('a', 'rc-dl');
        a.href = Board.fileUrl(f.fileId);
        a.appendChild(el('span', null, year + ' 모집요강 내려받기'));
        a.appendChild(el('span', 'ic', '↓'));
        a.setAttribute('aria-label', year + ' 모집요강 내려받기 (' + Board.formatSize(f.size || 0) + ')');
        box.appendChild(a);
        box.hidden = false;
        return;
      }
      var id = 'rc-files-' + year + '-' + bi;
      var btn = el('button', 'rc-dl');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', id);
      btn.appendChild(el('span', null, year + ' 모집요강 · 서류 내려받기'));
      btn.appendChild(el('span', 'ic', '↓'));
      var menu = el('div', 'rc-menu'); menu.id = id;
      var ul = el('ul'); ul.setAttribute('role', 'menu'); ul.setAttribute('aria-label', year + ' 모집요강 · 서류');
      ul.appendChild(row(f, year + ' 모집요강'));
      files.slice(1).forEach(function(x){ ul.appendChild(row(x)); });   // 「함께 내는 서류」 제목은 2026-11-11 사용자 요청으로 뺌
      menu.appendChild(ul);
      btn.addEventListener('click', function(){
        if(box.classList.contains('open')){ close(box); return; }
        if(openBox) close(openBox);
        box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); openBox = box;
      });
      // 목록 안에서 ↑ ↓로 옮겨 다닌다
      menu.addEventListener('keydown', function(e){
        if(e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        var items = [].slice.call(menu.querySelectorAll('a')), i = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      });
      box.appendChild(btn); box.appendChild(menu);
      box.hidden = false;
    });
  });
})();

/* ---------- 분야별 모집 요강 카드 (2026-11-10 사용자 · WBS 21.1) ----------
   ① 도식: 카드 글을 읽어 아이콘 · 칩 · 연도 막대 · 흐름으로 그린다(보이는 것만 — 원래 글은 .rc-sr로 화면 읽기 프로그램에 남김).
      분야 아이콘은 이름(음악 · 무용 · 전통 · 미술)으로, 항목 아이콘은 항목 이름(세부전공 · 모집대상 · 선발방식 · 동영상 · 포트폴리오)으로 고른다.
      읽지 못한 글(모양이 다른 글)은 손대지 않고 그대로 둔다. 운영진 글은 textContent로만 넣는다(CLAUDE.md 보안 5).
      편집 화면(?edit=1 · 이 탭에서 편집을 켬)에서는 그리지 않는다 — 글을 그대로 고치게.
      발행된 고친 글(data/posts.json pages)이 덮인 뒤(Content.ready) 그린다.
   ② 넘김 띠: .rc-cards(가로 띠 · 카드마다 멈춤, common.css) 밑에 ← → · 쪽수 · 진행 막대. 넘길 것이 없으면 숨김.
      PC 마우스는 끌어서도 넘긴다. 띠에 초점이 있으면 키보드 ← → */
(function(){
  var root = document.documentElement, tracks = [].slice.call(document.querySelectorAll('.rc-cards'));
  if(!tracks.length) return;
  var editing = /[?&]edit=1(&|$)/.test(location.search);
  try{ editing = editing || sessionStorage.getItem('hp_edit') === '1'; }catch(e){}
  if(editing) return;

  function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }
  function lines(dd){   // <br>로 나뉜 줄 — 글자만
    var out = [''], n;
    [].forEach.call(dd.childNodes, function(c){ if(c.nodeName === 'BR') out.push(''); else out[out.length - 1] += c.textContent; });
    return out.map(function(t){ return t.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  }
  function hide(dd, vis){   // 원래 글은 읽기 프로그램용으로 남기고 그림을 붙인다
    var sr = el('span', 'rc-sr');
    while(dd.firstChild) sr.appendChild(dd.firstChild);
    vis.setAttribute('aria-hidden', 'true');
    dd.appendChild(sr); dd.appendChild(vis);
  }
  var FIELD = [[/음악/, 'music'], [/무용|발레/, 'dance'], [/전통|국악/, 'trad'], [/미술|시각/, 'art']];
  var ROW = [[/전공|분야/, 'major'], [/대상|출생|연령|나이/, 'age'], [/선발|전형|방식/, 'flow'], [/포트폴리오|작품/, 'port'], [/동영상|영상|실기/, 'video']];
  function pick(list, t, dflt){ for(var i = 0; i < list.length; i++) if(list[i][0].test(t)) return list[i][1]; return dflt; }

  // 세부전공 — 「갈래 — 낱말, 낱말」 줄마다 갈래 이름 + 칩
  function chips(dd){
    var ls = lines(dd); if(!ls.length) return;
    var box = el('div', 'rc-chips'), RE = /^(.+?)\s*[—–-]\s*(.+)$/;
    // 갈래가 있는 줄이 하나라도 있으면 갈래 칸을 두고, 갈래 없는 줄(예: 전통예술 「연희」)은 갈래 칸을 비워 칩 줄을 맞춘다(2026-11-11 수정안)
    if(ls.some(function(l){ return RE.test(l); })) box.classList.add('has-grp');
    ls.forEach(function(l){
      var g = el('div', 'grp'), m = l.match(RE), items = m ? m[2] : l;
      if(box.classList.contains('has-grp')) g.appendChild(el('b', null, m ? m[1] : ''));
      items.split(/\s*[,，·]\s*/).filter(Boolean).forEach(function(w){ g.appendChild(el('span', null, w)); });
      box.appendChild(g);
    });
    hide(dd, box);
  }
  // 선발방식 — 쉼표로 나뉜 서류 · 단계를 ① → ② → ③
  function flow(dd){
    var parts = dd.textContent.replace(/\s+/g, ' ').trim().split(/\s*[,，·]\s*/).filter(Boolean);
    if(parts.length < 2 || parts.length > 6) return;
    var box = el('div', 'rc-flow');
    parts.forEach(function(w, i){   // 화살표는 다음 단계와 붙여 둔다(줄이 바뀔 때 화살표만 줄 끝에 남지 않게)
      var st = el('em', 'st');
      if(i) st.appendChild(el('i', 'ar', '→'));
      st.appendChild(el('span', null, w));
      box.appendChild(st);
    });
    hide(dd, box);
  }
  // 모집대상 — 「2009. 1. 1. ~ 2016. 12. 31. 출생」에서 연도 둘. 막대 눈금은 같은 띠의 모든 카드 공통
  function years(dd){
    var m = dd.textContent.match(/((?:19|20)\d{2})[^~〜～–]*[~〜～–]\s*((?:19|20)\d{2})/);
    return m ? [Number(m[1]), Number(m[2])].sort() : null;
  }
  function age(dd, y, lo, hi, ref){
    var box = el('div', 'rc-age'), ys = el('p', 'yrs'), a = el('b', null, String(y[0])), b = el('b', null, String(y[1]));
    a.appendChild(el('small', null, '년생')); b.appendChild(el('small', null, '년생'));
    ys.appendChild(a); ys.appendChild(b);
    var ax = el('div', 'axis'), bar = el('i'), span = Math.max(1, hi - lo + 1);
    bar.style.setProperty('--a', ((y[0] - lo) / span * 100) + '%');
    bar.style.setProperty('--b', ((hi - y[1]) / span * 100) + '%');
    ax.appendChild(bar);
    box.appendChild(ys); box.appendChild(ax);
    // 학년은 빼고 「출생연도 기준」만 (2026-11-11 수정안 — 지원 자격에서도 학년 표기를 뺌)
    if(ref){ var gd = el('p', 'grd'); gd.appendChild(el('small', null, ref + '년 출생연도 기준')); box.appendChild(gd); }
    hide(dd, box);
  }

  function draw(track){
    var cards = [].slice.call(track.querySelectorAll('.rc-card')), ages = [], lo = 9999, hi = 0;
    var pnl = track.closest('.panel'), ref = pnl && /^y(\d{4})$/.test(pnl.id) ? Number(pnl.id.slice(1)) : 0;
    cards.forEach(function(card){
      var h = card.querySelector('h3');
      if(h) card.setAttribute('data-f', pick(FIELD, h.textContent, 'etc'));
      [].forEach.call(card.querySelectorAll('dl > dt'), function(dt){
        var dd = dt.nextElementSibling, kind = pick(ROW, dt.textContent, 'dot');
        dt.classList.add('ic-' + kind);
        if(!dd || dd.tagName !== 'DD' || dd.querySelector('a, img')) return;
        if(kind === 'major') chips(dd);
        else if(kind === 'flow') flow(dd);
        else if(kind === 'age'){ var y = years(dd); if(y){ ages.push([dd, y]); lo = Math.min(lo, y[0]); hi = Math.max(hi, y[1]); } }
      });
    });
    ages.forEach(function(p){ age(p[0], p[1], lo, hi, ref); });
  }

  function slider(track){
    var nav = el('div', 'rc-nav'); nav.hidden = true;
    var btns = el('div', 'btns');
    function btn(cls, label, txt){ var b = el('button', cls, txt); b.type = 'button'; b.setAttribute('aria-label', label); btns.appendChild(b); return b; }
    var prev = btn('prev', '이전 분야 카드', '←'), next = btn('next', '다음 분야 카드', '→');
    var cnt = el('p', 'cnt'), cur = el('b'), tot = el('span');
    cnt.setAttribute('aria-live', 'polite');
    cnt.appendChild(cur); cnt.appendChild(document.createTextNode(' / ')); cnt.appendChild(tot);
    var bar = el('div', 'bar'), fill = el('i'); bar.setAttribute('aria-hidden', 'true'); bar.appendChild(fill);
    nav.appendChild(btns); nav.appendChild(cnt); nav.appendChild(bar);
    track.parentNode.insertBefore(nav, track.nextSibling);

    function cards(){ return [].slice.call(track.children).filter(function(c){ return c.classList.contains('rc-card') && c.offsetParent !== null; }); }
    function pad(n){ return (n < 10 ? '0' : '') + n; }
    function step(){ var c = cards(); return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : (c[0] ? c[0].offsetWidth : 300); }
    function update(){
      var c = cards(), max = track.scrollWidth - track.clientWidth, s = step();
      var shown = Math.max(1, Math.floor((track.clientWidth + 8) / s));
      var first = Math.min(c.length - 1, Math.round(track.scrollLeft / s));
      nav.hidden = max < 4 || c.length <= shown;
      cur.textContent = pad(Math.min(c.length, first + 1)); tot.textContent = pad(c.length);
      var w = Math.min(1, track.clientWidth / Math.max(1, track.scrollWidth));
      fill.style.setProperty('--w', (w * 100) + '%');
      fill.style.setProperty('--x', (max > 0 ? (track.scrollLeft / max) * ((1 - w) / w) * 100 : 0) + '%');
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    }
    prev.addEventListener('click', function(){ track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function(){ track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', function(){ window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);

    var down = null;   // 마우스로 끌기 — 놓으면 가까운 카드에 멈춤. 조금만 움직였으면 누르기로 둔다
    track.addEventListener('pointerdown', function(e){ if(e.pointerType === 'mouse' && e.button === 0) down = { x: e.clientX, left: track.scrollLeft, moved: false }; });
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
      var s = step();
      track.classList.remove('drag');
      track.scrollTo({ left: Math.round(track.scrollLeft / s) * s, behavior: 'smooth' });
    });
    track.addEventListener('dragstart', function(e){ e.preventDefault(); });
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', '분야별 모집 요강 — 좌우로 넘겨 보기');
    track.addEventListener('keydown', function(e){
      if(e.key === 'ArrowRight'){ e.preventDefault(); next.click(); }
      if(e.key === 'ArrowLeft'){ e.preventDefault(); prev.click(); }
    });
    // 숨은 연도 탭 안이면 크기가 0 — 탭을 바꾸면 다시 잰다
    document.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('.yr-tabs')) setTimeout(update, 60); });
    update(); setTimeout(update, 400);
    return update;
  }

  var ups = tracks.map(slider);
  var ready = window.Content && Content.ready ? Content.ready : Promise.resolve();
  ready.then(function(){ tracks.forEach(draw); ups.forEach(function(u){ u(); }); }, function(){ tracks.forEach(draw); });
})();

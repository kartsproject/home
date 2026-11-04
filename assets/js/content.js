/* ============================================================
   2026 K예술영재 프로젝트 — content.js
   페이지 직접 편집 (WBS 18, 2026-11-04). 운영진이 사이트 화면에서 고친 글자 · 목록을 페이지에 넣는다.
   data/posts.json의 pages.<body data-page> = { t:{ k12:"글" }, l:{ l1:[ { s, t, p }, … ] } } (모양은 apps-script/Pages.js)
     [data-e="k12"]   글자 칸. 고친 글이 있으면 그 글로 바꾼다
     [data-et]        글 안에 그림 · 작은 칸이 섞인 칸 — 글자만 바꾼다
     [data-list="l1"] 목록. 고친 목록이 있으면 HTML의 항목(s번째)을 본떠 그 순서 · 개수로 다시 만든다
     [data-ei="3"]    목록 항목 안의 글자 칸,  항목 안 [data-photo]는 p가 있으면 그 사진 자리로 바꾼다(복제한 항목)
   열쇠는 docs/tools/annotate-edit.py가 HTML에 붙인다. 고친 것이 없는 페이지는 HTML 그대로다.
   글 서식은 **굵게** · ==형광==(em.mark) · 줄바꿈(\n)만. 넣을 때는 textContent · DOM으로만 만든다(innerHTML 없음 — CLAUDE.md 보안 5).
   주소에 ?edit=1이 있거나 이 탭에서 편집을 켰으면(sessionStorage hp_edit) 편집 도구(editor.js)를 부른다 —
   편집 도구는 로그인을 받고, 저장할 수 있는지는 관문이 요청마다 확인한다.
   이 파일은 board.js 뒤, photos.js 앞에 둔다(목록을 다시 만든 뒤 사진을 넣도록).
   ============================================================ */
window.Content = (function(){
  var page = document.body.getAttribute('data-page') || '';
  var C = { page:page, editing:false };

  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function qsa(root, sel){ return [].slice.call(root.querySelectorAll(sel)); }
  function isMark(n){ return n.nodeName === 'EM' && n.classList.contains('mark'); }

  /* ---------- 읽기: 칸 → 글 ---------- */
  // 서식 표시는 잠깐 보이지 않는 글자로 두었다가(앞뒤 띄어쓰기를 바깥으로 빼려고) 끝에 ** · ==로 바꾼다
  var B1 = '\u0001', B2 = '\u0003', M1 = '\u0002', M2 = '\u0004';
  function readRich(el){
    var out = '';
    (function walk(p, inB, inM){
      [].forEach.call(p.childNodes, function(n){
        if(n.nodeType === 3){ out += n.data.replace(/\s+/g, ' '); return; }
        if(n.nodeType !== 1) return;
        var t = n.nodeName;
        if(t === 'BR'){ out += '\n'; return; }
        if(t === 'DIV' || t === 'P'){ if(out && out.slice(-1) !== '\n') out += '\n'; walk(n, inB, inM); return; }   // 편집 중 붙여 넣은 줄
        if((t === 'B' || t === 'STRONG') && !inB){ out += B1; walk(n, true, inM); out += B2; return; }
        if(isMark(n) && !inM){ out += M1; walk(n, inB, true); out += M2; return; }
        walk(n, inB, inM);   // 그 밖의 칸(문장 묶음 .ln-s 등)은 글자만
      });
    })(el, false, false);
    out = out.replace(/​/g, '')
      .replace(/([\u0001\u0002])( +)/g, '$2$1').replace(/( +)([\u0003\u0004])/g, '$2$1')
      .replace(/\u0001\u0003|\u0002\u0004/g, '').replace(/\u0001\u0003|\u0002\u0004/g, '');
    out = out.split('\n').map(function(l){ return l.replace(/ {2,}/g, ' ').trim(); }).join('\n')
      .replace(/\n{3,}/g, '\n\n').trim();
    return out.replace(/[\u0001\u0003]/g, '**').replace(/[\u0002\u0004]/g, '==');
  }
  // 글자만 바꾸는 칸: 그 칸이 바로 가진 첫 글(편집 중이면 .ed-t)
  function textNode(el){
    for(var i = 0; i < el.childNodes.length; i++){
      var n = el.childNodes[i];
      if(n.nodeType === 1 && n.classList.contains('ed-t')) return n;
      if(n.nodeType === 3 && /\S/.test(n.data)) return n;
    }
    return null;
  }
  function readText(el){
    var n = textNode(el);
    return n ? n.textContent.replace(/​/g, '').replace(/\s+/g, ' ').trim() : '';
  }
  function read(el){ return el.hasAttribute('data-et') ? readText(el) : readRich(el); }

  /* ---------- 쓰기: 글 → 칸 ---------- */
  function addText(p, s){
    s.split('\n').forEach(function(x, i){
      if(i) p.appendChild(document.createElement('br'));
      if(x) p.appendChild(document.createTextNode(x));
    });
  }
  function fill(p, s){
    var re = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==/g, last = 0, m;
    while((m = re.exec(s))){
      if(m.index > last) addText(p, s.slice(last, m.index));
      var e;
      if(m[1] != null){ e = document.createElement('b'); fill(e, m[1]); }
      else{ e = document.createElement('em'); e.className = 'mark'; fill(e, m[2]); }
      p.appendChild(e);
      last = re.lastIndex;
    }
    if(last < s.length) addText(p, s.slice(last));
  }
  // 칸에 글을 넣는다. 화면에 붙어 있으면 줄바꿈 단위(common.js __lb)도 다시 맞춘다 — 편집 중에는 맞추지 않는다
  function set(el, s){
    s = String(s == null ? '' : s);
    if(el.hasAttribute('data-et')){
      var n = textNode(el);
      if(!n) return;
      if(n.nodeType === 1){ n.textContent = s; return; }
      var m = n.data.match(/^(\s*)[\s\S]*?(\s*)$/);
      n.data = m[1] + (s || '​') + m[2];   // 비운 칸도 다음에 찾을 수 있게 보이지 않는 글자 하나
    }else{
      el.textContent = '';
      fill(el, s);
    }
    if(!C.editing && window.__lb && document.body.contains(el)) window.__lb(el);
  }

  /* ---------- 목록 ---------- */
  // 처음 HTML의 항목을 본(template)으로 둔다. 항목마다 data-s = 몇 번째 본인지
  var lists = {};
  qsa(document, '[data-list]').forEach(function(box){
    var items = [].slice.call(box.children);
    items.forEach(function(it, i){ it.setAttribute('data-s', String(i)); });
    lists[box.getAttribute('data-list')] = { box:box, tpl:items.map(function(it){ return it.cloneNode(true); }) };
  });
  function find(item, rk){ return item.getAttribute('data-ei') === rk ? item : item.querySelector('[data-ei="' + rk + '"]'); }
  function leavesOf(item){ return (item.hasAttribute('data-ei') ? [item] : []).concat(qsa(item, '[data-ei]')); }
  function photoOf(item){ return item.hasAttribute('data-photo') ? item : item.querySelector('[data-photo]'); }
  // 칸 수가 HTML과 달라지면 가로 칸 수(--n, common.css)를 항목 수에 맞춘다(5칸까지)
  function cols(L){
    var n = L.box.children.length;
    if(n === L.tpl.length) L.box.style.removeProperty('--n');
    else L.box.style.setProperty('--n', String(Math.max(1, Math.min(n, 5))));
  }
  function rebuild(L, recs){
    var made = [], frag = document.createDocumentFragment();
    recs.forEach(function(r){
      var tpl = r && L.tpl[r.s];
      if(!tpl) return;   // HTML에서 항목을 뺐으면 건너뛴다
      var c = tpl.cloneNode(true), tt = obj(r.t);
      Object.keys(tt).forEach(function(rk){
        var e = find(c, rk);
        if(e && typeof tt[rk] === 'string'){ set(e, tt[rk]); made.push(e); }
      });
      if(typeof r.p === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.p)){ var ph = photoOf(c); if(ph) ph.setAttribute('data-photo', r.p); }
      frag.appendChild(c);
    });
    if(recs.length && !frag.childNodes.length) return;   // 쓸 수 있는 항목이 하나도 없으면 HTML 그대로
    L.box.textContent = '';
    L.box.appendChild(frag);
    cols(L);
    if(!C.editing && window.__lb) made.forEach(function(e){ window.__lb(e); });
    if(window.__rvObserve) window.__rvObserve(L.box);
  }

  /* ---------- 고친 내용 넣기 · 모으기 ---------- */
  // HTML의 처음 글 (편집 도구가 「원래대로」 · 바뀐 칸 찾기에 쓴다)
  var orig = {};
  qsa(document, '[data-e]').forEach(function(el){ orig[el.getAttribute('data-e')] = read(el); });

  // reset: 고친 것이 없는 칸 · 목록도 HTML 처음 모습으로 되돌린다(편집 도구가 관문의 최신 내용을 다시 넣을 때)
  function apply(pd, reset){
    pd = obj(pd);
    var t = obj(pd.t), l = obj(pd.l);
    Object.keys(lists).forEach(function(k){
      var recs = Array.isArray(l[k]) ? l[k] : null;
      if(recs) rebuild(lists[k], recs);
      else if(reset) rebuild(lists[k], lists[k].tpl.map(function(_, i){ return { s:i }; }));
    });
    qsa(document, '[data-e]').forEach(function(el){
      var k = el.getAttribute('data-e');
      if(typeof t[k] === 'string') set(el, t[k]);
      else if(reset && read(el) !== orig[k]) set(el, orig[k]);
    });
  }

  // 지금 화면 → 저장할 내용. HTML과 같은 칸 · 목록은 넣지 않는다
  function collect(){
    var t = {}, l = {};
    qsa(document, '[data-e]').forEach(function(el){
      var k = el.getAttribute('data-e'), v = read(el);
      if(v !== orig[k]) t[k] = v;
    });
    Object.keys(lists).forEach(function(k){
      var L = lists[k], items = [].slice.call(L.box.children), same = items.length === L.tpl.length, recs = [];
      items.forEach(function(it, i){
        var s = Number(it.getAttribute('data-s')), tpl = L.tpl[s];
        if(!tpl) return;
        var r = { s:s }, tt = {};
        leavesOf(it).forEach(function(e){
          var rk = e.getAttribute('data-ei'), o = find(tpl, rk), v = read(e);
          if(!o || v !== read(o)) tt[rk] = v;
        });
        if(Object.keys(tt).length) r.t = tt;
        var ph = photoOf(it), oph = photoOf(tpl);
        if(ph && oph && ph.getAttribute('data-photo') !== oph.getAttribute('data-photo')) r.p = ph.getAttribute('data-photo');
        if(s !== i || r.t || r.p) same = false;
        recs.push(r);
      });
      if(!same) l[k] = recs;
    });
    return { t:t, l:l };
  }

  C.lists = lists; C.orig = orig; C.read = read; C.set = set; C.apply = apply; C.collect = collect;
  C.find = find; C.leavesOf = leavesOf; C.photoOf = photoOf; C.cols = cols; C.textNode = textNode;

  /* ---------- 방문자 화면: 발행된 내용 ---------- */
  C.ready = window.Board ? Board.load().then(function(d){ if(d) apply(obj(d.pages)[page]); return d; }) : Promise.resolve(null);

  /* ---------- 편집 도구 부르기 ---------- */
  var edit = /[?&]edit=1(&|$)/.test(location.search);
  try{
    if(edit) sessionStorage.setItem('hp_edit', '1');
    else edit = sessionStorage.getItem('hp_edit') === '1';
  }catch(e){}
  if(edit && page){
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'assets/css/editor.css';
    document.head.appendChild(css);
    ['assets/js/gateway.js', 'assets/js/cropper.js', 'assets/js/editor.js'].forEach(function(src){
      var s = document.createElement('script');
      s.src = src; s.async = false;   // 적은 순서대로 돈다
      document.body.appendChild(s);
    });
  }
  return C;
})();

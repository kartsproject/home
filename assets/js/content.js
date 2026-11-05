/* ============================================================
   2026 K예술영재 프로젝트 — content.js
   페이지 직접 편집 (WBS 18, 2026-11-04). 운영진이 사이트 화면에서 고친 글자 · 목록을 페이지에 넣는다.
   data/posts.json의 pages.<body data-page> = { t:{ k12:"글" }, l:{ l1:[ { s, t, p }, … ] } } (모양은 apps-script/Pages.js)
     [data-e="k12"]   글자 칸. 고친 글이 있으면 그 글로 바꾼다
     [data-et]        글 안에 그림 · 작은 칸이 섞인 칸 — 글자만 바꾼다
     [data-list="l1"] 목록. 고친 목록이 있으면 HTML의 항목(s번째)을 본떠 그 순서 · 개수로 다시 만든다
     [data-ei="3"]    목록 항목 안의 글자 칸,  항목 안 [data-photo]는 p가 있으면 그 사진 자리로 바꾼다(복제한 항목)
   더한 문단 · 구역 (WBS 18.7)
     a:{ k5:["문단", …] }      글자 칸 k5(문단 p) 바로 뒤에 더한 문단 — 같은 모양(태그 · class)으로 [data-ap="k5"]
     x:{ s4:[ 구역, … ] }      구역 자리 [data-sec="s4"] 바로 뒤에 더한 구역 [data-xs="s4"]
        구역 = { k:'text'|'photo'|'table'|'cards'|'steps', h:제목, d:제목 밑 설명, p:[문단], i:[[제목 · 항목, 설명 · 내용]], ph:사진 자리 }
        모양은 사이트에 있는 것(.p1-sec · .ab-dl · .cp-cards · .p1-st)을 그대로 쓴다. 메인은 띠(section.x-band)로 감싼다
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

  /* ---------- 더한 문단 · 구역 (WBS 18.7) ---------- */
  var X_KINDS = ['text', 'photo', 'table', 'cards', 'steps'];
  var GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  var SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  function mk(tag, cls){ var e = document.createElement(tag); if(cls) e.className = cls; return e; }
  function cell(tag, f, text, cls){ var e = mk(tag, cls); e.setAttribute('data-xf', f); fill(e, String(text == null ? '' : text)); return e; }
  function strs(v){ return Array.isArray(v) ? v.filter(function(x){ return typeof x === 'string'; }) : []; }
  function after(ref, n){ ref.parentNode.insertBefore(n, ref.nextSibling); }
  function rd(e){ return e ? readRich(e) : ''; }
  // 글자 칸(문단) 뒤에 더하는 문단: 그 문단과 같은 태그 · class, 편집 열쇠는 뺀다
  var STRIP = ['data-e', 'data-et', 'data-k', 'data-rv', 'data-d', 'id', 'contenteditable', 'data-ed', 'spellcheck', 'data-ap', 'data-xf', 'style'];
  function newPara(src, mark){
    var p = src.cloneNode(false);
    STRIP.forEach(function(a){ p.removeAttribute(a); });
    if(mark.ap) p.setAttribute('data-ap', mark.ap); else p.setAttribute('data-xf', 'p');
    return p;
  }
  function itemEl(k, it, n){
    var e;
    if(k === 'table'){ e = mk('div'); e.appendChild(cell('dt', 'a', it[0])); e.appendChild(cell('dd', 'b', it[1])); return e; }
    if(k === 'cards'){ e = mk('div', 'cp-card'); e.appendChild(cell('h3', 'a', it[0])); e.appendChild(cell('p', 'b', it[1])); return e; }
    e = mk('li'); e.appendChild(mk('small')); e.appendChild(cell('h3', 'a', it[0])); e.appendChild(cell('p', 'b', it[1]));
    return e;
  }
  // 더한 구역의 목록: 칸 수(--n) · 단계 번호를 항목 수에 맞춘다
  function fixAdded(box, k){
    k = k || (box.closest('[data-xk]') || box).getAttribute('data-xk');
    var n = box.children.length;
    if(k === 'cards') box.style.setProperty('--n', String(Math.max(1, Math.min(n, 3))));
    if(k === 'steps'){
      box.style.setProperty('--n', String(Math.max(1, Math.min(n, 5))));
      [].forEach.call(box.children, function(li, i){ var sm = li.querySelector('small'); if(sm) sm.textContent = (i < 9 ? '0' : '') + (i + 1); });
    }
  }
  function buildSec(sec, key, band){
    sec = obj(sec);
    var k = X_KINDS.indexOf(sec.k) > -1 ? sec.k : 'text';
    var box = mk('div', 'p1-sec x-sec x-' + k), head = mk('div', 'p1-h'), body = mk('div', 'x-body');
    head.appendChild(cell('h2', 'h', sec.h));
    head.appendChild(cell('p', 'd', sec.d, 'p1-ld'));
    if(k === 'text' || k === 'photo'){
      if(k === 'photo'){
        var fig = mk('figure', 'x-ph'), img = mk('img');
        img.alt = ''; img.loading = 'lazy'; img.src = GIF;
        if(typeof sec.ph === 'string' && SLUG.test(sec.ph)) img.setAttribute('data-photo', sec.ph);
        fig.appendChild(img); body.appendChild(fig);
      }
      var tx = mk('div', 'x-tx'), ps = strs(sec.p);
      (ps.length ? ps : ['']).forEach(function(t){ tx.appendChild(cell('p', 'p', t)); });
      body.appendChild(tx);
    }else{
      var list = mk(k === 'table' ? 'dl' : k === 'cards' ? 'div' : 'ol', k === 'table' ? 'ab-dl' : k === 'cards' ? 'cp-cards' : 'p1-st');
      var items = Array.isArray(sec.i) ? sec.i.filter(Array.isArray) : [];
      list.setAttribute('data-xl', '');
      (items.length ? items : [['', '']]).forEach(function(it, n){ list.appendChild(itemEl(k, [String(it[0] == null ? '' : it[0]), String(it[1] == null ? '' : it[1])], n)); });
      fixAdded(list, k);
      body.appendChild(list);
    }
    box.appendChild(head); box.appendChild(body);
    var outer = box;
    if(band){ outer = mk('section', 'x-band'); var inn = mk('div', 'inner'); inn.appendChild(box); outer.appendChild(inn); }
    outer.setAttribute('data-xs', key); outer.setAttribute('data-xk', k);
    return outer;
  }
  function readSec(o){
    var k = o.getAttribute('data-xk'), s = { k:k, h:rd(o.querySelector('[data-xf="h"]')) }, d = rd(o.querySelector('[data-xf="d"]'));
    if(d) s.d = d;
    if(k === 'text' || k === 'photo'){
      s.p = qsa(o, '[data-xf="p"]').map(readRich);
      var img = o.querySelector('[data-photo]');
      if(k === 'photo' && img) s.ph = img.getAttribute('data-photo');
    }else{
      var list = o.querySelector('[data-xl]');
      s.i = list ? [].map.call(list.children, function(it){ return [rd(it.querySelector('[data-xf="a"]')), rd(it.querySelector('[data-xf="b"]'))]; }) : [];
    }
    return s;
  }
  function paraAnchor(k){ var e = /^k\d+$/.test(k) && document.querySelector('[data-e="' + k + '"]'); return e && e.tagName === 'P' && !e.hasAttribute('data-et') ? e : null; }
  function secAnchor(s){ return /^s\d+$/.test(s) ? document.querySelector('[data-sec="' + s + '"]') : null; }
  function applyAdded(a, x){
    qsa(document, '[data-ap],[data-xs]').forEach(function(n){ n.parentNode.removeChild(n); });
    var made = [];
    Object.keys(a).forEach(function(k){
      var anc = paraAnchor(k), ref = anc;
      if(!anc) return;
      strs(a[k]).forEach(function(t){ var p = newPara(anc, { ap:k }); fill(p, t); after(ref, p); ref = p; made.push(p); });
    });
    Object.keys(x).forEach(function(s){
      var anc = secAnchor(s), ref = anc;
      if(!anc || !Array.isArray(x[s])) return;
      var band = anc.parentNode === document.body;
      x[s].forEach(function(sec){ var e = buildSec(sec, s, band); after(ref, e); ref = e; made.push(e); });
    });
    if(!C.editing && window.__lb) made.forEach(function(e){ window.__lb(e); });
  }
  function collectAdded(){
    var a = {}, x = {};
    qsa(document, 'p[data-e]').forEach(function(anc){
      var k = anc.getAttribute('data-e'), list = [], n = anc.nextElementSibling;
      while(n && n.getAttribute('data-ap') === k){ list.push(readRich(n)); n = n.nextElementSibling; }
      if(list.length) a[k] = list;
    });
    qsa(document, '[data-sec]').forEach(function(anc){
      var s = anc.getAttribute('data-sec'), list = [], n = anc.nextElementSibling;
      while(n && (n.getAttribute('data-xs') === s || n.classList.contains('ed-add'))){
        if(n.hasAttribute('data-xs')) list.push(readSec(n));
        n = n.nextElementSibling;
      }
      if(list.length) x[s] = list;
    });
    return { a:a, x:x };
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
    applyAdded(obj(pd.a), obj(pd.x));
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
    var ad = collectAdded(), out = { t:t, l:l };
    if(Object.keys(ad.a).length) out.a = ad.a;
    if(Object.keys(ad.x).length) out.x = ad.x;
    return out;
  }

  C.lists = lists; C.orig = orig; C.read = read; C.set = set; C.apply = apply; C.collect = collect;
  C.find = find; C.leavesOf = leavesOf; C.photoOf = photoOf; C.cols = cols; C.textNode = textNode;
  C.newPara = newPara; C.buildSec = buildSec; C.fixAdded = fixAdded; C.KINDS = X_KINDS;

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
    ['assets/js/gateway.js', 'assets/js/cropper.js', 'assets/js/codefield.js', 'assets/js/editor.js'].forEach(function(src){
      var s = document.createElement('script');
      s.src = src; s.async = false;   // 적은 순서대로 돈다
      document.body.appendChild(s);
    });
  }
  return C;
})();

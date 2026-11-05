/* ============================================================
   2026 K예술영재 프로젝트 — richtext.js
   글쓰기 도구 (2026-11-05 사용자 — 「글꼴 · 문장 정렬 등 글쓰기 도구」). 공지사항 본문 · 사이트 직접 편집이 함께 쓴다.
   ▣ 글은 HTML이 아니라 「조각(run)」으로 저장하고, 화면에는 DOM으로만 그린다 (innerHTML 없음 — CLAUDE.md 보안 5).
       조각 run = { x:글, b:1 굵게, i:1 기울임, u:1 밑줄, m:1 형광, s:'s'|'l' 크기, c:색, f:'g' 글꼴, h:링크 주소 }
       글 묶음 doc = { v:1, b:[ { t:'p'|'h'|'ul'|'ol', a:'l'|'c'|'r', r:[조각] (문단 · 소제목), i:[[조각], …] (목록) } ] }
   ▣ 색 · 크기 · 글꼴은 사이트에 맞춘 몇 가지만 고른다(색 4 · 크기 2 · 글꼴: 프리텐다드(기본) · G마켓 산스).
       화면 모양은 common.css의 .rt-* 규칙. 관문(apps-script/Rich.js)이 같은 규칙으로 다시 검사한다.
   ▣ 예전 글 형식도 읽는다: 사이트 칸 「**굵게** ==형광==」, 공지 본문 「**굵게** {강조:청록} {빨강:빨강}」
   ============================================================ */
window.RT = (function(){
  var COLORS = { teal:'청록', navy:'남색', red:'빨강', gray:'회색' };
  var SIZES = { s:'작게', l:'크게' };
  var FONTS = { g:'G마켓 산스' };
  var ALIGNS = { l:'왼쪽', c:'가운데', r:'오른쪽' };
  var FLAGS = ['b', 'i', 'u', 'm'], KEYS = ['s', 'c', 'f', 'h'];
  var LINK_OK = /^(https?:\/\/|mailto:)[^\s<>"]+$/i;
  var URL_RE = /https?:\/\/[^\s<>"'{}]+/g;
  var BLOCK = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|SECTION|ARTICLE|TABLE|TR|TD|PRE|FIGURE)$/;

  function el(tag, cls){ var e = document.createElement(tag); if(cls) e.className = cls; return e; }
  function ok(map, v){ return typeof v === 'string' && Object.prototype.hasOwnProperty.call(map, v); }

  /* ---------- G마켓 산스: 쓰는 글이 있을 때만 불러온다(사이트 글꼴, 메인 페이지와 같은 파일) ---------- */
  var fontAsked = false;
  function ensureFont(){
    if(fontAsked) return;
    fontAsked = true;
    if(document.querySelector('link[href*="GmarketSans"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://cdn.jsdelivr.net/gh/webfontworld/gmarket/GmarketSans.css';
    document.head.appendChild(l);
  }

  /* ---------- 조각 ---------- */
  function sameFmt(a, b){
    for(var i = 0; i < FLAGS.length; i++) if(!a[FLAGS[i]] !== !b[FLAGS[i]]) return false;
    for(var k = 0; k < KEYS.length; k++) if((a[KEYS[k]] || '') !== (b[KEYS[k]] || '')) return false;
    return true;
  }
  function pushRun(runs, x, fmt){
    if(!x) return;
    var last = runs[runs.length - 1];
    if(last && sameFmt(last, fmt)){ last.x += x; return; }
    var r = { x:x };
    FLAGS.forEach(function(f){ if(fmt[f]) r[f] = 1; });
    KEYS.forEach(function(k){ if(fmt[k]) r[k] = fmt[k]; });
    runs.push(r);
  }
  // 띄어쓰기 · 줄바꿈 정리: 줄 앞뒤 빈칸, 겹친 빈칸, 세 줄 넘는 빈 줄, 맨 앞 · 맨 뒤
  function tidy(runs){
    var out = [];
    runs.forEach(function(r){
      var x = r.x.replace(/​/g, '').replace(/[ \t ]+/g, ' ');
      var prev = out.length ? out[out.length - 1].x : '';
      if(/[ \n]$/.test(prev) || !out.length) x = x.replace(/^ +/, '');
      x = x.replace(/ +\n/g, '\n').replace(/\n +/g, '\n');
      if(/\n$/.test(prev)) x = x.replace(/^ +/, '');
      if(x){ var c = {}; for(var k in r) c[k] = r[k]; c.x = x; out.push(c); }
    });
    // 줄 끝 빈칸이 다음 조각의 줄바꿈 앞에 남은 것
    for(var i = 0; i < out.length - 1; i++) if(/^\n/.test(out[i + 1].x)) out[i].x = out[i].x.replace(/ +$/, '');
    if(out.length){ out[0].x = out[0].x.replace(/^[\s]+/, ''); out[out.length - 1].x = out[out.length - 1].x.replace(/\s+$/, ''); }
    var merged = [];
    out.forEach(function(r){ if(r.x) pushRun(merged, r.x, r); });
    merged.forEach(function(r){ r.x = r.x.replace(/\n{3,}/g, '\n\n'); });
    return merged;
  }
  function fmtOf(n, fmt){
    var f = {}, k;
    for(k in fmt) f[k] = fmt[k];
    var t = n.nodeName, cl = n.classList, st = n.style;
    if(t === 'B' || t === 'STRONG') f.b = 1;
    if(t === 'I' || (t === 'EM' && !cl.contains('mark'))) f.i = 1;
    if(t === 'U' || t === 'INS') f.u = 1;
    if((t === 'EM' && cl.contains('mark')) || t === 'MARK') f.m = 1;
    if(t === 'A'){ var href = n.getAttribute('href') || ''; if(LINK_OK.test(href)) f.h = href; }
    if(cl && cl.contains('em-key')) f.c = 'teal';       // 예전 공지 본문 {강조:} · {빨강:}
    if(cl && cl.contains('em-warn')) f.c = 'red';
    if(st){
      if(/^(bold|bolder|[6-9]00)$/.test(st.fontWeight)) f.b = 1;
      if(st.fontStyle === 'italic') f.i = 1;
      if(/underline/.test(st.textDecoration || st.textDecorationLine || '')) f.u = 1;
    }
    if(cl) [].forEach.call(cl, function(c){
      var m = /^rt-([scf])-(\w+)$/.exec(c);
      if(m && ok(m[1] === 's' ? SIZES : m[1] === 'c' ? COLORS : FONTS, m[2])) f[m[1]] = m[2];
    });
    return f;
  }
  function readNode(n, fmt, runs){
    if(n.nodeType === 3){ pushRun(runs, n.data.replace(/\s+/g, ' '), fmt); return; }
    if(n.nodeType !== 1) return;
    if(n.nodeName === 'BR'){ pushRun(runs, '\n', fmt); return; }
    if(/^(SCRIPT|STYLE|SVG|TEMPLATE)$/.test(n.nodeName)) return;
    var blk = BLOCK.test(n.nodeName);
    if(blk && runs.length && !/\n$/.test(runs[runs.length - 1].x)) pushRun(runs, '\n', fmt);
    var f = fmtOf(n, fmt);
    [].forEach.call(n.childNodes, function(c){ readNode(c, f, runs); });
    if(blk && runs.length && !/\n$/.test(runs[runs.length - 1].x)) pushRun(runs, '\n', fmt);
  }
  // 칸(한 문단) → 조각. 안의 블록은 줄바꿈으로
  function domToRuns(root, skip){
    var runs = [];
    [].forEach.call(root.childNodes, function(c){ if(!(skip && c.nodeType === 1 && skip.test(c.nodeName))) readNode(c, {}, runs); });
    return tidy(runs);
  }
  // 조각 → DOM. opts.link: 주소 글자를 링크로(공지 본문)
  function addText(p, s, link){
    s.split('\n').forEach(function(line, i){
      if(i) p.appendChild(el('br'));
      if(!line) return;
      if(!link){ p.appendChild(document.createTextNode(line)); return; }
      var last = 0, m;
      URL_RE.lastIndex = 0;
      while((m = URL_RE.exec(line))){
        var url = m[0].replace(/[.,;:!?)\]]+$/, '');
        if(m.index > last) p.appendChild(document.createTextNode(line.slice(last, m.index)));
        var a = el('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = url;
        p.appendChild(a);
        last = m.index + url.length;
        URL_RE.lastIndex = last;
      }
      if(last < line.length) p.appendChild(document.createTextNode(line.slice(last)));
    });
  }
  function runsToDom(parent, runs, opts){
    opts = opts || {};
    (runs || []).forEach(function(r){
      if(!r || typeof r.x !== 'string') return;
      var frag = document.createDocumentFragment(), linked = typeof r.h === 'string' && LINK_OK.test(r.h);
      addText(frag, r.x, opts.link && !linked);
      var node = frag;
      function wrap(tag, cls){ var w = el(tag, cls); w.appendChild(node); node = w; }
      if(r.b) wrap('b');
      if(r.i) wrap('i');
      if(r.u) wrap('u');
      if(r.m) wrap('em', 'mark');
      if(ok(SIZES, r.s)) wrap('span', 'rt-s-' + r.s);
      if(ok(COLORS, r.c)) wrap('span', 'rt-c-' + r.c);
      if(ok(FONTS, r.f)){ wrap('span', 'rt-f-' + r.f); ensureFont(); }
      if(linked){
        wrap('a');
        node.href = r.h;
        if(!/^mailto:/i.test(r.h)){ node.target = '_blank'; node.rel = 'noopener noreferrer'; }
      }
      parent.appendChild(node);
    });
  }
  function runsText(runs){ return (runs || []).map(function(r){ return r && typeof r.x === 'string' ? r.x : ''; }).join(''); }

  /* ---------- 예전 글 형식 ---------- */
  // 사이트 칸: **굵게** ==형광== 줄바꿈
  function legacyToRuns(s){
    var runs = [];
    (function parse(str, fmt){
      var re = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==/g, last = 0, m;
      while((m = re.exec(str))){
        if(m.index > last) pushRun(runs, str.slice(last, m.index), fmt);
        var f = {}, k;
        for(k in fmt) f[k] = fmt[k];
        if(m[1] != null){ f.b = 1; parse(m[1], f); } else { f.m = 1; parse(m[2], f); }
        last = re.lastIndex;
      }
      if(last < str.length) pushRun(runs, str.slice(last), fmt);
    })(String(s == null ? '' : s), {});
    return runs;
  }
  // 굵게 · 형광만 쓰고 글에 **나 ==가 없으면 예전 글 형식(문자열)으로 — 저장 내용이 짧고 예전 화면과도 맞는다
  function runsToLegacy(runs){
    var out = '';
    for(var i = 0; i < runs.length; i++){
      var r = runs[i];
      if(r.i || r.u || r.s || r.c || r.f || r.h || /\*\*|==/.test(r.x)) return null;
      var x = r.x;
      if(r.m) x = '==' + x + '==';
      if(r.b) x = '**' + x + '**';
      out += x;
    }
    return out;
  }
  // 공지 본문(예전): **굵게** {강조:청록} {빨강:빨강} — 줄마다 문단
  function legacyBodyToDoc(s){
    var blocks = [];
    String(s || '').replace(/\r\n?/g, '\n').split('\n').forEach(function(line){
      var runs = [];
      (function parse(str, fmt){
        var i = 0, buf = '';
        function flush(){ if(buf){ pushRun(runs, buf, fmt); buf = ''; } }
        while(i < str.length){
          if(str.substr(i, 2) === '**'){
            var end = str.indexOf('**', i + 2);
            if(end > i + 2){ flush(); var f = {}, k; for(k in fmt) f[k] = fmt[k]; f.b = 1; parse(str.slice(i + 2, end), f); i = end + 2; continue; }
          }
          var open = str.substr(i, 4);
          if(open === '{강조:' || open === '{빨강:'){
            var close = str.indexOf('}', i + 4);
            if(close > i + 4){ flush(); var g = {}, q; for(q in fmt) g[q] = fmt[q]; g.c = open === '{강조:' ? 'teal' : 'red'; g.b = 1; parse(str.slice(i + 4, close), g); i = close + 1; continue; }
          }
          buf += str[i++];
        }
        flush();
      })(line, {});
      blocks.push({ t:'p', r:runs });
    });
    return trimDoc({ v:1, b:blocks });
  }

  /* ---------- 글 묶음 (문단 · 소제목 · 목록) ---------- */
  function alignOf(n){
    if(!n || n.nodeType !== 1) return null;
    var m = /(?:^|\s)rt-a-([lcr])(?:\s|$)/.exec(n.className || '');
    if(m) return m[1];
    var ta = (n.style && n.style.textAlign) || n.getAttribute('align') || '';
    return ta === 'center' ? 'c' : ta === 'right' ? 'r' : ta === 'left' ? 'l' : null;
  }
  function blk(t, a, body){ var b = { t:t }; if(a && a !== 'l') b.a = a; if(t === 'ul' || t === 'ol') b.i = body; else b.r = body; return b; }
  function trimDoc(doc){
    var b = doc.b;
    var empty = function(x){ return x.t === 'p' && !runsText(x.r).trim(); };
    while(b.length && empty(b[0])) b.shift();
    while(b.length && empty(b[b.length - 1])) b.pop();
    doc.b = b.filter(function(x, i){ return !(empty(x) && i && empty(b[i - 1])); });   // 빈 문단은 한 줄까지
    return doc;
  }
  function domToDoc(root){
    var blocks = [], cur = null;
    function flush(){ if(cur){ var r = tidy(cur.runs); blocks.push(blk('p', cur.a, r)); cur = null; } }
    (function walk(node, a){
      [].forEach.call(node.childNodes, function(n){
        if(n.nodeType === 1 && BLOCK.test(n.nodeName)){
          flush();
          var t = n.nodeName, na = alignOf(n) || a;
          if(t === 'UL' || t === 'OL'){
            var items = [];
            [].forEach.call(n.querySelectorAll('li'), function(li){
              var r = domToRuns(li, /^(UL|OL)$/);
              if(r.length) items.push(r);
            });
            if(items.length) blocks.push(blk(t === 'UL' ? 'ul' : 'ol', na, items));
            return;
          }
          if(/^H[1-6]$/.test(t)){ var hr = domToRuns(n); if(hr.length) blocks.push(blk('h', na, hr)); return; }
          if(n.querySelector('p,div,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote')){ walk(n, na); flush(); return; }
          blocks.push(blk('p', na, domToRuns(n)));
          return;
        }
        if(n.nodeType === 3 && !n.data.trim() && !cur) return;
        if(!cur) cur = { runs:[], a:a };
        readNode(n, {}, cur.runs);
      });
    })(root, alignOf(root));
    flush();
    return trimDoc({ v:1, b:blocks });
  }
  function docToDom(container, doc, opts){
    container.textContent = '';
    ((doc && doc.b) || []).forEach(function(b){
      if(!b) return;
      var e;
      if(b.t === 'ul' || b.t === 'ol'){
        e = el(b.t, 'rt-' + b.t);
        (b.i || []).forEach(function(r){ var li = el('li'); runsToDom(li, r, opts); e.appendChild(li); });
      }else{
        e = el(b.t === 'h' ? 'h3' : 'p', b.t === 'h' ? 'rt-h' : null);
        runsToDom(e, b.r, opts);
        if(!e.firstChild) e.appendChild(el('br'));   // 빈 줄
      }
      if(ok(ALIGNS, b.a) && b.a !== 'l') e.classList.add('rt-a-' + b.a);
      container.appendChild(e);
    });
  }
  function docText(doc){
    return ((doc && doc.b) || []).map(function(b){
      if(b.t === 'ul' || b.t === 'ol') return (b.i || []).map(function(r, i){ return (b.t === 'ul' ? '• ' : (i + 1) + '. ') + runsText(r); }).join('\n');
      return runsText(b.r);
    }).join('\n');
  }

  /* ---------- 편집: 고른 글자에 서식 넣기 · 빼기 ---------- */
  var GROUPS = {
    b:{ test:function(n){ return /^(B|STRONG)$/.test(n.nodeName); }, make:function(){ return el('b'); } },
    i:{ test:function(n){ return n.nodeName === 'I' || (n.nodeName === 'EM' && !n.classList.contains('mark')); }, make:function(){ return el('i'); } },
    u:{ test:function(n){ return n.nodeName === 'U'; }, make:function(){ return el('u'); } },
    m:{ test:function(n){ return (n.nodeName === 'EM' && n.classList.contains('mark')) || n.nodeName === 'MARK'; }, make:function(){ return el('em', 'mark'); } },
    s:{ test:function(n){ return n.nodeName === 'SPAN' && /(^|\s)rt-s-/.test(n.className); }, make:function(v){ return el('span', 'rt-s-' + v); } },
    c:{ test:function(n){ return n.nodeName === 'SPAN' && /(^|\s)(rt-c-|em-key|em-warn)/.test(n.className); }, make:function(v){ return el('span', 'rt-c-' + v); } },
    f:{ test:function(n){ return n.nodeName === 'SPAN' && /(^|\s)rt-f-/.test(n.className); }, make:function(v){ ensureFont(); return el('span', 'rt-f-' + v); } },
    h:{ test:function(n){ return n.nodeName === 'A'; }, make:function(v){ var a = el('a'); a.href = v; return a; } }
  };
  function isG(n, g){ return n && n.nodeType === 1 && GROUPS[g].test(n); }
  function ancestorG(node, root, g){
    for(var n = node; n && n !== root; n = n.parentNode) if(isG(n, g)) return n;
    return null;
  }
  function range(root){
    var s = window.getSelection();
    if(!s || !s.rangeCount) return null;
    var r = s.getRangeAt(0);
    return root && root.contains(r.commonAncestorContainer) ? r : null;
  }
  function unwrap(n){ var p = n.parentNode; while(n.firstChild) p.insertBefore(n.firstChild, n); p.removeChild(n); }
  function stripIn(frag, g){ [].slice.call(frag.querySelectorAll('*')).forEach(function(x){ if(isG(x, g)) unwrap(x); }); }
  function allIn(r, root, g){
    var top = r.commonAncestorContainer, any = false;
    if(top.nodeType === 3) return !!ancestorG(top, root, g);
    var w = document.createTreeWalker(top, NodeFilter.SHOW_TEXT, null), t;
    while((t = w.nextNode())){
      if(!r.intersectsNode(t) || !t.data.trim()) continue;
      any = true;
      if(!ancestorG(t, root, g)) return false;
    }
    return any;
  }
  function empty(n){ return n && n.parentNode && !n.textContent && !(n.querySelector && n.querySelector('br,img')); }
  // g: b · i · u · m(켜고 끄기), s · c · f(값, null이면 뺌), h(링크 주소, null이면 뺌). 고른 글이 없으면 false
  // force: 켜고 끄는 서식도 value 그대로(서식 지우기)
  function apply(root, g, value, force){
    var r = range(root);
    if(!r || r.collapsed) return false;
    if(!force && (g === 'b' || g === 'i' || g === 'u' || g === 'm')) value = !allIn(r, root, g);
    var A = ancestorG(r.commonAncestorContainer, root, g), frag, node, after = null;
    if(A){
      // 고른 글이 한 서식 칸 안에 다 들어 있으면 그 칸을 셋으로 나눠 가운데를 밖으로 뺀다
      var r2 = document.createRange();
      r2.setStart(r.endContainer, r.endOffset);
      r2.setEnd(A, A.childNodes.length);
      var tail = r2.extractContents();
      frag = r.extractContents();
      after = A.cloneNode(false);
      after.appendChild(tail);
      A.parentNode.insertBefore(after, A.nextSibling);
    }else frag = r.extractContents();
    stripIn(frag, g);
    node = frag;
    if(value){ var w = GROUPS[g].make(value); w.appendChild(frag); node = w; }
    var first = node.nodeType === 11 ? node.firstChild : node, last = node.nodeType === 11 ? node.lastChild : node;
    if(A) A.parentNode.insertBefore(node, after); else r.insertNode(node);
    if(empty(A)) A.parentNode.removeChild(A);
    if(empty(after)) after.parentNode.removeChild(after);
    var sel = window.getSelection(), nr = document.createRange();
    if(first && last){ nr.setStartBefore(first); nr.setEndAfter(last); sel.removeAllRanges(); sel.addRange(nr); }
    return true;
  }
  // 서식 지우기(링크는 둔다)
  function clear(root){
    var r = range(root);
    if(!r || r.collapsed) return false;
    ['b', 'i', 'u', 'm', 's', 'c', 'f'].forEach(function(g){ apply(root, g, null, true); });
    return true;
  }
  function active(root, g){
    var r = range(root);
    return !!(r && (ancestorG(r.startContainer, root, g) || (!r.collapsed && allIn(r, root, g))));
  }
  function valueOf(root, g){
    var r = range(root), n = r && ancestorG(r.startContainer, root, g);
    if(!n) return null;
    if(g === 'h') return n.getAttribute('href');
    var m = new RegExp('rt-' + g + '-(\\w+)').exec(n.className);
    return m ? m[1] : (n.classList.contains('em-warn') ? 'red' : n.classList.contains('em-key') ? 'teal' : null);
  }

  /* ---------- 도구 막대 ---------- */
  // opts.root(): 지금 고치는 칸(contenteditable) 또는 null
  // opts.mode(root): 'cell'(한 문단 칸 — 정렬은 칸에), 'doc'(여러 문단 — 정렬은 문단마다, 목록 · 소제목 가능)
  // opts.alignTarget(root): cell일 때 정렬 class를 붙일 요소
  // opts.changed(): 서식을 바꾼 뒤 부름. opts.extra: 뒤에 붙일 단추들
  function toolbar(opts){
    var bar = el('div', 'rt-bar');
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', '글쓰기 도구');
    var pop = null, btns = {};
    function root(){ return opts.root(); }
    function done(){ var rt = root(); if(rt) rt.normalize(); if(opts.changed) opts.changed(); sync(); }
    function needSel(){ if(opts.notice) opts.notice('바꿀 글자를 먼저 끌어서 골라 주세요.'); }
    function b(label, title, fn, cls){
      var x = el('button', 'rt-btn' + (cls ? ' ' + cls : ''));
      x.type = 'button'; x.textContent = label; x.title = title; x.setAttribute('aria-label', title);
      x.addEventListener('mousedown', function(ev){ ev.preventDefault(); });   // 고른 글자가 풀리지 않게
      x.addEventListener('click', function(ev){ ev.preventDefault(); fn(x); });
      return x;
    }
    function inline(g, v){ var rt = root(); if(!rt) return; if(!apply(rt, g, v)) return needSel(); done(); }
    function closePop(){ if(pop){ pop.remove(); pop = null; } }
    function menu(anchor, items, pick){
      if(pop){ var same = pop.anchor === anchor; closePop(); if(same) return; }
      pop = el('div', 'rt-pop');
      pop.anchor = anchor;
      items.forEach(function(it){ pop.appendChild(b(it[1], it[1], function(){ closePop(); pick(it[0]); }, it[2])); });
      bar.appendChild(pop);
      pop.style.left = (anchor.offsetLeft) + 'px';
      pop.style.top = (anchor.offsetTop + anchor.offsetHeight + 4) + 'px';
    }
    function sep(){ return el('span', 'rt-sep'); }
    function blockCmd(cmd, arg){
      var rt = root(); if(!rt) return;
      document.execCommand(cmd, false, arg);
      done();
    }
    function align(a){
      var rt = root(); if(!rt) return;
      if(opts.mode(rt) === 'doc'){
        blockCmd(a === 'c' ? 'justifyCenter' : a === 'r' ? 'justifyRight' : 'justifyLeft');
        return;
      }
      var t = opts.alignTarget ? opts.alignTarget(rt) : rt;
      t.classList.remove('rt-a-l', 'rt-a-c', 'rt-a-r');
      if(a) t.classList.add('rt-a-' + a);
      done();
    }
    btns.b = b('굵게', '굵게 (Ctrl+B)', function(){ inline('b'); }, 'rt-b');
    btns.i = b('기울임', '기울임 (Ctrl+I)', function(){ inline('i'); }, 'rt-i');
    btns.u = b('밑줄', '밑줄 (Ctrl+U)', function(){ inline('u'); }, 'rt-u');
    btns.m = b('형광', '형광 밑줄', function(){ inline('m'); }, 'rt-m');
    btns.s = b('크기 ▾', '글자 크기', function(x){ menu(x, [[null, '보통'], ['s', '작게', 'rt-s-s'], ['l', '크게', 'rt-s-l']], function(v){ inline('s', v); }); });
    btns.c = b('색 ▾', '글자 색', function(x){
      var items = [[null, '기본(검정)']];
      Object.keys(COLORS).forEach(function(k){ items.push([k, COLORS[k], 'rt-c-' + k]); });
      menu(x, items, function(v){ inline('c', v); });
    });
    btns.f = b('글꼴 ▾', '글꼴', function(x){ ensureFont(); menu(x, [[null, '프리텐다드(기본)'], ['g', 'G마켓 산스', 'rt-f-g']], function(v){ inline('f', v); }); });
    btns.a = b('정렬 ▾', '문장 정렬', function(x){ menu(x, [['l', '왼쪽 정렬'], ['c', '가운데 정렬'], ['r', '오른쪽 정렬']], align); });
    btns.ul = b('• 목록', '글머리 목록', function(){ blockCmd('insertUnorderedList'); }, 'rt-blk');
    btns.ol = b('1. 목록', '번호 목록', function(){ blockCmd('insertOrderedList'); }, 'rt-blk');
    btns.h = b('소제목', '소제목으로', function(){ blockCmd('formatBlock', 'h3'); }, 'rt-blk');
    btns.p = b('본문', '보통 문단으로', function(){ blockCmd('formatBlock', 'p'); }, 'rt-blk');
    btns.link = b('링크', '링크 넣기 · 빼기', function(){
      var rt = root(); if(!rt) return;
      if(valueOf(rt, 'h')){ apply(rt, 'h', null); done(); return; }
      var r = range(rt);
      if(!r || r.collapsed) return needSel();
      var saved = r.cloneRange();
      var url = window.prompt('연결할 주소를 넣어 주세요 (https://로 시작)', 'https://');
      if(!url) return;
      url = url.trim();
      if(!/^https?:\/\//i.test(url) && /^[\w.-]+\.[a-z]{2,}/i.test(url)) url = 'https://' + url;
      if(!LINK_OK.test(url)){ if(opts.notice) opts.notice('주소는 https://로 시작해야 합니다.'); return; }
      rt.focus();   // 주소 묻는 창이 닫히면 칸의 커서가 풀린다 — 칸과 고른 글자를 되살린다
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved);
      apply(rt, 'h', url); done();
    });
    btns.x = b('서식 지우기', '고른 글자의 서식 지우기(링크는 둠)', function(){ var rt = root(); if(!rt) return; if(!clear(rt)) return needSel(); done(); });
    [btns.b, btns.i, btns.u, btns.m, sep(), btns.s, btns.c, btns.f, sep(), btns.a, sep(), btns.ul, btns.ol, btns.h, btns.p, sep(), btns.link, btns.x]
      .forEach(function(x){ bar.appendChild(x); });
    (opts.extra || []).forEach(function(x){ bar.appendChild(x); });
    bar.querySelectorAll('.rt-blk').forEach(function(x, i){ if(i === 0) x.previousSibling.classList.add('rt-blk-sep'); });

    // 지금 고른 글자의 서식을 단추에 보여 준다
    function sync(){
      var rt = root();
      ['b', 'i', 'u', 'm'].forEach(function(g){ btns[g].classList.toggle('on', !!(rt && active(rt, g))); });
      btns.link.classList.toggle('on', !!(rt && valueOf(rt, 'h')));
      var doc = rt && opts.mode(rt) === 'doc';
      [btns.ul, btns.ol, btns.h, btns.p].forEach(function(x){ x.hidden = !doc; });
      bar.querySelector('.rt-blk-sep').hidden = !doc;
    }
    document.addEventListener('selectionchange', function(){ if(!bar.hidden) sync(); });
    document.addEventListener('mousedown', function(ev){ if(pop && !bar.contains(ev.target)) closePop(); });
    // 단축키
    bar.keys = function(ev){
      if(!(ev.ctrlKey || ev.metaKey) || ev.altKey) return false;
      var k = ev.key.toLowerCase(), g = k === 'b' ? 'b' : k === 'i' ? 'i' : k === 'u' ? 'u' : null;
      if(!g) return false;
      ev.preventDefault(); inline(g); return true;
    };
    bar.sync = sync;
    bar.close = closePop;
    return bar;
  }

  return {
    COLORS:COLORS, SIZES:SIZES, FONTS:FONTS, ALIGNS:ALIGNS,
    domToRuns:domToRuns, runsToDom:runsToDom, runsText:runsText, tidy:tidy,
    legacyToRuns:legacyToRuns, runsToLegacy:runsToLegacy, legacyBodyToDoc:legacyBodyToDoc,
    domToDoc:domToDoc, docToDom:docToDom, docText:docText, trimDoc:trimDoc, alignOf:alignOf,
    apply:apply, toolbar:toolbar, ensureFont:ensureFont
  };
})();

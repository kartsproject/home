/* ============================================================
   2026 K예술영재 프로젝트 — board.js
   게시글(공지 · 언론홍보 · 갤러리 · 표지 사진) 표시 공통 모듈. 관리자 미리보기와 방문자 화면이 같이 쓴다.
   ▣ 운영진이 입력한 값은 모두 textContent로 넣는다 (innerHTML 금지 — CLAUDE.md 보안 5).
   ▣ 본문 서식 (docs/decisions.md 4절)
       **굵게**   {강조:청록 글자}   {빨강:빨간 글자}   주소(https://…)는 자동 링크
   ============================================================ */
window.Board = (function(){

  /* ---------- 드라이브 주소 (docs/decisions.md 5절) ----------
     구글이 공식 보장하는 주소가 아니라서 이 두 함수에만 둔다. 막히면 여기만 바꾼다. */
  function photoUrl(fileId, width){
    return 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId) + '=w' + (width || 1600);
  }
  function fileUrl(fileId){
    return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);
  }

  function formatSize(bytes){
    if(bytes >= 1024*1024) return (bytes/1024/1024).toFixed(1) + 'M';
    return Math.max(1, Math.round(bytes/1024)) + 'K';
  }

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }

  /* ---------- 본문 ---------- */
  var URL_RE = /https?:\/\/[^\s<>"'{}]+/g;
  var SPANS = { '{강조:':'em-key', '{빨강:':'em-warn' };

  // 글자 조각을 넣되, 그 안의 주소는 링크로 만든다. 끝에 붙은 문장부호는 링크에서 뺀다.
  function appendText(parent, text){
    var last = 0, m;
    URL_RE.lastIndex = 0;
    while((m = URL_RE.exec(text))){
      var url = m[0].replace(/[.,;:!?)\]]+$/, '');
      if(m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el('a', null, url);
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      parent.appendChild(a);
      last = m.index + url.length;
      URL_RE.lastIndex = last;
    }
    if(last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  // 한 줄 안의 서식을 읽어 parent에 붙인다. 짝이 맞지 않는 기호는 글자 그대로 둔다.
  function appendInline(parent, s){
    var buf = '', i = 0;
    function flush(){ if(buf){ appendText(parent, buf); buf = ''; } }
    while(i < s.length){
      if(s.substr(i, 2) === '**'){
        var end = s.indexOf('**', i + 2);
        if(end > i + 2){
          flush();
          var b = el('strong');
          appendInline(b, s.slice(i + 2, end));
          parent.appendChild(b);
          i = end + 2; continue;
        }
      }
      var open = s.substr(i, 4);
      if(SPANS[open]){
        var close = s.indexOf('}', i + 4);
        if(close > i + 4){
          flush();
          var span = el('span', SPANS[open]);
          appendInline(span, s.slice(i + 4, close));
          parent.appendChild(span);
          i = close + 1; continue;
        }
      }
      buf += s[i++];
    }
    flush();
  }

  function renderBody(text){
    var box = el('div', 'post-body');
    String(text || '').split('\n').forEach(function(line, n){
      if(n) box.appendChild(document.createElement('br'));
      appendInline(box, line);
    });
    return box;
  }

  /* ---------- 공지 상세 ---------- */
  // 사진 → 글 → 첨부 (photoPosition이 bottom이면 글 → 사진 → 첨부). 비어 있는 칸은 그리지 않는다.
  // opts.localPhoto(photo): 관리자 화면이 아직 드라이브에 없는 사진의 미리보기 주소를 줄 때 쓴다.
  // opts.onPhoto(index): 사진링크가 없을 때 사진을 누르면 부른다 (방문자 화면의 확대 보기).
  function renderNotice(post, opts){
    opts = opts || {};
    var art = el('article', 'post');
    var head = el('header', 'post-head');
    if(post.category) head.appendChild(el('p', 'post-cat', post.category));
    head.appendChild(el('h3', 'post-title', post.title || ''));
    if(post.date) head.appendChild(el('p', 'post-date', post.date));
    art.appendChild(head);

    var photos = null, link = /^https?:\/\//i.test(post.photoLink || '') ? post.photoLink : '';   // 관문도 검사하지만 시트를 직접 고친 경우까지 막는다
    if(post.photos && post.photos.length){
      photos = el('div', 'post-photos');
      post.photos.forEach(function(p, i){
        var img = el('img');
        img.src = (opts.localPhoto && opts.localPhoto(p)) || photoUrl(p.fileId, 1600);
        img.alt = post.title || '';
        img.loading = 'lazy';
        if(p.w && p.h){ img.width = p.w; img.height = p.h; }
        if(link){
          var a = el('a'); a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.appendChild(img); photos.appendChild(a);
        }else if(opts.onPhoto){
          var zb = el('button', 'post-zoom'); zb.type = 'button';
          zb.setAttribute('aria-label', '사진 크게 보기 (' + (i + 1) + '/' + post.photos.length + ')');
          zb.addEventListener('click', function(){ opts.onPhoto(i); });
          zb.appendChild(img); photos.appendChild(zb);
        }else photos.appendChild(img);
      });
    }
    var body = post.body ? renderBody(post.body) : null;
    if(post.photoPosition === 'bottom'){ if(body) art.appendChild(body); if(photos) art.appendChild(photos); }
    else{ if(photos) art.appendChild(photos); if(body) art.appendChild(body); }

    if(post.files && post.files.length){
      var files = el('section', 'post-files');
      files.appendChild(el('h4', null, '첨부파일'));
      var ul = el('ul');
      post.files.forEach(function(f, i){
        var li = el('li'), a = el('a');
        a.href = fileUrl(f.fileId);
        a.appendChild(el('span', 'nm', (i + 1) + '. ' + f.name));
        a.appendChild(el('span', 'sz', '(' + formatSize(f.size) + ')'));
        li.appendChild(a); ul.appendChild(li);
      });
      files.appendChild(ul);
      art.appendChild(files);
    }
    return art;
  }

  /* ---------- 공개 글 읽기 (방문자 화면) ----------
     관문이 발행한 data/posts.json을 한 번만 읽는다. no-cache: 바뀌었는지 서버에 확인하고, 그대로면 가진 것을 쓴다.
     파일이 아직 없으면(첫 발행 전) 빈 목록, 그 밖의 실패는 null. */
  var MSG = { empty:'등록된 글이 없습니다.', fail:'소식을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  var loading = null;
  function arr(v){ return Array.isArray(v) ? v : []; }
  function fix(p){ p.photos = arr(p.photos); p.files = arr(p.files); return p; }
  function load(){
    if(!loading) loading = fetch('data/posts.json', { cache:'no-cache' }).then(function(r){
      if(r.status === 404) return {};
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(d){
      d = d || {};
      var obj = function(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
      // heroVideo: 표지 동영상(2안 WBS 8.6) — 영상을 올린 칸만 { src, w, h }. 1안 화면은 쓰지 않는다
      return { notices:arr(d.notices).map(fix), press:arr(d.press), gallery:arr(d.gallery).map(fix), hero:obj(d.hero), heroVideo:obj(d.heroVideo) };
    }).catch(function(){ return null; });
    return loading;
  }

  // 본문 · 사진 · 첨부가 모두 없는 공지는 목록에 보이되 누를 수 없다 (docs/decisions.md 4절)
  function hasContent(post){
    return !!(String(post.body || '').trim() || (post.photos && post.photos.length) || (post.files && post.files.length));
  }

  // 공지 목록 한 줄. 내용 없는 글은 href 없는 <a class="empty">로 두어 마우스 반응은 같고 눌러도 이동하지 않는다.
  function noticeItem(post, href, withCat){
    var li = el('li'), a = el('a');
    if(hasContent(post)) a.href = href; else a.className = 'empty';
    if(withCat && post.category) a.appendChild(el('span', 'cat', post.category));
    a.appendChild(el('span', 't', post.title || ''));
    a.appendChild(el('span', 'd', post.date || ''));
    li.appendChild(a);
    return li;
  }

  // 언론홍보 목록 한 줄 — 누르면 기사 주소를 새 탭으로. 공지 목록과 같은 칸(언론사는 분류 자리)을 쓴다.
  // 주소가 http(s)가 아니면(관문이 막지만 시트를 직접 고친 경우) 이동하지 않는다.
  function pressItem(post){
    var li = el('li'), a = el('a', 'press');
    if(/^https?:\/\//i.test(post.url || '')){
      a.href = post.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.title = '새 창에서 기사 보기';
    }else a.className = 'press empty';
    if(post.source) a.appendChild(el('span', 'cat', post.source));
    a.appendChild(el('span', 't', post.title || ''));
    var ext = el('span', 'ext', '↗'); ext.setAttribute('aria-hidden', 'true');
    a.appendChild(ext);
    a.appendChild(el('span', 'd', post.date || ''));
    li.appendChild(a);
    return li;
  }

  /* ---------- 사진 확대 보기 (갤러리 앨범 · 공지 사진) ----------
     좌우 버튼 · ←→ 키 · 휴대폰 밀어 넘기기, Esc · 바깥 누르기로 닫는다. */
  var V = null;
  function button(cls, label, text){
    var b = el('button', cls, text); b.type = 'button'; b.setAttribute('aria-label', label); return b;
  }
  function buildViewer(){
    V = { box:el('div', 'zv'), img:el('img', 'zv-img'), cap:el('p', 'zv-cap'), num:el('p', 'zv-num'),
          prev:button('zv-prev', '이전 사진', '‹'), next:button('zv-next', '다음 사진', '›'), x:button('zv-x', '닫기', '×'),
          photos:[], i:0, back:null };
    V.box.hidden = true;
    V.box.setAttribute('role', 'dialog'); V.box.setAttribute('aria-modal', 'true'); V.box.setAttribute('aria-label', '사진 확대 보기');
    V.img.alt = '';
    var stage = el('figure', 'zv-stage');
    stage.appendChild(V.img); stage.appendChild(V.cap);
    [stage, V.num, V.prev, V.next, V.x].forEach(function(n){ V.box.appendChild(n); });
    document.body.appendChild(V.box);

    V.prev.addEventListener('click', function(){ show(V.i - 1); });
    V.next.addEventListener('click', function(){ show(V.i + 1); });
    V.x.addEventListener('click', closeViewer);
    V.box.addEventListener('click', function(e){ if(e.target === V.box || e.target === stage) closeViewer(); });
    document.addEventListener('keydown', function(e){
      if(V.box.hidden) return;
      if(e.key === 'Escape') closeViewer();
      else if(e.key === 'ArrowLeft') show(V.i - 1);
      else if(e.key === 'ArrowRight') show(V.i + 1);
      else if(e.key === 'Tab'){   // 열려 있는 동안 포커스를 안에 둔다
        var bs = [V.prev, V.next, V.x].filter(function(b){ return !b.hidden; }),
            k = bs.indexOf(document.activeElement);
        e.preventDefault();
        bs[(k + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus();
      }
    });
    var sx = null;
    V.box.addEventListener('touchstart', function(e){ sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive:true });
    V.box.addEventListener('touchend', function(e){
      if(sx === null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if(Math.abs(dx) > 50) show(V.i + (dx < 0 ? 1 : -1));
    });
  }
  function show(i){
    var n = V.photos.length;
    V.i = (i + n) % n;
    var p = V.photos[V.i];
    V.img.removeAttribute('src');
    if(p.w && p.h){ V.img.width = p.w; V.img.height = p.h; }
    else{ V.img.removeAttribute('width'); V.img.removeAttribute('height'); }
    V.img.src = photoUrl(p.fileId, 1600);
    V.num.textContent = (V.i + 1) + ' / ' + n;
    if(V.caps) V.cap.textContent = V.caps[V.i] || '';
    [V.i - 1, V.i + 1].forEach(function(k){   // 옆 사진을 미리 받아 넘길 때 덜 기다리게 한다
      if(n > 1) new Image().src = photoUrl(V.photos[(k + n) % n].fileId, 1600);
    });
  }
  // caption: 모든 사진에 같은 글자(문자열) 또는 사진마다 다른 글자(photos와 같은 길이의 배열 — 프로그램 페이지 사진 줄)
  function viewer(photos, start, caption){
    if(!photos || !photos.length) return;
    if(!V) buildViewer();
    V.photos = photos;
    V.back = document.activeElement;
    V.caps = Array.isArray(caption) ? caption : null;
    V.cap.textContent = V.caps ? '' : (caption || '');
    V.prev.hidden = V.next.hidden = V.num.hidden = photos.length < 2;
    show(start || 0);
    V.box.hidden = false;
    document.documentElement.classList.add('zv-open');
    V.x.focus();
  }
  function closeViewer(){
    V.box.hidden = true;
    document.documentElement.classList.remove('zv-open');
    if(V.back && V.back.focus) V.back.focus();
  }

  return { photoUrl:photoUrl, fileUrl:fileUrl, formatSize:formatSize, renderBody:renderBody, renderNotice:renderNotice,
           MSG:MSG, load:load, hasContent:hasContent, noticeItem:noticeItem, pressItem:pressItem, viewer:viewer };
})();

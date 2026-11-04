/* ============================================================
   2026 K예술영재 프로젝트 — photos.js
   사이트 사진 자리 (WBS 15). 페이지의 data-photo="자리" 요소에, 관리자 페이지 「사이트 사진」 탭에서 바꾼 사진을 넣는다.
   data/posts.json의 photos에 그 자리가 없으면 아무것도 하지 않는다 — HTML · CSS에 적힌 기본 사진이 그대로 보인다.
     <img data-photo> · <div class="wk-ph" data-photo>   → 사진 주소(src)와 보이는 위치(object-position).
                                                          「사진 준비 중」 칸은 사진을 올리면 사진으로 바뀐다
     그 밖의 요소(#sv · #recruit · .mn-ph i)            → CSS 변수 --photo · --photo-pos
                                                          (CSS가 var(--photo, 기본 사진) · var(--photo-pos, 기본 위치)로 쓴다)
   자리 이름은 관문 PHOTO_SLOTS_(apps-script/Photos.js) · 관리자 페이지 PHOTO_PAGES(admin.js)와 같다.
   data/posts.json의 photoMode가 'attached'면(관문 importSitePhotos 뒤) 기본 사진을 쓰지 않고, 올린 사진이 없는 자리는 비워 둔다.
   주소에 ?photo=자리 가 있으면(관리자 페이지 「페이지에서 보기」) 그 자리로 옮겨 노란 테두리로 표시한다.
   ============================================================ */
(function(){
  var els = [].slice.call(document.querySelectorAll('[data-photo]'));
  if(!els.length || !window.Board) return;
  var m = location.search.match(/[?&]photo=([a-z0-9-]+)/), focus = m ? m[1] : null;

  // 보이는 크기 × 화면 배율에 맞춰 400 단위로 받는다(긴 변 2400까지 — 관리자 페이지가 올릴 때 줄이는 크기). 숨은 탭 안은 크기를 잴 수 없어 800
  function want(el){
    var w = el.getBoundingClientRect().width || 0;
    if(!w) return 800;
    w = Math.ceil(w * Math.min(window.devicePixelRatio || 1, 2) / 400) * 400;
    return Math.max(400, Math.min(2400, w));
  }

  function apply(el, p){
    var pos = p.pos ? p.pos.x + '% ' + p.pos.y + '%' : p.fileId ? '50% 50%' : null;
    if(el.tagName === 'IMG' || el.classList.contains('wk-ph')){
      var img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if(!img){
        if(!p.fileId) return;   // 기본 사진이 없는 칸(사진 준비 중)에 위치만 — 바꿀 것이 없다
        img = document.createElement('img');
        img.alt = ''; img.loading = 'lazy';
        el.textContent = '';
        el.classList.remove('empty');
        el.appendChild(img);
      }
      if(p.fileId) img.src = Board.photoUrl(p.fileId, want(el));
      if(pos) img.style.objectPosition = pos;
    }else{
      if(p.fileId) el.style.setProperty('--photo', 'url("' + Board.photoUrl(p.fileId, want(el)) + '")');
      if(pos) el.style.setProperty('--photo-pos', pos);
    }
  }

  function mark(){
    var el = focus && document.querySelector('[data-photo="' + focus + '"]');
    if(!el) return;
    el.classList.add('photo-focus');
    // 탭 이동 · 머리 높이 보정(common.js)이 끝난 뒤 옮긴다
    setTimeout(function(){ el.scrollIntoView({ block:'center', behavior:'smooth' }); }, 400);
  }

  // photoMode 'attached'(2026-11-04): 기본 사진을 쓰지 않는다 — 올린 사진이 없는 자리는 비워 둔다(.ph-none)
  function clear(el){
    el.classList.add('ph-none');
    if(el.tagName === 'IMG'){ el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='; return; }   // 투명 1px — 깨진 그림 표시 없이 바탕색만
    if(el.classList.contains('wk-ph')){ el.textContent = ''; el.classList.remove('empty'); return; }
    el.style.setProperty('--photo', 'none');
  }

  Board.load().then(function(d){
    var photos = (d && d.photos) || {}, attached = d && d.photoMode === 'attached';
    els.forEach(function(el){
      var p = photos[el.getAttribute('data-photo')];
      if(attached && !(p && p.fileId)){ clear(el); return; }
      if(p && (p.fileId || p.pos)) apply(el, p);
    });
  }).then(mark, mark);
})();

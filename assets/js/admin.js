/* ============================================================
   2026 K예술영재 프로젝트 — admin.js
   게시글 관리 화면. 관문(Apps Script)만 부른다 — docs/api.md.
   ▣ 관문 주소는 공개된다고 가정한다. 권한 확인은 관문이 요청마다 한다 (CLAUDE.md 보안 1·2).
   ▣ 토큰은 sessionStorage(탭을 닫으면 로그아웃), 기기ID만 localStorage.
   ▣ 운영진이 입력한 값은 textContent로만 화면에 넣는다.
   ============================================================ */
(function(){
  var GATEWAY = 'https://script.google.com/macros/s/AKfycbzfrJrDmXwhRAb62MEVCiWFDLU2e-HzFy5R9RWTkw0uatO9BMlYgCi5dPlNfUgIxAEITQ/exec';
  var K = { token:'hp_admin_token', exp:'hp_admin_exp', device:'hp_admin_device' };
  try{ localStorage.removeItem('hp_admin_name'); }catch(e){}   // 예전에 저장하던 이름 (2026-10-14부터 쓰지 않음)
  var UPLOAD_PARALLEL = 3;     /* 사진을 동시에 올리는 수 (관문은 시트 기록만 잠근다) */
  var PHOTO_MAX_SIDE = 1600;   /* 올리기 전 긴 변 (docs/decisions.md 5절). 표지 사진은 관문이 주는 limits.heroPhotoSide(2400) */
  /* 게시판 — 탭 순서 = 사이트 소식 탭 순서(공지사항 · 언론홍보 · 갤러리) + 표지 사진 */
  var BOARDS = [
    { id:'notice',  tab:'공지사항',  name:'공지',        add:'+ 새 공지' },
    { id:'press',   tab:'언론홍보',  name:'언론홍보 글', add:'+ 새 기사' },
    { id:'gallery', tab:'갤러리',    name:'앨범',        add:'+ 새 앨범' },
    { id:'hero',    tab:'표지 사진', name:'표지 사진',   add:null },
    { id:'photo',   tab:'사이트 사진', name:'사이트 사진', add:null }
  ];
  /* 사이트 사진 자리 (WBS 15) — 관문 PHOTO_SLOTS_(apps-script/Photos.js) · 페이지의 data-photo와 같은 이름. 페이지 순서 = 메뉴 순서.
     def: 기본 사진(HTML · CSS에 적힌 것 — 바꾸면 여기도), 없으면 「사진 준비 중」 칸. pos: 기본 사진의 보이는 위치(없으면 가운데).
     shape: 사이트에서 보이는 가로 ÷ 세로 [PC, 모바일] — 위치를 고를 때 미리보기 틀 (2026-11-04 1440 · 390 화면에서 잰 값).
     tab: 워크숍 분야 탭 (주소 #music 등) */
  var BAND = [4, 1.77], CARD3 = [0.97, 1.5], CARD45 = [0.88, 1.18], FIELD = [1.14, 1.13];
  var R = 'assets/img/real/';   /* 운영 사진(실사진, WBS 16.1) — preview4와 같은 사진 · 위치 */
  var PHOTO_PAGES = [
    { name:'메인', page:'index.html', slots:[
      { slot:'step1', name:'여정 STEP 01 · 워크숍', def:R + 'step1.jpg', shape:[1.78, 1.46] },
      { slot:'step2', name:'여정 STEP 02 · 심화 멘토링', def:R + 'step2.jpg', pos:[50, 30], shape:[1.78, 1.46] },
      { slot:'step3', name:'여정 STEP 03 · 겨울캠프', def:R + 'step3.jpg', pos:[50, 70], shape:[1.78, 1.46] },
      { slot:'recruit', name:'모집 및 선발 띠', def:R + 'band.jpg', pos:[50, 35], shape:[3.35, 1.77] }
    ] },
    { name:'사업소개', page:'about.html', slots:[
      { slot:'sv-about', name:'위 사진 띠', def:R + 'sv-about.jpg', pos:[50, 45], shape:BAND },
      { slot:'ab-music', name:'네 분야 · 음악', def:R + 'ab-music.jpg', shape:FIELD },
      { slot:'ab-dance', name:'네 분야 · 무용', def:R + 'ab-dance.jpg', shape:FIELD },
      { slot:'ab-trad', name:'네 분야 · 전통예술', def:R + 'ab-trad.jpg', shape:FIELD },
      { slot:'ab-art', name:'네 분야 · 미술', def:R + 'ab-art.jpg', shape:FIELD }
    ] },
    { name:'워크숍', page:'programs.html', slots:[
      { slot:'sv-programs', name:'위 사진 띠', def:R + 'sv-programs.jpg', pos:[50, 40], shape:BAND },
      { slot:'mu1', tab:'music', name:'음악 01 · 전공별 1:1 레슨', def:R + 'mu1.jpg', shape:CARD3 },
      { slot:'mu2', tab:'music', name:'음악 02 · 마스터클래스 · 특강', def:R + 'mu2.jpg', shape:CARD3 },
      { slot:'mu3', tab:'music', name:'음악 03 · 연주회', def:R + 'mu3.jpg', shape:CARD3 },
      { slot:'da1', tab:'dance', name:'무용 01 · 발레 클라스', def:R + 'da1.jpg', shape:CARD45 },
      { slot:'da2', tab:'dance', name:'무용 02 · 발레 레퍼토리', def:R + 'da2.jpg', pos:[50, 45], shape:CARD45 },
      { slot:'da3', tab:'dance', name:'무용 03 · 발레 클라스의 역사', def:R + 'da3.jpg', shape:CARD45 },
      { slot:'da4', tab:'dance', name:'무용 04 · 피지컬 트레이닝', def:R + 'da4.jpg', shape:CARD45 },
      { slot:'tr1', tab:'trad', name:'전통예술 01 · 전공 실기', def:R + 'tr1.jpg', shape:CARD45 },
      { slot:'tr2', tab:'trad', name:'전통예술 02 · 전공 심화', def:R + 'tr2.jpg', shape:CARD45 },
      { slot:'tr3', tab:'trad', name:'전통예술 03 · 신체·음악 표현', def:R + 'tr3.jpg', pos:[50, 30], shape:CARD45 },
      { slot:'tr4', tab:'trad', name:'전통예술 04 · 소리 탐색 및 창작', def:R + 'tr4.jpg', shape:CARD45 },
      { slot:'tr5', tab:'trad', name:'전통예술 05 · 현장 체험', def:R + 'tr5.jpg', shape:CARD45 },
      { slot:'ar1', tab:'art', name:'미술 01 · 관찰과 탐구', def:R + 'ar1.jpg', shape:CARD45 },
      { slot:'ar2', tab:'art', name:'미술 02 · 예술가 특강 및 창작 실습', def:R + 'ar2.jpg', shape:CARD45 },
      { slot:'ar3', tab:'art', name:'미술 03 · 주제 탐색 및 작품 구상', def:R + 'ar3.jpg', shape:CARD45 },
      { slot:'ar4', tab:'art', name:'미술 04 · 개별 작품 제작', def:R + 'ar4.jpg', shape:CARD45 },
      { slot:'ar5', tab:'art', name:'미술 05 · 작품 발표 및 공유', def:R + 'ar5.jpg', pos:[50, 40], shape:CARD45 }
    ] },
    { name:'모집 및 선발', page:'recruit.html', slots:[
      { slot:'sv-recruit', name:'위 사진 띠', def:R + 'sv-recruit.jpg', pos:[50, 55], shape:BAND }
    ] },
    { name:'심화 멘토링', page:'mentoring.html', slots:[
      { slot:'sv-mentoring', name:'위 사진 띠', def:R + 'sv-mentoring.jpg', pos:[50, 45], shape:BAND }
    ] },
    { name:'겨울캠프', page:'camp.html', slots:[
      { slot:'sv-camp', name:'위 사진 띠', def:R + 'sv-camp.jpg', shape:BAND }
    ] }
  ];
  function photoInfo(slot){
    var hit = null;
    PHOTO_PAGES.forEach(function(g){ g.slots.forEach(function(s){ if(s.slot === slot) hit = Object.assign({ pageName:g.name, page:g.page }, s); }); });
    return hit;
  }
  function photoHref(info){ return info.page + '?photo=' + info.slot + (info.tab ? '#' + info.tab : ''); }
  /* 표지 기본 사진 — main.css의 --img-hero-*와 맞출 것. 올린 사진이 없으면 사이트는 이 사진을, 이것도 없으면 그 칸을 건너뛴다 */
  var HERO_DEFAULT = { music:'assets/img/real/hero-music.jpg', dance:'assets/img/real/hero-dance.jpg', trad:'assets/img/real/hero-trad.jpg', art:'assets/img/real/hero-art.jpg' };   /* 실사진 (WBS 16.1) */
  /* 표지 동영상이 올라가는 영상 전용 저장소(GitHub Pages) — main.js의 MEDIA_BASE와 맞출 것. 관문은 경로(hero/A-00123.mp4)만 준다 (2안 WBS 8.6) */
  var MEDIA_BASE = 'https://kartsproject.github.io/home-media/';
  /* 갤러리 앨범 과정 · 분야 — 관문 GALLERY_COURSES_ · GALLERY_FIELDS_(Setup.js)와 같은 코드. 프로그램 페이지가 이 코드로 공개 앨범 사진을 모은다.
     분야 ''(공통)은 그 과정 전체, 과정 ''은 지정 안 함 (WBS 8.10) */
  var GALLERY_COURSES = [['workshop', '워크숍'], ['mentoring', '심화멘토링'], ['camp', '겨울캠프']];
  var GALLERY_FIELDS = [['music', '음악'], ['dance', '무용'], ['trad', '전통예술'], ['art', '미술'], ['', '공통']];   /* 화면 순서 = 분야 순서(2026-10-21, WBS 9.10). 코드는 관문과 같음 */
  var HERO_ORDER = ['music', 'dance', 'trad', 'art'];   /* 표지 칸 순서 — main.js SLOTS와 맞출 것 */
  function codeName(list, code){ var x = list.filter(function(i){ return i[0] === code; })[0]; return x ? x[1] : ''; }
  // ('workshop', 'dance') → '워크숍 · 무용'. 지정 안 함이면 ''
  function galleryLabel(course, field){
    var c = codeName(GALLERY_COURSES, course || '');
    return c ? c + ' · ' + codeName(GALLERY_FIELDS, field || '') : '';
  }

  var S = { token:null, exp:0, name:'', data:null, tab:'notice', edit:null, lastActive:Date.now() };
  var $ = function(id){ return document.getElementById(id); };

  /* ---------- 저장소 (막혀 있어도 화면은 동작) ---------- */
  function ss(k, v){ try{ if(v === undefined) return sessionStorage.getItem(k); if(v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); }catch(e){ return null; } }
  function ls(k, v){ try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }
  function deviceId(){
    var id = ls(K.device);
    if(!id){ id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2)); ls(K.device, id); }
    return id || 'no-storage';
  }

  /* ---------- 요소 만들기 ---------- */
  function h(tag, attrs, kids){
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k){
      var v = attrs[k];
      if(v == null || v === false) return;
      if(k === 'class') e.className = v;
      else if(k === 'text') e.textContent = v;
      else if(k === 'value') e.value = v;
      else if(k === 'checked' || k === 'disabled' || k === 'selected') e[k] = !!v;
      else if(k === 'style') e.style.cssText = v;
      else if(k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids == null ? [] : kids).forEach(function(c){
      if(c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  /* ---------- 알림 · 처리 중 ---------- */
  var toastTimer;
  function toast(msg, isErr){
    var t = $('toast'); t.textContent = msg; t.className = 'mg-toast on' + (isErr ? ' err' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.className = 'mg-toast'; }, isErr ? 6000 : 3500);
  }
  function busy(msg){ $('busyMsg').textContent = msg || ''; $('busy').hidden = !msg; }

  var ERRORS = {
    AUTH_INVALID:'접근코드가 맞지 않습니다.',
    AUTH_EXPIRED:'사용기한이 지난 접근코드입니다.',
    AUTH_LOCKED:'로그인 실패가 많아 잠겼습니다. 10분 뒤 다시 시도해 주세요.',
    INVALID_INPUT:'입력값을 확인해 주세요.',
    FILE_REJECTED:'올릴 수 없는 파일입니다. 형식과 크기를 확인해 주세요.',
    NOT_FOUND:'글이나 첨부를 찾을 수 없습니다. 다른 사람이 지웠을 수 있습니다.',
    BUSY:'다른 저장이 진행 중입니다. 잠시 뒤 다시 눌러 주세요.',
    MEDIA_FAILED:'동영상을 사이트에 올리지 못했습니다. 아무것도 바뀌지 않았으니 잠시 뒤 다시 저장해 주세요.',
    NETWORK:'인터넷 연결을 확인해 주세요.',
    TIMEOUT:'응답이 너무 늦습니다. 잠시 뒤 다시 시도해 주세요.',
    SERVER_ERROR:'처리 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.'
  };
  function errMsg(e){ return ERRORS[e && e.code] || ERRORS.SERVER_ERROR; }

  /* ---------- 관문 호출 ---------- */
  function GatewayError(code){ this.code = code; }

  function call(body, timeoutMs){
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl && setTimeout(function(){ ctrl.abort(); }, timeoutMs || 60000);
    return fetch(GATEWAY, {
      method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' },
      body:JSON.stringify(body), signal:ctrl && ctrl.signal
    }).catch(function(e){
      throw new GatewayError(e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK');
    }).then(function(r){
      return r.json().catch(function(){ throw new GatewayError('SERVER_ERROR'); });
    }).then(function(j){
      clearTimeout(timer);
      if(!j.ok) throw new GatewayError(j.error || 'SERVER_ERROR');
      return j.data;
    }, function(e){ clearTimeout(timer); throw e; });
  }

  // 토큰이 필요한 요청. 로그인이 만료됐으면 작업 화면은 그대로 두고 로그인 창을 띄운 뒤 같은 요청을 다시 보낸다.
  function api(action, extra, timeoutMs){
    var go = function(){ return call(Object.assign({ action:action, token:S.token }, extra), timeoutMs); };
    if(!S.token || Date.now() > S.exp) return relogin().then(go);
    return go().catch(function(e){
      if(e.code === 'TOKEN_EXPIRED' || e.code === 'TOKEN_INVALID') return relogin().then(go);
      throw e;
    });
  }

  /* ---------- 로그인 ----------
     접근코드만 입력한다. 관문은 이름을 받아 작성자 · 수정자 · 로그에 남기므로 늘 「운영자」로 보낸다
     (2026-10-14 차장님 요청. 로그 탭에는 어떤 접근코드로 들어왔는지가 함께 남는다) */
  var OPERATOR = '운영자';
  var loginWaiters = [];
  function setSession(d){
    S.token = d.token; S.exp = d.expiresAt; S.name = d.name;
    ss(K.token, d.token); ss(K.exp, String(d.expiresAt));
    $('who').textContent = OPERATOR + ' 님';
    $('user').hidden = false;
  }
  function showLogin(message){
    $('loginSub').textContent = message || '운영진 접근코드를 입력해 주세요.';
    $('loginErr').textContent = '';
    $('code').value = '';
    $('login').hidden = false;
    $('code').focus();
  }
  function relogin(){
    return new Promise(function(resolve){
      loginWaiters.push(resolve);
      if($('login').hidden) showLogin(S.data ? '로그인 시간이 지났습니다. 다시 로그인하면 하던 작업을 이어서 합니다.' : null);
    });
  }
  $('loginForm').addEventListener('submit', function(ev){
    ev.preventDefault();
    var code = $('code').value.trim();
    if(!code){ $('loginErr').textContent = '접근코드를 입력해 주세요.'; return; }
    $('loginBtn').disabled = true; $('loginErr').textContent = '';
    call({ action:'auth', code:code, name:OPERATOR, deviceId:deviceId(), requestId:Date.now() + '-' + Math.random().toString(16).slice(2) }, 30000)
      .then(function(d){
        setSession(d);
        $('login').hidden = true;
        var w = loginWaiters; loginWaiters = [];
        w.forEach(function(fn){ fn(); });
      }, function(e){ $('loginErr').textContent = errMsg(e); })
      .then(function(){ $('loginBtn').disabled = false; });
  });
  $('logout').addEventListener('click', function(){
    if(!confirmLeave()) return;
    ss(K.token, null); ss(K.exp, null);
    location.reload();
  });

  // 작업 중이면 토큰을 미리 연장한다(만료 30분 전부터, 최근 15분 안에 손댄 경우만).
  ['input','click','keydown'].forEach(function(t){ document.addEventListener(t, function(){ S.lastActive = Date.now(); }, true); });
  setInterval(function(){
    if(!S.token || Date.now() - S.lastActive > 15*60*1000 || S.exp - Date.now() > 30*60*1000) return;
    call({ action:'ping', token:S.token }, 30000).then(function(d){ S.token = d.token; S.exp = d.expiresAt; ss(K.token, d.token); ss(K.exp, String(d.expiresAt)); }, function(){});
  }, 5*60*1000);

  /* ---------- 목록 ---------- */
  function load(){
    busy('목록을 불러오는 중…');
    return api('list', {}).then(function(d){ S.data = d; renderPub(); renderList(); }, function(e){ toast(errMsg(e), true); })
      .then(function(){ busy(null); });
  }

  function renderPub(){
    var p = S.data && S.data.lastPublish, box = $('pub');
    box.textContent = '';
    if(!p){ box.hidden = true; return; }
    box.hidden = false;
    box.className = 'mg-pub' + (p.ok ? '' : ' fail');
    var inner = h('div', { class:'mg-in' });
    if(p.ok){
      inner.appendChild(h('span', { text:'마지막 사이트 반영 ' + p.at.slice(0,16).replace('T',' ') + ' · 저장한 내용은 1~2분 뒤 사이트에 보입니다.' }));
    }else{
      inner.appendChild(h('span', { text:'⚠ 글은 저장됐지만 사이트 반영에 실패했습니다.' }));
      inner.appendChild(h('button', { type:'button', text:'다시 반영', onclick:republish }));
    }
    box.appendChild(inner);
  }

  function republish(){
    busy('사이트에 반영하는 중…');
    api('publish', {}).then(function(d){
      S.data.lastPublish = { ok:d.published, at:new Date(Date.now() + 9*3600e3).toISOString().slice(0,19) };
      renderPub();
      toast(d.published ? '사이트에 반영했습니다. 1~2분 뒤 보입니다.' : '반영에 또 실패했습니다. 잠시 뒤 다시 눌러 주세요.', !d.published);
    }, function(e){ toast(errMsg(e), true); }).then(function(){ busy(null); });
  }

  function renderList(){
    var d = S.data, view = $('view');
    view.textContent = '';
    var items = itemsOf(S.tab), board = boardOf(S.tab);
    var tabs = h('div', { class:'mg-tabs' }, BOARDS.map(function(b){
      var n = b.id === 'hero' || b.id === 'photo' ? itemsOf(b.id).filter(function(x){ return x.photos.length; }).length + ' / ' + itemsOf(b.id).length : String(itemsOf(b.id).length);
      return h('button', { type:'button', class:S.tab === b.id ? 'on' : null, onclick:function(){ S.tab = b.id; renderList(); } },
        [b.tab, h('span', { class:'n', text:n })]);
    }));
    view.appendChild(h('div', { class:'mg-head' }, [
      tabs,
      board.add ? h('button', { type:'button', class:'mg-btn pri', text:board.add, onclick:function(){ openEditor(S.tab, null); } }) : null
    ]));

    if(S.tab === 'hero'){ view.appendChild(heroCards(items)); return; }
    if(S.tab === 'photo'){ view.appendChild(photoCards(items)); return; }
    if(!items.length){ view.appendChild(h('p', { class:'mg-empty', text:'아직 글이 없습니다.' })); return; }

    if(S.tab === 'press'){
      view.appendChild(h('div', { class:'mg-rows' }, items.map(function(p){
        return h('button', { type:'button', class:'mg-row', onclick:function(){ openEditor('press', p); } }, [
          h('span', { class:'badges' }, [visBadge(p.visibility)]),
          h('span', { class:'t' }, [h('small', { text:p.source }), p.title]),
          h('span', { class:'m', text:p.date })
        ]);
      })));
      return;
    }

    if(S.tab === 'notice'){
      view.appendChild(h('div', { class:'mg-rows' }, items.map(function(n){
        var meta = [n.date];
        if(n.photos.length) meta.push('사진 ' + n.photos.length);
        if(n.files.length) meta.push('파일 ' + n.files.length);
        return h('button', { type:'button', class:'mg-row', onclick:function(){ openEditor('notice', n); } }, [
          h('span', { class:'badges' }, [visBadge(n.visibility), n.pinned ? h('span', { class:'badge pin', text:'상단 고정' }) : null]),
          h('span', { class:'t' }, [h('small', { text:n.category }), n.title]),
          h('span', { class:'m', text:meta.join(' · ') })
        ]);
      })));
    }else{
      view.appendChild(h('div', { class:'mg-cards' }, items.map(function(g){
        var th = h('span', { class:'th' }, [visBadge(g.visibility)]);
        if(g.photos.length) th.style.backgroundImage = 'url("' + Board.photoUrl(g.photos[0].fileId, 480) + '")';
        return h('button', { type:'button', class:'mg-card', onclick:function(){ openEditor('gallery', g); } }, [
          th,
          h('span', { class:'tx' }, [
            h('span', { class:'t', text:g.title, style:'display:block' }),
            h('span', { class:'m', text:[g.date, galleryLabel(g.course, g.field) || null, '사진 ' + g.photos.length + '장'].filter(Boolean).join(' · '), style:'display:block' })
          ])
        ]);
      })));
    }
  }
  function visBadge(v){ return h('span', { class:'badge ' + (v === '공개' ? 'on' : 'off'), text:v }); }
  function boardOf(id){ return BOARDS.filter(function(b){ return b.id === id; })[0]; }
  function itemsOf(id){
    var d = S.data, list = (id === 'notice' ? d.notices : id === 'press' ? d.press : id === 'gallery' ? d.gallery : id === 'photo' ? d.photos : d.hero) || [];
    /* 표지 칸은 화면(main.js SLOTS)과 같은 분야 순서로 보여 준다 — 관문 · 시트의 칸 순서는 그대로 (분야 순서 2026-10-21, WBS 9.10) */
    if(id === 'hero') list = list.slice().sort(function(a, b){ return HERO_ORDER.indexOf(a.slot) - HERO_ORDER.indexOf(b.slot); });
    return list;
  }

  /* 표지 사진 — 분야 칸 4개(순서 고정). 올린 사진 > 기본 사진 > 건너뜀 */
  function heroState(slot){
    if(slot.photos.length) return { src:Board.photoUrl(slot.photos[0].fileId, 640), text:(slot.videos || []).length ? '올린 동영상' : slot.depth && slot.cutouts.length ? '올린 사진 · 2.5D' : '올린 사진', cls:'on' };
    if(HERO_DEFAULT[slot.slot]) return { src:HERO_DEFAULT[slot.slot], text:'기본 사진', cls:'def' };
    return { src:null, text:'사진 없음 · 표지에서 건너뜀', cls:'off' };
  }
  function heroCards(items){
    var box = h('div', null, [
      h('p', { class:'mg-note', text:'표지는 이 순서로 한 장씩 넘어갑니다. 칸을 눌러 사진을 올리거나 바꾸세요. 사진을 빼면 기본 사진이 보이고, 기본 사진도 없는 칸은 건너뜁니다.' })
    ]);
    box.appendChild(h('div', { class:'mg-cards hero' }, items.map(function(s, i){
      var st = heroState(s);
      var th = h('span', { class:'th' }, [h('span', { class:'badge ' + st.cls, text:st.text })]);
      if(st.src) th.style.backgroundImage = 'url("' + st.src + '")';
      return h('button', { type:'button', class:'mg-card', onclick:function(){ openEditor('hero', s); } }, [
        th,
        h('span', { class:'tx' }, [
          h('span', { class:'t', text:(i + 1) + '. ' + s.label, style:'display:block' }),
          h('span', { class:'m', text:s.photos.length && s.updatedAt ? '바꾼 때 ' + s.updatedAt.slice(0,16).replace('T',' ') : ' ', style:'display:block' })
        ])
      ]);
    })));
    return box;
  }

  /* 사이트 사진 — 페이지별 자리. 올린 사진 > 기본 사진 > 사진 준비 중. 관문이 아직 이 기능을 모르면(새로 배포 전) d.photos가 없다 */
  function photoState(slot, info){
    var pos = slot.pos ? [slot.pos.x, slot.pos.y] : slot.photos.length ? [50, 50] : info.pos || [50, 50];
    if(slot.photos.length) return { src:Board.photoUrl(slot.photos[0].fileId, 640), text:'바꾼 사진', cls:'on', pos:pos };
    if(info.def) return { src:info.def, text:slot.pos ? '기본 사진 · 위치 조정' : '기본 사진', cls:'def', pos:pos };
    return { src:null, text:'사진 준비 중', cls:'off', pos:pos };
  }
  function photoCards(items){
    var box = h('div', null, [
      h('p', { class:'mg-note', text:'사이트 곳곳에 들어간 사진입니다(메인 첫 화면 표지는 「표지 사진」 탭, 소식 · 프로그램 페이지 사진 줄은 「갤러리」 탭). 자리를 눌러 사진을 바꾸거나 보이는 위치를 고르세요. 사진을 빼면 처음 사진(기본 사진)으로 돌아갑니다.' })
    ]);
    if(!S.data.photos){
      box.appendChild(h('p', { class:'mg-empty', text:'관문(Apps Script)을 새로 배포하면 쓸 수 있습니다. 담당자에게 알려 주세요.' }));
      return box;
    }
    var bySlot = {};
    items.forEach(function(s){ bySlot[s.slot] = s; });
    PHOTO_PAGES.forEach(function(g){
      var slots = g.slots.filter(function(i){ return bySlot[i.slot]; });
      if(!slots.length) return;
      box.appendChild(h('div', { class:'mg-ph-group' }, [
        h('h3', { text:g.name }),
        h('a', { class:'mg-btn sm', href:g.page, target:'_blank', rel:'noopener', text:'페이지 열기 ↗' })
      ]));
      box.appendChild(h('div', { class:'mg-cards photo' }, slots.map(function(info){
        var s = bySlot[info.slot], st = photoState(s, info);
        var th = h('span', { class:'th' + (st.src ? '' : ' none') }, [h('span', { class:'badge ' + st.cls, text:st.text })]);
        if(st.src){ th.style.backgroundImage = 'url("' + st.src + '")'; th.style.backgroundPosition = st.pos[0] + '% ' + st.pos[1] + '%'; }
        return h('button', { type:'button', class:'mg-card', onclick:function(){ openEditor('photo', s); } }, [
          th,
          h('span', { class:'tx' }, [
            h('span', { class:'t', text:info.name, style:'display:block' }),
            h('span', { class:'m', text:(s.photos.length || s.pos) && s.updatedAt ? '바꾼 때 ' + s.updatedAt.slice(0,16).replace('T',' ') + ' · ' + s.updatedBy : ' ', style:'display:block' })
          ])
        ]);
      })));
    });
    return box;
  }

  /* ---------- 작성 화면 ---------- */
  function todayKst(){ return new Date(Date.now() + 9*3600e3).toISOString().slice(0,10); }

  function openEditor(board, post){
    var lim = S.data.limits;
    listY = window.scrollY;
    var copyAtt = function(a){ return Object.assign({}, a); };
    var blank = {
      notice:  { category:S.data.categories[0], title:'', body:'', date:todayKst(), pinned:false, photoPosition:'top', photoLink:'', visibility:'공개' },
      press:   { source:'', title:'', date:todayKst(), url:'', visibility:'공개' },
      gallery: { title:'', desc:'', date:todayKst(), visibility:'공개', course:'', field:'' }
    };
    S.edit = {
      board:board, id:post ? post.id : null, dirty:false, preview:false,
      post: post ? Object.assign({}, post) : blank[board],
      photos: post && post.photos ? post.photos.map(copyAtt) : [],
      files: post && post.files ? post.files.map(copyAtt) : [],
      cutouts: post && post.cutouts ? post.cutouts.map(copyAtt) : [],
      videos: post && post.videos ? post.videos.map(copyAtt) : [],
      maxPhotos: board === 'notice' ? lim.noticePhotos : board === 'hero' || board === 'photo' ? 1 : lim.galleryPhotos,
      photoSide: board === 'hero' || board === 'photo' ? (lim.heroPhotoSide || 2400) : PHOTO_MAX_SIDE
    };
    renderEditor();
    history.pushState({ adEdit:1 }, '');
    window.scrollTo(0, 0);
  }

  function markDirty(){ if(S.edit) S.edit.dirty = true; }
  function pending(){ var e = S.edit; return e ? e.photos.concat(e.files, e.cutouts, e.videos).filter(function(a){ return a.uploading; }).length : 0; }
  function confirmLeave(){
    if(!S.edit || (!S.edit.dirty && !pending())) return true;
    return confirm('저장하지 않은 내용이 있습니다. 나가면 사라집니다. 나갈까요?');
  }
  window.addEventListener('beforeunload', function(ev){
    if(S.edit && (S.edit.dirty || pending())){ ev.preventDefault(); ev.returnValue = ''; }
  });

  /* 작성 화면을 열 때 브라우저 기록을 하나 남겨, 브라우저 뒤로 가기로도 목록에 돌아오게 한다 */
  var listY = 0;
  function dropEditState(){ if(history.state && history.state.adEdit) history.back(); }
  function closeEditor(){ S.edit = null; renderList(); window.scrollTo(0, listY); dropEditState(); }
  window.addEventListener('popstate', function(){
    if(!S.edit) return;                              // 버튼 · 저장으로 닫으면서 기록을 되돌린 경우
    if(confirmLeave()){ S.edit = null; renderList(); window.scrollTo(0, listY); }
    else history.pushState({ adEdit:1 }, '');        // 머무르기로 하면 기록을 다시 남긴다
  });

  function renderEditor(){
    var e = S.edit, p = e.post, lim = S.data.limits, isNotice = e.board === 'notice', isPress = e.board === 'press';
    var view = $('view');
    view.textContent = '';
    var wrap = h('section', { class:'mg-edit' });

    wrap.appendChild(h('div', { class:'mg-edit-top' }, [
      h('button', { type:'button', class:'mg-back', text:'← 목록으로', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
      p.author ? h('span', { class:'mg-meta', text:'작성 ' + p.author + ' · 마지막 수정 ' + p.updatedBy + ' ' + (p.updatedAt || '').slice(0,16).replace('T',' ') }) : null
    ]));

    if(e.board === 'hero'){ renderHeroEditor(wrap, e); view.appendChild(wrap); return; }
    if(e.board === 'photo'){ renderPhotoEditor(wrap, e); view.appendChild(wrap); return; }

    wrap.appendChild(h('h2', { text:(e.id ? '' : '새 ') + boardOf(e.board).name + (e.id ? ' 수정' : '') }));

    var bind = function(key){ return function(ev){ p[key] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; markDirty(); }; };

    // 분류 · 게시일 · 공개여부
    var row = h('div', { class:'fld-row', style:'margin-top:22px' });
    if(isNotice){
      row.appendChild(h('div', { class:'fld' }, [
        h('label', { for:'f-cat', text:'분류' }),
        // 분류 목록에서 빠진 분류(예: 2026-10-14 삭제한 「아카이브」)의 글은 다시 고르게 한다. 그대로 두면 화면엔 첫 분류가 보이지만 예전 값이 전송된다
        h('select', { id:'f-cat', onchange:bind('category') }, (S.data.categories.indexOf(p.category) < 0
          ? [h('option', { value:'', text:'분류를 골라 주세요 (예전 분류 「' + p.category + '」는 더 이상 쓰지 않음)', selected:true, disabled:true })] : [])
          .concat(S.data.categories.map(function(c){ return h('option', { value:c, text:c, selected:c === p.category }); })))
      ]));
    }
    if(e.board === 'gallery'){
      row.appendChild(h('div', { class:'fld' }, [
        h('label', { for:'f-field', text:'분야' }),
        // 값은 「과정:분야」 (예: workshop:dance, workshop: = 워크숍 · 공통, : = 지정 안 함)
        h('select', { id:'f-field', onchange:function(ev){
          var v = ev.target.value.split(':'); p.course = v[0]; p.field = v[1] || ''; markDirty();
        } }, [h('option', { value:':', text:'지정 안 함', selected:!p.course })].concat(GALLERY_COURSES.map(function(c){
          return h('optgroup', { label:c[1] }, GALLERY_FIELDS.map(function(f){
            return h('option', { value:c[0] + ':' + f[0], text:f[1], selected:p.course === c[0] && (p.field || '') === f[0] });
          }));
        }))),
        h('p', { class:'syntax', text:'고르면 그 프로그램 페이지에 이 앨범 사진이 나옵니다(공개 앨범만). 워크숍 · 공통은 워크숍 네 분야 탭에 모두 나옵니다.' })
      ]));
    }
    row.appendChild(h('div', { class:'fld' }, [
      h('label', { for:'f-date', text:'게시일' }),
      h('input', { id:'f-date', type:'date', value:p.date, onchange:bind('date') })
    ]));
    row.appendChild(h('div', { class:'fld' }, [
      h('span', { class:'lb' }, ['공개 여부', h('span', { class:'hint', text:'비공개 글은 사이트에 보이지 않습니다' })]),
      h('div', { class:'choices' }, ['공개', '비공개'].map(function(v){
        return h('label', null, [h('input', { type:'radio', name:'vis', value:v, checked:p.visibility === v, onchange:bind('visibility') }), v]);
      }))
    ]));
    wrap.appendChild(row);

    // 언론사 (언론홍보만) · 제목
    if(isPress){
      wrap.appendChild(field('f-source', '언론사', lim.pressSource, function(){
        return h('input', { id:'f-source', type:'text', value:p.source, placeholder:'예: 연합뉴스', maxlength:String(lim.pressSource), oninput:bind('source') });
      }, '목록에서 제목 앞에 보입니다'));
    }
    var titleMax = isNotice ? lim.noticeTitle : isPress ? lim.pressTitle : lim.galleryTitle;
    wrap.appendChild(field('f-title', isPress ? '기사 제목' : '제목', titleMax, function(){
      return h('input', { id:'f-title', type:'text', value:p.title, maxlength:String(titleMax), oninput:bind('title') });
    }));

    if(isPress){
      var urlInput = h('input', { id:'f-url', type:'url', value:p.url, placeholder:'https://', maxlength:String(lim.link), oninput:bind('url') });
      wrap.appendChild(h('div', { class:'fld' }, [
        h('label', { for:'f-url' }, ['기사 주소', h('span', { class:'hint', text:'사이트 목록에서 누르면 이 주소가 새 탭으로 열립니다' })]),
        urlInput,
        h('p', { class:'syntax' }, [h('button', { type:'button', class:'mg-btn sm', text:'주소 열어 확인 ↗', onclick:function(){
          var u = urlInput.value.trim();
          if(/^https?:\/\/\S+$/i.test(u)) window.open(u, '_blank', 'noopener'); else toast('기사 주소는 https:// 로 시작해야 합니다.', true);
        } })])
      ]));
    }else if(isNotice){
      wrap.appendChild(bodyField(p, lim));
      wrap.appendChild(photoField(e, '사진', '포스터 · 안내 이미지. 맨 앞 사진부터 차례로 보입니다.'));
      wrap.appendChild(h('div', { class:'fld-row two' }, [
        h('div', { class:'fld' }, [
          h('span', { class:'lb', text:'사진 위치' }),
          h('div', { class:'choices' }, [['top','글 위'], ['bottom','글 아래']].map(function(o){
            return h('label', null, [h('input', { type:'radio', name:'ppos', value:o[0], checked:p.photoPosition === o[0], onchange:bind('photoPosition') }), o[1]]);
          }))
        ]),
        h('div', { class:'fld' }, [
          h('label', { for:'f-link' }, ['사진을 누르면 이동할 주소', h('span', { class:'hint', text:'비우면 이동하지 않음' })]),
          h('input', { id:'f-link', type:'url', value:p.photoLink, placeholder:'https://', maxlength:String(lim.link), oninput:bind('photoLink') })
        ])
      ]));
      wrap.appendChild(fileField(e, lim));
      wrap.appendChild(h('div', { class:'fld' }, [
        h('label', { class:'choices', style:'font-weight:600' }, [h('input', { type:'checkbox', checked:p.pinned, onchange:bind('pinned') }), '목록 맨 위에 고정'])
      ]));
    }else{
      wrap.appendChild(field('f-desc', '설명', lim.galleryDesc, function(){
        return h('input', { id:'f-desc', type:'text', value:p.desc, placeholder:'예: 2026.07 · 광주캠퍼스', maxlength:String(lim.galleryDesc), oninput:bind('desc') });
      }, '촬영 시기 · 장소'));
      wrap.appendChild(photoField(e, '사진', '맨 앞 사진이 목록에 보이는 대표 사진입니다.'));
    }

    wrap.appendChild(h('div', { class:'mg-actions' }, [
      e.id ? h('button', { type:'button', class:'mg-btn warn', text:'삭제', onclick:removePost }) : null,
      h('div', { class:'r' }, [
        h('button', { type:'button', class:'mg-btn', text:'취소', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
        h('button', { type:'button', class:'mg-btn pri', text:'저장', onclick:save })
      ])
    ]));
    view.appendChild(wrap);
  }

  // 표지 사진 한 칸 — 사진 한 장만 둔다. 칸은 고정이라 삭제 버튼이 없다 (docs/decisions.md 2절)
  function renderHeroEditor(wrap, e){
    var p = e.post, def = HERO_DEFAULT[p.slot];
    wrap.appendChild(h('h2', { text:'표지 사진 — ' + p.label }));
    wrap.appendChild(h('p', { class:'mg-note', text:def
      ? '사진을 올리면 표지의 이 칸에 보입니다. 사진을 빼고 저장하면 아래 기본 사진으로 돌아갑니다.'
      : '사진을 올리면 표지의 이 칸에 보입니다. 이 칸은 기본 사진이 없어, 사진을 빼고 저장하면 표지에서 건너뜁니다.' }));
    wrap.appendChild(photoField(e, '사진', '가로로 긴 사진(16:9 정도)이 좋습니다. 화면 비율에 따라 위아래나 좌우가 잘리고, 왼쪽에 제목 글자가 올라갑니다.'));
    if(S.data.limits.videoPartBytes){   // 동영상을 받는 관문(2안)일 때만
      var videoBox = h('div', { class:'fld mg-video', id:'videoFld' });
      wrap.appendChild(videoBox);
      drawVideo(e, videoBox);
    }
    var depthBox = h('div', { class:'fld mg-depth', id:'depthFld' });
    wrap.appendChild(depthBox);
    drawDepth(e, depthBox);
    if(def) wrap.appendChild(h('div', { class:'fld' }, [
      h('span', { class:'lb', text:'기본 사진 (올린 사진이 없을 때 보임)' }),
      h('img', { class:'mg-hero-def', src:def, alt:'' })
    ]));
    wrap.appendChild(h('div', { class:'mg-actions' }, [
      h('div', { class:'r' }, [
        h('button', { type:'button', class:'mg-btn', text:'취소', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
        h('button', { type:'button', class:'mg-btn pri', text:'저장', onclick:save })
      ])
    ]));
  }

  // 사이트 사진 한 자리 — 사진 한 장 + 보이는 위치. 자리는 고정이라 삭제 버튼이 없다 (WBS 15)
  function renderPhotoEditor(wrap, e){
    var p = e.post, info = photoInfo(p.slot) || { slot:p.slot, name:p.label, pageName:'', page:'index.html', shape:[1.5, 1.5] };
    e.info = info;
    wrap.appendChild(h('h2', { text:'사이트 사진 — ' + (info.pageName ? info.pageName + ' · ' : '') + info.name }));
    wrap.appendChild(h('p', { class:'mg-note' }, [
      info.def ? '사진을 올리면 이 자리의 기본 사진 대신 보입니다. 사진을 빼고 저장하면 기본 사진으로 돌아갑니다. '
               : '지금은 「사진 준비 중」으로 비어 있는 자리입니다. 사진을 올리면 그 자리에 보이고, 빼면 다시 비어 보입니다. ',
      '학생 얼굴이 크게 나오는 사진은 피해 주세요. ',
      h('a', { href:photoHref(info), target:'_blank', rel:'noopener', text:'사이트에서 이 자리 보기 ↗' })
    ]));
    wrap.appendChild(photoField(e, '사진', '이 자리는 화면에 따라 잘려 보입니다. 아래 「보이는 위치」 미리보기로 확인하세요.'));
    var posBox = h('div', { class:'fld mg-pos', id:'posFld' });
    wrap.appendChild(posBox);
    drawPos(e, posBox);
    if(info.def) wrap.appendChild(h('div', { class:'fld' }, [
      h('span', { class:'lb', text:'기본 사진 (올린 사진이 없을 때 보임)' }),
      h('img', { class:'mg-hero-def', src:info.def, alt:'', style:'aspect-ratio:auto' })
    ]));
    wrap.appendChild(h('div', { class:'mg-actions' }, [
      (e.photos.length || p.pos) ? h('button', { type:'button', class:'mg-btn warn', text:info.def ? '기본 사진 · 위치로 되돌리기' : '비우기 (사진 준비 중)', onclick:function(){
        e.photos = []; p.pos = null; markDirty(); drawPhotos(null, e); drawPos(e); toast('저장하면 ' + (info.def ? '기본 사진으로' : '빈 자리로') + ' 돌아갑니다.');
      } }) : null,
      h('div', { class:'r' }, [
        h('button', { type:'button', class:'mg-btn', text:'취소', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
        h('button', { type:'button', class:'mg-btn pri', text:'저장', onclick:save })
      ])
    ]));
  }

  // 보이는 위치 — 사진을 누르거나 끌어 가운데 둘 곳을 고른다. 사이트와 같은 방식(object-position · background-position %)으로 PC · 모바일 틀에 미리 보여 준다
  function drawPos(e, box){
    box = box || $('posFld');
    if(!box || !e.info) return;
    box.textContent = '';
    var p = e.post, info = e.info, ph = e.photos[0];
    var src = ph ? (ph.local || (ph.fileId && Board.photoUrl(ph.fileId, 1200))) : info.def;
    box.appendChild(h('span', { class:'lb' }, ['보이는 위치', h('span', { class:'hint', text:'사진을 누르거나 끌어서, 잘려도 꼭 보여야 할 곳(인물 · 악기 등)을 고르세요.' })]));
    if(!src || (ph && ph.error)){
      box.appendChild(h('p', { class:'hint', text:ph && ph.uploading ? '사진을 올리는 중입니다…' : '사진을 올리면 고를 수 있습니다.' }));
      return;
    }
    var cur = p.pos ? [p.pos.x, p.pos.y] : ph ? [50, 50] : info.pos || [50, 50];
    var dot = h('i', { class:'dot' });
    var pick = h('div', { class:'pick' }, [h('img', { src:src, alt:'', draggable:'false' }), dot]);
    var shapes = [['PC', info.shape[0]], ['모바일', info.shape[1]]];
    var frames = shapes.map(function(sh){
      var f = h('span', { class:'fr' });
      f.style.aspectRatio = String(sh[1]);
      f.style.maxWidth = Math.round(240 * sh[1]) + 'px';   // 틀 높이 240px 안쪽 — 세로로 긴 칸도 비율 그대로
      f.style.backgroundImage = 'url("' + src + '")';
      return h('figure', null, [f, h('figcaption', { text:sh[0] })]);
    });
    function show(xy){
      dot.style.left = xy[0] + '%'; dot.style.top = xy[1] + '%';
      frames.forEach(function(fig){ fig.firstChild.style.backgroundPosition = xy[0] + '% ' + xy[1] + '%'; });
    }
    function at(ev){
      var r = pick.getBoundingClientRect();
      var x = Math.min(100, Math.max(0, (ev.clientX - r.left) / r.width * 100)), y = Math.min(100, Math.max(0, (ev.clientY - r.top) / r.height * 100));
      p.pos = { x:Math.round(x), y:Math.round(y) }; markDirty(); show([p.pos.x, p.pos.y]); note.textContent = posText();
    }
    var down = false;
    pick.addEventListener('pointerdown', function(ev){ down = true; pick.setPointerCapture(ev.pointerId); at(ev); });
    pick.addEventListener('pointermove', function(ev){ if(down) at(ev); });
    pick.addEventListener('pointerup', function(){ down = false; });
    pick.addEventListener('pointercancel', function(){ down = false; });
    function posText(){ return p.pos ? '가로 ' + p.pos.x + '% · 세로 ' + p.pos.y + '%' : ph ? '가운데' : '기본 위치'; }
    var note = h('span', { class:'hint', text:posText() });
    box.appendChild(h('div', { class:'mg-pos-in' }, [
      pick,
      h('div', { class:'pv' }, frames.concat([h('p', { class:'syntax' }, [note, ' ',
        h('button', { type:'button', class:'mg-btn sm', text:ph ? '가운데로' : '기본 위치로', onclick:function(){ p.pos = null; markDirty(); drawPos(e); } })
      ])]))
    ]));
    show(cur);
  }

  function field(id, label, max, make, hint){
    var input = make();
    var count = max ? h('p', { class:'count' }) : null;
    var upd = function(){ if(count){ count.textContent = input.value.length + ' / ' + max; count.className = 'count' + (input.value.length > max ? ' over' : ''); } };
    input.addEventListener('input', upd); upd();
    return h('div', { class:'fld' }, [h('label', { for:id }, [label, hint ? h('span', { class:'hint', text:hint }) : null]), input, count]);
  }

  // 본문: 서식 버튼(굵게 · 강조색 · 빨간색) + 미리보기 (docs/decisions.md 4절)
  function bodyField(p, lim){
    var ta = h('textarea', { id:'f-body', value:p.body, placeholder:'안내 내용을 입력하세요. 주소(https://…)는 자동으로 링크가 됩니다.' });
    var count = h('p', { class:'count' });
    var pv = h('div', { class:'preview', hidden:true });
    var pvBtn;
    var sync = function(){
      p.body = ta.value;
      count.textContent = ta.value.length + ' / ' + lim.noticeBody;
      count.className = 'count' + (ta.value.length > lim.noticeBody ? ' over' : '');
      if(!pv.hidden) drawPreview();
    };
    var drawPreview = function(){
      pv.textContent = '';
      pv.appendChild(Board.renderNotice(previewPost(), { localPhoto:function(ph){ return ph.local; } }));
    };
    var wrapSel = function(open, close){
      var s = ta.selectionStart, eIdx = ta.selectionEnd, sel = ta.value.slice(s, eIdx) || '글자';
      ta.value = ta.value.slice(0, s) + open + sel + close + ta.value.slice(eIdx);
      ta.focus(); ta.setSelectionRange(s + open.length, s + open.length + sel.length);
      markDirty(); sync();
    };
    ta.addEventListener('input', function(){ markDirty(); sync(); });
    pvBtn = h('button', { type:'button', class:'pv', text:'미리보기', onclick:function(){
      pv.hidden = !pv.hidden; pvBtn.className = 'pv' + (pv.hidden ? '' : ' on');
      if(!pv.hidden) drawPreview();
    } });
    sync();
    return h('div', { class:'fld' }, [
      h('label', { for:'f-body' }, ['본문', h('span', { class:'hint', text:'비워 두면 사진 · 첨부만 보입니다' })]),
      h('div', { class:'tools' }, [
        h('button', { type:'button', class:'b', text:'굵게', title:'고른 글자를 굵게', onclick:function(){ wrapSel('**', '**'); } }),
        h('button', { type:'button', class:'k', text:'강조색', title:'고른 글자를 청록색으로', onclick:function(){ wrapSel('{강조:', '}'); } }),
        h('button', { type:'button', class:'w', text:'빨간색', title:'고른 글자를 빨간색으로', onclick:function(){ wrapSel('{빨강:', '}'); } }),
        h('span', { class:'sp' }), pvBtn
      ]),
      ta, count,
      h('p', { class:'syntax' }, ['글자를 고르고 버튼을 누르면 기호가 붙습니다: ',
        h('code', { text:'**굵게**' }), ' ', h('code', { text:'{강조:청록}' }), ' ', h('code', { text:'{빨강:빨강}' }),
        ' — 실제 모양은 미리보기로 확인하세요.']),
      pv
    ]);
  }

  function previewPost(){
    var e = S.edit;
    var done = function(a){ return a.fileId || a.local; };
    return Object.assign({}, e.post, { photos:e.photos.filter(done), files:e.files.filter(function(a){ return a.fileId; }) });
  }

  /* ---------- 사진 ---------- */
  /* 표지 2.5D 입체 효과 — 원본 위에 누끼(인물만 오려 낸 투명 배경 PNG)를 겹쳐, 넘어갈 때 인물이 배경보다 더 커지며 다가오게 한다.
     켜려면 누끼가 있어야 하고, 원본을 빼거나 바꾸면 누끼가 빠지고 꺼진다. 관문도 같은 규칙으로 다시 확인한다 (docs/decisions.md 2절) */
  function drawDepth(e, box){
    box = box || $('depthFld');
    if(!box) return;
    box.textContent = '';
    if(e.videos.length){   // 동영상 칸은 2.5D를 쓰지 않는다 (2026-10-16 사용자 결정)
      box.appendChild(h('p', { class:'hint', text:'동영상을 올린 칸은 2.5D 입체 효과를 쓰지 않습니다.' }));
      return;
    }
    var p = e.post, ph = e.photos[0], cut = e.cutouts[0];
    var ready = !!(ph && ph.attachmentId && ph.w);
    box.appendChild(h('label', { class:'choices', style:'font-weight:700' }, [
      h('input', { type:'checkbox', checked:p.depth, disabled:!ready && !p.depth, onchange:function(ev){ p.depth = ev.target.checked; markDirty(); drawDepth(e); } }),
      '2.5D 입체 효과 켜기'
    ]));
    box.appendChild(h('p', { class:'hint', text:ready
      ? '인물만 오려 낸 누끼 사진을 원본 위에 겹쳐, 사진이 넘어갈 때 인물이 배경보다 앞으로 다가오게 합니다. 끄면 사진 전체가 천천히 확대 · 축소됩니다.'
      : '원본 사진을 먼저 올리면 켤 수 있습니다. 끄면 사진 전체가 천천히 확대 · 축소됩니다.' }));
    if(!p.depth) return;

    box.appendChild(h('span', { class:'lb' }, ['누끼 사진', h('span', { class:'hint', text:'원본 사진에서 배경을 지운 투명 배경 PNG 1장. 앞으로 다가올 주인공만 남기고(여러 명이 떨어져 있으면 인물 뒤에 겹친 윤곽이 보임), 원본과 같은 비율이어야 합니다.' })]));
    if(cut){
      var im = h('div', { class:'im' });
      var src = cut.local || (cut.fileId && Board.photoUrl(cut.fileId, 400));
      if(src) im.style.backgroundImage = 'url("' + src + '"),repeating-conic-gradient(#D9DBD8 0 25%,#fff 0 50%)';
      box.appendChild(h('div', { class:'photos' }, [h('div', { class:'ph cut' }, [
        im,
        cut.uploading ? h('div', { class:'state', text:'올리는 중…' }) : null,
        cut.error ? h('div', { class:'state err', text:cut.error }) : null,
        h('div', { class:'ctl' }, [h('button', { type:'button', class:'x', text:'✕', title:'빼기', onclick:function(){ e.cutouts = []; markDirty(); drawDepth(e); } })])
      ])]));
      var bgSrc = ph && (ph.local || (ph.fileId && Board.photoUrl(ph.fileId, 1600)));
      var fgSrc = cut.local || (cut.fileId && Board.photoUrl(cut.fileId, 1600));
      if(bgSrc && fgSrc && !cut.error){
        var pv = h('div', { class:'mg-depth-pv' }, [h('img', { class:'bg', src:bgSrc, alt:'' }), h('img', { class:'fg', src:fgSrc, alt:'' })]);
        pv.style.aspectRatio = ph.w + ' / ' + ph.h;
        var org = (p.center ? p.center.x : 50) + '% ' + (p.center ? p.center.y : 50) + '%';
        [].forEach.call(pv.children, function(img){ img.style.transformOrigin = org; });
        box.appendChild(h('span', { class:'lb', style:'margin-top:18px' }, ['미리보기', h('span', { class:'hint', text:'인물 윤곽이 원본과 어긋나 보이면 누끼를 다시 만들어 주세요. 표지에서는 사진이 넘어갈 때마다 한 번 다가옵니다.' })]));
        box.appendChild(pv);
      }
    }else{
      var input = h('input', { type:'file', accept:'image/png,image/webp', hidden:true, onchange:function(){
        if(input.files[0]) addCutout(e, input.files[0]); input.value = '';
      } });
      box.appendChild(h('div', { class:'add' }, [
        h('button', { type:'button', class:'mg-btn sm', text:'+ 누끼 사진 올리기', onclick:function(){ input.click(); } }),
        h('span', { class:'hint', text:'PNG · WEBP. 원본 크기에 맞춰 올립니다.' }),
        input
      ]));
    }
  }

  // 원본을 빼거나 새로 올리면 누끼를 빼고 2.5D를 끈다 — 새 사진 위에 예전 인물이 겹치지 않게 (2026-10-15 사용자 결정)
  function photoChanged(e){
    if(e.board === 'photo'){ e.post.pos = null; drawPos(e); return; }   // 새 사진에는 예전 위치가 맞지 않는다
    if(e.board !== 'hero') return;
    if(e.cutouts.length) toast('원본 사진이 바뀌어 누끼 사진을 뺐습니다. 2.5D를 쓰려면 새 원본의 누끼를 올려 주세요.');
    e.cutouts = []; e.post.depth = false;
    drawDepth(e);
  }

  function addCutout(e, file){
    var ph = e.photos[0], cut = { uploading:true, name:file.name };
    e.cutouts = [cut];
    drawDepth(e);
    prepCutout(file, ph.w, ph.h).then(function(r){
      cut.local = r.preview; cut.w = ph.w; cut.h = ph.h; e.post.center = r.center;
      if(S.edit === e) drawDepth(e);
      if(r.blob.size > (S.data.limits.cutoutBytes || 8388608)) throw { userMsg:'누끼 사진이 너무 큽니다(' + Math.round(r.blob.size / 1048576) + 'MB). 원본을 더 작은 사진으로 바꿔 주세요.' };
      return blobToBase64(r.blob).then(function(b64){
        return api('upload', { kind:'cutout', name:file.name.replace(/\.[^.]+$/, '') + '.png', mimeType:'image/png', base64:b64, width:ph.w, height:ph.h }, 120000);
      });
    }).then(function(d){
      cut.attachmentId = d.attachmentId; cut.fileId = d.fileId; cut.size = d.size; cut.uploading = false; markDirty();
    }, function(err){
      cut.uploading = false;
      cut.error = err && err.code ? errMsg(err) : (err && err.userMsg) || '이 사진은 열 수 없습니다. PNG로 바꿔 올려 주세요.';
    }).then(function(){ if(S.edit === e) drawDepth(e); });
  }

  // 누끼를 원본 크기(w×h)로 맞추고 확인한다 — 비율이 원본과 같아야(1% 안) 하고 투명한 곳이 있어야 한다.
  // 투명한 곳의 색 값은 0으로 비워 PNG 용량을 줄이고, 인물 영역(반 넘게 불투명한 곳)을 감싸는 상자의 가운데를 확대 중심(%)으로 돌려준다.
  function prepCutout(file, w, hgt){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        URL.revokeObjectURL(url);
        var iw = img.naturalWidth, ih = img.naturalHeight;
        if(Math.abs(iw / ih - w / hgt) > w / hgt * 0.01){
          return reject({ userMsg:'원본과 비율이 다릅니다(원본 ' + w + '×' + hgt + ', 누끼 ' + iw + '×' + ih + '). 원본과 같은 사진에서 배경만 지워 주세요.' });
        }
        var c = document.createElement('canvas'); c.width = w; c.height = hgt;
        var g = c.getContext('2d'); g.drawImage(img, 0, 0, w, hgt);
        var data = g.getImageData(0, 0, w, hgt), d = data.data, n = w * hgt, clear = 0;
        var x0 = w, x1 = -1, y0 = hgt, y1 = -1;
        for(var i = 0; i < n; i++){
          var a = d[i * 4 + 3];
          if(a === 0){ d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; clear++; }
          else if(a > 128){
            var x = i % w, y = (i - x) / w;
            if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
          }
        }
        if(clear < n * 0.02) return reject({ userMsg:'배경이 지워지지 않은 사진입니다. 배경을 투명하게 지운 PNG를 올려 주세요.' });
        if(x1 < 0) return reject({ userMsg:'인물이 보이지 않습니다(사진 전체가 투명). 누끼를 다시 만들어 주세요.' });
        g.putImageData(data, 0, 0);
        var center = { x:Math.round((x0 + x1 + 1) / 2 / w * 1000) / 10, y:Math.round((y0 + y1 + 1) / 2 / hgt * 1000) / 10 };
        c.toBlob(function(blob){ blob ? resolve({ blob:blob, preview:URL.createObjectURL(blob), center:center }) : reject(new Error('toBlob')); }, 'image/png');
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  /* ---------- 표지 동영상 (2안 WBS 8.6) ----------
     드라이브 영상은 사이트에서 재생되지 않아 관문이 영상 전용 저장소에 올린다(저장할 때만 — 저장하지 않은 영상은 공개되지 않음).
     올리면 첫 장면을 잘라 이 칸의 사진(대기 사진)으로 바꾼다 — 영상이 뜨기 전 · 데이터 절약 · 움직임 줄이기 · 1안 화면에서 보인다.
     영상은 줄이거나 바꾸지 않고 그대로 올리므로 MP4(H.264) · 20MB 이하만 받는다 (2026-10-16 사용자 결정) */
  function drawVideo(e, box){
    box = box || $('videoFld');
    if(!box) return;
    box.textContent = '';
    var lim = S.data.limits, v = e.videos[0];
    box.appendChild(h('span', { class:'lb' }, ['동영상 (선택)', h('span', { class:'hint', text:'올리면 사진 대신 소리 없이 재생됩니다. 첫 장면이 자동으로 위 사진이 되어, 영상이 뜨기 전이나 데이터 절약 · 움직임 줄이기 설정에서 보입니다.' })]));
    if(v){
      var src = v.local || (v.src && MEDIA_BASE + v.src);
      var pv = h('div', { class:'mg-video-pv' });
      if(src){
        var vd = h('video', { src:src, autoplay:true, loop:true, playsinline:true });
        vd.muted = true;
        vd.addEventListener('error', function(){ if(!v.local) pv.appendChild(h('p', { class:'state', text:'저장한 영상은 사이트 반영 뒤 1~2분 지나야 여기서도 보입니다.' })); });
        pv.appendChild(vd);
      }
      if(v.uploading) pv.appendChild(h('p', { class:'state', text:'올리는 중… ' + (v.progress || '') }));
      if(v.error) pv.appendChild(h('p', { class:'state err', text:v.error }));
      box.appendChild(pv);
      var meta = [v.name, v.size ? Board.formatSize(v.size) : null, v.w ? v.w + '×' + v.h : null, v.duration ? Math.round(v.duration) + '초' : null].filter(Boolean).join(' · ');
      box.appendChild(h('div', { class:'add' }, [
        h('span', { class:'hint', text:meta }),
        h('button', { type:'button', class:'mg-btn sm', text:'동영상 빼기', disabled:!!v.uploading, onclick:function(){
          e.videos = []; markDirty(); drawVideo(e); drawDepth(e);
          toast('동영상을 뺐습니다. 위 사진(첫 장면)은 그대로 남습니다. 필요하면 사진도 바꿔 주세요.');
        } })
      ]));
      return;
    }
    var input = h('input', { type:'file', accept:'video/mp4,.mp4', hidden:true, onchange:function(){
      if(input.files[0]) addVideo(e, input.files[0]); input.value = '';
    } });
    box.appendChild(h('div', { class:'add' }, [
      h('button', { type:'button', class:'mg-btn sm', text:'+ 동영상 올리기', onclick:function(){ input.click(); } }),
      h('span', { class:'hint', text:'MP4(H.264) · ' + Board.formatSize(lim.videoBytes) + ' 이하. 10~20초 · 1080p 가로 영상이 알맞습니다. 아이폰 기본 영상(HEVC · MOV)은 MP4(H.264)로 바꿔 올려 주세요.' }),
      input
    ]));
  }

  function addVideo(e, file){
    var lim = S.data.limits;
    if(!/\.mp4$/i.test(file.name) || (file.type && file.type !== 'video/mp4')) return toast('MP4 파일만 올릴 수 있습니다. 아이폰 영상(MOV)은 MP4(H.264)로 바꿔 올려 주세요.', true);
    if(file.size > lim.videoBytes) return toast('동영상이 너무 큽니다(' + Board.formatSize(file.size) + '). ' + Board.formatSize(lim.videoBytes) + ' 이하로 줄여 주세요.', true);
    var v = { uploading:true, name:file.name, size:file.size, progress:'' };
    e.videos = [v]; e.post.depth = false;
    drawVideo(e); drawDepth(e);
    var redraw = function(){ if(S.edit === e){ drawVideo(e); drawPhotos(null, e); } };
    probeVideo(file, e.photoSide).then(function(r){
      v.local = r.url; v.w = r.w; v.h = r.h; v.duration = r.duration;
      // 첫 장면 → 이 칸의 사진(대기 사진). 원본이 바뀌므로 누끼 · 2.5D도 빠진다
      var ph = { uploading:true, name:'첫 장면.jpg', local:URL.createObjectURL(r.poster), w:r.pw, h:r.ph };
      e.photos = [ph]; photoChanged(e); redraw();
      var base = file.name.replace(/\.[^.]+$/, '');
      var poster = blobToBase64(r.poster).then(function(b64){
        return api('upload', { kind:'photo', name:base + '-첫장면.jpg', mimeType:'image/jpeg', base64:b64, width:r.pw, height:r.ph }, 120000);
      }).then(function(d){ ph.attachmentId = d.attachmentId; ph.fileId = d.fileId; ph.size = d.size; ph.uploading = false; },
        function(err){ ph.uploading = false; ph.error = errMsg(err); throw err; });
      return Promise.all([poster, uploadVideo(file, base + '.mp4', r, v, redraw)]);
    }).then(function(){ markDirty(); }, function(err){
      v.uploading = false;
      v.error = err && err.userMsg ? err.userMsg : errMsg(err);
    }).then(redraw);
  }

  // 영상을 열어 크기 · 길이를 읽고, 첫 장면을 표지 사진 크기(긴 변 maxSide 이하) JPEG로 잘라 낸다. 열 수 없으면(HEVC 등) 거절
  function probeVideo(file, maxSide){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), vd = document.createElement('video');
      var fail = function(){ URL.revokeObjectURL(url); reject({ userMsg:'이 영상은 열 수 없습니다. MP4(H.264)로 바꿔 올려 주세요. 아이폰 기본 영상(HEVC)은 브라우저에서 열리지 않을 수 있습니다.' }); };
      vd.muted = true; vd.playsInline = true; vd.preload = 'auto';
      vd.onerror = fail;
      vd.onloadeddata = function(){
        if(!vd.videoWidth || !vd.videoHeight) return fail();
        vd.onseeked = function(){
          vd.onseeked = null;
          var w = vd.videoWidth, hgt = vd.videoHeight, sc = Math.min(1, maxSide / Math.max(w, hgt));
          var pw = Math.round(w * sc), ph = Math.round(hgt * sc);
          var c = document.createElement('canvas'); c.width = pw; c.height = ph;
          c.getContext('2d').drawImage(vd, 0, 0, pw, ph);
          c.toBlob(function(blob){ blob ? resolve({ url:url, w:w, h:hgt, duration:vd.duration, poster:blob, pw:pw, ph:ph }) : fail(); }, 'image/jpeg', 0.85);
        };
        vd.currentTime = 0.001;   // 첫 화면을 확실히 그리게 한 번 이동
      };
      vd.src = url;
    });
  }

  // 관문 요청 크기 한도 때문에 limits.videoPartBytes(약 4MB) 조각으로 나눠 차례로 보낸다. 마지막 조각 응답에 첨부ID가 온다
  function uploadVideo(file, name, r, v, redraw){
    var PART = S.data.limits.videoPartBytes, n = Math.max(1, Math.ceil(file.size / PART)), i = 0;
    var uploadId = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
    var next = function(){
      v.progress = Math.round(i / n * 100) + '%'; redraw();
      return blobToBase64(file.slice(i * PART, (i + 1) * PART)).then(function(b64){
        return api('upload', { kind:'video', name:name, mimeType:'video/mp4', width:r.w, height:r.h, uploadId:uploadId, part:i, parts:n, base64:b64 }, 180000);
      }).then(function(d){ i++; return i < n ? next() : d; });
    };
    return next().then(function(d){ v.attachmentId = d.attachmentId; v.size = d.size; v.uploading = false; });
  }

  function photoField(e, label, hint){
    var box = h('div', { class:'fld', id:'photoFld' });
    drawPhotos(box, e, label, hint);
    return box;
  }
  function drawPhotos(box, e, label, hint){
    box = box || $('photoFld');
    if(!box) return;
    label = label || box.dataset.label; hint = hint || box.dataset.hint;
    box.dataset.label = label; box.dataset.hint = hint;
    box.textContent = '';
    var isGallery = e.board === 'gallery';
    box.appendChild(h('span', { class:'lb' }, [label + ' (' + e.photos.length + ' / ' + e.maxPhotos + ')', h('span', { class:'hint', text:hint })]));
    var grid = h('div', { class:'photos' });
    e.photos.forEach(function(ph, i){
      var im = h('div', { class:'im' });
      var src = ph.local || (ph.fileId && Board.photoUrl(ph.fileId, 400));
      if(src) im.style.backgroundImage = 'url("' + src + '")';
      var move = function(to){ var arr = e.photos; arr.splice(to, 0, arr.splice(i, 1)[0]); markDirty(); drawPhotos(null, e); };
      grid.appendChild(h('div', { class:'ph' }, [
        im,
        i === 0 && isGallery ? h('span', { class:'rep', text:'대표' }) : null,
        ph.uploading ? h('div', { class:'state', text:'올리는 중…' }) : null,
        ph.error ? h('div', { class:'state err', text:ph.error }) : null,
        h('div', { class:'ctl' }, [
          e.maxPhotos > 1 ? h('button', { type:'button', text:'◀', title:'앞으로', disabled:i === 0, onclick:function(){ move(i - 1); } }) : null,
          e.maxPhotos > 1 ? h('button', { type:'button', text:'▶', title:'뒤로', disabled:i === e.photos.length - 1, onclick:function(){ move(i + 1); } }) : null,
          e.maxPhotos > 1 ? h('button', { type:'button', text:isGallery ? '대표로' : '맨 앞', disabled:i === 0, onclick:function(){ move(0); } }) : null,
          h('button', { type:'button', class:'x', text:'✕', title:'빼기', onclick:function(){ e.photos.splice(i, 1); markDirty(); drawPhotos(null, e); photoChanged(e); } })
        ])
      ]));
    });
    if(e.photos.length) box.appendChild(grid);
    var input = h('input', { type:'file', accept:'image/jpeg,image/png,image/webp', multiple:true, hidden:true, onchange:function(){
      addPhotos(e, [].slice.call(input.files)); input.value = '';
    } });
    box.appendChild(h('div', { class:'add' }, [
      h('button', { type:'button', class:'mg-btn sm', text:'+ 사진 추가', disabled:e.photos.length >= e.maxPhotos, onclick:function(){ input.click(); } }),
      h('span', { class:'hint', text:'JPG · PNG · WEBP. 올리기 전에 자동으로 줄입니다(긴 변 ' + e.photoSide + 'px).' }),
      input
    ]));
  }

  function addPhotos(e, list){
    var room = e.maxPhotos - e.photos.length;
    if(list.length > room){ toast('사진은 최대 ' + e.maxPhotos + '장입니다. ' + room + '장만 올립니다.', true); list = list.slice(0, room); }
    var jobs = list.map(function(file){
      var ph = { uploading:true, name:file.name };
      e.photos.push(ph);
      return function(){
        return shrinkPhoto(file, e.photoSide).then(function(r){
          ph.local = r.preview; ph.w = r.w; ph.h = r.h; drawPhotos(null, e); drawPos(e);
          return blobToBase64(r.blob).then(function(b64){
            return api('upload', { kind:'photo', name:file.name.replace(/\.[^.]+$/, '') + '.jpg', mimeType:'image/jpeg', base64:b64, width:r.w, height:r.h }, 120000);
          });
        }).then(function(d){
          ph.attachmentId = d.attachmentId; ph.fileId = d.fileId; ph.size = d.size; ph.uploading = false; markDirty();
        }, function(err){
          ph.uploading = false; ph.error = err && err.code ? errMsg(err) : '이 사진은 열 수 없습니다. JPG로 바꿔 올려 주세요.';
        }).then(function(){ if(S.edit === e){ drawPhotos(null, e); drawDepth(e); drawPos(e); } });
      };
    });
    drawPhotos(null, e);
    if(jobs.length) photoChanged(e);
    runQueue(jobs, UPLOAD_PARALLEL);
  }

  // 긴 변을 maxSide로 줄이고 JPEG로 바꾼다. 투명한 부분은 흰색으로 채운다.
  function shrinkPhoto(file, maxSide){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * scale)), hgt = Math.max(1, Math.round(img.naturalHeight * scale));
        var c = document.createElement('canvas'); c.width = w; c.height = hgt;
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, hgt); g.drawImage(img, 0, 0, w, hgt);
        c.toBlob(function(blob){ blob ? resolve({ blob:blob, w:w, h:hgt, preview:url }) : reject(new Error('toBlob')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function(){ reject(new Error('decode')); };
      img.src = url;
    });
  }

  function blobToBase64(blob){
    return new Promise(function(resolve, reject){
      var fr = new FileReader();
      fr.onload = function(){ resolve(String(fr.result).split(',')[1]); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  function runQueue(jobs, n){
    var i = 0;
    var next = function(){ if(i >= jobs.length) return Promise.resolve(); return jobs[i++]().then(next); };
    for(var k = 0; k < Math.min(n, jobs.length); k++) next();
  }

  /* ---------- 파일 ---------- */
  function fileField(e, lim){
    var box = h('div', { class:'fld', id:'fileFld' });
    drawFiles(box, e, lim);
    return box;
  }
  function drawFiles(box, e, lim){
    box = box || $('fileFld'); lim = lim || S.data.limits;
    if(!box) return;
    box.textContent = '';
    box.appendChild(h('span', { class:'lb' }, ['첨부파일 (' + e.files.length + ' / ' + lim.noticeFiles + ')', h('span', { class:'hint', text:'방문자가 내려받을 수 있습니다' })]));
    if(e.files.length){
      box.appendChild(h('div', { class:'files' }, e.files.map(function(f, i){
        var move = function(to){ e.files.splice(to, 0, e.files.splice(i, 1)[0]); markDirty(); drawFiles(null, e); };
        return h('div', { class:'fl' }, [
          h('span', { class:'nm', text:(i + 1) + '. ' + f.name }),
          f.uploading ? h('span', { class:'st', text:'올리는 중…' }) : f.error ? h('span', { class:'st err', text:f.error }) : h('span', { class:'sz', text:Board.formatSize(f.size || 0) }),
          h('span', { class:'ctl' }, [
            h('button', { type:'button', text:'▲', title:'위로', disabled:i === 0, onclick:function(){ move(i - 1); } }),
            h('button', { type:'button', text:'▼', title:'아래로', disabled:i === e.files.length - 1, onclick:function(){ move(i + 1); } }),
            h('button', { type:'button', text:'✕', title:'빼기', onclick:function(){ e.files.splice(i, 1); markDirty(); drawFiles(null, e); } })
          ])
        ]);
      })));
    }
    var accept = lim.fileExts.map(function(x){ return '.' + x; }).join(',');
    var input = h('input', { type:'file', accept:accept, multiple:true, hidden:true, onchange:function(){
      addFiles(e, [].slice.call(input.files)); input.value = '';
    } });
    box.appendChild(h('div', { class:'add' }, [
      h('button', { type:'button', class:'mg-btn sm', text:'+ 파일 추가', disabled:e.files.length >= lim.noticeFiles, onclick:function(){ input.click(); } }),
      h('span', { class:'hint', text:lim.fileExts.join(' · ') + ' · 한 개 ' + Board.formatSize(lim.fileBytes) + ' 이하' }),
      input
    ]));
  }

  function addFiles(e, list){
    var lim = S.data.limits, room = lim.noticeFiles - e.files.length;
    if(list.length > room){ toast('첨부파일은 최대 ' + lim.noticeFiles + '개입니다.', true); list = list.slice(0, room); }
    var jobs = [];
    list.forEach(function(file){
      var ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1];
      if(!ext || lim.fileExts.indexOf(ext.toLowerCase()) === -1){ toast(file.name + ': 올릴 수 없는 형식입니다.', true); return; }
      if(file.size > lim.fileBytes){ toast(file.name + ': ' + Board.formatSize(lim.fileBytes) + '보다 큽니다.', true); return; }
      var f = { uploading:true, name:file.name, size:file.size };
      e.files.push(f);
      jobs.push(function(){
        return blobToBase64(file).then(function(b64){
          return api('upload', { kind:'file', name:file.name, mimeType:file.type || '', base64:b64 }, 120000);
        }).then(function(d){
          f.attachmentId = d.attachmentId; f.fileId = d.fileId; f.size = d.size; f.uploading = false; markDirty();
        }, function(err){ f.uploading = false; f.error = errMsg(err); })
          .then(function(){ if(S.edit === e) drawFiles(null, e); });
      });
    });
    drawFiles(null, e);
    runQueue(jobs, UPLOAD_PARALLEL);
  }

  /* ---------- 저장 · 삭제 ---------- */
  function save(){
    var e = S.edit, p = e.post, lim = S.data.limits, isNotice = e.board === 'notice';
    var fail = function(msg){ toast(msg, true); };
    if(pending()) return fail('사진 · 파일을 올리는 중입니다. 끝난 뒤 저장해 주세요.');
    if(e.photos.concat(e.files, e.cutouts, e.videos).some(function(a){ return a.error; })) return fail('올리지 못한 사진 · 파일이 있습니다. ✕로 빼고 저장해 주세요.');
    if(e.board === 'hero'){
      var hasVideo = e.videos.length > 0;
      if(hasVideo && !e.photos.length) return fail('동영상 칸은 대기 사진이 필요합니다. 동영상을 빼고 다시 올리면 첫 장면이 사진으로 들어갑니다.');
      if(p.depth && !hasVideo && !e.cutouts.length) return fail('2.5D 입체 효과를 켜려면 누끼 사진을 올려 주세요. 쓰지 않으려면 체크를 꺼 주세요.');
      if(!e.photos.length && !HERO_DEFAULT[p.slot] && !confirm('사진이 없으면 「' + p.label + '」 칸은 표지에서 빠집니다. 이대로 저장할까요?')) return;
      var newVideo = e.videos.some(function(a){ return !a.src; });
      return send({
        board:'hero', id:e.id, post:{ depth:!hasVideo && !!p.depth, center:e.cutouts.length ? p.center : null },
        photos:e.photos.map(function(a){ return a.attachmentId; }), cutouts:e.cutouts.map(function(a){ return a.attachmentId; }),
        videos:e.videos.map(function(a){ return a.attachmentId; }), files:[]
      }, newVideo ? '저장하고 사이트에 반영하는 중…\n동영상이 있어 30초 정도 걸릴 수 있습니다.' : null);
    }
    if(e.board === 'photo'){
      return send({ board:'photo', id:e.id, post:{ pos:p.pos || null }, photos:e.photos.map(function(a){ return a.attachmentId; }), files:[] });
    }
    if(e.board === 'press' && !(p.source || '').trim()) return fail('언론사를 입력해 주세요.');
    if(!p.title.trim()) return fail('제목을 입력해 주세요.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) return fail('게시일을 입력해 주세요.');
    if(e.board === 'press'){
      if(!/^https?:\/\/\S+$/i.test((p.url || '').trim())) return fail('기사 주소를 https:// 로 시작하는 주소로 입력해 주세요.');
      return send({ board:'press', id:e.id, post:{ source:p.source, title:p.title, date:p.date, url:p.url.trim(), visibility:p.visibility }, photos:[], files:[] });
    }
    if(isNotice){
      if(S.data.categories.indexOf(p.category) < 0) return fail('분류를 골라 주세요. 「' + p.category + '」는 더 이상 쓰지 않는 분류입니다.');
      if(p.body.length > lim.noticeBody) return fail('본문이 너무 깁니다.');
      if(p.photoLink && !/^https?:\/\/\S+$/i.test(p.photoLink.trim())) return fail('사진 이동 주소는 https:// 로 시작해야 합니다.');
      // 내용 없는 공지는 사이트 목록에 보이되 누를 수 없다(docs/decisions.md 4절). 공개 글이면 한 번 묻고 저장한다
      if(!p.body.trim() && !e.photos.length && !e.files.length && p.visibility === '공개' &&
         !confirm('본문 · 사진 · 첨부가 없어 사이트 목록에서 누를 수 없는 글이 됩니다. 이대로 저장할까요?')) return;
    }else if(!e.photos.length && p.visibility === '공개' && !confirm('사진이 없는 앨범입니다. 사이트에 빈 칸으로 보입니다. 그래도 공개로 저장할까요?')) return;

    var post = isNotice
      ? { category:p.category, title:p.title, body:p.body, date:p.date, pinned:!!p.pinned, photoPosition:p.photoPosition, photoLink:(p.photoLink || '').trim(), visibility:p.visibility }
      : { title:p.title, desc:p.desc || '', date:p.date, visibility:p.visibility, course:p.course || '', field:p.course ? p.field || '' : '' };
    send({
      board:e.board, id:e.id, post:post,
      photos:e.photos.map(function(a){ return a.attachmentId; }),
      files:isNotice ? e.files.map(function(a){ return a.attachmentId; }) : []
    });
  }

  function send(req, busyMsg){
    var e = S.edit;
    busy(busyMsg || '저장하고 사이트에 반영하는 중…\n10초 정도 걸립니다.');
    api('save', req, 120000).then(function(d){
      e.dirty = false;
      S.edit = null; dropEditState();
      toast(d.published ? '저장했습니다. 1~2분 뒤 사이트에 보입니다.' : '저장했지만 사이트 반영에 실패했습니다. 위의 [다시 반영]을 눌러 주세요.', !d.published);
      return load();
    }, function(err){ busy(null); toast(errMsg(err), true); });
  }

  function removePost(){
    var e = S.edit;
    if(!confirm('이 글을 삭제할까요?\n첨부한 사진 · 파일도 함께 지워집니다(드라이브 휴지통에서 30일 안에 복구 가능).')) return;
    busy('삭제하고 사이트에 반영하는 중…');
    api('remove', { board:e.board, id:e.id }, 120000).then(function(d){
      e.dirty = false; S.edit = null; dropEditState();
      toast(d.published ? '삭제했습니다. 1~2분 뒤 사이트에서 사라집니다.' : '삭제했지만 사이트 반영에 실패했습니다. [다시 반영]을 눌러 주세요.', !d.published);
      return load();
    }, function(err){ busy(null); toast(errMsg(err), true); });
  }

  /* ---------- 시작 ---------- */
  S.token = ss(K.token); S.exp = Number(ss(K.exp)) || 0;
  if(S.token && Date.now() < S.exp){
    $('user').hidden = false;
    $('who').textContent = OPERATOR + ' 님';
    S.name = OPERATOR;
    load();
  }else{
    relogin().then(load);
  }
})();

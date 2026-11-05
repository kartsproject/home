/* ============================================================
   2026 K예술영재 프로젝트 — admin.js
   게시글 관리 화면. 관문(Apps Script)만 부른다 — docs/api.md.
   ▣ 관문 주소는 공개된다고 가정한다. 권한 확인은 관문이 요청마다 한다 (CLAUDE.md 보안 1·2).
   ▣ 토큰은 sessionStorage(탭을 닫으면 로그아웃), 기기ID만 localStorage.
   ▣ 운영진이 입력한 값은 textContent로만 화면에 넣는다.
   ============================================================ */
(function(){
  var GATEWAY = window.HP_GATEWAY;   /* 관문 주소는 assets/js/gateway.js 한 곳에 (페이지 직접 편집과 함께 씀, WBS 18) */
  var K = { token:'hp_admin_token', exp:'hp_admin_exp', device:'hp_admin_device' };
  try{ localStorage.removeItem('hp_admin_name'); }catch(e){}   // 예전에 저장하던 이름 (2026-10-14부터 쓰지 않음)
  var UPLOAD_PARALLEL = 3;     /* 사진을 동시에 올리는 수 (관문은 시트 기록만 잠근다) */
  var PHOTO_MAX_SIDE = 1600;   /* 올리기 전 긴 변 (docs/decisions.md 5절) */
  /* 게시판 — 탭 순서 = 사이트 소식 탭 순서(공지사항 · 언론홍보 · 갤러리) + 모집요강 */
  var BOARDS = [
    { id:'notice',  tab:'공지사항',  name:'공지',        add:'+ 새 공지' },
    { id:'press',   tab:'언론홍보',  name:'언론홍보 글', add:'+ 새 기사' },
    { id:'gallery', tab:'갤러리',    name:'앨범',        add:'+ 새 앨범' },
    { id:'guide',   tab:'모집요강',  name:'모집요강',    add:'+ 새 연도' }
  ];
  /* 표지 사진 · 사이트 사진 메뉴는 2026-11-05 뺐다(사용자) — 사진은 사이트 화면의 페이지 직접 편집(editor.js, WBS 18)에서 바꾼다.
     관문의 hero · photo 저장은 그대로 쓴다(편집 화면이 부름). 표지 동영상 · 2.5D를 새로 넣는 화면은 없다 (docs/decisions.md 5절) */
  /* 갤러리 앨범 과정 · 분야 — 관문 GALLERY_COURSES_ · GALLERY_FIELDS_(Setup.js)와 같은 코드. 프로그램 페이지가 이 코드로 공개 앨범 사진을 모은다.
     분야 ''(공통)은 그 과정 전체, 과정 ''은 지정 안 함 (WBS 8.10) */
  var GALLERY_COURSES = [['workshop', '워크숍'], ['mentoring', '심화멘토링'], ['camp', '겨울캠프']];
  var GALLERY_FIELDS = [['music', '음악'], ['dance', '무용'], ['trad', '전통예술'], ['art', '미술'], ['', '공통']];   /* 화면 순서 = 분야 순서(2026-10-21, WBS 9.10). 코드는 관문과 같음 */
  function codeName(list, code){ var x = list.filter(function(i){ return i[0] === code; })[0]; return x ? x[1] : ''; }
  // ('workshop', 'dance') → '워크숍 · 무용'. 지정 안 함이면 ''
  function galleryLabel(course, field){
    var c = codeName(GALLERY_COURSES, course || '');
    return c ? c + ' · ' + codeName(GALLERY_FIELDS, field || '') : '';
  }

  var S = { token:null, exp:0, name:'', data:null, tab:'notice', edit:null, lastActive:Date.now(), sel:{ board:null, ids:{} } };
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
    DUPLICATE_YEAR:'그 연도의 모집요강이 이미 있습니다. 목록에서 그 연도를 눌러 고쳐 주세요.',
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
    if(codeField) codeField.hide();
    $('login').hidden = false;
    $('code').focus();
  }
  function relogin(){
    return new Promise(function(resolve){
      loginWaiters.push(resolve);
      if($('login').hidden) showLogin(S.data ? '로그인 시간이 지났습니다. 다시 로그인하면 하던 작업을 이어서 합니다.' : null);
    });
  }
  // 접근코드 칸: 한글 자판이어도 영문으로, 오른쪽 [보기] (codefield.js, 2026-11-05)
  var codeField = window.CodeField ? CodeField.enhance($('code')) : null;
  $('loginForm').addEventListener('submit', function(ev){
    ev.preventDefault();
    var code = $('code').value.trim();
    if(window.CodeField) code = CodeField.clean(code);
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
      var n = String(itemsOf(b.id).length);
      return h('button', { type:'button', class:S.tab === b.id ? 'on' : null, onclick:function(){ S.tab = b.id; renderList(); } },
        [b.tab, h('span', { class:'n', text:n })]);
    }));
    view.appendChild(h('div', { class:'mg-head' }, [
      tabs,
      board.add ? h('button', { type:'button', class:'mg-btn pri', text:board.add, onclick:function(){ openEditor(S.tab, null); } }) : null
    ]));

    if(S.tab === 'guide'){ view.appendChild(guideRows(items)); return; }
    if(!items.length){ view.appendChild(h('p', { class:'mg-empty', text:'아직 글이 없습니다.' })); return; }

    // 선택 삭제 (2026-11-05): 탭을 바꾸면 고른 것을 비우고, 목록에 없는 글은 뺀다
    if(S.sel.board !== S.tab) S.sel = { board:S.tab, ids:{} };
    var present = {};
    items.forEach(function(x){ present[x.id] = true; });
    Object.keys(S.sel.ids).forEach(function(id){ if(!present[id]) delete S.sel.ids[id]; });
    view.appendChild(selBar(items));

    if(S.tab === 'press'){
      view.appendChild(h('div', { class:'mg-rows' }, items.map(function(p){
        return selRow(p, h('button', { type:'button', class:'mg-row', onclick:function(){ openEditor('press', p); } }, [
          h('span', { class:'badges' }, [visBadge(p.visibility)]),
          h('span', { class:'t' }, [h('small', { text:p.source }), p.title]),
          h('span', { class:'m', text:p.date })
        ]));
      })));
    }else if(S.tab === 'notice'){
      view.appendChild(h('div', { class:'mg-rows' }, items.map(function(n){
        var meta = [n.date];
        if(n.photos.length) meta.push('사진 ' + n.photos.length);
        if(n.files.length) meta.push('파일 ' + n.files.length);
        return selRow(n, h('button', { type:'button', class:'mg-row', onclick:function(){ openEditor('notice', n); } }, [
          h('span', { class:'badges' }, [visBadge(n.visibility), n.pinned ? h('span', { class:'badge pin', text:'상단 고정' }) : null]),
          h('span', { class:'t' }, [h('small', { text:n.category }), n.title]),
          h('span', { class:'m', text:meta.join(' · ') })
        ]));
      })));
    }else{
      view.appendChild(h('div', { class:'mg-cards' }, items.map(function(g){
        var th = h('span', { class:'th' }, [visBadge(g.visibility)]);
        if(g.photos.length) th.style.backgroundImage = 'url("' + Board.photoUrl(g.photos[0].fileId, 480) + '")';
        return selRow(g, h('button', { type:'button', class:'mg-card', onclick:function(){ openEditor('gallery', g); } }, [
          th,
          h('span', { class:'tx' }, [
            h('span', { class:'t', text:g.title, style:'display:block' }),
            h('span', { class:'m', text:[g.date, galleryLabel(g.course, g.field) || null, '사진 ' + g.photos.length + '장'].filter(Boolean).join(' · '), style:'display:block' })
          ])
        ]), true);
      })));
    }
    updateSel();
  }

  /* ---------- 선택 삭제 (공지사항 · 언론홍보 · 갤러리, 2026-11-05) ---------- */
  // 줄 · 카드 왼쪽(카드는 사진 위)에 고르는 칸. 글을 여는 단추와 따로 둔다(단추 안에 고르는 칸을 넣을 수 없음)
  function selRow(item, opener, isCard){
    var box = h('input', { type:'checkbox', 'aria-label':'선택: ' + (item.title || item.id) });
    box.checked = !!S.sel.ids[item.id];
    box.addEventListener('change', function(){
      if(box.checked) S.sel.ids[item.id] = true; else delete S.sel.ids[item.id];
      updateSel();
    });
    return h('div', { class:(isCard ? 'mg-sel-card' : 'mg-sel-row'), 'data-id':item.id }, [
      h('label', { class:'mg-chk', title:'선택' }, [box]), opener
    ]);
  }
  function selBar(items){
    var all = h('input', { type:'checkbox', id:'selAll' });
    all.addEventListener('change', function(){
      S.sel.ids = {};
      if(all.checked) items.forEach(function(x){ S.sel.ids[x.id] = true; });
      [].forEach.call(document.querySelectorAll('.mg-sel-row input, .mg-sel-card input'), function(c){ c.checked = all.checked; });
      updateSel();
    });
    return h('div', { class:'mg-selbar' }, [
      h('label', { class:'mg-chk all' }, [all, h('span', { text:'전체 선택' })]),
      h('span', { class:'cnt', id:'selCnt' }),
      h('button', { type:'button', class:'mg-btn sm warn', id:'selDel', text:'선택 삭제', onclick:removeSelected })
    ]);
  }
  function updateSel(){
    var all = $('selAll');
    if(!all) return;
    var total = document.querySelectorAll('.mg-sel-row, .mg-sel-card').length, n = Object.keys(S.sel.ids).length;
    all.checked = total > 0 && n === total;
    all.indeterminate = n > 0 && n < total;
    $('selCnt').textContent = n ? n + '개 선택됨' : '';
    $('selDel').disabled = !n;
    $('selDel').textContent = n ? '선택 삭제 (' + n + ')' : '선택 삭제';
    [].forEach.call(document.querySelectorAll('.mg-sel-row, .mg-sel-card'), function(r){ r.classList.toggle('on', !!S.sel.ids[r.getAttribute('data-id')]); });
  }
  function removeSelected(){
    var ids = Object.keys(S.sel.ids), board = S.tab, total = ids.length, published = true;
    if(!total) return;
    var name = boardOf(board).name;
    if(!confirm('선택한 ' + name + ' ' + total + '개를 삭제할까요?\n첨부한 사진 · 파일도 함께 지워집니다(드라이브 휴지통에서 30일 안에 복구 가능).')) return;
    // 관문이 시간이 모자라면 남은 글을 돌려준다 — 남은 것을 이어서 보낸다
    function step(rest){
      busy('삭제하고 사이트에 반영하는 중… (' + (total - rest.length) + ' / ' + total + ')\n사진이 많으면 몇 분 걸릴 수 있습니다.');
      return api('remove', { board:board, ids:rest }, 330000).then(function(d){
        if(!d.published) published = false;
        var remain = d.remaining || [];
        if(remain.length && remain.length < rest.length) return step(remain);
      });
    }
    step(ids).then(function(){
      S.sel.ids = {};
      toast(published ? total + '개를 삭제했습니다. 1~2분 뒤 사이트에서 사라집니다.' : '삭제했지만 사이트 반영에 실패했습니다. 위의 [다시 반영]을 눌러 주세요.', !published);
      return load();
    }, function(err){
      busy(null);
      toast(errMsg(err) + ' 지워진 것과 남은 것을 목록에서 확인해 주세요.', true);
      S.sel.ids = {};
      return load();
    });
  }
  function visBadge(v){ return h('span', { class:'badge ' + (v === '공개' ? 'on' : 'off'), text:v }); }
  function boardOf(id){ return BOARDS.filter(function(b){ return b.id === id; })[0]; }
  function itemsOf(id){
    var d = S.data;
    return (id === 'notice' ? d.notices : id === 'press' ? d.press : id === 'gallery' ? d.gallery : d.guides) || [];
  }

  /* 모집요강 — 연도마다 한 줄 (WBS 17.4). 관문이 아직 이 기능을 모르면(새로 배포 전) d.guides가 없다 */
  function guideRows(items){
    var box = h('div', null, [h('p', { class:'mg-note', text:'연도마다 모집요강 파일(PDF) 하나를 올리면 「모집 및 선발」 페이지의 그 연도 탭에 「모집요강 내려받기」 단추가 나옵니다. 비공개로 두면 사이트에 보이지 않습니다. 사이트에 그 연도 탭이 없으면(예: 2028) 담당자에게 탭 추가를 요청하세요.' })]);
    if(!S.data.guides){ box.appendChild(h('p', { class:'mg-empty', text:'관문(Apps Script)을 새로 배포하면 쓸 수 있습니다. 담당자에게 알려 주세요.' })); return box; }
    if(!items.length){ box.appendChild(h('p', { class:'mg-empty', text:'아직 올린 모집요강이 없습니다. [+ 새 연도]를 눌러 올려 주세요.' })); return box; }
    box.appendChild(h('div', { class:'mg-rows' }, items.map(function(g){
      return h('button', { type:'button', class:'mg-row', onclick:function(){ openEditor('guide', g); } }, [
        h('span', { class:'badges' }, [visBadge(g.visibility)]),
        h('span', { class:'t' }, [h('small', { text:g.year + '년' }), g.year + ' 모집요강']),
        h('span', { class:'m', text:g.files.length ? g.files[0].name : '파일 없음 · 사이트에 안 보임' })
      ]);
    })));
    return box;
  }
  function nextGuideYear(){
    var y = Number(todayKst().slice(0, 4)), used = (S.data.guides || []).map(function(g){ return Number(g.year); });
    while(used.indexOf(y) > -1) y++;
    return String(y);
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
      gallery: { title:'', desc:'', date:todayKst(), visibility:'공개', course:'', field:'' },
      guide:   { year:nextGuideYear(), title:'', visibility:'공개' }
    };
    S.edit = {
      board:board, id:post ? post.id : null, dirty:false, preview:false,
      post: post ? Object.assign({}, post) : blank[board],
      photos: post && post.photos ? post.photos.map(copyAtt) : [],
      files: post && post.files ? post.files.map(copyAtt) : [],
      maxPhotos: board === 'notice' ? lim.noticePhotos : lim.galleryPhotos,
      maxFiles: board === 'guide' ? (lim.guideFiles || 1) : lim.noticeFiles,
      photoSide: PHOTO_MAX_SIDE
    };
    renderEditor();
    history.pushState({ adEdit:1 }, '');
    window.scrollTo(0, 0);
  }

  function markDirty(){ if(S.edit) S.edit.dirty = true; }
  function pending(){ var e = S.edit; return e ? e.photos.concat(e.files).filter(function(a){ return a.uploading; }).length : 0; }
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

    if(e.board === 'guide'){ renderGuideEditor(wrap, e); view.appendChild(wrap); return; }

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

  // 모집요강 한 연도 — 연도 · 제목(선택) · 공개 여부 · 파일
  function renderGuideEditor(wrap, e){
    var p = e.post, lim = S.data.limits;
    var bind = function(key){ return function(ev){ p[key] = ev.target.value; markDirty(); }; };
    wrap.appendChild(h('h2', { text:e.id ? p.year + ' 모집요강 수정' : '새 모집요강' }));
    wrap.appendChild(h('div', { class:'fld-row', style:'margin-top:22px' }, [
      h('div', { class:'fld' }, [
        h('label', { for:'f-year', text:'연도' }),
        h('input', { id:'f-year', type:'number', min:'2020', max:'2099', step:'1', value:p.year, oninput:bind('year') }),
        h('p', { class:'syntax', text:'모집 및 선발 페이지의 같은 연도 탭에 나옵니다. 한 연도에 하나만 만들 수 있습니다.' })
      ]),
      h('div', { class:'fld' }, [
        h('span', { class:'lb' }, ['공개 여부', h('span', { class:'hint', text:'비공개면 사이트에 보이지 않습니다' })]),
        h('div', { class:'choices' }, ['공개', '비공개'].map(function(v){
          return h('label', null, [h('input', { type:'radio', name:'vis', value:v, checked:p.visibility === v, onchange:bind('visibility') }), v]);
        }))
      ])
    ]));
    wrap.appendChild(fileField(e, lim));
    wrap.appendChild(h('div', { class:'mg-actions' }, [
      e.id ? h('button', { type:'button', class:'mg-btn warn', text:'삭제', onclick:removePost }) : null,
      h('div', { class:'r' }, [
        h('button', { type:'button', class:'mg-btn', text:'취소', onclick:function(){ if(confirmLeave()) closeEditor(); } }),
        h('button', { type:'button', class:'mg-btn pri', text:'저장', onclick:save })
      ])
    ]));
  }

  function field(id, label, max, make, hint){
    var input = make();
    var count = max ? h('p', { class:'count' }) : null;
    var upd = function(){ if(count){ count.textContent = input.value.length + ' / ' + max; count.className = 'count' + (input.value.length > max ? ' over' : ''); } };
    input.addEventListener('input', upd); upd();
    return h('div', { class:'fld' }, [h('label', { for:id }, [label, hint ? h('span', { class:'hint', text:hint }) : null]), input, count]);
  }

  // 본문: 글쓰기 도구(richtext.js — 굵게 · 기울임 · 밑줄 · 형광 · 크기 · 색 · 글꼴 · 정렬 · 목록 · 소제목 · 링크) + 미리보기
  // (2026-11-05 사용자). 보이는 대로 고치고, 저장은 글 묶음(rich)과 글자만(body, 글자 수 · 빈 글 확인용)으로 보낸다.
  // 예전 본문(**굵게** {강조:} {빨강:})은 열 때 같은 모양으로 바꿔 보여 준다
  function bodyField(p, lim){
    var ed = h('div', { class:'rt-edit rt-doc', id:'f-body', contenteditable:'true', role:'textbox', 'aria-multiline':'true', 'aria-label':'본문',
      'data-placeholder':'안내 내용을 입력하세요. 주소(https://…)는 사이트에서 자동으로 링크가 됩니다.' });
    ed.spellcheck = false;
    RT.docToDom(ed, p.rich && p.rich.b ? p.rich : RT.legacyBodyToDoc(p.body));
    if(!ed.firstChild){ var first = h('p'); first.appendChild(h('br')); ed.appendChild(first); }   // 빈 본문도 문단 안에서 쓰기 시작하게
    try{ document.execCommand('defaultParagraphSeparator', false, 'p'); }catch(err){}
    var count = h('p', { class:'count' });
    var pv = h('div', { class:'preview', hidden:true });
    var pvBtn;
    var sync = function(){
      var doc = RT.domToDoc(ed);
      p.rich = doc;
      p.body = RT.docText(doc);
      count.textContent = p.body.length + ' / ' + lim.noticeBody;
      count.className = 'count' + (p.body.length > lim.noticeBody ? ' over' : '');
      ed.classList.toggle('is-empty', !p.body.trim());
      if(!pv.hidden) drawPreview();
    };
    var drawPreview = function(){
      pv.textContent = '';
      pv.appendChild(Board.renderNotice(previewPost(), { localPhoto:function(ph){ return ph.local; } }));
    };
    var bar = RT.toolbar({
      root:function(){ return ed; },
      mode:function(){ return 'doc'; },
      changed:function(){ markDirty(); sync(); },
      notice:function(m){ toast(m, true); }
    });
    ed.addEventListener('input', function(){ markDirty(); sync(); });
    ed.addEventListener('keydown', function(ev){ bar.keys(ev); });
    // 붙여 넣기는 글자만(다른 곳의 글꼴 · 색이 섞이지 않게). 줄은 그대로
    ed.addEventListener('paste', function(ev){
      ev.preventDefault();
      var t = ((ev.clipboardData || window.clipboardData).getData('text/plain') || '').replace(/\r\n?/g, '\n');
      document.execCommand('insertText', false, t);
    });
    ed.addEventListener('drop', function(ev){ ev.preventDefault(); });
    pvBtn = h('button', { type:'button', class:'pv', text:'미리보기', onclick:function(){
      pv.hidden = !pv.hidden; pvBtn.className = 'pv' + (pv.hidden ? '' : ' on');
      if(!pv.hidden) drawPreview();
    } });
    sync();
    return h('div', { class:'fld rt-field' }, [
      h('label', { for:'f-body' }, ['본문', h('span', { class:'hint', text:'비워 두면 사진 · 첨부만 보입니다' })]),
      bar, ed,
      h('div', { class:'tools under' }, [count, h('span', { class:'sp' }), pvBtn]),
      h('p', { class:'syntax', text:'글자를 끌어 고른 뒤 위 도구를 누르세요. 정렬 · 목록 · 소제목은 커서가 있는 문단에 적용됩니다. 실제 모양은 미리보기로 확인하세요.' }),
      pv
    ]);
  }


  function previewPost(){
    var e = S.edit;
    var done = function(a){ return a.fileId || a.local; };
    return Object.assign({}, e.post, { photos:e.photos.filter(done), files:e.files.filter(function(a){ return a.fileId; }) });
  }

  /* ---------- 사진 ---------- */
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
          !ph.uploading && !ph.error && (ph.local || ph.fileId) ? h('button', { type:'button', text:'자르기', title:'확대 · 축소해 자르기', onclick:function(){ recropPhoto(e, i); } }) : null,
          h('button', { type:'button', class:'x', text:'✕', title:'빼기', onclick:function(){ e.photos.splice(i, 1); markDirty(); drawPhotos(null, e); } })
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
      return function(){ return uploadPhoto(e, ph, file.name, shrinkPhoto(file, e.photoSide)); };
    });
    drawPhotos(null, e);
    runQueue(jobs, UPLOAD_PARALLEL);
  }

  // prepared: { blob, w, h, preview }을 주는 Promise. 올린 뒤 ph에 첨부ID · 파일ID를 적는다
  function uploadPhoto(e, ph, name, prepared){
    ph.uploading = true; ph.error = null;
    drawPhotos(null, e);
    return prepared.then(function(r){
      ph.local = r.preview; ph.w = r.w; ph.h = r.h; drawPhotos(null, e);
      return blobToBase64(r.blob).then(function(b64){
        return api('upload', { kind:'photo', name:String(name || '사진').replace(/\.[^.]+$/, '') + '.jpg', mimeType:'image/jpeg', base64:b64, width:r.w, height:r.h }, 120000);
      });
    }).then(function(d){
      ph.attachmentId = d.attachmentId; ph.fileId = d.fileId; ph.size = d.size; ph.uploading = false; markDirty();
    }, function(err){
      ph.uploading = false; ph.error = err && err.code ? errMsg(err) : '이 사진은 열 수 없습니다. JPG로 바꿔 올려 주세요.';
    }).then(function(){ if(S.edit === e) drawPhotos(null, e); });
  }

  // 이미 넣은 사진을 다시 자른다 — 자른 사진을 새로 올려 그 자리를 바꾼다(드라이브의 원래 사진은 저장할 때 빠진 첨부로 정리됨)
  function recropPhoto(e, i){
    var ph = e.photos[i];
    if(!ph || ph.uploading) return;
    var src = ph.local || (ph.fileId && Board.photoUrl(ph.fileId, Math.max(e.photoSide, 2400)));
    cropPhoto(src, { ratio:0, maxSide:e.photoSide, remote:!ph.local }).then(function(r){
      if(!r || r === 'skip') return;
      var nph = { uploading:true, name:ph.name || '사진' };
      e.photos.splice(i, 1, nph);
      uploadPhoto(e, nph, nph.name, Promise.resolve(r));
    }, function(){ toast('이 사진은 여기서 자를 수 없습니다. 원본 파일을 [+ 사진 추가]로 다시 올리면서 잘라 주세요.', true); });
  }

  // 사진 줄이기 · 자르기 창은 assets/js/cropper.js (페이지 직접 편집과 함께 씀, WBS 18)
  function shrinkPhoto(file, maxSide){ return Cropper.shrink(file, maxSide); }
  function cropPhoto(src, opts){ return Cropper.crop(src, Object.assign({ onError:function(m){ toast(m, true); } }, opts)); }

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
    box.appendChild(h('span', { class:'lb' }, [(e.board === 'guide' ? '모집요강 파일' : '첨부파일') + ' (' + e.files.length + ' / ' + e.maxFiles + ')', h('span', { class:'hint', text:e.board === 'guide' ? 'PDF 한 개. 모집 및 선발 페이지의 이 연도 탭에 「' + (e.post.year || '') + ' 모집요강 내려받기」 단추로 나옵니다(파일 이름은 보이지 않음).' : '방문자가 내려받을 수 있습니다' })]));
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
      h('button', { type:'button', class:'mg-btn sm', text:'+ 파일 추가', disabled:e.files.length >= e.maxFiles, onclick:function(){ input.click(); } }),
      h('span', { class:'hint', text:lim.fileExts.join(' · ') + ' · 한 개 ' + Board.formatSize(lim.fileBytes) + ' 이하' }),
      input
    ]));
  }

  function addFiles(e, list){
    var lim = S.data.limits, room = e.maxFiles - e.files.length;
    if(list.length > room){ toast('파일은 최대 ' + e.maxFiles + '개입니다.', true); list = list.slice(0, room); }
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
    if(e.photos.concat(e.files).some(function(a){ return a.error; })) return fail('올리지 못한 사진 · 파일이 있습니다. ✕로 빼고 저장해 주세요.');
    if(e.board === 'guide'){
      var year = String(p.year || '').trim();
      if(!/^20[2-9]\d$/.test(year)) return fail('연도를 네 자리로 입력해 주세요. 예: 2026');
      if((S.data.guides || []).some(function(g){ return g.year === year && g.id !== e.id; })) return fail(year + '년 모집요강이 이미 있습니다. 목록에서 그 연도를 눌러 고쳐 주세요.');
      if(!e.files.length && p.visibility === '공개' && !confirm('파일이 없어 사이트에는 보이지 않습니다. 그래도 저장할까요?')) return;
      return send({ board:'guide', id:e.id, post:{ year:year, title:p.title || '', visibility:p.visibility }, photos:[], files:e.files.map(function(a){ return a.attachmentId; }) });
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
      ? { category:p.category, title:p.title, body:p.body, rich:p.rich || RT.legacyBodyToDoc(p.body), date:p.date, pinned:!!p.pinned, photoPosition:p.photoPosition, photoLink:(p.photoLink || '').trim(), visibility:p.visibility }
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

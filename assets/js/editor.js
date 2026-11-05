/* ============================================================
   2026 K예술영재 프로젝트 — editor.js
   페이지 직접 편집 (WBS 18, 2026-11-04). 사이트 화면 위에서 글자 · 목록 항목 · 사진을 고친다.
   content.js가 ?edit=1(또는 이 탭에서 편집을 켠 뒤)일 때만 부른다. 방문자 화면에는 이 파일이 오지 않는다.
     글자     눌러서 바로 고친다. 고르고 [굵게] · [형광], [원래대로]는 HTML 처음 글로. 모아서 아래 [저장]
     목록     항목 위 단추로 앞으로 · 뒤로 · 복제 · 삭제 (저장할 때 함께)
     문단     문단을 누르면 뜨는 [아래에 문단 추가] · [문단 빼기] (WBS 18.7)
     구역     구역 사이의 [+ 여기에 구역 추가]로 틀(글 · 사진 + 글 · 표 · 카드 · 단계)을 골라 더하고, 더한 구역은 [위로] [아래로] [구역 삭제]
     사진     사진 위 단추로 바꾸기(자르기 창) · 자르기 · 빼기 — 누르면 바로 저장된다(관리자 페이지 「사이트 사진」 · 「표지 사진」과 같은 칸)
   ▣ 저장할 수 있는지는 관문이 요청마다 토큰으로 확인한다. 토큰은 sessionStorage(관리자 페이지와 같은 칸), 기기ID만 localStorage.
   ▣ 운영진이 쓴 글은 textContent · DOM으로만 다룬다(innerHTML 없음 — CLAUDE.md 보안 5). 붙여 넣기는 글자만.
   ============================================================ */
(function(){
  var C = window.Content, GATEWAY = window.HP_GATEWAY;
  if(!C || !GATEWAY || !window.Board) return;
  var K = { token:'hp_admin_token', exp:'hp_admin_exp', device:'hp_admin_device', edit:'hp_edit' };
  var PAGE_NAMES = { index:'메인', about:'사업소개', recruit:'모집 및 선발', programs:'워크숍', mentoring:'심화 멘토링', camp:'겨울캠프', news:'소식' };
  var E = { token:null, exp:0, data:null, base:'', photos:{}, local:{}, saving:false, lastActive:Date.now(), heroSlot:null };

  /* ---------- 작은 도구 ---------- */
  function ss(k, v){ try{ if(v === undefined) return sessionStorage.getItem(k); if(v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); }catch(e){ return null; } }
  function ls(k, v){ try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }
  function deviceId(){
    var id = ls(K.device);
    if(!id){ id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2)); ls(K.device, id); }
    return id || 'no-storage';
  }
  function h(tag, attrs, kids){
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k){
      var v = attrs[k];
      if(v == null || v === false) return;
      if(k === 'class') e.className = v;
      else if(k === 'text') e.textContent = v;
      else if(k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids == null ? [] : kids).forEach(function(c){
      if(c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  // 단추를 눌러도 글자 칸의 커서 · 고른 글이 풀리지 않게
  function btn(text, onclick, cls, title){
    return h('button', { type:'button', class:'ed-b' + (cls ? ' ' + cls : ''), text:text, title:title || null,
      onmousedown:function(ev){ ev.preventDefault(); }, onclick:function(ev){ ev.preventDefault(); ev.stopPropagation(); onclick(ev); } });
  }

  var ui = h('div', { class:'ed-ui' });
  var toastEl = h('div', { class:'ed-toast', role:'status' }), toastTimer;
  function toast(msg, isErr){
    toastEl.textContent = msg; toastEl.className = 'ed-toast on' + (isErr ? ' err' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function(){ toastEl.className = 'ed-toast'; }, isErr ? 6000 : 3500);
  }
  var busyEl = h('div', { class:'ed-busy', hidden:true }, [h('div', null, [h('i'), h('p')])]);
  function busy(msg){ busyEl.querySelector('p').textContent = msg || ''; busyEl.hidden = !msg; }

  var ERRORS = {
    AUTH_INVALID:'접근코드가 맞지 않습니다.',
    AUTH_EXPIRED:'사용기한이 지난 접근코드입니다.',
    AUTH_LOCKED:'로그인 실패가 많아 잠겼습니다. 10분 뒤 다시 시도해 주세요.',
    INVALID_INPUT:'저장할 수 없는 내용이 있습니다. 글이 너무 길지 않은지(한 칸 3,000자) 확인해 주세요.',
    FILE_REJECTED:'올릴 수 없는 파일입니다. 형식과 크기를 확인해 주세요.',
    NOT_FOUND:'사진 자리를 찾을 수 없습니다. 화면을 새로 고친 뒤 다시 해 주세요.',
    BUSY:'다른 저장이 진행 중입니다. 잠시 뒤 다시 눌러 주세요.',
    NETWORK:'인터넷 연결을 확인해 주세요.',
    TIMEOUT:'응답이 너무 늦습니다. 잠시 뒤 다시 시도해 주세요.',
    SERVER_ERROR:'처리 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.'
  };
  function errMsg(e){ return ERRORS[e && e.code] || ERRORS.SERVER_ERROR; }

  /* ---------- 관문 호출 (admin.js와 같은 방식) ---------- */
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
  function api(action, extra, timeoutMs){
    var go = function(){ return call(Object.assign({ action:action, token:E.token }, extra), timeoutMs); };
    if(!E.token || Date.now() > E.exp) return relogin().then(go);
    return go().catch(function(e){
      if(e.code === 'TOKEN_EXPIRED' || e.code === 'TOKEN_INVALID') return relogin().then(go);
      throw e;
    });
  }

  /* ---------- 로그인 (관리자 페이지와 같은 접근코드 · 같은 토큰 칸) ---------- */
  var waiters = [];
  var codeIn = h('input', { type:'password', autocomplete:'current-password', 'aria-label':'접근코드' });
  var loginErr = h('p', { class:'ed-err' });
  var loginSub = h('p', { class:'ed-hint', text:'운영진 접근코드를 입력하면 이 화면에서 바로 고칠 수 있습니다.' });
  var loginBtn = h('button', { type:'submit', class:'ed-b pri', text:'로그인' });
  var loginBox = h('div', { class:'ed-modal', hidden:true, role:'dialog', 'aria-label':'편집 로그인' }, [
    h('form', { class:'ed-login', onsubmit:function(ev){
      ev.preventDefault();
      var code = codeIn.value.trim();
      if(window.CodeField) code = CodeField.clean(code);
      if(!code){ loginErr.textContent = '접근코드를 입력해 주세요.'; return; }
      loginBtn.disabled = true; loginErr.textContent = '';
      call({ action:'auth', code:code, name:'운영자', deviceId:deviceId(), requestId:Date.now() + '-' + Math.random().toString(16).slice(2) }, 30000)
        .then(function(d){
          setSession(d);
          loginBox.hidden = true;
          var w = waiters; waiters = [];
          w.forEach(function(fn){ fn(); });
        }, function(e){ loginErr.textContent = errMsg(e); })
        .then(function(){ loginBtn.disabled = false; });
    } }, [
      h('h2', { text:'페이지 편집' }), loginSub, codeIn, loginErr,
      h('div', { class:'acts' }, [h('button', { type:'button', class:'ed-b', text:'편집 그만두기', onclick:quit }), loginBtn])
    ])
  ]);
  // 접근코드 칸: 한글 자판이어도 영문으로, 오른쪽 [보기] (codefield.js, 2026-11-05)
  var codeField = window.CodeField ? CodeField.enhance(codeIn) : null;
  function setSession(d){ E.token = d.token; E.exp = d.expiresAt; ss(K.token, d.token); ss(K.exp, String(d.expiresAt)); }
  function relogin(){
    return new Promise(function(resolve){
      waiters.push(resolve);
      if(loginBox.hidden){
        if(E.data) loginSub.textContent = '로그인 시간이 지났습니다. 다시 로그인하면 하던 일을 이어서 합니다.';
        codeIn.value = ''; loginErr.textContent = ''; loginBox.hidden = false;
        if(codeField) codeField.hide();
        codeIn.focus();
      }
    });
  }
  ['input','click','keydown'].forEach(function(t){ document.addEventListener(t, function(){ E.lastActive = Date.now(); }, true); });
  setInterval(function(){   // 손대고 있으면 만료 30분 전부터 토큰을 미리 연장
    if(!E.token || Date.now() - E.lastActive > 15*60*1000 || E.exp - Date.now() > 30*60*1000) return;
    call({ action:'ping', token:E.token }, 30000).then(setSession, function(){});
  }, 5*60*1000);

  /* ---------- 아래 막대 ---------- */
  var saveBtn = btn('저장', save, 'pri');
  var stateEl = h('span', { class:'ed-state', text:'불러오는 중…' });
  var bar = h('div', { class:'ed-bar', role:'region', 'aria-label':'페이지 편집' }, [
    h('b', { text:'편집 중 · ' + (PAGE_NAMES[C.page] || C.page) }),
    stateEl,
    h('span', { class:'sp' }),
    btn('도움말', help),
    h('a', { class:'ed-b', href:'admin.html', text:'관리자 페이지' }),
    btn('편집 끝내기', quit),
    saveBtn
  ]);
  function help(){
    window.alert([
      '글자: 고칠 글자를 눌러 바로 고칩니다. 글자를 끌어 고른 뒤 위에 뜨는 도구로 굵게 · 기울임 · 밑줄 · 형광 · 크기 · 색 · 글꼴 · 링크를 바꾸고, [정렬]로 칸의 문장 정렬을 바꿉니다. [원래대로]는 처음 글로 되돌립니다.',
      '줄 나누기: Enter. 붙여 넣으면 글자만 들어갑니다.',
      '목록: 카드 · 단계 · 표 줄 위에 마우스를 올리면 [앞으로] [뒤로] [복제] [삭제] 단추가 나옵니다.',
      '문단: 문단을 누르면 위에 뜨는 [아래에 문단 추가]로 문단을 더하고, 더한 문단은 [문단 빼기]로 뺍니다.',
      '구역: 구역 사이의 [+ 여기에 구역 추가]를 누르고 모양(글 · 사진 + 글 · 표 · 카드 · 단계)을 고르면 새 구역이 생깁니다. 더한 구역 위에 마우스를 올리면 [위로] [아래로] [구역 삭제]가 나옵니다.',
      '글자 · 목록은 아래 [저장]을 눌러야 사이트에 반영됩니다(1~2분 뒤 보임).',
      '사진: 사진 위에 마우스를 올리면 [사진 바꾸기] [자르기] [빼기]가 나옵니다. 사진은 누르는 즉시 저장됩니다.',
      '머리 · 바닥 메뉴와 공지 · 갤러리 · 모집요강 파일은 관리자 페이지에서 고칩니다.'
    ].join('\n\n'));
  }
  function quit(){
    if(dirty() && !window.confirm('저장하지 않은 고침이 있습니다. 편집을 끝내면 사라집니다. 끝낼까요?')) return;
    E.base = JSON.stringify(C.collect());   // 아래 beforeunload가 다시 묻지 않게
    ss(K.edit, null);
    location.href = location.pathname + location.hash;
  }
  window.addEventListener('beforeunload', function(ev){
    if(!dirty()) return;
    ev.preventDefault(); ev.returnValue = '';
  });

  /* ---------- 바뀐 것 · 저장 ---------- */
  function dirty(){ return !!E.data && JSON.stringify(C.collect()) !== E.base; }
  var stateTimer;
  function changed(){
    clearTimeout(stateTimer);
    stateTimer = setTimeout(function(){
      var d = dirty();
      saveBtn.disabled = !d || E.saving;
      stateEl.textContent = d ? '저장하지 않은 고침이 있습니다' : '모두 저장됨';
      stateEl.classList.toggle('warn', d);
    }, 200);
  }
  function save(){
    if(E.saving || !E.data) return;
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    var content = C.collect(), json = JSON.stringify(content);
    if(json.length > 45000) return toast('이 페이지에 고친 글이 너무 많습니다. 담당 개발자에게 알려 주세요.', true);
    E.saving = true; saveBtn.disabled = true;
    busy('저장하고 사이트에 반영하는 중…\n10초 정도 걸립니다.');
    api('savePage', { page:C.page, content:content }, 120000).then(function(d){
      E.base = json;
      toast(d.published ? '저장했습니다. 1~2분 뒤 방문자 화면에 보입니다.' : '저장했지만 사이트 반영에 실패했습니다. 관리자 페이지의 [다시 반영]을 눌러 주세요.', !d.published);
    }, function(e){ toast(errMsg(e), true); }).then(function(){ E.saving = false; busy(null); changed(); });
  }

  /* ---------- 글자 칸 ---------- */
  function setEditable(el, plain){
    if(plain){
      try{ el.contentEditable = 'plaintext-only'; }catch(e){}
      if(el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    }else el.contentEditable = 'true';
    el.spellcheck = false;
    el.setAttribute('data-ed', plain ? 'text' : 'rich');
  }
  // 글자만 고치는 칸: 그 글을 .ed-t로 감싸 그것만 고칠 수 있게 한다(옆의 그림 · 작은 칸은 그대로)
  function wrapText(el){
    var n = C.textNode(el);
    if(!n || n.nodeType === 1) return n;
    var m = n.data.match(/^(\s*)([\s\S]*?)(\s*)$/), sp = h('span', { class:'ed-t', text:m[2].replace(/​/g, '') }), par = n.parentNode;
    if(m[1]) par.insertBefore(document.createTextNode(m[1]), n);
    par.insertBefore(sp, n);
    if(m[3]) par.insertBefore(document.createTextNode(m[3]), n);
    par.removeChild(n);
    return sp;
  }
  var CELLS = '[data-e],[data-ei],[data-ap],[data-xf]';   // 고칠 수 있는 칸: HTML 칸 · 목록 항목 칸 · 더한 문단 · 더한 구역 칸
  function prepare(el){
    if(el.hasAttribute('data-et')){ var sp = wrapText(el); if(sp) setEditable(sp, true); return; }
    if(el.getAttribute('data-xf') === 'tx'){ setEditable(el, false); el.setAttribute('data-ed', 'doc'); return; }   // 더한 구역의 글: 여러 문단
    C.set(el, C.read(el));   // 문장 묶음 · 붙임 공백(줄바꿈 단위, common.js)을 풀어 고치기 쉽게
    setEditable(el, false);
  }
  function editRoot(node){
    var el = node && (node.nodeType === 1 ? node : node.parentNode);
    return el && el.closest ? el.closest('[data-ed]') : null;
  }
  // 고친 글자 칸이 속한 칸(data-e · data-ei가 붙은 요소)
  function cellOf(ed){ return ed.classList.contains('ed-t') ? ed.parentNode.closest('[data-e],[data-ei]') : ed; }
  // 문단을 더할 수 있는 칸: 페이지 글자 칸의 문단(p) · 더한 문단 · 더한 구역의 문단
  function paraCell(cell){
    if(!cell || cell.tagName !== 'P') return null;
    if(cell.hasAttribute('data-ap') || cell.getAttribute('data-xf') === 'p') return cell;
    return cell.hasAttribute('data-e') && !cell.hasAttribute('data-et') ? cell : null;
  }
  function addPara(){
    var cell = cur.ed && paraCell(cellOf(cur.ed));
    if(!cell) return;
    var p = cell.getAttribute('data-xf') === 'p' ? C.newPara(cell, {}) : C.newPara(cell, { ap:cell.getAttribute('data-ap') || cell.getAttribute('data-e') });
    cell.parentNode.insertBefore(p, cell.nextSibling);
    prepare(p);
    p.focus();
    changed();
  }
  function removePara(){
    var cell = cur.ed && cellOf(cur.ed);
    if(!cell || !(cell.hasAttribute('data-ap') || cell.getAttribute('data-xf') === 'p')) return;
    if(cell.getAttribute('data-xf') === 'p' && cell.parentNode.querySelectorAll('[data-xf="p"]').length < 2) return toast('구역의 마지막 문단은 뺄 수 없습니다. 글을 비우면 사이트에 보이지 않습니다.', true);
    cell.parentNode.removeChild(cell);
    cur.ed = null; changed(); place();
  }
  function original(cell){
    if(cell.hasAttribute('data-e')) return C.orig[cell.getAttribute('data-e')];
    var item = cell.closest('[data-s]'), box = item && item.parentNode, L = box && C.lists[box.getAttribute('data-list')];
    var tpl = L && L.tpl[Number(item.getAttribute('data-s'))], o = tpl && C.find(tpl, cell.getAttribute('data-ei'));
    return o ? C.read(o) : null;
  }

  function revert(){
    var ed = cur.ed; if(!ed) return;
    var cell = cellOf(ed), v = cell && original(cell);
    if(v == null) return;
    C.set(cell, v);
    if(cell.hasAttribute('data-et')) prepare(cell);
    changed();
    place();
  }

  // 글쓰기 도구(richtext.js): 굵게 · 기울임 · 밑줄 · 형광 · 크기 · 색 · 글꼴 · 정렬 · 링크 · 서식 지우기,
  // 여러 문단 칸(더한 구역의 글)은 목록 · 소제목도. 뒤에 이 칸의 [원래대로] · [아래에 문단 추가] · [문단 빼기]
  var rtBar = RT.toolbar({
    root:function(){ return cur.ed && cur.ed.getAttribute('data-ed') !== 'text' ? cur.ed : null; },
    mode:function(rt){ return rt.getAttribute('data-ed') === 'doc' ? 'doc' : 'cell'; },
    alignTarget:function(rt){ return cellOf(rt); },
    changed:function(){ changed(); place(); },
    notice:function(m){ toast(m, true); },
    extra:[
      h('span', { class:'rt-sep fx' }),
      btn('원래대로', revert, 'fr', '이 칸을 처음 글로 되돌립니다'),
      btn('아래에 문단 추가', addPara, 'fa', '이 문단 바로 아래에 새 문단을 더합니다'),
      btn('문단 빼기', removePara, 'fd warn', '더한 문단을 뺍니다')
    ]
  });
  var fmtBar = h('div', { class:'ed-tool ed-fmt', hidden:true }, [rtBar]);
  var cur = { ed:null, item:null, photo:null, sec:null };

  document.addEventListener('focusin', function(ev){
    var ed = editRoot(ev.target);
    cur.ed = ed && ed.isContentEditable ? ed : null;
    place();
  });
  document.addEventListener('focusout', function(){
    setTimeout(function(){ if(!editRoot(document.activeElement)){ cur.ed = null; place(); } }, 0);
  });
  document.addEventListener('input', function(ev){ if(editRoot(ev.target)) changed(); });
  document.addEventListener('keydown', function(ev){
    var ed = editRoot(ev.target);
    if(!ed) return;
    if(ev.key === 'Escape'){ ed.blur(); return; }
    if(ed.getAttribute('data-ed') !== 'text' && rtBar.keys(ev)) return;   // Ctrl+B · I · U
    if(ev.key === 'Enter' && ed.getAttribute('data-ed') === 'doc'){ setTimeout(changed, 0); return; }   // 여러 문단 칸은 새 문단
    if(ev.key === 'Enter'){
      ev.preventDefault();
      if(ed.getAttribute('data-ed') === 'text') return ed.blur();   // 글자만 고치는 칸은 한 줄
      if(!document.execCommand('insertLineBreak')){
        var sel = window.getSelection(), r = sel.getRangeAt(0), br = document.createElement('br');
        r.deleteContents(); r.insertNode(br); r.setStartAfter(br); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
      }
      changed();
    }
  });
  document.addEventListener('paste', function(ev){
    var ed = editRoot(ev.target);
    if(!ed) return;
    ev.preventDefault();
    var t = (ev.clipboardData || window.clipboardData).getData('text/plain') || '';
    t = t.replace(/\r\n?/g, '\n');
    if(ed.getAttribute('data-ed') === 'text') t = t.replace(/\s*\n\s*/g, ' ');
    if(!document.execCommand('insertText', false, t)){
      var sel = window.getSelection(), r = sel.getRangeAt(0);
      r.deleteContents(); r.insertNode(document.createTextNode(t)); r.collapse(false);
    }
    changed();
  });
  document.addEventListener('drop', function(ev){ if(editRoot(ev.target)) ev.preventDefault(); });

  // 편집 중에는 본문의 링크로 넘어가지 않는다(글자를 누르면 고치기). 머리 · 바닥 메뉴와 탭(#)은 그대로
  document.addEventListener('click', function(ev){
    var a = ev.target.closest && ev.target.closest('a[href]');
    if(!a || a.closest('#header,#footer,#allmenu,.ed-ui')) return;
    if(/^#/.test(a.getAttribute('href'))) return;
    ev.preventDefault();
  }, true);

  /* ---------- 목록 항목 ---------- */
  function listOf(item){ var box = item.parentNode; return C.lists[box.getAttribute('data-list')]; }
  // 항목 수가 바뀐 뒤: HTML 목록은 가로 칸 수, 더한 구역의 목록은 칸 수 · 단계 번호
  function afterList(box){ if(box.hasAttribute('data-list')) C.cols(C.lists[box.getAttribute('data-list')]); else C.fixAdded(box); }
  function rand4(){ var s = ''; while(s.length < 4) s += 'abcdefghijkmnpqrstuvwxyz23456789'.charAt(Math.floor(Math.random() * 32)); return s; }
  // 복제한 항목의 새 사진 자리: HTML 처음 항목의 자리 + -x네 글자 (관문 createPhotoSlot_가 받아 준다)
  function newSlot(item){
    var L = listOf(item), tpl = L && L.tpl[Number(item.getAttribute('data-s'))], ph = tpl && C.photoOf(tpl);
    return ph ? ph.getAttribute('data-photo') + '-x' + rand4() : null;
  }
  function move(dir){
    var it = cur.item; if(!it) return;
    var to = dir < 0 ? it.previousElementSibling : it.nextElementSibling;
    if(!to){ toast(dir < 0 ? '맨 앞 항목입니다.' : '맨 뒤 항목입니다.'); return; }
    if(dir < 0) it.parentNode.insertBefore(it, to); else it.parentNode.insertBefore(to, it);
    afterList(it.parentNode);
    changed(); place();
  }
  function duplicate(){
    var it = cur.item; if(!it) return;
    var box = it.parentNode, tplList = box.hasAttribute('data-list');
    if(box.children.length >= 60) return toast('항목은 60개까지입니다.', true);
    var c = it.cloneNode(true), ph = tplList ? C.photoOf(c) : null, slot = ph && newSlot(it);
    if(ph && slot){ ph.setAttribute('data-photo', slot); window.Photos && Photos.clear(ph); }
    box.insertBefore(c, it.nextSibling);
    afterList(box);
    changed();
    toast(ph ? '복제했습니다. 새 항목의 사진은 비어 있습니다 — 사진 위 [사진 넣기]로 넣어 주세요.' : '복제했습니다. 글을 고친 뒤 [저장]을 눌러 주세요.');
    setItem(c);
  }
  function removeItem(){
    var it = cur.item; if(!it) return;
    var box = it.parentNode;
    if(box.children.length < 2) return toast('마지막 항목은 지울 수 없습니다. 글을 고쳐 써 주세요.', true);
    if(!window.confirm('이 항목을 지울까요?\n(저장하기 전이면 [편집 끝내기]로 버릴 수 있습니다)')) return;
    box.removeChild(it);
    afterList(box);
    setItem(null); changed();
  }
  var itemBar = h('div', { class:'ed-tool ed-item', hidden:true }, [
    btn('◀ 앞으로', function(){ move(-1); }), btn('뒤로 ▶', function(){ move(1); }),
    btn('복제', duplicate), btn('삭제', removeItem, 'warn')
  ]);
  function setItem(it){ if(cur.item === it) return; cur.item = it; place(); }

  /* ---------- 사진 ---------- */
  var heroEl = document.getElementById('hero');
  var fileIn = h('input', { type:'file', accept:'image/jpeg,image/png,image/webp', hidden:true });
  var filePick = null;
  fileIn.addEventListener('change', function(){ var f = fileIn.files && fileIn.files[0]; fileIn.value = ''; if(f && filePick) filePick(f); });

  function photoSide(){ return (E.data && E.data.limits && E.data.limits.heroPhotoSide) || 2400; }
  function blobToBase64(blob){
    return new Promise(function(resolve, reject){
      var fr = new FileReader();
      fr.onload = function(){ resolve(String(fr.result).split(',')[1]); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }
  // 대상: { kind:'photo', slot, el } 또는 { kind:'hero', slot:'music' }
  function target(){
    if(cur.photo === heroEl) return E.heroSlot ? { kind:'hero', slot:E.heroSlot } : null;
    return cur.photo ? { kind:'photo', slot:cur.photo.getAttribute('data-photo'), el:cur.photo } : null;
  }
  function ratioOf(t){
    var el = t.kind === 'hero' ? heroEl : t.el, r = el.getBoundingClientRect();
    return r.width && r.height ? r.width / r.height : 16 / 9;
  }
  function currentPhoto(t){
    if(t.kind === 'hero'){ var hs = heroItem(t.slot); return hs && hs.photos[0]; }
    return E.photos[t.slot];
  }
  function upload(t, r, name){
    busy('사진을 올리고 사이트에 반영하는 중…\n20초 정도 걸립니다.');
    return blobToBase64(r.blob).then(function(b64){
      return api('upload', { kind:'photo', name:String(name || '사진').replace(/\.[^.]+$/, '') + '.jpg', mimeType:'image/jpeg', base64:b64, width:r.w, height:r.h }, 120000);
    }).then(function(d){
      return saveSlot(t, [d.attachmentId]).then(function(res){
        E.local[t.kind + ':' + t.slot] = r.preview;
        var ph = { fileId:d.fileId, w:r.w, h:r.h };
        if(t.kind === 'hero'){ var hs = heroItem(t.slot); if(hs){ hs.photos = [ph]; hs.cutouts = []; } drawHero(); }
        else{ E.photos[t.slot] = ph; showPhoto(t.slot, ph, r.preview); }
        toast(res.published ? '사진을 바꿨습니다. 1~2분 뒤 방문자 화면에 보입니다.' : '사진은 저장했지만 사이트 반영에 실패했습니다. 관리자 페이지의 [다시 반영]을 눌러 주세요.', !res.published);
      });
    }).catch(function(e){ toast(e && e.code ? errMsg(e) : '이 사진은 열 수 없습니다. JPG로 바꿔 올려 주세요.', true); })
      .then(function(){ busy(null); });
  }
  function saveSlot(t, photos){
    if(t.kind === 'hero') return api('save', { board:'hero', id:'H-' + t.slot, post:{ depth:false, center:null }, photos:photos, cutouts:[], files:[] }, 120000);
    return api('save', { board:'photo', id:'S-' + t.slot, post:{ pos:null }, photos:photos, files:[] }, 120000);
  }
  function showPhoto(slot, ph, preview){
    [].forEach.call(document.querySelectorAll('[data-photo="' + slot + '"]'), function(el){
      Photos.apply(el, ph);
      if(!preview) return;
      var img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if(img) img.src = preview; else el.style.setProperty('--photo', 'url("' + preview + '")');
    });
  }
  function replacePhoto(){
    var t = target(); if(!t) return;
    filePick = function(file){
      var url = URL.createObjectURL(file);
      Cropper.crop(url, { ratio:ratioOf(t), maxSide:photoSide(), skip:true, onError:function(m){ toast(m, true); } }).then(function(r){
        if(r === null){ URL.revokeObjectURL(url); return; }
        (r === 'skip' ? Cropper.shrink(file, photoSide()) : Promise.resolve(r)).then(function(x){ upload(t, x, file.name); });
      }, function(){ toast('이 사진은 열 수 없습니다. JPG로 바꿔 올려 주세요.', true); });
    };
    fileIn.click();
  }
  function recrop(){
    var t = target(); if(!t) return;
    var local = E.local[t.kind + ':' + t.slot], ph = currentPhoto(t);
    if(!local && !(ph && ph.fileId)) return toast('자를 사진이 없습니다. [사진 넣기]로 올려 주세요.', true);
    var src = local || Board.photoUrl(ph.fileId, photoSide());
    Cropper.crop(src, { ratio:ratioOf(t), maxSide:photoSide(), remote:!local, onError:function(m){ toast(m, true); } }).then(function(r){
      if(r && r !== 'skip') upload(t, r, '사진');
    }, function(){ toast('이 사진은 여기서 자를 수 없습니다. 원본 파일을 [사진 바꾸기]로 다시 올리면서 잘라 주세요.', true); });
  }
  function removePhoto(){
    var t = target(); if(!t) return;
    if(!currentPhoto(t) && !E.local[t.kind + ':' + t.slot]) return toast('뺄 사진이 없습니다.');
    var msg = t.kind === 'hero'
      ? '「' + heroName(t.slot) + '」 표지 사진을 뺄까요? 표지에서 그 분야 칸이 빠집니다(동영상 · 2.5D도 함께 빠짐).'
      : '이 사진을 뺄까요? 사이트에서 이 자리는 비어 보입니다.';
    if(!window.confirm(msg)) return;
    busy('사진을 빼고 사이트에 반영하는 중…');
    saveSlot(t, []).then(function(res){
      delete E.local[t.kind + ':' + t.slot];
      if(t.kind === 'hero'){ var hs = heroItem(t.slot); if(hs){ hs.photos = []; hs.cutouts = []; hs.videos = []; } drawHero(); }
      else{
        delete E.photos[t.slot];
        [].forEach.call(document.querySelectorAll('[data-photo="' + t.slot + '"]'), function(el){ Photos.clear(el); });
      }
      toast(res.published ? '사진을 뺐습니다.' : '뺐지만 사이트 반영에 실패했습니다. 관리자 페이지의 [다시 반영]을 눌러 주세요.', !res.published);
    }, function(e){ toast(errMsg(e), true); }).then(function(){ busy(null); place(); });
  }

  // 표지(메인): 분야를 고른 뒤 그 분야 사진을 바꾼다
  function heroItem(k){ return E.data && (E.data.hero || []).filter(function(x){ return x.slot === k; })[0]; }
  function heroName(k){ return (window.__hero && __hero.names[k]) || k; }
  function drawHero(){
    if(!window.__hero) return;
    var custom = {}, videos = {};
    (E.data.hero || []).forEach(function(x){
      if(x.photos && x.photos[0]) custom[x.slot] = { fileId:x.photos[0].fileId, w:x.photos[0].w, h:x.photos[0].h };
      if(custom[x.slot] && x.videos && x.videos[0] && x.videos[0].src) videos[x.slot] = { src:x.videos[0].src };
    });
    __hero.rebuild(custom, videos);
    if(E.heroSlot) __hero.show(E.heroSlot);
    drawHeroChips();
  }
  var heroChips = h('span', { class:'chips' });
  function drawHeroChips(){
    heroChips.textContent = '';
    if(!window.__hero) return;
    if(!E.heroSlot) E.heroSlot = __hero.current() || __hero.slots[0];
    __hero.slots.forEach(function(k){
      var hs = heroItem(k), has = !!(hs && hs.photos && hs.photos.length);
      heroChips.appendChild(btn(heroName(k) + (has ? '' : ' (없음)'), function(){ E.heroSlot = k; __hero.show(k); drawHeroChips(); }, k === E.heroSlot ? 'on' : null));
    });
  }
  var photoLabel = h('b', { class:'lb' });
  var photoBar = h('div', { class:'ed-tool ed-photo', hidden:true }, [
    photoLabel, heroChips,
    btn('사진 바꾸기', replacePhoto, 'pri'), btn('자르기', recrop), btn('빼기', removePhoto, 'warn')
  ]);
  function setPhoto(el){ if(cur.photo === el) return; cur.photo = el; place(); }

  /* ---------- 구역 더하기 (WBS 18.7) ---------- */
  var KIND_NAMES = { text:'제목 + 글', photo:'제목 + 사진 + 글', table:'제목 + 표 (항목 · 내용)', cards:'제목 + 카드', steps:'제목 + 단계' };
  var KIND_HINTS = { text:'문단 몇 개로 된 설명', photo:'사진 한 장과 설명', table:'「기간 — 2026년 …」처럼 왼쪽 항목, 오른쪽 내용', cards:'테두리 카드 여러 개(제목 + 설명)', steps:'01 · 02 · 03 순서가 있는 단계' };
  function sample(k){
    var two = function(a, b, n){ var r = []; for(var i = 0; i < n; i++) r.push([a, b]); return r; };
    var sec = { k:k, h:'새 구역 제목', d:'' };
    if(k === 'text' || k === 'photo') sec.p = ['내용을 입력하세요.'];
    if(k === 'photo') sec.ph = 'sec-x' + rand4();
    if(k === 'table') sec.i = two('항목', '내용을 입력하세요.', 2);
    if(k === 'cards') sec.i = two('카드 제목', '설명을 입력하세요.', 3);
    if(k === 'steps') sec.i = two('단계 이름', '설명을 입력하세요.', 3);
    return sec;
  }
  // 구역 자리마다(그 자리 + 더한 구역들 뒤) [+ 여기에 구역 추가] 줄을 둔다. 저장 내용에는 들어가지 않는다(content.js collect)
  function drawAddBars(){
    [].forEach.call(document.querySelectorAll('.ed-add'), function(b){ b.parentNode.removeChild(b); });
    [].forEach.call(document.querySelectorAll('[data-sec]'), function(anc){
      var key = anc.getAttribute('data-sec'), last = anc;
      while(last.nextElementSibling && last.nextElementSibling.getAttribute('data-xs') === key) last = last.nextElementSibling;
      var band = anc.parentNode === document.body;
      var row = h('div', { class:'ed-add' + (band ? ' band' : '') }, [
        h('button', { type:'button', class:'ed-b', text:'+ 여기에 구역 추가', onclick:function(ev){ pickKind(ev.currentTarget, key, row); } })
      ]);
      last.parentNode.insertBefore(row, last.nextSibling);
    });
  }
  var pickBox = h('div', { class:'ed-tool ed-pick', hidden:true });
  function pickKind(button, key, row){
    pickBox.textContent = '';
    pickBox.appendChild(h('b', { class:'lb', text:'어떤 모양의 구역을 더할까요?' }));
    C.KINDS.forEach(function(k){
      pickBox.appendChild(h('button', { type:'button', class:'ed-k', onclick:function(){ pickBox.hidden = true; addSection(k, key, row); } }, [
        h('b', { text:KIND_NAMES[k] }), h('span', { text:KIND_HINTS[k] })
      ]));
    });
    pickBox.appendChild(btn('취소', function(){ pickBox.hidden = true; }));
    pickBox.hidden = false;
    var r = button.getBoundingClientRect();
    pickBox.style.left = Math.max(6, Math.min(r.left, window.innerWidth - pickBox.offsetWidth - 6)) + 'px';
    pickBox.style.top = Math.max(6, Math.min(r.bottom + 6, window.innerHeight - pickBox.offsetHeight - 76)) + 'px';
  }
  document.addEventListener('pointerdown', function(ev){ if(!pickBox.hidden && !ev.target.closest('.ed-pick,.ed-add')) pickBox.hidden = true; });
  function addSection(k, key, row){
    var anc = document.querySelector('[data-sec="' + key + '"]');
    var sec = C.buildSec(sample(k), key, anc && anc.parentNode === document.body);
    row.parentNode.insertBefore(sec, row);
    [].forEach.call(sec.querySelectorAll('[data-xf]'), prepare);
    var img = sec.querySelector('[data-photo]');
    if(img && window.Photos) Photos.clear(img);
    changed();
    sec.scrollIntoView({ block:'center', behavior:'smooth' });
    var title = sec.querySelector('[data-xf="h"]');
    if(title){ title.focus(); var r = document.createRange(); r.selectNodeContents(title); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(r); }
    toast(k === 'photo' ? '구역을 더했습니다. 글을 고치고, 사진 위 [사진 넣기]로 사진을 넣은 뒤 [저장]을 눌러 주세요.' : '구역을 더했습니다. 글을 고친 뒤 [저장]을 눌러 주세요.');
  }
  function moveSection(dir){
    var sec = cur.sec; if(!sec) return;
    var key = sec.getAttribute('data-xs'), to = dir < 0 ? sec.previousElementSibling : sec.nextElementSibling;
    if(!to || to.getAttribute('data-xs') !== key){ toast(dir < 0 ? '이 자리에서 맨 위 구역입니다.' : '이 자리에서 맨 아래 구역입니다.'); return; }
    if(dir < 0) sec.parentNode.insertBefore(sec, to); else sec.parentNode.insertBefore(to, sec);
    changed(); place();
    sec.scrollIntoView({ block:'nearest', behavior:'smooth' });
  }
  function removeSection(){
    var sec = cur.sec; if(!sec) return;
    if(!window.confirm('이 구역을 통째로 지울까요?\n(저장하기 전이면 [편집 끝내기]로 버릴 수 있습니다)')) return;
    sec.parentNode.removeChild(sec);
    cur.sec = null; cur.item = null; cur.photo = null;
    changed(); place();
  }
  var secBar = h('div', { class:'ed-tool ed-sec', hidden:true }, [
    h('b', { class:'lb', text:'더한 구역' }),
    btn('▲ 위로', function(){ moveSection(-1); }), btn('▼ 아래로', function(){ moveSection(1); }), btn('구역 삭제', removeSection, 'warn')
  ]);
  function setSec(el){ if(cur.sec === el) return; cur.sec = el; place(); }

  /* ---------- 떠 있는 단추 자리 ---------- */
  function vis(r){ return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; }
  function place(){
    var pr = cur.ed && cur.ed.getBoundingClientRect();
    fmtBar.hidden = !(pr && vis(pr));
    if(!fmtBar.hidden){
      var cell = cellOf(cur.ed);
      fmtBar.classList.toggle('text-only', cur.ed.getAttribute('data-ed') === 'text');
      rtBar.sync();
      fmtBar.querySelector('.fr').hidden = !(cell && (cell.hasAttribute('data-e') || cell.hasAttribute('data-ei')));
      fmtBar.querySelector('.fa').hidden = !paraCell(cell);
      fmtBar.querySelector('.fd').hidden = !(cell && (cell.hasAttribute('data-ap') || cell.getAttribute('data-xf') === 'p'));
      fmtBar.querySelector('.fx').hidden = fmtBar.querySelector('.fr').hidden && fmtBar.querySelector('.fa').hidden && fmtBar.querySelector('.fd').hidden;
      fmtBar.style.left = Math.max(6, Math.min(pr.left, window.innerWidth - fmtBar.offsetWidth - 6)) + 'px';
      fmtBar.style.top = Math.max(6, pr.top - fmtBar.offsetHeight - 6) + 'px';
    }
    var ir = cur.item && document.body.contains(cur.item) && cur.item.getBoundingClientRect();
    itemBar.hidden = !(ir && vis(ir));
    if(!itemBar.hidden){
      // 항목 바로 위 오른쪽(자리가 없으면 항목 안 위쪽) — 사진 단추(사진 아래쪽)와 겹치지 않게
      var ih = itemBar.offsetHeight, above = ir.top - ih - 3;
      itemBar.style.left = Math.max(6, Math.min(ir.right - itemBar.offsetWidth, window.innerWidth - itemBar.offsetWidth - 6)) + 'px';
      itemBar.style.top = (above > 6 ? above : Math.max(6, ir.top + 4)) + 'px';
    }
    var sr = cur.sec && document.body.contains(cur.sec) && cur.sec.getBoundingClientRect();
    secBar.hidden = !(sr && vis(sr));
    if(!secBar.hidden){
      // 구역 바로 위 왼쪽(자리가 없으면 구역 안 위쪽) — 항목 단추(항목 위 오른쪽)와 겹치지 않게
      var sh = secBar.offsetHeight, sabove = sr.top - sh - 3;
      secBar.style.left = Math.max(6, Math.min(sr.left, window.innerWidth - secBar.offsetWidth - 6)) + 'px';
      secBar.style.top = (sabove > 6 ? sabove : Math.max(6, sr.top + 4)) + 'px';
    }
    var el = cur.photo && document.body.contains(cur.photo) ? cur.photo : null, rr = el && el.getBoundingClientRect();
    photoBar.hidden = !(rr && vis(rr));
    if(!photoBar.hidden){
      var isHero = el === heroEl, has = isHero ? true : !!(E.photos[el.getAttribute('data-photo')] || E.local['photo:' + el.getAttribute('data-photo')]);
      photoLabel.textContent = isHero ? '표지 사진' : '사진';
      heroChips.hidden = !isHero;
      photoBar.querySelector('.pri').textContent = has ? '사진 바꾸기' : '사진 넣기';
      // 사진 안 왼쪽 아래(화면 아래 막대 위로). 표지는 분야 목록 · 로고 위로 조금 더 올린다
      var top = Math.min(rr.bottom, window.innerHeight - 70) - photoBar.offsetHeight - (isHero ? 90 : 8);
      top = Math.max(top, rr.top + 8);
      photoBar.style.left = Math.max(6, Math.min(rr.left + 8, window.innerWidth - photoBar.offsetWidth - 6)) + 'px';
      photoBar.style.top = Math.max(6, top) + 'px';
    }
  }
  var raf = 0;
  function later(){ if(!raf) raf = requestAnimationFrame(function(){ raf = 0; place(); }); }
  window.addEventListener('scroll', later, true);
  window.addEventListener('resize', later);

  // 마우스(휴대폰은 누른 곳)가 있는 항목 · 사진 · 더한 구역.
  // 다른 항목으로 가면 바로 바꾸고, 빈 곳으로 나가면 0.9초 기다린 뒤 단추를 숨긴다 — 단추까지 마우스를 옮기는 동안 사라지지 않게.
  // 떠 있는 단추 위에서는 숨기지 않는다
  var SETTERS = { item:setItem, photo:setPhoto, sec:setSec }, hideT = {};
  function want(kind, el){
    if(el){ clearTimeout(hideT[kind]); hideT[kind] = null; SETTERS[kind](el); return; }
    if(!cur[kind] || hideT[kind]) return;
    hideT[kind] = setTimeout(function(){ hideT[kind] = null; SETTERS[kind](null); }, 900);
  }
  function keep(){ Object.keys(hideT).forEach(function(k){ clearTimeout(hideT[k]); hideT[k] = null; }); }
  function hover(ev){
    var t = ev.target;
    if(!t.closest) return;
    if(t.closest('.ed-tool')){ keep(); return; }
    if(t.closest('.ed-ui')) return;
    if(t.closest('#header,#footer,#allmenu')){ want('item', null); want('photo', null); want('sec', null); return; }
    want('item', t.closest('[data-list] > [data-s], [data-xl] > *'));
    var ph = t.closest('[data-photo]');
    if(!ph && heroEl && t.closest('#hero') && !t.closest('[data-ed]')) ph = heroEl;
    want('photo', ph);
    want('sec', t.closest('[data-xs]'));
  }
  document.addEventListener('pointerover', hover);
  document.addEventListener('pointerdown', hover);

  /* ---------- 시작 ---------- */
  function start(){
    document.documentElement.classList.add('ed-on');
    [loginBox, busyEl, toastEl, fmtBar, itemBar, photoBar, secBar, pickBox, bar, fileIn].forEach(function(x){ ui.appendChild(x); });
    document.body.appendChild(ui);
    saveBtn.disabled = true;

    E.token = ss(K.token); E.exp = Number(ss(K.exp)) || 0;
    var ready = (E.token && Date.now() < E.exp) ? Promise.resolve() : relogin();
    ready.then(function(){ return C.ready; }).then(function(){
      busy('편집할 내용을 불러오는 중…');
      return api('list', {}, 60000);
    }).then(function(d){
      E.data = d;
      // 관문의 최신 내용(발행 전 고침 포함)으로 다시 맞춘다
      C.editing = true;
      C.apply((d.pages || {})[C.page], true);
      (d.photos || []).forEach(function(p){ if(p.photos && p.photos[0]) E.photos[p.slot] = { fileId:p.photos[0].fileId, w:p.photos[0].w, h:p.photos[0].h, pos:p.pos }; });
      if(window.Photos) Photos.fill(E.photos, d.photoMode === 'attached');
      if(heroEl && window.__hero) drawHero();
      [].forEach.call(document.querySelectorAll(CELLS), prepare);
      drawAddBars();
      E.base = JSON.stringify(C.collect());
      var meta = (d.pageMeta || {})[C.page];
      stateEl.textContent = meta && meta.updatedAt ? '마지막 저장 ' + meta.updatedAt : '모두 저장됨';
    }, function(e){
      toast(errMsg(e), true);
      stateEl.textContent = '불러오지 못했습니다 — 새로 고쳐 주세요';
    }).then(function(){ busy(null); });
  }
  start();
})();

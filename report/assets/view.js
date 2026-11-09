/* 최종본 열람 — 한예종(열람 계정 또는 열람 코드) · 운영자(로그인 상태). 기본은 문서 보기 */
(async function () {
  'use strict';
  var KR = window.KR, R = window.KRReport, h = KR.h;
  var app = document.getElementById('app');
  var S = { code: sessionStorage.getItem('kr4_vcode') || '', list: [], kind: 'W', key: KR.param('key'), ver: KR.param('ver'), mode: KR.param('mode') || 'doc', cur: null, mt: null, isOp: false, me: null, codeOn: true };
  if (S.key) S.kind = S.key[0];

  // 「최종본 열람」 권한으로 로그인한 상태면 코드 없이
  if (KR.token()) { try { var b = await KR.me(); var pp = b.user.perm || {}; if (pp.view || pp.compile || pp.open || pp.admin) { S.isOp = true; S.me = b; KR.boot = b; } } catch (e) { } }
  if (!S.isOp) { try { S.codeOn = (await KR.call('view.info')).codeOn; } catch (e) { } }

  async function api(action, data) { return KR.call(action, Object.assign({ code: S.code }, data || {})); }

  function codeForm(msg) {
    app.innerHTML = '';
    KR.demoBar();
    if (!S.codeOn) {
      app.appendChild(h('div', { class: 'login single' }, [h('div', { class: 'login-card' }, [h('div', { class: 'eyebrow', text: 'K ARTS GIFTED PROJECT' }), h('h2', { text: '업무보고 열람' }), h('p', { text: '로그인해서 열람합니다.' }), h('a', { class: 'btn primary lg block', href: '#/login?next=view' }, '로그인')])]));
      return;
    }
    var inp = h('input', { class: 'input', type: 'password', placeholder: '열람 코드', autocomplete: 'off', 'aria-label': '열람 코드' });
    var err = h('div', { class: 'err', role: 'alert', text: msg || '' });
    var btn = h('button', { class: 'btn primary lg', style: 'width:100%' }, '열람하기');
    var f = h('form', { class: 'login-card narrow', onsubmit: async function (e) {
      e.preventDefault(); err.textContent = ''; KR.busy(btn, true);
      S.code = inp.value.trim();
      try { await Promise.all([loadList(), R.loadMaster({ code: S.code })]); sessionStorage.setItem('kr4_vcode', S.code); start(); }
      catch (x) { err.textContent = x.message; }
      KR.busy(btn, false);
    } }, [h('div', { class: 'eyebrow', text: 'K ARTS GIFTED PROJECT' }), h('h2', { text: '업무보고 열람' }), h('p', { text: '케이브레인컴퍼니에서 받은 열람 코드를 입력하세요.' }), inp, err, btn, h('a', { class: 'view-link', href: '#/login?next=view' }, '계정이 있으면 로그인 ›'), KR.DEMO ? h('div', { class: 'muted small', style: 'margin-top:10px;text-align:center', text: '체험 모드 열람 코드 · karts-demo' }) : null]);
    app.appendChild(h('div', { class: 'login single' }, [f]));
    inp.focus();
  }
  async function loadList() {
    // 목록과 처음 열 보고서를 한 번에 받음
    var r = await api('view.list', { first: { key: S.key, ver: S.ver, kind: S.kind } });
    S.list = r.list; S.soon = r.soon || [];
    if (r.cur) { DOCS[r.cur.key + '|' + r.cur.ver] = r.cur; if (!S.key || S.key !== r.cur.key) { S.key = r.cur.key; S.kind = r.cur.key[0]; } }
  }
  var DOCS = {};   // 한 번 받은 판은 다시 받지 않음 (판은 바뀌지 않으므로)
  async function getDoc(key, ver) {
    var lv = ver || ((S.list.filter(function (x) { return x.key === key; })[0] || {}).ver) || '';
    if (lv && DOCS[key + '|' + lv]) return DOCS[key + '|' + lv];
    var d = await api('view.get', { key: key, ver: ver });
    DOCS[d.key + '|' + d.ver] = d; return d;
  }
  function canOpen() { return S.isOp && window.KROpen && window.KROpen.can(S.me.user.perm); }
  function soonOf(kind) { return (S.soon || []).filter(function (x) { return x.key[0] === kind; })[0]; }
  function soonLine(x) { return h('p', {}, [h('b', { text: x.title || KR.fromKey(x.key).title }), document.createTextNode('는 ' + window.KROpen.when(x.openAt) + '에 공개됩니다.')]); }

  var shell, listSel, verSel, stage, modeSeg;
  function start() {
    app.innerHTML = '';
    var top = h('header', { class: 'vtop' }, h('div', { class: 'in' }, [
      h('a', { class: 'brand', href: S.isOp ? KR.homeOf(S.me.user.perm) : '#/view' }, [h('span', { class: 'mark', 'aria-hidden': 'true' }), h('span', { text: 'K예술영재 업무보고' })]),
      h('div', { class: 'seg kind', role: 'tablist' }, [['W', '주간'], ['M', '월간']].map(function (k) { return h('button', { class: S.kind === k[0] ? 'on' : '', onclick: function () { S.kind = k[0]; S.key = ''; S.ver = ''; fillList(); open(); } }, k[1]); })),
      listSel = h('select', { class: 'input sel', 'aria-label': '보고서 고르기', onchange: function () { S.key = listSel.value; S.ver = ''; open(); } }),
      verSel = h('select', { class: 'input sel ver', 'aria-label': '판 고르기', onchange: function () { S.ver = verSel.value; open(); } }),
      h('span', { class: 'spacer' }),
      modeSeg = h('div', { class: 'seg' }, [['doc', '문서 보기'], ['meet', '회의 화면']].map(function (m) { return h('button', { 'data-m': m[0], class: S.mode === m[0] ? 'on' : '', onclick: function () { S.mode = m[0]; syncUrl(); render(); } }, m[1]); })),
      h('button', { class: 'btn-ghost-w', onclick: function () { if (S.cur) R.print(S.cur.doc); } }, '인쇄·PDF'),
      h('button', { class: 'btn-ghost-w', onclick: function () { if (S.cur) R.hwpx(S.cur.doc, S.cur.ver).catch(function (e) { KR.toast(e.message, true); }); } }, '한글 파일 받기'),
      S.isOp ? backLink() : h('button', { class: 'btn-ghost-w', onclick: function () { sessionStorage.removeItem('kr4_vcode'); location.reload(); } }, '나가기')
    ]));
    document.body.insertBefore(top, document.body.firstChild);
    KR.demoBar(top);
    stage = h('div', { class: 'vstage' });
    app.appendChild(stage);
    fillList(); open();
  }
  function fillList() {
    Array.prototype.forEach.call(document.querySelectorAll('.seg.kind button'), function (bt, i) { bt.classList.toggle('on', (i === 0 ? 'W' : 'M') === S.kind); });
    var list = S.list.filter(function (x) { return x.key[0] === S.kind; });
    listSel.innerHTML = '';
    list.forEach(function (x) { var w = KR.fromKey(x.key); listSel.appendChild(h('option', { value: x.key, text: x.title || w.title, selected: x.key === S.key })); });
    if (!S.key && list.length) S.key = list[0].key;
    listSel.hidden = !list.length; verSel.hidden = !list.length;
  }
  function syncUrl() { KR.setParams({ key: S.key, ver: S.ver, mode: S.mode === 'doc' ? '' : S.mode }); }
  function backLink() {
    var p = S.me.user.perm;
    if (p.compile) return h('a', { class: 'btn-ghost-w', href: '#/hub' }, '취합으로');
    if (p.write) return h('a', { class: 'btn-ghost-w', href: '#/write' }, '작성으로');
    return h('button', { class: 'btn-ghost-w', onclick: async function () { try { await KR.call('logout'); } catch (e) { } sessionStorage.removeItem('kr4_token'); KR.go('#/login'); } }, '로그아웃');
  }
  async function open() {
    if (S.mt) { S.mt.destroy(); S.mt = null; }
    if (!S.key || !S.list.some(function (x) { return x.key === S.key; })) {
      S.cur = null; stage.innerHTML = '';
      var sn = soonOf(S.kind);
      stage.appendChild(h('div', { class: 'empty-state' }, [h('div', { class: 'es-ic', text: S.kind === 'M' ? '▦' : '◎' }),
        h('h3', { text: sn ? (sn.title || KR.fromKey(sn.key).title) + ' 공개 예정' : S.kind === 'M' ? '월간 보고서가 아직 공개되지 않았습니다' : '주간 보고서가 아직 공유되지 않았습니다' }),
        h('p', { text: sn ? window.KROpen.when(sn.openAt) + '부터 이곳에서 볼 수 있습니다.' : '케이브레인컴퍼니에서 ' + (S.kind === 'M' ? '공개' : '공유') + '하면 이곳에 나타납니다.' })]));
      return;
    }
    stage.innerHTML = '<div class="loading">불러오는 중…</div>';
    try { S.cur = await getDoc(S.key, S.ver); }
    catch (e) { stage.innerHTML = ''; stage.appendChild(h('div', { class: 'notice warn', text: e.message })); return; }
    verSel.innerHTML = '';
    S.cur.versions.slice().reverse().forEach(function (v, i) { verSel.appendChild(h('option', { value: v.ver, text: 'v' + v.ver + (i === 0 ? ' (최신)' : '') + ' · ' + KR.fmtTime(v.at) + (v.memo ? ' · ' + v.memo : ''), selected: v.ver === S.cur.ver })); });
    syncUrl(); render();
  }
  function render() {
    Array.prototype.forEach.call(modeSeg.children, function (bt) { bt.classList.toggle('on', bt.getAttribute('data-m') === S.mode); });
    if (S.mt) { S.mt.destroy(); S.mt = null; }
    stage.innerHTML = '';
    if (!S.cur) return;
    var doc = S.cur.doc;
    document.title = doc.title + ' · K예술영재 프로젝트';
    if (S.mode === 'meet') { S.mt = R.meeting(function () { return doc; }); stage.appendChild(S.mt.el); stage.classList.add('is-meet'); }
    else {
      stage.classList.remove('is-meet');
      var sch = R.docSchedule(doc), sn = soonOf(S.kind);
      if (canOpen()) stage.appendChild(h('div', { class: 'openstrip' }, [window.KROpen.panel(S.key, { dark: true })]));
      else if (sn && sn.key > S.key) stage.appendChild(h('div', { class: 'v-soon' }, [soonLine(sn)]));
      stage.appendChild(h('div', { class: 'docwrap' }, [
        h('div', { class: 'paper big' }, [R.docEl(doc)]),
        sch.length ? h('section', { class: 'paper sched' }, [h('h2', { text: '다가오는 일정' }), R.agendaEl(sch)]) : null
      ]));
    }
  }

  if (S.isOp) { try { await Promise.all([loadList(), R.loadMaster()]); start(); } catch (e) { codeForm(e.message); } }
  else if (S.code) { try { await Promise.all([loadList(), R.loadMaster({ code: S.code })]); start(); } catch (e) { sessionStorage.removeItem('kr4_vcode'); codeForm(e.code === 'code' ? '' : e.message); } }
  else codeForm();
})();

/* 로그인 화면 */
(function () {
  'use strict';
  var KR = window.KR, h = KR.h;
  var app = document.getElementById('app');
  var next = KR.param('next');
  var name = h('input', { class: 'input', id: 'name', name: 'username', autocomplete: 'username', required: true, 'aria-label': '이름', placeholder: '이름' });
  var pw = h('input', { class: 'input', id: 'pw', type: 'password', name: 'password', autocomplete: 'current-password', required: true, 'aria-label': '비밀번호', placeholder: '비밀번호' });
  var err = h('div', { class: 'err', role: 'alert' });
  var go = h('button', { class: 'btn primary lg block', id: 'go' }, '들어가기');
  var demoBox = h('div');
  var form = h('form', { class: 'login-card', id: 'f', autocomplete: 'on' }, [
    h('h2', { text: '로그인' }),
    h('p', { text: '이름과 본인 비밀번호로 들어갑니다. 계정은 케이브레인 관리자가 만들어 드립니다.' }),
    name, pw, err, go,
    h('a', { class: 'view-link', href: '#/view' }, '한예종 담당자이신가요? 열람 코드로 보기 ›'),
    demoBox
  ]);
  app.appendChild(h('div', { class: 'login' }, [
    h('section', { class: 'login-hero' }, [
      h('div', { class: 'eyebrow', text: 'K ARTS GIFTED PROJECT' }),
      h('h1', { class: 'display' }, ['업무보고.', h('br'), h('span', { class: 'grad', text: '한 장으로.' })]),
      h('p', { class: 'lede', text: '업체별로 쓰고, 케이브레인이 모으고, 한예종과 함께 봅니다.' }),
      h('ol', { class: 'flow' }, [
        h('li', {}, [h('b', { text: '01' }), h('span', { text: '분야별 작성' })]),
        h('li', {}, [h('b', { text: '02' }), h('span', { text: '취합·정리' })]),
        h('li', {}, [h('b', { text: '03' }), h('span', { text: '회의 화면 공유' })])
      ])
    ]),
    form
  ]));
  KR.demoBar();
  function goHome(b) {
    var p = b.user.perm || {}, ok = { write: p.write, hub: p.compile, view: p.view || p.compile || p.open || p.admin, admin: p.admin };
    KR.go(next && ok[next] ? '#/' + next : KR.homeOf(p));
  }
  async function after(b) {
    if (b.user.mustChange) { var ok = await KR.passwordModal(true); if (!ok) return; }
    goHome(b);
  }
  if (KR.DEMO) {
    var box = h('div', { class: 'demo-accounts' }, [h('div', { class: 'da-h', text: '체험 계정 · 비밀번호 demo1234' })]);
    [['박종현', '케이브레인 · 관리자·취합'], ['김레이', '레이아웃 · 대표(업체 작성분 관리)'], ['이레이', '레이아웃 · 작성'], ['박엠비', 'MBC C&I · 홍보 분야만 작성'], ['한열람', '한예종 · 최종본 열람']].forEach(function (a) {
      box.appendChild(h('button', { type: 'button', onclick: function () { name.value = a[0]; pw.value = 'demo1234'; form.requestSubmit(); } }, [h('b', { text: a[0] }), h('span', { text: a[1] })]));
    });
    box.appendChild(h('div', { class: 'da-h', text: '한예종 열람 코드 · karts-demo' }));
    demoBox.appendChild(box);
  }
  if (KR.token()) KR.me().then(after).catch(function () { sessionStorage.removeItem('kr4_token'); });
  else KR.call('ping').catch(function () { });   // 이름·비밀번호를 치는 동안 서버를 미리 깨움
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); err.textContent = '';
    if (/[\u3131-\u318E\uAC00-\uD7A3]/.test(pw.value)) { err.textContent = '비밀번호가 한글로 입력됐습니다. 한/영 키를 눌러 영문으로 바꾼 뒤 다시 입력하세요.'; pw.value = ''; pw.focus(); return; }
    KR.busy(go, true);
    try {
      var b = await KR.call('login', { name: name.value.trim(), password: pw.value });
      sessionStorage.setItem('kr4_token', b.token);
      KR.meSave(b);
      await after(b);
    } catch (x) { err.textContent = x.message; }
    KR.busy(go, false);
  });
  // Caps Lock이 켜져 있으면 미리 알려 줌
  pw.addEventListener('keyup', function (e) { if (e.getModifierState) err.textContent = e.getModifierState('CapsLock') ? 'Caps Lock이 켜져 있습니다.' : (err.textContent === 'Caps Lock이 켜져 있습니다.' ? '' : err.textContent); });
  name.focus();
})();

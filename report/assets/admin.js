/* 관리자 화면 — 사람 · 주체별 권한 · 열람·설정 · 접속 기록
 * 권한 판단은 서버(Code.gs)가 요청마다 한다. 이 화면은 설정을 보여 주고 바꾸는 역할만 한다. */
(async function () {
  'use strict';
  var KR = window.KR, R = window.KRReport, h = KR.h;
  var b = await KR.requireLogin('admin');
  KR.topbar(b, 'admin');
  var app = document.getElementById('app');
  app.innerHTML = ''; app.className = 'wrap';
  var PERMS = KR.PERMS, L = KR.PERM_LABEL, D = KR.PERM_DESC;
  var TABS = [['people', '사람'], ['orgs', '주체별 권한'], ['settings', '열람·설정'], ['logs', '접속 기록']];
  var S = { tab: TABS.some(function (t) { return t[0] === KR.param('tab'); }) ? KR.param('tab') : 'people', data: null };

  var head = h('div', { class: 'page-head' }, [h('div', { class: 'eyebrow', text: '관리자' }), h('h1', { text: '접속 권한 관리' }), h('p', { class: 'lede-s', text: '주체(업체)마다 기본 권한을 정하고, 사람마다 필요한 것만 예외로 바꿉니다.' })]);
  var tabsBox = h('nav', { class: 'tabs', role: 'tablist' }), main = h('div', { class: 'adm-main' });
  app.appendChild(head); app.appendChild(tabsBox); app.appendChild(main);
  function drawTabs() {
    tabsBox.innerHTML = '';
    TABS.forEach(function (t) { tabsBox.appendChild(h('button', { role: 'tab', 'aria-selected': S.tab === t[0] ? 'true' : 'false', class: S.tab === t[0] ? 'on' : '', onclick: function () { S.tab = t[0]; KR.setParams({ tab: t[0] }); drawTabs(); show(); } }, t[1])); });
  }
  async function load() { S.data = await KR.call('admin.data'); }
  async function show() {
    main.innerHTML = '<div class="loading">불러오는 중…</div>';
    try {
      if (S.tab !== 'logs' && !S.data) await load();
      main.innerHTML = '';
      ({ people: people, orgs: orgs, settings: settings, logs: logs })[S.tab]();
    } catch (e) { main.innerHTML = ''; main.appendChild(h('div', { class: 'notice warn', text: e.message })); }
  }

  /* ---------- 공용 부품 ---------- */
  function sw(on, onchange, label) {
    var el = h('button', { type: 'button', class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label || '' }, h('i'));
    el.addEventListener('click', function () { on = !on; el.classList.toggle('on', on); el.setAttribute('aria-checked', on ? 'true' : 'false'); onchange(on); });
    return el;
  }
  function catChips(sel, onchange, disabled) {
    var box = h('div', { class: 'cat-chips' + (disabled ? ' dis' : '') });
    KR.CATS.forEach(function (_, i) {
      var on = sel.indexOf(i) >= 0;
      box.appendChild(h('button', { type: 'button', class: 'cchip' + (on ? ' on' : ''), style: '--c2:' + R.CAT_C[i][1], disabled: disabled, 'aria-pressed': on ? 'true' : 'false', onclick: function (e) {
        var k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else sel.push(i); sel.sort();
        e.currentTarget.classList.toggle('on', sel.indexOf(i) >= 0); e.currentTarget.setAttribute('aria-pressed', sel.indexOf(i) >= 0 ? 'true' : 'false'); onchange(sel);
      } }, [h('i'), KR.CAT_SHORT[i]]));
    });
    return box;
  }
  function orgOf(name) { return S.data.orgs.filter(function (o) { return o.name === name; })[0] || { perm: {} }; }
  function permChips(u) {
    var box = h('div', { class: 'pchips' });
    PERMS.forEach(function (k) {
      var on = !!u.perm[k], own = u.own && u.own[k] != null;
      box.appendChild(h('span', { class: 'pchip' + (on ? ' on' : '') + (own ? ' own' : ''), title: (own ? '개인 예외 · ' : '주체 기본 · ') + L[k] + (on ? ' 허용' : ' 없음') }, L[k]));
    });
    if (u.perm.write) {
      var n = u.perm.cats.length;
      box.appendChild(h('span', { class: 'pchip cats' + (u.own && u.own.cats ? ' own' : ''), title: u.perm.cats.map(function (i) { return KR.CAT_SHORT[i]; }).join(', ') }, n === 5 ? '모든 분야' : u.perm.cats.map(function (i) { return KR.CAT_SHORT[i]; }).join('·')));
    }
    return box;
  }

  /* ---------- 사람 ---------- */
  function people() {
    var users = S.data.users;
    main.appendChild(h('div', { class: 'sec-head' }, [
      h('div', {}, [h('h2', { text: '사람' }), h('p', { class: 'muted', text: '검은 칩은 허용된 권한, 주황 점이 붙은 칩은 그 사람에게만 따로 정한 예외입니다.' })]),
      h('button', { class: 'btn primary', onclick: function () { personModal(null); } }, '＋ 사람 추가')
    ]));
    S.data.orgs.forEach(function (o) {
      var list = users.filter(function (u) { return u.company === o.name; });
      var defaults = PERMS.filter(function (k) { return o.perm[k]; }).map(function (k) { return L[k]; });
      main.appendChild(h('section', { class: 'card org-people' }, [
        h('header', {}, [h('h3', { text: o.name }), h('span', { class: 'muted small', text: list.filter(function (u) { return u.status !== '중지'; }).length + '명 · 기본 권한: ' + (defaults.length ? defaults.join(', ') : '없음') })]),
        list.length ? h('div', { class: 'plist' }, list.map(function (u) {
          return h('div', { class: 'prow' + (u.status === '중지' ? ' off' : '') }, [
            h('div', { class: 'pname' }, [h('b', { text: u.name }), u.status === '중지' ? h('span', { class: 'tag gray', text: '중지' }) : u.temp ? (viewOnly(u.perm) ? h('span', { class: 'tag gray', text: '열람 전용 · 기본 비밀번호' }) : h('span', { class: 'tag amber', text: '첫 로그인 전' })) : null, h('small', { text: u.lastLogin ? '최근 접속 ' + KR.fmtTime(u.lastLogin) : '접속 기록 없음' })]),
            permChips(u),
            h('div', { class: 'pacts' }, [
              h('button', { class: 'btn sm', onclick: function () { personModal(u); } }, '권한·정보'),
              h('button', { class: 'btn sm ghost', onclick: async function () {
                if (!(await KR.confirm(u.name + '님의 비밀번호를 기본 비밀번호로 초기화할까요? 다음 로그인 때 본인 비밀번호로 다시 정하게 됩니다.', '초기화'))) return;
                try { var r = await KR.call('user.reset', { id: u.id }); await load(); show(); showTemp(u.name, r.temp, true, u.perm); } catch (e) { KR.toast(e.message, true); }
              } }, '비밀번호 초기화')
            ])
          ]);
        })) : h('p', { class: 'muted small pad', text: '등록된 사람이 없습니다' })
      ]));
    });
  }
  function personModal(u) {
    var isNew = !u;
    u = u || { name: '', company: S.data.orgs[0].name, status: '활성', own: {} };
    var own = JSON.parse(JSON.stringify(u.own || {}));
    var name = h('input', { class: 'input', value: u.name, placeholder: '로그인할 때 쓰는 이름' });
    var org = h('select', { class: 'input' }, S.data.orgs.map(function (o) { return h('option', { value: o.name, text: o.name, selected: o.name === u.company }); }));
    var active = u.status !== '중지';
    var rowsBox = h('div', { class: 'perm-rows' });
    function drawRows() {
      rowsBox.innerHTML = '';
      var base = orgOf(org.value).perm;
      PERMS.forEach(function (k) {
        var val = own[k] == null ? 'inh' : own[k] ? 'on' : 'off';
        var seg = h('div', { class: 'seg3', role: 'radiogroup', 'aria-label': L[k] }, [['inh', '주체 기본 · ' + (base[k] ? '허용' : '없음')], ['on', '허용'], ['off', '차단']].map(function (x) {
          return h('button', { type: 'button', role: 'radio', 'aria-checked': val === x[0] ? 'true' : 'false', class: val === x[0] ? 'on' : '', onclick: function () { if (x[0] === 'inh') delete own[k]; else own[k] = x[0] === 'on'; drawRows(); } }, x[1]);
        }));
        rowsBox.appendChild(h('div', { class: 'perm-row' }, [h('div', {}, [h('b', { text: L[k] }), h('small', { text: D[k] })]), seg]));
      });
      var writeOn = own.write != null ? own.write : base.write;
      var catsCustom = Array.isArray(own.cats);
      var catBox = h('div', { class: 'perm-row col' }, [
        h('div', {}, [h('b', { text: '작성 분야' }), h('small', { text: '이 사람이 작성 단계에서 볼 수 있는 분야' })]),
        h('div', { class: 'seg3' }, [['inh', '주체 기본 · ' + (base.cats || []).length + '개'], ['custom', '직접 고르기']].map(function (x) {
          return h('button', { type: 'button', class: (catsCustom ? 'custom' : 'inh') === x[0] ? 'on' : '', onclick: function () { if (x[0] === 'inh') delete own.cats; else own.cats = (base.cats || [0, 1, 2, 3, 4]).slice(); drawRows(); } }, x[1]);
        })),
        catsCustom ? catChips(own.cats, function () { }) : null
      ]);
      if (!writeOn) catBox.classList.add('dim');
      rowsBox.appendChild(catBox);
    }
    org.addEventListener('change', drawRows);
    drawRows();
    var m = KR.modal(isNew ? '사람 추가' : u.name + ' · 권한과 정보', [
      h('div', { class: 'grid2' }, [h('label', { class: 'field' }, [h('span', { text: '이름' }), name]), h('label', { class: 'field' }, [h('span', { text: '소속 주체' }), org])]),
      isNew ? null : h('div', { class: 'perm-row' }, [h('div', {}, [h('b', { text: '계정 사용' }), h('small', { text: '끄면 로그인할 수 없습니다' })]), sw(active, function (v) { active = v; }, '계정 사용')]),
      h('h4', { class: 'mh', text: '권한' }),
      rowsBox
    ], [
      h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); } }),
      h('button', { class: 'btn primary', text: isNew ? '추가' : '저장', onclick: async function (e) {
        KR.busy(e.target, true);
        try {
          var r = await KR.call('user.save', { user: { id: isNew ? '' : u.id, name: name.value, company: org.value, status: active ? '활성' : '중지', own: own } });
          m.close(); await load(); show();
          if (r.temp) showTemp(r.user.name, r.temp, false, r.user.perm); else KR.toast('저장했습니다');
        } catch (x) { KR.toast(x.message, true); }
        KR.busy(e.target, false);
      } })
    ], { wide: true });
  }
  /** 기본 비밀번호 안내 (비밀번호 값은 서버가 돌려준 것을 그대로 씀 — 화면 코드에는 두지 않음) */
  /** 열람만 하는 계정은 기본 비밀번호를 그대로 씀(관문도 같은 기준으로 판단) */
  function viewOnly(p) { return !!(p && p.view && !p.write && !p.team && !p.compile && !p.share && !p.admin && !p.open); }
  function showTemp(name, pw, isReset, perm) {
    var vo = viewOnly(perm);
    var text = '[K예술영재 업무보고]\n주소: ' + KR.baseUrl() + '\n이름: ' + name + '\n비밀번호: ' + pw + (vo ? '\n공유된 최종본을 문서·회의 화면으로 보고, 인쇄·PDF와 한글 파일로 받을 수 있습니다.' : '\n처음 들어가면 본인 비밀번호로 바꿔 주세요.');
    var m = KR.modal(isReset ? '기본 비밀번호로 초기화했습니다' : '사람을 추가했습니다', [
      h('p', { style: 'margin:0 0 12px', text: vo ? name + ' 계정은 열람 전용이라 기본 비밀번호를 그대로 씁니다(바꾸지 않아도 됨). 필요하면 아래 안내문을 보내 주세요.' : name + '님은 기본 비밀번호로 들어가 바로 본인 비밀번호를 정하게 됩니다. 필요하면 아래 안내문을 보내 주세요.' }),
      h('pre', { class: 'temp', text: text })
    ], [h('button', { class: 'btn', text: '닫기', onclick: function () { m.close(); } }), h('button', { class: 'btn primary', text: '안내문 복사', onclick: function () { KR.copy(text); } })]);
  }

  /* ---------- 주체별 권한 ---------- */
  function orgs() {
    var list = S.data.orgs.map(function (o) { return { name: o.name, from: o.name, perm: JSON.parse(JSON.stringify(o.perm)), note: o.note || '' }; });
    var dirty = false, bar = h('div', { class: 'savebar' }), grid = h('div', { class: 'org-grid' });
    function mark() { dirty = true; drawBar(); }
    function drawBar() {
      bar.innerHTML = '';
      bar.classList.toggle('show', dirty);
      bar.appendChild(h('span', { text: dirty ? '바꾼 내용이 있습니다' : '' }));
      bar.appendChild(h('button', { class: 'btn', onclick: function () { S.tab = 'orgs'; show(); } }, '되돌리기'));
      bar.appendChild(h('button', { class: 'btn primary', onclick: async function (e) {
        KR.busy(e.target, true);
        try { await KR.call('orgs.save', { orgs: list }); await load(); KR.toast('주체별 권한을 저장했습니다'); show(); }
        catch (x) { KR.toast(x.message, true); }
        KR.busy(e.target, false);
      } }, '저장'));
    }
    function draw() {
      grid.innerHTML = '';
      list.forEach(function (o, idx) {
        var count = S.data.users.filter(function (u) { return u.company === o.from; }).length;
        var nm = h('input', { class: 'org-name', value: o.name, 'aria-label': '주체 이름', oninput: function () { o.name = nm.value; mark(); } });
        grid.appendChild(h('section', { class: 'card org-card' }, [
          h('header', {}, [nm, h('span', { class: 'muted small', text: count + '명' }), h('span', { class: 'spacer' }),
            h('button', { class: 'icon-btn', title: '앞으로', 'aria-label': '앞으로', disabled: idx === 0, onclick: function () { list.splice(idx - 1, 0, list.splice(idx, 1)[0]); mark(); draw(); } }, '↑'),
            h('button', { class: 'icon-btn', title: '뒤로', 'aria-label': '뒤로', disabled: idx === list.length - 1, onclick: function () { list.splice(idx + 1, 0, list.splice(idx, 1)[0]); mark(); draw(); } }, '↓'),
            h('button', { class: 'icon-btn danger', title: count ? '소속된 사람이 있으면 지울 수 없습니다' : '지우기', 'aria-label': '지우기', disabled: !!count, onclick: function () { list.splice(idx, 1); mark(); draw(); } }, '✕')
          ]),
          h('div', { class: 'org-perms' }, PERMS.map(function (k) {
            return h('div', { class: 'perm-row' }, [h('div', {}, [h('b', { text: L[k] }), h('small', { text: D[k] })]), sw(!!o.perm[k], function (v) { o.perm[k] = v; mark(); }, L[k])]);
          }).concat([h('div', { class: 'perm-row col' }, [h('div', {}, [h('b', { text: '작성 분야' }), h('small', { text: '이 주체 사람들이 기본으로 작성하는 분야' })]), catChips(o.perm.cats || (o.perm.cats = [0, 1, 2, 3, 4]), function () { mark(); })])]))
        ]));
      });
      grid.appendChild(h('button', { class: 'card add-org', onclick: function () { list.push({ name: '새 주체', from: '', perm: { write: true, team: false, view: true, compile: false, share: false, admin: false, cats: [0, 1, 2, 3, 4] }, note: '' }); mark(); draw(); } }, [h('b', { text: '＋' }), '주체 추가']));
    }
    main.appendChild(h('div', { class: 'sec-head' }, [h('div', {}, [h('h2', { text: '주체별 기본 권한' }), h('p', { class: 'muted', text: '여기서 정한 값이 그 주체 사람 모두에게 적용됩니다. 순서는 취합할 때 보고서에 모이는 순서이기도 합니다.' })])]));
    main.appendChild(grid); main.appendChild(bar);
    draw(); drawBar();
  }

  /* ---------- 열람·설정 ---------- */
  function settings() {
    var st = S.data.settings, on = st.viewCodeOn;
    var code = h('input', { class: 'input mono', value: st.viewCode });
    var due = h('input', { class: 'input', value: st.writeDue || '', placeholder: '예: 금요일 12:00' });
    var url = KR.baseUrl() + '#/view';
    main.appendChild(h('div', { class: 'settings' }, [
      h('section', { class: 'card set-card' }, [
        h('h3', { text: '한예종 열람' }),
        h('p', { class: 'muted', text: '열람 코드를 켜 두면 로그인 없이 코드만으로 공유된 최종본을 봅니다. 끄면 「최종본 열람」 권한이 있는 계정으로 로그인해야 합니다.' }),
        h('div', { class: 'copyrow' }, [h('code', { text: url }), h('button', { class: 'btn sm', onclick: function () { KR.copy(url); } }, '복사')]),
        h('div', { class: 'perm-row' }, [h('div', {}, [h('b', { text: '열람 코드 사용' }), h('small', { text: '코드를 바꾸면 이전 코드는 바로 막힙니다' })]), sw(on, function (v) { on = v; })]),
        h('label', { class: 'field' }, [h('span', { text: '열람 코드 (6자 이상)' }), h('div', { class: 'row' }, [code, h('button', { class: 'btn sm', onclick: function () { var c = 'abcdefghjkmnpqrstuvwxyz23456789', s = 'karts-'; for (var i = 0; i < 4; i++) s += c.charAt(Math.floor(Math.random() * c.length)); code.value = s; } }, '새로 만들기')])])
      ]),
      h('section', { class: 'card set-card' }, [
        h('h3', { text: '공개 시점' }),
        h('p', { class: 'muted', text: '공유한 주간·월간 보고서가 주체별로 언제부터 보일지 정합니다. 기본 규칙은 여기서, 보고서 하나만 다르게 할 때는 취합 화면 옆 「주체별 공개 시점」이나 최종본 화면 위에서 바꿉니다.' }),
        h('p', { class: 'muted small', text: '관리자와 「공개 시점 설정」 권한이 있는 사람이 바꿀 수 있습니다. 권한은 「사람」 탭에서 개인별로 줍니다.' }),
        h('div', { class: 'row' }, [h('button', { class: 'btn', onclick: function () { window.KROpen.rules(); } }, '기본 규칙 정하기')])
      ]),
      h('section', { class: 'card set-card' }, [
        h('h3', { text: 'AI 문장 정리' }),
        h('p', { class: 'muted', text: st.ai ? '사용 중입니다. 취합 화면의 「✦ 문장 정리」와 월간 초안 만들기에서 Gemini가 실적·계획 문장으로 다듬습니다.' : '꺼져 있습니다. Apps Script → 프로젝트 설정 → 스크립트 속성에 GEMINI_API_KEY를 넣으면 켜집니다. 그 전에는 공백·중복만 정리하는 기본 정리가 동작합니다.' }),
        h('p', { class: 'muted small', text: '무료 등급은 구글이 입력·출력을 서비스 개선에 쓸 수 있습니다. 학생 이름·연락처 같은 개인정보는 보고 내용에 쓰지 않도록 안내해 주세요.' })
      ]),
      h('section', { class: 'card set-card' }, [
        h('h3', { text: '작성' }),
        h('label', { class: 'field' }, [h('span', { text: '작성 마감 (작성 화면에 표시)' }), due]),
        h('p', { class: 'muted small', text: '주체 목록과 순서는 「주체별 권한」 탭에서 바꿉니다.' })
      ]),
      h('div', { class: 'set-save' }, [h('button', { class: 'btn primary', onclick: async function (e) {
        KR.busy(e.target, true);
        try { S.data.settings = await KR.call('settings.save', { viewCode: code.value, viewCodeOn: on, writeDue: due.value }); KR.toast('설정을 저장했습니다'); }
        catch (x) { KR.toast(x.message, true); }
        KR.busy(e.target, false);
      } }, '설정 저장')])
    ]));
  }

  /* ---------- 접속 기록 ---------- */
  async function logs() {
    var r = await KR.call('logs');
    var q = h('input', { class: 'input', placeholder: '이름·행동으로 찾기', style: 'max-width:280px' });
    var box = h('div', { class: 'card logs' });
    function draw() {
      var k = q.value.trim();
      box.innerHTML = '';
      var list = r.logs.filter(function (x) { return !k || (x.user + x.action + x.target).indexOf(k) >= 0; });
      if (!list.length) { box.appendChild(h('p', { class: 'muted pad', text: '기록이 없습니다' })); return; }
      box.appendChild(h('table', { class: 'dtable' }, [
        h('thead', {}, h('tr', {}, ['시각', '사람', '행동', '대상'].map(function (x) { return h('th', { text: x }); }))),
        h('tbody', {}, list.slice(0, 200).map(function (x) { return h('tr', {}, [h('td', { class: 'nowrap', text: KR.fmtTime(x.at) }), h('td', { text: x.user }), h('td', {}, [h('span', { class: 'tag', text: x.action })]), h('td', { class: 'muted', text: x.target })]); }))
      ]));
    }
    q.addEventListener('input', draw);
    main.appendChild(h('div', { class: 'sec-head' }, [h('div', {}, [h('h2', { text: '접속 기록' }), h('p', { class: 'muted', text: '로그인, 제출, 공유, 권한 변경 기록 (최근 300건)' })]), q]));
    main.appendChild(box); draw();
  }

  drawTabs(); show();
})();

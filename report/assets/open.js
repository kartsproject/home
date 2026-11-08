/* 공개 시점 — 공유본을 주체별로 언제부터 보여 줄지 정함 (관리자 · 「공개 시점 설정」 권한)
 * 실제로 막는 것은 서버(view.list · view.get)이고, 이 화면은 정하고 보여 주기만 한다 */
(function (root) {
  'use strict';
  var KR = root.KR, h = KR.h;
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var RULE_W = [['now', '공유하는 즉시'], ['fri', '보고일 (실적 주 금요일)'], ['mon', '대면보고일 (다음 주 월요일)'], ['tue', '다음 주 화요일']];
  var RULE_M = [['hold', '비공개 (작성자가 공개할 때까지)'], ['now', '공유하는 즉시'], ['due', '보고일 (말일 · 주말이면 앞 평일)'], ['first', '다음 달 1일'], ['firstwd', '다음 달 첫 평일']];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function when(iso) { if (!iso) return ''; var d = new Date(iso); return (d.getMonth() + 1) + '. ' + d.getDate() + '.(' + WD[d.getDay()] + ') ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function local(iso) { var d = iso ? new Date(iso) : new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function titleOf(it) { return it.title || KR.fromKey(it.key).title; }
  function ruleName(key, r) {
    var isM = key[0] === 'M', list = isM ? RULE_M : RULE_W, mode = isM ? r.m : r.w;
    var n = (list.filter(function (x) { return x[0] === mode; })[0] || list[0])[1];
    return mode === 'now' || mode === 'hold' ? n.replace(/ \(.*\)$/, '') : n.replace(/ \(.*\)$/, '') + ' ' + (isM ? r.mt : r.wt);
  }

  /** 한 주체의 상태 → [알약 종류, 글] */
  function stateOf(it, s) {
    if (s.hold) return ['none', '비공개'];
    if (!it.ver) return ['none', s.at ? '공유 후 ' + when(s.at) + '부터' : '공유하면 바로'];
    if (s.open) return ['ok', s.at ? '공개 중 · ' + when(s.at) + '부터' : '공개 중'];
    return ['run', when(s.at) + ' 공개 예정'];
  }
  function srcOf(s) { return s.mode === 'rule' ? '기본 규칙' : '따로 정함'; }

  async function load(key) { var r = await KR.call('open.get', { keys: key ? [key] : [] }); return r; }
  function itemOf(r, key) { return r.items.filter(function (x) { return x.key === key; })[0]; }

  /** 상태 카드 (취합 화면 옆 · 열람 화면 위) — opts.dark: 어두운 바탕 */
  function panel(key, opts) {
    opts = opts || {};
    var box = h('section', { class: 'openbox' + (opts.dark ? ' dark' : '') }, [h('div', { class: 'loading sm', text: '공개 시점 불러오는 중…' })]);
    function draw(r) {
      box.innerHTML = '';
      var it = itemOf(r, key);
      box.appendChild(h('div', { class: 'ob-h' }, [
        h('h3', { text: '주체별 공개 시점' }),
        h('button', { class: 'btn sm', onclick: function () { editor(key, { data: r, done: draw, reload: reload }); } }, '바꾸기')
      ]));
      if (!r.targets.length) { box.appendChild(h('p', { class: 'muted small', text: '공개 시점을 정할 주체가 없습니다. 취합 권한이 없는 주체만 대상입니다.' })); return; }
      if (key[0] === 'M') box.appendChild(pubSwitch(key, r, it, draw));
      box.appendChild(h('ul', { class: 'ob-list' }, r.targets.map(function (o) {
        var s = it.st[o], k = stateOf(it, s);
        return h('li', {}, [
          h('b', { text: o }),
          h('span', { class: 'status-pill sm ' + k[0], text: k[1] }),
          h('small', { text: srcOf(s) })
        ]);
      })));
      if (r.codeOn) box.appendChild(h('p', { class: 'ob-note', text: r.codeOrg ? '열람 코드로 들어오면 ' + r.codeOrg + '과 같은 시점에 보입니다.' : '열람 코드로 들어오면 모든 주체에 열린 뒤에 보입니다.' }));
    }
    function reload() { load(key).then(draw).catch(function (e) { box.innerHTML = ''; box.appendChild(h('p', { class: 'muted small', text: e.message })); }); }
    reload();
    box.reload = reload;
    return box;
  }

  /** 월간: 작성을 마친 뒤 한 번에 공개 · 비공개 (기본은 비공개) */
  function pubSwitch(key, r, it, draw) {
    var sts = r.targets.map(function (o) { return it.st[o]; });
    var pub = sts.filter(function (s) { return !s.hold && (s.open || s.mode === 'now'); }).length;
    var state = pub === sts.length ? 'on' : pub ? 'part' : 'off';
    async function set(v, btn) {
      var over = {}; r.targets.forEach(function (o) { over[o] = v; });
      KR.busy(btn, true);
      try { draw(await KR.call('open.save', { key: key, over: over })); KR.toast(v === 'now' ? '다른 주체에 공개했습니다' : '비공개로 돌렸습니다'); }
      catch (e) { KR.toast(e.message, true); KR.busy(btn, false); }
    }
    return h('div', { class: 'ob-pub ' + state }, [
      h('div', { class: 'ob-pub-t' }, [
        h('b', { text: state === 'on' ? '공개 중' : state === 'part' ? '일부 주체에만 공개' : '비공개' }),
        h('small', { text: !it.ver ? '작성을 마치고 공유본을 올린 뒤 공개할 수 있습니다' : state === 'on' ? '모든 주체가 이 월간보고를 봅니다' : '취합 담당만 봅니다. 공개하면 다른 주체도 봅니다' })
      ]),
      state !== 'on' ? h('button', { class: 'btn sm gold', disabled: !it.ver, onclick: function (e) { set('now', e.target); } }, '공개하기') : null,
      state !== 'off' ? h('button', { class: 'btn sm', onclick: function (e) { set('hold', e.target); } }, '비공개로') : null
    ]);
  }

  /** 보고서 하나의 주체별 공개 시점 정하기 */
  async function editor(key, opts) {
    opts = opts || {};
    var r = opts.data || await load(key), it = itemOf(r, key);
    var rows = r.targets.map(function (o) {
      var s = it.st[o], rule = r.rules[o];
      var cur = s.mode === 'rule' ? 'rule' : s.mode;
      var dt = h('input', { class: 'input', type: 'datetime-local', value: s.mode === 'at' ? (s.local || local(s.at)) : local(s.ruleAt || ''), 'aria-label': o + ' 공개 시각' });
      var sel = h('select', { class: 'input', 'aria-label': o + ' 공개 방법', onchange: sync }, [
        ['rule', '기본 규칙대로 — ' + ruleName(key, rule) + (s.ruleAt ? ' (' + when(s.ruleAt) + ')' : '')],
        ['now', '지금 바로 공개 (공유되어 있으면 즉시)'],
        ['at', '날짜·시각 직접 정하기'],
        ['hold', '비공개 (보류)']
      ].map(function (x) { return h('option', { value: x[0], text: x[1], selected: x[0] === cur }); }));
      function sync() { dt.hidden = sel.value !== 'at'; }
      sync();
      return { org: o, sel: sel, dt: dt, el: h('div', { class: 'ob-row' }, [h('b', { text: o }), h('div', { class: 'ob-ctl' }, [sel, dt])]) };
    });
    var m = KR.modal('공개 시점 · ' + titleOf(it), [
      h('p', { class: 'muted small', style: 'margin:0 0 14px', text: (it.ver ? '공유본 v' + it.ver + ' · ' + KR.fmtTime(it.sharedAt) + ' 공유. ' : '아직 공유 전입니다. 미리 정해 두면 공유할 때 그대로 따릅니다. ') + '정한 시각 전에는 그 주체의 열람 화면에 이 보고서가 나타나지 않습니다.' }),
      h('div', { class: 'ob-rows' }, rows.map(function (x) { return x.el; })),
      r.codeOn ? h('p', { class: 'ob-note', text: r.codeOrg ? '열람 코드로 들어오는 사람은 ' + r.codeOrg + ' 기준을 따릅니다.' : '열람 코드로 들어오는 사람은 모든 주체에 열린 뒤에 봅니다.' }) : null
    ], [
      h('button', { class: 'btn ghost', style: 'margin-right:auto', text: '기본 규칙 바꾸기', onclick: function () { m.close(); rules({ done: function () { if (opts.reload) opts.reload(); editor(key, { done: opts.done, reload: opts.reload }); } }); } }),
      h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); } }),
      h('button', { class: 'btn primary', text: '저장', onclick: async function (e) {
        var over = {};
        for (var i = 0; i < rows.length; i++) {
          var x = rows[i], v = x.sel.value;
          if (v === 'at') { if (!x.dt.value) { KR.toast(x.org + '의 공개 시각을 넣으세요', true); x.dt.focus(); return; } v = x.dt.value.slice(0, 16); }
          over[x.org] = v;
        }
        KR.busy(e.target, true);
        try { var res = await KR.call('open.save', { key: key, over: over }); m.close(); KR.toast('공개 시점을 저장했습니다'); if (opts.done) opts.done(res); }
        catch (x2) { KR.toast(x2.message, true); }
        KR.busy(e.target, false);
      } })
    ], { wide: true, noFocus: true });
  }

  /** 주체별 기본 규칙 (주간 · 월간) */
  async function rules(opts) {
    opts = opts || {};
    var r = await load('');
    function timeIn(v, label) { return h('input', { class: 'input t', type: 'time', value: v, 'aria-label': label }); }
    function ruleSel(list, v, label, t) {
      var s = h('select', { class: 'input', 'aria-label': label, onchange: function () { t.disabled = s.value === 'now' || s.value === 'hold'; } }, list.map(function (x) { return h('option', { value: x[0], text: x[1], selected: x[0] === v }); }));
      t.disabled = v === 'now' || v === 'hold';
      return s;
    }
    var rows = r.targets.map(function (o) {
      var x = r.rules[o], wt = timeIn(x.wt, o + ' 주간 시각'), mt = timeIn(x.mt, o + ' 월간 시각');
      var w = ruleSel(RULE_W, x.w, o + ' 주간 규칙', wt), mm = ruleSel(RULE_M, x.m, o + ' 월간 규칙', mt);
      return { org: o, w: w, wt: wt, m: mm, mt: mt, el: h('div', { class: 'ob-rule' }, [
        h('b', { text: o }),
        h('div', { class: 'ob-pair' }, [h('span', { text: '주간' }), w, wt]),
        h('div', { class: 'ob-pair' }, [h('span', { text: '월간' }), mm, mt])
      ]) };
    });
    var m = KR.modal('주체별 기본 공개 규칙', [
      h('p', { class: 'muted small', style: 'margin:0 0 14px', text: '공유본이 각 주체의 열람 화면에 언제부터 보일지 정합니다. 보고서마다 따로 정한 값이 있으면 그 값이 먼저입니다. 정한 시각보다 늦게 공유하면 공유하는 즉시 보입니다. 월간은 기본이 비공개로, 작성자가 「공개하기」를 눌러야 보입니다.' }),
      r.targets.length ? h('div', { class: 'ob-rules' }, rows.map(function (x) { return x.el; })) : h('p', { class: 'muted', text: '대상 주체가 없습니다.' }),
      h('p', { class: 'ob-note', text: '취합 권한이 있는 주체(케이브레인컴퍼니 등)와 관리자 · 공개 시점 설정 권한자는 언제나 모두 봅니다.' })
    ], [
      h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); if (opts.done) opts.done(); } }),
      h('button', { class: 'btn primary', text: '저장', onclick: async function (e) {
        var out = {};
        rows.forEach(function (x) { out[x.org] = { w: x.w.value, wt: x.wt.value || '09:00', m: x.m.value, mt: x.mt.value || '09:00' }; });
        KR.busy(e.target, true);
        try { await KR.call('open.save', { rules: out }); m.close(); KR.toast('기본 규칙을 저장했습니다'); if (opts.done) opts.done(); }
        catch (x2) { KR.toast(x2.message, true); }
        KR.busy(e.target, false);
      } })
    ], { wide: true, noFocus: true });
  }

  function can(p) { return !!(p && (p.open || p.admin)); }
  root.KROpen = { panel: panel, editor: editor, rules: rules, can: can, when: when };
})(window);

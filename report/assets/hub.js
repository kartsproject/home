/* 취합 화면 (케이브레인) — 주간 취합 · 월간 취합 */
(async function () {
  'use strict';
  var KR = window.KR, R = window.KRReport, h = KR.h;
  var b = await KR.requireLogin('compile');
  KR.topbar(b, 'hub');
  var masterP = R.loadMaster();   // 일정 관리 목록 (달력 고정 일정)
  var P = b.user.perm;
  var app = document.getElementById('app');
  app.innerHTML = ''; app.className = 'wrap wide';
  var pk = KR.param('key');
  var S = { tab: KR.param('tab') === 'month' ? 'month' : 'week', w: /^W-/.test(pk) ? KR.fromKey(pk) : KR.current(), m: /^M-/.test(pk) ? KR.fromKey(pk) : KR.currentMonth(), companies: b.companies.slice(), saveTimer: null };
  var TABS = [['week', '주간 취합'], ['month', '월간 취합']];

  var tabsBox = h('nav', { class: 'tabs', role: 'tablist' }), main = h('div', { class: 'hub-main' });
  app.appendChild(tabsBox); app.appendChild(main);
  function drawTabs() {
    tabsBox.innerHTML = '';
    TABS.forEach(function (t) { tabsBox.appendChild(h('button', { role: 'tab', 'aria-selected': S.tab === t[0] ? 'true' : 'false', class: S.tab === t[0] ? 'on' : '', onclick: function () { S.tab = t[0]; syncUrl(); drawTabs(); show(); } }, t[1])); });
  }
  function show() {
    main.innerHTML = '<div class="loading">불러오는 중…</div>';
    syncUrl();
    ({ week: weekTab, month: monthTab })[S.tab]();
  }
  function syncUrl() { KR.setParams({ tab: S.tab === 'month' ? 'month' : '', key: S.tab === 'month' ? S.m.key : S.w.key }); }
  function viewUrl() { return KR.baseUrl() + '#/view'; }

  /* =========================================================
   * 공용: 취합 편집기
   * ========================================================= */
  function editor(ctx) {
    // ctx: {doc, w, onChange, entriesById}
    var doc = ctx.doc, box = h('div', { class: 'ed' });
    function changed() { ctx.onChange(); draw(); }
    function draw() {
      box.innerHTML = '';
      doc.cats.forEach(function (cat, i) {
        // 「ㅇ」 소제목이 같은 실적·계획 카드는 같은 줄에(화면·인쇄·한글 파일과 같은 규칙 KR.pairRows)
        function head(side) { return h('div', { class: 'ed-col ed-hd ' + side }, [h('div', { class: 'ed-colh' }, [h('b', { text: side === 'prev' ? (doc.headPrev || '지난 실적') : (doc.headNext || '향후 계획') }), h('span', { text: side === 'prev' ? doc.periodPrev : doc.periodNext })])]); }
        var cells = [head('prev'), head('next')];
        var groups = (cat.prev.length || cat.next.length) ? KR.pairRows(cat.prev, cat.next) : [];
        groups.forEach(function (g, gi) {
          ['prev', 'next'].forEach(function (side) {
            var list = cat[side];
            cells.push(h('div', { class: 'ed-col ed-row ' + side + (g.match ? ' match' : '') + (gi === groups.length - 1 ? ' last' : '') }, [
              h('div', { class: 'ed-list' }, g[side].map(function (blk) { return card(i, side, list, list.indexOf(blk)); }))
            ]));
          });
        });
        ['prev', 'next'].forEach(function (side) {
          cells.push(h('div', { class: 'ed-col ed-ft ' + side }, [
            cat[side].length ? null : h('div', { class: 'ed-empty', text: '해당 사항 없음' }),
            h('button', { class: 'add-b sm', onclick: function () { editBlock(null, i, side); } }, '+ 직접 추가')
          ]));
        });
        var cols = cells;
        box.appendChild(h('section', { class: 'ed-cat', style: '--c1:' + R.CAT_C[i][0] + ';--c2:' + R.CAT_C[i][1] }, [
          h('header', {}, [h('span', { class: 'ed-n', text: String(i + 1).padStart(2, '0') }), h('h3', { text: KR.CATS[i] })]),
          h('div', { class: 'ed-cols' }, cols)
        ]));
      });
    }
    function card(i, side, list, j) {
      var blk = list[j];
      function mv(k) { var x = list.splice(j, 1)[0]; list.splice(j + k, 0, x); changed(); }
      return h('div', { class: 'ec' + (blk.hide ? ' off' : '') + (blk.edited ? ' edited' : '') }, [
        h('div', { class: 'ec-meta' }, [
          blk.org ? h('span', { class: 'ec-org', text: blk.org }) : null,
          blk.by ? h('span', { class: 'ec-by', text: blk.by }) : null,
          !blk.src && !blk.by ? h('span', { class: 'ec-by', text: '직접 추가' }) : null,
          blk.edited ? h('span', { class: 'ec-ed', text: blk.ai ? '문장 정리됨' : '편집함' }) : null,
          blk.hide ? h('span', { class: 'ec-ed', text: '보고서에서 뺌' }) : null,
          h('span', { class: 'spacer' }),
          h('button', { class: 'icon-btn', title: '위로', 'aria-label': '위로', disabled: j === 0, onclick: function () { mv(-1); } }, '↑'),
          h('button', { class: 'icon-btn', title: '아래로', 'aria-label': '아래로', disabled: j === list.length - 1, onclick: function () { mv(1); } }, '↓'),
          h('button', { class: 'icon-btn', title: blk.hide ? '보고서에 다시 넣기' : '보고서에서 빼기', 'aria-label': '빼기', onclick: function () { blk.hide = !blk.hide; changed(); } }, blk.hide ? '↺' : '−'),
          h('button', { class: 'icon-btn', title: '고치기', 'aria-label': '고치기', onclick: function () { editBlock(blk, i, side); } }, '✎')
        ]),
        h('div', { class: 'ec-body', onclick: function () { editBlock(blk, i, side); } }, [R.blockEl(blk)])
      ]);
    }
    function editBlock(blk, ci, side) {
      var isNew = !blk;
      blk = blk || { id: KR.uid(), src: '', org: 'MBC C&I', by: '', t: '', c: '', d: '' };
      var t = h('input', { class: 'input', value: blk.t, placeholder: '예: 키비주얼' });
      var c = h('textarea', { class: 'input', rows: 2, value: blk.c, placeholder: '예: 2차 리뷰 시사 보고(11/10,화)' });
      var bxIn = h('textarea', { class: 'input', rows: 4, value: blk.box || '', placeholder: '* 주요 의견\n배경은 무채색 계열로\n2안은 타이포를 달리해 재시안' });
      // 세부 「-」 줄: 작성 화면과 같은 입력(줄마다 칸 · ↑↓ 이동 · 줄별 상세 박스)
      var dVal = blk.d || '', dEd = R.subRows(blk.d, function (v) { dVal = v; });
      var d = h('div', { class: 'sub-ed' }, [dEd.el]);
      var orgSel = h('select', { class: 'input' }, S.companies.concat(blk.org && S.companies.indexOf(blk.org) < 0 ? [blk.org] : []).map(function (n) { return h('option', { value: n, text: n, selected: n === blk.org }); }));
      var catSel = h('select', { class: 'input' }, KR.CATS.map(function (n, k) { return h('option', { value: k, text: n, selected: k === ci }); }));
      var sideSel = h('select', { class: 'input' }, [h('option', { value: 'prev', text: '지난 실적', selected: side === 'prev' }), h('option', { value: 'next', text: '향후 계획', selected: side === 'next' })]);
      var paste = isNew ? h('details', { class: 'paste-d' }, [h('summary', { text: '메일·한글로 받은 글을 붙여넣어 한꺼번에 넣기' }), (function () {
        var ta = h('textarea', { class: 'input mono', rows: 7, placeholder: '□ 홍보/다큐/아카이빙\nㅇ(언론홍보) 기획기사 음악편 보도(11/6,금)\n- ...' });
        return h('div', {}, [ta, h('button', { class: 'btn sm', style: 'margin-top:6px', onclick: function () {
          var p = KR.parseText(ta.value, Number(catSel.value)), n = 0;
          p.cats.forEach(function (l, k) { l.forEach(function (x) { doc.cats[k][sideSel.value].push({ id: KR.uid(), src: '', org: orgSel.value, by: '', t: x.t, c: x.c, d: x.d, box: x.box || '' }); n++; }); });
          if (!n) { KR.toast('읽을 내용이 없습니다', true); return; }
          m.close(); changed(); KR.toast(n + '건을 넣었습니다');
        } }, '읽어서 넣기')]);
      })()]) : null;
      var m = KR.modal(isNew ? '항목 직접 추가' : '항목 고치기', [
        h('div', { class: 'grid2' }, [h('label', { class: 'field' }, [h('span', { text: '분야' }), catSel]), h('label', { class: 'field' }, [h('span', { text: '구분' }), sideSel])]),
        h('div', { class: 'grid2' }, [h('label', { class: 'field' }, [h('span', { text: '소제목 ( ) 안' }), t]), h('label', { class: 'field' }, [h('span', { text: '업체' }), orgSel])]),
        h('label', { class: 'field' }, [h('span', { text: '내용 (ㅇ 줄)' }), c]),
        h('label', { class: 'field' }, [h('span', { text: '세부 내용' }), d]),
        h('label', { class: 'field' }, [h('span', { text: '항목 전체 상세 박스 (「ㅇ」 아래 맨 끝 · 첫 줄을 「* 주요 의견」처럼 쓰면 박스 제목)' }), bxIn]),
        blk.src && blk.edited ? h('p', { class: 'muted small', text: '이 항목은 편집한 상태라 작성자가 원문을 고쳐도 자동으로 바뀌지 않습니다.' }) : null,
        blk.src && !isNew ? h('p', { class: 'muted small', text: '원문 작성: ' + (blk.by || '') + ' (' + (blk.org || '') + ')' }) : null,
        paste
      ], [
        !isNew ? h('button', { class: 'btn danger-ghost', text: '삭제', onclick: async function () {
          if (!(await KR.confirm(blk.src ? '작성자가 쓴 항목입니다. 보고서에서 지울까요? (작성자 원문은 남습니다. 빼기만 하려면 「−」를 쓰세요)' : '이 항목을 지울까요?', '지우기', true))) return;
          var l = doc.cats[ci][side]; l.splice(l.indexOf(blk), 1);
          if (blk.src) { doc.removed = doc.removed || {}; doc.removed[blk.src] = 1; }
          m.close(); changed();
        } }) : null,
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); } }),
        h('button', { class: 'btn primary', text: '저장', onclick: function () {
          blk.t = t.value.trim(); blk.c = c.value.replace(/\s+$/, ''); blk.d = dVal; blk.box = bxIn.value.replace(/\s+$/, ''); blk.org = orgSel.value;
          if (KR.blockEmpty(blk)) { KR.toast('내용을 입력하세요', true); return; }
          if (blk.src && !isNew) blk.edited = true;
          var nc = Number(catSel.value), ns = sideSel.value;
          if (!isNew && (nc !== ci || ns !== side)) { var l = doc.cats[ci][side]; l.splice(l.indexOf(blk), 1); doc.cats[nc][ns].push(blk); if (blk.src) blk.edited = true; }
          else if (isNew) doc.cats[nc][ns].push(blk);
          m.close(); changed();
        } })
      ], { wide: true });
    }
    draw();
    return { el: box, draw: draw };
  }

  /** 다가오는 일정 패널 */
  function schedulePanel(doc, onChange) {
    var box = h('div', { class: 'sch' });
    function draw() {
      box.innerHTML = '';
      var all = R.schedule(doc, { all: true });
      box.appendChild(h('div', { class: 'sch-h' }, [h('h3', { text: '다가오는 일정' }), h('span', { class: 'muted small' }, ['향후 계획 속 날짜를 자동으로 읽었습니다. 잘못 읽힌 건 빼 주세요. 늘 보이는 사업 일정은 ', h('a', { href: '#/sched', text: '일정 관리' }), '에서 고칩니다.'])]));
      if (!all.length) box.appendChild(h('div', { class: 'ag-empty', text: '날짜가 적힌 계획이 없습니다' }));
      box.appendChild(h('div', { class: 'sch-list' }, R.byDate(all).map(function (g) {
        var dt = KR.parse(g.date);
        return h('div', { class: 'sch-day' }, [
          h('div', { class: 'sch-d' }, [h('b', { text: String(dt.getDate()) }), h('span', { text: (dt.getMonth() + 1) + '월 ' + '일월화수목금토'[dt.getDay()] })]),
          h('div', { class: 'sch-items' }, g.items.map(function (x) {
            return h('div', { class: 'sch-it' + (x.off ? ' off' : '') }, [
              h('i', { style: 'background:' + R.CAT_C[x.cat || 0][1] }),
              R.timeOf(x) ? h('span', { class: 'sch-t', text: R.timeOf(x) }) : null,
              h('span', { class: 'sch-x', text: x.text }),
              x.auto ? h('button', { class: 'icon-btn', title: x.off ? '다시 표시' : '일정에서 빼기', onclick: function () { doc.schedOff = doc.schedOff || {}; if (x.off) delete doc.schedOff[x.id]; else doc.schedOff[x.id] = 1; onChange(); draw(); } }, x.off ? '↺' : '−')
                : h('button', { class: 'icon-btn danger', title: '지우기', onclick: function () { doc.schedAdd = (doc.schedAdd || []).filter(function (y) { return y.id !== x.id; }); onChange(); draw(); } }, '✕')
            ]);
          }))
        ]);
      })));
      var dIn = h('input', { class: 'input', type: 'date' }), tIn = h('input', { class: 'input', placeholder: '시간 (선택)', style: 'max-width:110px' }), xIn = h('input', { class: 'input', placeholder: '일정 내용' });
      var cSel = h('select', { class: 'input', style: 'max-width:130px' }, KR.CAT_SHORT.map(function (n, k) { return h('option', { value: k, text: n }); }));
      box.appendChild(h('div', { class: 'sch-add' }, [dIn, tIn, cSel, xIn, h('button', { class: 'btn sm', onclick: function () {
        if (!dIn.value || !xIn.value.trim()) { KR.toast('날짜와 내용을 입력하세요', true); return; }
        doc.schedAdd = doc.schedAdd || []; doc.schedAdd.push({ id: 'm' + KR.uid(), date: dIn.value, time: tIn.value.trim(), text: xIn.value.trim(), cat: Number(cSel.value), org: '' });
        onChange(); draw();
      } }, '추가')]));
    }
    draw();
    return { el: box, draw: draw };
  }

  /** 회의 화면 미리보기 (편집본으로) */
  function meetPreview(getDoc) {
    var ov = h('div', { class: 'meet-ov' });
    var mt = R.meeting(getDoc, { extra: function (bar) { bar.appendChild(h('button', { class: 'm-btn sm', onclick: close }, '닫기')); } });
    function close() { mt.destroy(); ov.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape' && !document.fullscreenElement) close(); }
    document.addEventListener('keydown', esc);
    ov.appendChild(mt.el); document.body.appendChild(ov); mt.el.focus();
  }

  /** 공유 */
  async function share(key, doc, saveFirst, after) {
    var memo = h('input', { class: 'input', placeholder: '고친 내용 메모 (선택, 예: 공연 일정 수정)' });
    var last = after.lastVer, isM = key[0] === 'M', canPub = isM && window.KROpen.can(P);
    var pubChk = h('input', { type: 'checkbox' });
    var m = KR.modal(isM ? '월간보고 공유본 올리기' : '한예종에 공유', [
      isM ? h('p', { class: 'notice info', style: 'margin:0 0 12px', text: '월간보고는 기본이 비공개입니다. 올린 뒤 「공개하기」를 눌러야 다른 주체(한예종 포함)가 봅니다.' }) : null,
      h('p', { style: 'margin:0 0 10px', text: isM ? (last ? '이미 v' + last + '가 올라가 있습니다. 지금 내용으로 v' + (Number(last) + 1) + '을 올립니다. 공개 상태는 그대로 유지됩니다.' : '지금 편집본을 최종본(v1)으로 올립니다.') : last ? '이미 v' + last + '가 공유되어 있습니다. 지금 내용으로 v' + (Number(last) + 1) + '을 공유하면 한예종 화면이 새 판으로 바뀝니다(이전 판도 열람 가능).' : '지금 편집본을 최종본(v1)으로 공유합니다. 한예종은 열람 주소와 코드로 이 화면만 봅니다.' }),
      last ? h('label', { class: 'field' }, [h('span', { text: '메모' }), memo]) : null,
      canPub ? h('label', { class: 'chk' }, [pubChk, h('span', { text: '올리면서 바로 모든 주체에 공개' })]) : null
    ], [
      h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); } }),
      h('button', { class: 'btn gold', text: isM ? '올리기' : '공유하기', onclick: async function (e) {
        KR.busy(e.target, true);
        try {
          await saveFirst();
          var r = await KR.call('compile.share', { key: key, doc: R.freeze(doc), memo: memo.value });
          if (canPub && pubChk.checked) {
            var og = await KR.call('open.get', { keys: [key] }), over = {};
            og.targets.forEach(function (o) { over[o] = 'now'; });
            await KR.call('open.save', { key: key, over: over });
          }
          m.close(); after.done(r);
          var hub = await KR.call('hub.week', { key: key }).catch(function () { return {}; });
          KR.modal('공유했습니다 · v' + r.ver, [
            h('p', { style: 'margin:0 0 12px', text: '한예종 담당자에게 아래 주소를 알려 주세요. 처음 한 번만 알려 주면 이후 공유본은 같은 주소에서 바로 보입니다.' }),
            h('div', { class: 'copyrow' }, [h('code', { text: viewUrl() }), h('button', { class: 'btn sm', onclick: function () { KR.copy(viewUrl()); } }, '복사')]),
            hub.viewCode ? h('div', { class: 'copyrow' }, [h('code', { text: '열람 코드: ' + hub.viewCode }), h('button', { class: 'btn sm', onclick: function () { KR.copy(hub.viewCode); } }, '복사')]) : h('p', { class: 'muted small', text: '열람 코드를 꺼 두었습니다. 한예종 계정으로 로그인해서 봅니다.' }),
            window.KROpen.can(P) ? h('div', { class: 'ob-in-modal' }, [window.KROpen.panel(key)]) : null
          ], [h('button', { class: 'btn primary', text: '확인', onclick: function () { document.querySelector('.modal-bg').close(); } })]);
        } catch (x) { KR.toast(x.message, true); }
        KR.busy(e.target, false);
      } })
    ]);
  }

  /* =========================================================
   * AI 문장 정리 — 작성분을 실적·계획 문장으로 다듬어 편집본에 넣음 (되돌리기 가능)
   * ========================================================= */
  function payloadOf(doc) {
    return doc.cats.map(function (c) {
      function pick(list) { return R.visible(list).map(function (b) { return { id: b.id, t: b.t, c: b.c, d: b.d, box: b.box || '' }; }); }
      return { prev: pick(c.prev), next: pick(c.next) };
    });
  }
  /** 규칙 기반 기본 정리 (AI를 못 쓸 때): 공백·마침표·중복 줄 정리 */
  function tidy(cats) {
    function line(s) { return String(s || '').replace(/[ \t]+/g, ' ').replace(/\s*([,)])/g, '$1').replace(/\(\s+/g, '(').replace(/[.。]\s*$/, '').trim(); }
    function lines(s) { var seen = {}; return String(s || '').split('\n').map(function (l) { var lead = /^\s+/.test(l) ? '  ' : ''; return lead + line(l); }).filter(function (l) { var k = l.trim(); if (!k || seen[k]) return false; seen[k] = 1; return true; }).join('\n'); }
    return cats.map(function (c) { function f(list) { return list.map(function (b) { return { from: b.id, t: line(b.t), c: lines(b.c), d: lines(b.d), box: lines(b.box) }; }); } return { prev: f(c.prev), next: f(c.next) }; });
  }
  /** cats(결과)를 편집본에 반영. 원래 블록의 업체·원문 연결은 from으로 이어 둠 */
  function applyRefined(doc, out, src) {
    var byId = {};
    doc.cats.forEach(function (c) { ['prev', 'next'].forEach(function (sd) { c[sd].forEach(function (b) { byId[b.id] = b; }); }); });
    (src || []).forEach(function (c) { ['prev', 'next'].forEach(function (sd) { (c[sd] || []).forEach(function (b) { if (!byId[b.id]) byId[b.id] = b; }); }); });
    doc.cats.forEach(function (c, i) {
      ['prev', 'next'].forEach(function (sd) {
        var hidden = c[sd].filter(function (b) { return b.hide; });
        c[sd] = (out[i] && out[i][sd] || []).map(function (r) {
          var o = byId[Array.isArray(r.from) ? r.from[0] : r.from] || {};
          return { id: KR.uid(), src: o.src || '', org: o.org || '', by: o.by || '', t: r.t, c: r.c, d: r.d, box: r.box || '', sig: o.sig || '', edited: true, ai: true };
        }).concat(hidden);
      });
    });
    // 정리하면서 다른 항목에 합쳐진 원본은 「흡수됨」으로 기록 → 원본이 그대로면 변경 알림에서 빼고, 바뀌면 새 항목으로 알림
    var present = {};
    doc.cats.forEach(function (c) { ['prev', 'next'].forEach(function (sd) { c[sd].forEach(function (b) { if (b.src) present[b.src] = 1; }); }); });
    doc.absorbed = doc.absorbed || {};
    Object.keys(byId).forEach(function (k) { var o = byId[k]; if (o.src && !present[o.src]) doc.absorbed[o.src] = o.sig || ''; });
  }
  /**
   * 세부 줄의 상세 박스(「§」 줄)는 문장 정리(AI·기본)에 보내지 않고 따로 두었다가, 정리된 글에서 가장 닮은 「-」 줄 아래에 다시 붙인다.
   * (AI가 줄을 다듬거나 순서를 바꿔도 박스가 다른 줄로 섞이거나 사라지지 않게)
   */
  function stripSub(cats) {
    var keep = {};
    function f(list) { return (list || []).map(function (b) { var us = KR.dParse(b.d); if (us.some(function (u) { return u.box; })) keep[b.id] = us; return Object.assign({}, b, { d: us.filter(function (u) { return u.t.trim(); }).map(function (u) { return u.t; }).join('\n') }); }); }
    return { cats: cats.map(function (c) { return { prev: f(c.prev), next: f(c.next) }; }), keep: keep };
  }
  function simText(a, b) {   // 두 글자씩 겹치는 정도(0~1)
    function grams(s) { s = String(s || '').replace(/\s+/g, ''); var g = {}; for (var i = 0; i < s.length - 1; i++) g[s.substr(i, 2)] = (g[s.substr(i, 2)] || 0) + 1; return g; }
    var A = grams(a), B = grams(b), n = 0, ta = 0, tb = 0, k;
    for (k in A) { ta += A[k]; if (B[k]) n += Math.min(A[k], B[k]); }
    for (k in B) tb += B[k];
    return ta + tb ? 2 * n / (ta + tb) : (String(a).trim() === String(b).trim() ? 1 : 0);
  }
  function reattachSub(out, keep) {
    (out || []).forEach(function (c) {
      ['prev', 'next'].forEach(function (sd) {
        (c[sd] || []).forEach(function (r) {
          var froms = Array.isArray(r.from) ? r.from : [r.from], subs = [];
          froms.forEach(function (id) { (keep[id] || []).forEach(function (u) { if (u.box) subs.push(u); }); });
          if (!subs.length) return;
          var us = KR.dParse(String(r.d || '').split('\n').filter(function (l) { return KR.lineKind(l) !== 'box'; }).join('\n')).filter(function (u) { return u.t.trim(); });
          subs.forEach(function (u) {
            var best = -1, bs = -1;
            us.forEach(function (x, j) { var sc = simText(u.t, x.t); if (sc > bs) { bs = sc; best = j; } });
            if (best < 0 || bs < 0.2) { us.push({ t: u.t, box: u.box }); return; }   // 맞는 줄이 없으면 원래 줄과 함께 붙임
            us[best].box = us[best].box ? us[best].box + '\n' + u.box : u.box;
          });
          r.d = KR.dJoin(us);
        });
      });
    });
    return out;
  }
  async function refine(doc, mode, src, onDone) {
    var before = JSON.parse(JSON.stringify(doc.cats));
    var wait = KR.modal('문장 정리 중', [h('div', { class: 'ai-wait' }, [h('div', { class: 'ai-orb' }), h('p', { text: b.ai ? 'AI가 실적·계획 문장으로 다듬고 있습니다. 보통 10~40초 걸립니다.' : '기본 정리 중…' })])], [], { locked: true, noFocus: true });
    var out = null, note = '', sp = stripSub(src || payloadOf(doc));
    if (b.ai) {
      try { var r = await KR.call('compile.ai', { mode: mode, cats: sp.cats }); out = r.cats; note = 'AI(' + r.model + ')로 정리했습니다'; }
      catch (e) { note = e.message + ' — 기본 정리만 했습니다'; }
    } else note = 'AI 키가 없어 기본 정리(공백·중복)만 했습니다';
    if (!out) out = tidy(sp.cats);
    reattachSub(out, sp.keep);
    wait.close();
    applyRefined(doc, out, src);
    S.undo = { key: doc.key, cats: before };
    onDone();
    KR.toast(note);
  }
  function undoBtn(doc, onDone) {
    if (!S.undo || S.undo.key !== doc.key) return null;
    return h('button', { class: 'btn ghost', title: '문장 정리 전으로 되돌립니다', onclick: function () { doc.cats = S.undo.cats; S.undo = null; onDone(); KR.toast('정리 전으로 되돌렸습니다'); } }, '↺ 정리 전으로');
  }

  /* =========================================================
   * 주간 취합
   * ========================================================= */
  /** 주체별 제출 현황(주간·월간 공용) */
  function submCards(users, entries, label, files, key) {
    files = files || [];
    var writers = users.filter(function (u) { return u.status !== '중지'; });
    var byUid = {}; entries.forEach(function (e) { byUid[e.uid] = e; });
    var box = h('div', { class: 'subm' }, S.companies.filter(function (co) { return writers.some(function (u) { return u.company === co; }); }).map(function (co) {
      var people = writers.filter(function (u) { return u.company === co; });
      var es = entries.filter(function (e) { return e.company === co; });
      var done = es.filter(function (e) { return e.status === '제출'; }).length;
      return h('div', { class: 'sb-co' }, [
        h('div', { class: 'sb-h' }, [h('b', { text: co }), h('span', { class: done ? 'ok' : 'none', text: done ? '제출 ' + done + '명' : '아직 없음' })]),
        h('div', { class: 'sb-people' }, people.map(function (u) {
          var e = byUid[u.id], cls = !e ? 'none' : e.status === '제출' ? 'ok' : 'run';
          var lb = !e ? '미작성' : e.status === '제출' ? '제출 ' + KR.fmtTime(e.submitted).split(' ').pop() + (e.updated > e.submitted ? ' · 이후 수정' : '') : '작성 중';
          var fs = files.filter(function (f) { return f.uid === u.id; });
          return h('button', { class: 'sb-p ' + cls, disabled: !e && !fs.length && !P.admin, title: '작성 내용' + (fs.length ? '·참고 자료' : '') + ' 보기' + (P.admin ? ' · 대신 수정' : ''), onclick: function () { personModal(e, u, fs, key); } }, [h('i'), h('b', { text: u.name }), h('span', { text: lb }), fs.length ? h('span', { class: 'sb-f', title: '참고 자료 ' + fs.length + '개', text: '📎' + fs.length }) : null]);
        }))
      ]);
    }));
    if (!label) return box;
    return h('section', { class: 'subm-sec' }, [h('div', { class: 'subm-l', text: label }), box]);
  }

  async function weekTab() {
    var w = S.w, data;
    await masterP;
    try { data = await KR.call('hub.week', { key: w.key }); } catch (e) { main.innerHTML = ''; main.appendChild(h('div', { class: 'notice warn', text: e.message })); return; }
    S.companies = b.companies.slice();
    var entries = data.entries, doc = data.draft && data.draft.doc, fresh = false;
    if (!doc) { doc = R.compile(entries, S.companies, w); fresh = true; }
    var st = { savedAt: data.draft ? data.draft.updated : '', shared: data.shared, dirty: fresh && entries.length > 0 };

    main.innerHTML = '';
    var saveState = h('span', { class: 'savestate' });
    function setSave(t) { saveState.textContent = t; }
    async function saveNow() {
      clearTimeout(S.saveTimer);
      if (!st.dirty) return;
      setSave('저장 중…');
      try { var r = await KR.call('compile.save', { key: w.key, doc: doc }); st.savedAt = r.updated; st.dirty = false; setSave('편집본 저장됨 ' + KR.fmtTime(r.updated).split(' ').pop()); }
      catch (e) { setSave('저장 실패'); KR.toast(e.message, true); throw e; }
    }
    function onChange() { st.dirty = true; setSave('편집 중…'); clearTimeout(S.saveTimer); S.saveTimer = setTimeout(function () { saveNow().catch(function () { }); }, 1200); drawDiff(); sp.draw(); }

    // 머리
    var lastShared = st.shared.length ? st.shared[st.shared.length - 1] : null;
    main.appendChild(h('div', { class: 'hub-head' }, [
      h('div', { class: 'weeknav big' }, [
        h('button', { class: 'wn-btn', 'aria-label': '이전 주', onclick: async function () { if (st.dirty) await saveNow(); S.w = w.prev(); syncUrl(); weekTab(); } }, '‹'),
        h('div', {}, [h('div', { class: 'hh-t', text: doc.title }), h('div', { class: 'hh-s', text: '실적 ' + w.periodPrev + ' · 계획 ' + w.periodNext })]),
        h('button', { class: 'wn-btn', 'aria-label': '다음 주', onclick: async function () { if (st.dirty) await saveNow(); S.w = w.next(); syncUrl(); weekTab(); } }, '›')
      ]),
      h('div', { class: 'hh-r' }, [
        lastShared ? h('span', { class: 'status-pill ok', text: '한예종 공유 v' + lastShared.ver + ' · ' + KR.fmtTime(lastShared.at) }) : h('span', { class: 'status-pill none', text: '아직 공유 전' }),
        saveState
      ])
    ]));
    setSave(st.savedAt ? '편집본 저장됨 ' + KR.fmtTime(st.savedAt) : (fresh ? '작성분을 모아 새로 취합했습니다' : ''));

    // 제출 현황
    main.appendChild(submCards(data.users, entries, null, data.files, w.key));

    // 변경 알림
    var diffBox = h('div');
    main.appendChild(diffBox);
    function drawDiff() {
      diffBox.innerHTML = '';
      var d = R.diff(doc, entries, S.companies);
      if (!d.total) return;
      diffBox.appendChild(h('div', { class: 'notice gold' }, [
        h('span', {}, [h('b', { text: '작성분이 바뀌었습니다 ' }), [d.added ? '새 항목 ' + d.added : '', d.changed ? '수정 ' + d.changed : '', d.removed ? '삭제 ' + d.removed : ''].filter(String).join(' · ')]),
        h('button', { class: 'btn sm primary', onclick: function () { remergeKeep(); KR.toast('반영했습니다. 직접 편집한 항목은 그대로 두었습니다'); } }, '편집본에 반영')
      ]));
    }
    function remergeKeep() { R.remerge(doc, entries, S.companies); ed.draw(); onChange(); }

    // 도구
    var orgChk = h('input', { type: 'checkbox', checked: !!doc.showOrg, onchange: function () { doc.showOrg = orgChk.checked; onChange(); } });
    main.appendChild(h('div', { class: 'toolbar' }, [
      h('button', { class: 'btn primary', onclick: function () { meetPreview(function () { return doc; }); } }, '▶ 회의 화면으로 보기'),
      h('button', { class: 'btn', onclick: function () { docPreview(doc); } }, '문서로 보기'),
      h('label', { class: 'chk' }, [orgChk, ' 업체명 표기']),
      h('button', { class: 'btn ai', onclick: function () { refine(doc, 'week', null, function () { weekRedraw(); }); } }, '✦ 문장 정리'),
      undoBtn(doc, function () { weekRedraw(); }),
      h('button', { class: 'btn ghost', onclick: function () { infoModal(doc, w, onChange); } }, '제목·기간 고치기'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost', onclick: async function () {
        if (!(await KR.confirm('편집한 내용을 버리고, 지금 작성분으로 처음부터 다시 취합할까요?', '다시 취합', true))) return;
        var keep = { title: doc.title, dateLine: doc.dateLine, periodPrev: doc.periodPrev, periodNext: doc.periodNext, showOrg: doc.showOrg };
        var nd = R.compile(entries, S.companies, w); Object.assign(nd, keep);
        Object.keys(doc).forEach(function (k) { delete doc[k]; }); Object.assign(doc, nd);
        ed.draw(); onChange();
      } }, '처음부터 다시 취합'),
      h('button', { class: 'btn', onclick: function () { R.print(doc); } }, '인쇄·PDF'),
      h('button', { class: 'btn', onclick: function () { R.hwpx(doc, lastShared ? lastShared.ver : '1').catch(function (e) { KR.toast('한글 파일을 만들지 못했습니다: ' + e.message, true); }); } }, '한글 파일'),
      P.share ? h('button', { class: 'btn gold', onclick: function () { share(w.key, doc, saveNow, { lastVer: lastShared && lastShared.ver, done: function () { weekTab(); } }); } }, lastShared ? '갱신해서 공유' : '한예종에 공유') : null
    ]));

    function weekRedraw() { st.dirty = true; saveNow().then(function () { weekTab(); }).catch(function () { weekTab(); }); }
    var ed = editor({ doc: doc, w: w, onChange: onChange });
    var sp = schedulePanel(doc, onChange);
    main.appendChild(h('div', { class: 'hub-grid' }, [ed.el, h('aside', { class: 'hub-side' }, [window.KROpen.can(P) ? window.KROpen.panel(w.key) : null, filesPanel(data.files), sp.el, sharedList(st.shared, w.key)])]));
    drawDiff();
    // 처음 취합할 때: 작성분을 실적·계획 문장으로 정리해서 넣음
    if (fresh && entries.length) refine(doc, 'week', null, weekRedraw);
    else if (st.dirty) { saveNow().catch(function () { }); }
  }
  function sharedList(list, key) {
    if (!list.length) return h('div');
    return h('div', { class: 'shared' }, [h('h3', { text: '공유 기록' })].concat(list.slice().reverse().map(function (s) {
      return h('a', { class: 'sh-it', href: '#/view?key=' + key + '&ver=' + s.ver }, [h('b', { text: 'v' + s.ver }), h('span', { text: KR.fmtTime(s.at) + ' · ' + s.by + (s.memo ? ' · ' + s.memo : '') })]);
    })));
  }
  /** 사람별 작성 내용 + 참고 자료. 관리자는 「대신 수정」으로 그 사람 작성 화면을 바로 엶 */
  function personModal(e, u, files, key) {
    u = u || { id: e.uid, name: e.name, company: e.company }; files = files || []; key = key || e.key;
    var kids = [];
    if (e) {
      var w = KR.fromKey(e.key), doc = R.newDoc(w);
      doc.title = e.company + ' · ' + e.name + ' 작성분'; doc.cats = KR.normData(e.data).cats;
      kids.push(h('p', { class: 'muted small', style: 'margin:0 0 10px', text: (e.status === '제출' ? '제출 ' + KR.fmtTime(e.submitted) : '작성 중') + ' · 마지막 수정 ' + KR.fmtTime(e.updated) + (e.by && e.by !== e.name ? ' (' + e.by + ')' : '') }));
    } else kids.push(h('p', { class: 'muted small', style: 'margin:0 0 10px', text: '아직 작성하지 않았습니다' }));
    if (files.length) kids.push(h('div', { class: 'files-box' }, [h('b', { text: '참고 자료 ' + files.length + '개' })].concat(files.map(function (f) { return KR.fileItem(f); }))));
    if (e) kids.push(h('div', { class: 'paper' }, [R.docEl(doc)]));
    var foot = P.admin ? [h('a', { class: 'btn primary', href: '#/write?key=' + encodeURIComponent(key) + '&uid=' + encodeURIComponent(u.id) }, '✎ 대신 수정')] : [];
    KR.modal(u.name + ' (' + u.company + ')', kids, foot, { wide: true });
  }
  /** 이 회차 참고 자료 전체 (주체·사람별) */
  function filesPanel(files) {
    if (!files || !files.length) return null;
    return h('div', { class: 'shared files-side' }, [h('h3', { text: '참고 자료 ' + files.length + '개' })].concat(files.map(function (f) { return KR.fileItem(f, { who: true }); })));
  }
  function docPreview(doc) {
    KR.modal('문서로 보기', [h('div', { class: 'paper' }, [R.docEl(doc)])], [
      h('button', { class: 'btn', text: '인쇄·PDF', onclick: function () { R.print(doc); } }),
      h('button', { class: 'btn primary', text: '닫기', onclick: function () { document.querySelector('.modal-bg').close(); } })
    ], { wide: true });
  }
  function infoModal(doc, w, onChange) {
    var f = {};
    [['title', '제목'], ['dateLine', '날짜 줄'], ['periodPrev', '지난 실적 기간'], ['periodNext', '향후 계획 기간']].forEach(function (x) { f[x[0]] = h('input', { class: 'input', value: doc[x[0]] }); });
    var m = KR.modal('제목·기간 고치기', [
      h('label', { class: 'field' }, [h('span', { text: '제목' }), f.title]),
      h('label', { class: 'field' }, [h('span', { text: '날짜 줄 (오른쪽 위)' }), f.dateLine]),
      h('div', { class: 'grid2' }, [h('label', { class: 'field' }, [h('span', { text: '지난 실적 기간' }), f.periodPrev]), h('label', { class: 'field' }, [h('span', { text: '향후 계획 기간' }), f.periodNext])]),
      h('button', { class: 'linklike', onclick: function () { f.title.value = w.title; f.dateLine.value = w.dateLine; f.periodPrev.value = w.periodPrev; f.periodNext.value = w.periodNext; } }, '기본값으로 되돌리기')
    ], [h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); } }), h('button', { class: 'btn primary', text: '저장', onclick: function () { Object.keys(f).forEach(function (k) { doc[k] = f[k].value.trim(); }); m.close(); onChange(); show(); } })]);
  }

  /* =========================================================
   * 월간 취합 — 그달 주간 최종본을 모아서
   * ========================================================= */
  async function monthTab() {
    var m = S.m, data, weeks;
    await masterP;
    try {
      var both = await Promise.all([KR.call('hub.week', { key: m.key }), KR.call('hub.weeks', { keys: m.weekKeys })]);   // 동시에 받음
      data = both[0]; weeks = both[1].weeks;
    } catch (e) { main.innerHTML = ''; main.appendChild(h('div', { class: 'notice warn', text: e.message })); return; }
    S.companies = b.companies.slice();
    var entries = data.entries || [];
    var doc = data.draft && data.draft.doc, st = { dirty: false, shared: data.shared };
    main.innerHTML = '';
    var saveState = h('span', { class: 'savestate', text: data.draft ? '편집본 저장됨 ' + KR.fmtTime(data.draft.updated) : '' });
    async function saveNow() {
      clearTimeout(S.saveTimer); if (!st.dirty) return;
      saveState.textContent = '저장 중…';
      var r = await KR.call('compile.save', { key: m.key, doc: doc }); st.dirty = false; saveState.textContent = '편집본 저장됨 ' + KR.fmtTime(r.updated).split(' ').pop();
    }
    function onChange() { st.dirty = true; saveState.textContent = '편집 중…'; clearTimeout(S.saveTimer); S.saveTimer = setTimeout(function () { saveNow().catch(function (e) { KR.toast(e.message, true); }); }, 1200); if (sp) sp.draw(); drawDiff(); }
    var lastShared = st.shared.length ? st.shared[st.shared.length - 1] : null;
    main.appendChild(h('div', { class: 'hub-head' }, [
      h('div', { class: 'weeknav big' }, [
        h('button', { class: 'wn-btn', 'aria-label': '이전 달', onclick: async function () { if (st.dirty) await saveNow(); S.m = m.prev(); syncUrl(); monthTab(); } }, '‹'),
        h('div', {}, [h('div', { class: 'hh-t', text: (doc && doc.title) || m.title }), h('div', { class: 'hh-s', text: '실적 ' + m.periodPrev + ' · 계획 ' + m.periodNext })]),
        h('button', { class: 'wn-btn', 'aria-label': '다음 달', onclick: async function () { if (st.dirty) await saveNow(); S.m = m.next(); syncUrl(); monthTab(); } }, '›')
      ]),
      h('div', { class: 'hh-r' }, [lastShared ? h('span', { class: 'status-pill ok', text: '공유본 v' + lastShared.ver + ' · ' + KR.fmtTime(lastShared.at) }) : h('span', { class: 'status-pill none', text: '아직 올리기 전' }), saveState])
    ]));
    // 재료 1: 주체별 월간 입력
    var mEntries = entries.filter(function (e) { return KR.normData(e.data).cats.some(function (c) { return c.prev.concat(c.next).some(function (x) { return !KR.blockEmpty(x); }); }); });
    main.appendChild(submCards(data.users, entries, '주체별 월간 입력', data.files, m.key));
    // 재료 2: 포함 주차
    var have = weeks.filter(function (x) { return x.doc; });
    main.appendChild(h('div', { class: 'mweeks' }, [h('b', { text: '이 달에 포함되는 주간보고' })].concat(weeks.map(function (x) {
      var ww = KR.fromKey(x.key);
      return h('span', { class: 'mw ' + (x.doc ? (/공유/.test(x.from) ? 'ok' : 'run') : 'none') }, [h('i'), ww.planName + ' 보고', h('small', { text: '실적 ' + KR.md(ww.mon).slice(0, 5) + '~ · ' + (x.from || '없음') })]);
    }))));
    /** 월간 정리용 원자료: 그달 주간 최종본의 지난 실적(주차 표시) + 주체별 월간 입력 + 다음 달 계획(월간 입력 → 마지막 주 계획) */
    function monthSrc() {
      var docs = weeks.filter(function (x) { return x.doc; });
      function mine(i, side) {
        var out = [];
        entries.forEach(function (e) { KR.normData(e.data).cats[i][side].forEach(function (bk) { if (KR.blockEmpty(bk)) return; out.push({ id: e.uid + ':' + bk.id, src: e.uid + ':' + bk.id, org: e.company, by: e.name, t: bk.t || '', c: bk.c || '', d: bk.d || '', box: bk.box || '', sig: R.sig(bk), w: '월간 입력' }); }); });
        return out;
      }
      return KR.CATS.map(function (_, i) {
        var prev = [];
        docs.forEach(function (x) { var wn = KR.fromKey(x.key).name; R.visible(x.doc.cats[i].prev).forEach(function (bk) { prev.push({ id: bk.id, src: '', org: bk.org || '', by: bk.by || '', t: bk.t, c: bk.c, d: bk.d, box: bk.box || '', w: wn }); }); });
        prev = prev.concat(mine(i, 'prev'));
        var last = docs[docs.length - 1];
        var next = mine(i, 'next').concat(last ? R.visible(last.doc.cats[i].next).map(function (bk) { return { id: bk.id, src: '', org: bk.org || '', by: bk.by || '', t: bk.t, c: bk.c, d: bk.d, box: bk.box || '' }; }) : []);
        return { prev: prev, next: next };
      });
    }
    // 월간 입력이 바뀌면 알림 → 편집본에 반영(손댄 항목은 그대로)
    var diffBox = h('div');
    function drawDiff() {
      diffBox.innerHTML = '';
      if (!doc) return;
      var d = R.diff(doc, entries, S.companies);
      if (!d.total) return;
      diffBox.appendChild(h('div', { class: 'notice gold' }, [
        h('span', {}, [h('b', { text: '월간 입력이 바뀌었습니다 ' }), [d.added ? '새 항목 ' + d.added : '', d.changed ? '수정 ' + d.changed : '', d.removed ? '삭제 ' + d.removed : ''].filter(String).join(' · ')]),
        h('button', { class: 'btn sm primary', onclick: function () { R.remerge(doc, entries, S.companies); onChange(); saveNow().then(function () { monthTab(); }); KR.toast('반영했습니다. 직접 편집한 항목은 그대로 두었습니다'); } }, '편집본에 반영')
      ]));
    }
    function build() {
      var nd = R.monthCompile(weeks, m, entries, S.companies);
      if (doc) { ['title', 'dateLine', 'periodPrev', 'periodNext', 'showOrg'].forEach(function (k) { if (doc[k] != null) nd[k] = doc[k]; }); Object.keys(doc).forEach(function (k) { delete doc[k]; }); Object.assign(doc, nd); }
      else doc = nd;
      // 실적은 그달 결과물만으로, 실적 문장으로 정리
      refine(doc, 'month', monthSrc(), function () { st.dirty = true; saveNow().then(function () { monthTab(); }).catch(function (e) { KR.toast(e.message, true); }); });
    }
    if (!doc) {
      main.appendChild(h('div', { class: 'empty-state' }, [
        h('div', { class: 'es-ic', text: '▦' }),
        h('h3', { text: m.name + ' 월간보고 초안이 아직 없습니다' }),
        h('p', { text: have.length || mEntries.length
          ? '주간보고 ' + have.length + '개의 지난 실적과 주체별 월간 입력 ' + mEntries.length + '건을 분야·소제목별로 합쳐 「한 달 실적」으로 정리하고, 월간 입력의 다음 달 계획과 마지막 주의 향후 계획으로 계획을 채웁니다. 만든 뒤 자유롭게 고칠 수 있어요.'
          : '이 달에 취합된 주간보고도, 주체별 월간 입력도 아직 없습니다. 주간 취합을 진행하거나 작성 화면 「월간」에서 내용을 넣어 주세요.' }),
        h('button', { class: 'btn primary lg', disabled: !(have.length || mEntries.length), onclick: build }, '주간보고 + 월간 입력으로 초안 만들기')
      ]));
      return;
    }
    var orgChk = h('input', { type: 'checkbox', checked: !!doc.showOrg, onchange: function () { doc.showOrg = orgChk.checked; onChange(); } });
    main.appendChild(h('div', { class: 'toolbar' }, [
      h('button', { class: 'btn primary', onclick: function () { meetPreview(function () { return doc; }); } }, '▶ 회의 화면으로 보기'),
      h('button', { class: 'btn', onclick: function () { docPreview(doc); } }, '문서로 보기'),
      h('label', { class: 'chk' }, [orgChk, ' 업체명 표기']),
      h('button', { class: 'btn ai', onclick: function () { refine(doc, 'month', monthSrc(), function () { st.dirty = true; saveNow().then(function () { monthTab(); }); }); } }, '✦ 실적으로 다시 정리'),
      undoBtn(doc, function () { st.dirty = true; saveNow().then(function () { monthTab(); }); }),
      h('button', { class: 'btn ghost', onclick: function () { infoModal(doc, m, onChange); } }, '제목·기간 고치기'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost', onclick: async function () { if (await KR.confirm('편집한 내용을 버리고 주간보고와 월간 입력으로 다시 만들까요?', '다시 만들기', true)) build(); } }, '처음부터 다시 만들기'),
      h('button', { class: 'btn', onclick: function () { R.print(doc); } }, '인쇄·PDF'),
      h('button', { class: 'btn', onclick: function () { R.hwpx(doc, lastShared ? lastShared.ver : '1').catch(function (e) { KR.toast(e.message, true); }); } }, '한글 파일'),
      P.share ? h('button', { class: 'btn gold', onclick: function () { share(m.key, doc, saveNow, { lastVer: lastShared && lastShared.ver, done: function () { monthTab(); } }); } }, lastShared ? '새 판 올리기' : '공유본 올리기') : null
    ]));
    main.appendChild(diffBox); drawDiff();
    main.appendChild(h('div', { class: 'tip' }, [h('b', { text: '월간 초안 ' }), '주간보고 실적과 주체별 월간 입력을 같은 소제목끼리 합쳤습니다. 주간보고 뒤에 고친 내용은 「처음부터 다시 만들기」, 월간 입력이 바뀌면 위 알림의 「편집본에 반영」으로 가져옵니다.']));
    var ed = editor({ doc: doc, w: m, onChange: onChange });
    var sp = schedulePanel(doc, onChange);
    main.appendChild(h('div', { class: 'hub-grid' }, [ed.el, h('aside', { class: 'hub-side' }, [window.KROpen.can(P) ? window.KROpen.panel(m.key) : null, filesPanel(data.files), sp.el, sharedList(st.shared, m.key)])]));
  }

  drawTabs(); show();
})();

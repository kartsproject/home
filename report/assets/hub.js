/* 취합 화면 (케이브레인) — 주간 취합 · 월간 취합 */
(async function () {
  'use strict';
  var KR = window.KR, R = window.KRReport, h = KR.h;
  var b = await KR.requireLogin('compile');
  KR.topbar(b, 'hub');
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
        var cols = ['prev', 'next'].map(function (side) {
          var list = cat[side];
          return h('div', { class: 'ed-col ' + side }, [
            h('div', { class: 'ed-colh' }, [h('b', { text: side === 'prev' ? (doc.headPrev || '지난 실적') : (doc.headNext || '향후 계획') }), h('span', { text: side === 'prev' ? doc.periodPrev : doc.periodNext })]),
            list.length ? null : h('div', { class: 'ed-empty', text: '해당 사항 없음' }),
            h('div', { class: 'ed-list' }, list.map(function (blk, j) { return card(i, side, list, j); })),
            h('button', { class: 'add-b sm', onclick: function () { editBlock(null, i, side); } }, '+ 직접 추가')
          ]);
        });
        box.appendChild(h('section', { class: 'ed-cat', style: '--c1:' + R.CAT_C[i][0] + ';--c2:' + R.CAT_C[i][1] }, [
          h('header', {}, [h('span', { class: 'ed-n', text: String(i + 1).padStart(2, '0') }), h('h3', { text: '□ ' + KR.CATS[i] })]),
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
          blk.edited ? h('span', { class: 'ec-ed', text: '편집함' }) : null,
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
      var d = h('textarea', { class: 'input', rows: 6, value: blk.d, placeholder: '한 줄에 하나씩 (앞에 - 가 붙습니다)\n앞에 공백을 두면 윗줄에 이어지는 줄\n* ※ [ 로 시작하면 기호 그대로' });
      var orgSel = h('select', { class: 'input' }, S.companies.concat(blk.org && S.companies.indexOf(blk.org) < 0 ? [blk.org] : []).map(function (n) { return h('option', { value: n, text: n, selected: n === blk.org }); }));
      var catSel = h('select', { class: 'input' }, KR.CATS.map(function (n, k) { return h('option', { value: k, text: n, selected: k === ci }); }));
      var sideSel = h('select', { class: 'input' }, [h('option', { value: 'prev', text: '지난 실적', selected: side === 'prev' }), h('option', { value: 'next', text: '향후 계획', selected: side === 'next' })]);
      var paste = isNew ? h('details', { class: 'paste-d' }, [h('summary', { text: '메일·한글로 받은 글을 붙여넣어 한꺼번에 넣기' }), (function () {
        var ta = h('textarea', { class: 'input mono', rows: 7, placeholder: '□ 홍보/다큐/아카이빙\nㅇ(언론홍보) 기획기사 음악편 보도(11/6,금)\n- ...' });
        return h('div', {}, [ta, h('button', { class: 'btn sm', style: 'margin-top:6px', onclick: function () {
          var p = KR.parseText(ta.value, Number(catSel.value)), n = 0;
          p.cats.forEach(function (l, k) { l.forEach(function (x) { doc.cats[k][sideSel.value].push({ id: KR.uid(), src: '', org: orgSel.value, by: '', t: x.t, c: x.c, d: x.d }); n++; }); });
          if (!n) { KR.toast('읽을 내용이 없습니다', true); return; }
          m.close(); changed(); KR.toast(n + '건을 넣었습니다');
        } }, '읽어서 넣기')]);
      })()]) : null;
      var m = KR.modal(isNew ? '항목 직접 추가' : '항목 고치기', [
        h('div', { class: 'grid2' }, [h('label', { class: 'field' }, [h('span', { text: '분야' }), catSel]), h('label', { class: 'field' }, [h('span', { text: '구분' }), sideSel])]),
        h('div', { class: 'grid2' }, [h('label', { class: 'field' }, [h('span', { text: '소제목 ( ) 안' }), t]), h('label', { class: 'field' }, [h('span', { text: '업체' }), orgSel])]),
        h('label', { class: 'field' }, [h('span', { text: '내용 (ㅇ 줄)' }), c]),
        h('label', { class: 'field' }, [h('span', { text: '세부 내용' }), d]),
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
          blk.t = t.value.trim(); blk.c = c.value.replace(/\s+$/, ''); blk.d = d.value.replace(/\s+$/, ''); blk.org = orgSel.value;
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
      box.appendChild(h('div', { class: 'sch-h' }, [h('h3', { text: '다가오는 일정' }), h('span', { class: 'muted small', text: '향후 계획 속 날짜를 자동으로 읽었습니다. 잘못 읽힌 건 빼 주세요.' })]));
      if (!all.length) box.appendChild(h('div', { class: 'ag-empty', text: '날짜가 적힌 계획이 없습니다' }));
      box.appendChild(h('div', { class: 'sch-list' }, all.map(function (x) {
        var dt = KR.parse(x.date);
        return h('div', { class: 'sch-it' + (x.off ? ' off' : '') }, [
          h('i', { style: 'background:' + R.CAT_C[x.cat || 0][1] }),
          h('span', { class: 'sch-d', text: (dt.getMonth() + 1) + '.' + dt.getDate() + '(' + '일월화수목금토'[dt.getDay()] + ')' }),
          x.time ? h('span', { class: 'sch-t', text: x.time }) : null,
          h('span', { class: 'sch-x', text: x.text }),
          x.auto ? h('button', { class: 'icon-btn', title: x.off ? '다시 표시' : '일정에서 빼기', onclick: function () { doc.schedOff = doc.schedOff || {}; if (x.off) delete doc.schedOff[x.id]; else doc.schedOff[x.id] = 1; onChange(); draw(); } }, x.off ? '↺' : '−')
            : h('button', { class: 'icon-btn danger', title: '지우기', onclick: function () { doc.schedAdd = (doc.schedAdd || []).filter(function (y) { return y.id !== x.id; }); onChange(); draw(); } }, '✕')
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
    var last = after.lastVer;
    var m = KR.modal('한예종에 공유', [
      h('p', { style: 'margin:0 0 10px', text: last ? '이미 v' + last + '가 공유되어 있습니다. 지금 내용으로 v' + (Number(last) + 1) + '을 공유하면 한예종 화면이 새 판으로 바뀝니다(이전 판도 열람 가능).' : '지금 편집본을 최종본(v1)으로 공유합니다. 한예종은 열람 주소와 코드로 이 화면만 봅니다.' }),
      last ? h('label', { class: 'field' }, [h('span', { text: '메모' }), memo]) : null
    ], [
      h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); } }),
      h('button', { class: 'btn gold', text: '공유하기', onclick: async function (e) {
        KR.busy(e.target, true);
        try {
          await saveFirst();
          var r = await KR.call('compile.share', { key: key, doc: R.freeze(doc), memo: memo.value });
          m.close(); after.done(r);
          var hub = await KR.call('hub.week', { key: key }).catch(function () { return {}; });
          KR.modal('공유했습니다 · v' + r.ver, [
            h('p', { style: 'margin:0 0 12px', text: '한예종 담당자에게 아래 주소를 알려 주세요. 처음 한 번만 알려 주면 이후 공유본은 같은 주소에서 바로 보입니다.' }),
            h('div', { class: 'copyrow' }, [h('code', { text: viewUrl() }), h('button', { class: 'btn sm', onclick: function () { KR.copy(viewUrl()); } }, '복사')]),
            hub.viewCode ? h('div', { class: 'copyrow' }, [h('code', { text: '열람 코드: ' + hub.viewCode }), h('button', { class: 'btn sm', onclick: function () { KR.copy(hub.viewCode); } }, '복사')]) : h('p', { class: 'muted small', text: '열람 코드를 꺼 두었습니다. 한예종 계정으로 로그인해서 봅니다.' })
          ], [h('button', { class: 'btn primary', text: '확인', onclick: function () { document.querySelector('.modal-bg').close(); } })]);
        } catch (x) { KR.toast(x.message, true); }
        KR.busy(e.target, false);
      } })
    ]);
  }

  /* =========================================================
   * 주간 취합
   * ========================================================= */
  async function weekTab() {
    var w = S.w, data;
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
    var writers = data.users.filter(function (u) { return u.status !== '중지'; });
    var byUid = {}; entries.forEach(function (e) { byUid[e.uid] = e; });
    main.appendChild(h('div', { class: 'subm' }, S.companies.filter(function (co) { return writers.some(function (u) { return u.company === co; }); }).map(function (co) {
      var people = writers.filter(function (u) { return u.company === co; });
      var es = entries.filter(function (e) { return e.company === co; });
      var done = es.filter(function (e) { return e.status === '제출'; }).length;
      return h('div', { class: 'sb-co' }, [
        h('div', { class: 'sb-h' }, [h('b', { text: co }), h('span', { class: done ? 'ok' : 'none', text: done ? '제출 ' + done + '명' : '아직 없음' })]),
        h('div', { class: 'sb-people' }, people.map(function (u) {
          var e = byUid[u.id], cls = !e ? 'none' : e.status === '제출' ? 'ok' : 'run';
          var label = !e ? '미작성' : e.status === '제출' ? '제출 ' + KR.fmtTime(e.submitted).split(' ').pop() + (e.updated > e.submitted ? ' · 이후 수정' : '') : '작성 중';
          return h('button', { class: 'sb-p ' + cls, disabled: !e, title: e ? '작성 내용 보기' : '', onclick: function () { personModal(e); } }, [h('i'), h('b', { text: u.name }), h('span', { text: label })]);
        }))
      ]);
    })));

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

    var ed = editor({ doc: doc, w: w, onChange: onChange });
    var sp = schedulePanel(doc, onChange);
    main.appendChild(h('div', { class: 'hub-grid' }, [ed.el, h('aside', { class: 'hub-side' }, [sp.el, sharedList(st.shared, w.key)])]));
    drawDiff();
    if (st.dirty) { saveNow().catch(function () { }); }
  }
  function sharedList(list, key) {
    if (!list.length) return h('div');
    return h('div', { class: 'shared' }, [h('h3', { text: '공유 기록' })].concat(list.slice().reverse().map(function (s) {
      return h('a', { class: 'sh-it', href: '#/view?key=' + key + '&ver=' + s.ver }, [h('b', { text: 'v' + s.ver }), h('span', { text: KR.fmtTime(s.at) + ' · ' + s.by + (s.memo ? ' · ' + s.memo : '') })]);
    })));
  }
  function personModal(e) {
    var w = KR.fromKey(e.key), doc = R.newDoc(w);
    doc.title = e.company + ' · ' + e.name + ' 작성분'; doc.cats = KR.normData(e.data).cats;
    KR.modal(e.name + ' (' + e.company + ')', [h('p', { class: 'muted small', style: 'margin:0 0 10px', text: (e.status === '제출' ? '제출 ' + KR.fmtTime(e.submitted) : '작성 중') + ' · 마지막 수정 ' + KR.fmtTime(e.updated) }), h('div', { class: 'paper' }, [R.docEl(doc)])], [], { wide: true });
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
    try {
      data = await KR.call('hub.week', { key: m.key });
      weeks = (await KR.call('hub.weeks', { keys: m.weekKeys })).weeks;
    } catch (e) { main.innerHTML = ''; main.appendChild(h('div', { class: 'notice warn', text: e.message })); return; }
    var doc = data.draft && data.draft.doc, st = { dirty: false, shared: data.shared };
    main.innerHTML = '';
    var saveState = h('span', { class: 'savestate', text: data.draft ? '편집본 저장됨 ' + KR.fmtTime(data.draft.updated) : '' });
    async function saveNow() {
      clearTimeout(S.saveTimer); if (!st.dirty) return;
      saveState.textContent = '저장 중…';
      var r = await KR.call('compile.save', { key: m.key, doc: doc }); st.dirty = false; saveState.textContent = '편집본 저장됨 ' + KR.fmtTime(r.updated).split(' ').pop();
    }
    function onChange() { st.dirty = true; saveState.textContent = '편집 중…'; clearTimeout(S.saveTimer); S.saveTimer = setTimeout(function () { saveNow().catch(function (e) { KR.toast(e.message, true); }); }, 1200); if (sp) sp.draw(); }
    var lastShared = st.shared.length ? st.shared[st.shared.length - 1] : null;
    main.appendChild(h('div', { class: 'hub-head' }, [
      h('div', { class: 'weeknav big' }, [
        h('button', { class: 'wn-btn', 'aria-label': '이전 달', onclick: async function () { if (st.dirty) await saveNow(); S.m = m.prev(); syncUrl(); monthTab(); } }, '‹'),
        h('div', {}, [h('div', { class: 'hh-t', text: (doc && doc.title) || m.title }), h('div', { class: 'hh-s', text: '실적 ' + m.periodPrev + ' · 계획 ' + m.periodNext })]),
        h('button', { class: 'wn-btn', 'aria-label': '다음 달', onclick: async function () { if (st.dirty) await saveNow(); S.m = m.next(); syncUrl(); monthTab(); } }, '›')
      ]),
      h('div', { class: 'hh-r' }, [lastShared ? h('span', { class: 'status-pill ok', text: '한예종 공유 v' + lastShared.ver + ' · ' + KR.fmtTime(lastShared.at) }) : h('span', { class: 'status-pill none', text: '아직 공유 전' }), saveState])
    ]));
    // 포함 주차
    var have = weeks.filter(function (x) { return x.doc; });
    main.appendChild(h('div', { class: 'mweeks' }, [h('b', { text: '이 달에 포함되는 주간보고' })].concat(weeks.map(function (x) {
      var ww = KR.fromKey(x.key);
      return h('span', { class: 'mw ' + (x.doc ? (/공유/.test(x.from) ? 'ok' : 'run') : 'none') }, [h('i'), ww.planName + ' 보고', h('small', { text: '실적 ' + KR.md(ww.mon).slice(0, 5) + '~ · ' + (x.from || '없음') })]);
    }))));
    function build() {
      var nd = R.monthCompile(weeks, m);
      if (doc) { ['title', 'dateLine', 'periodPrev', 'periodNext', 'showOrg'].forEach(function (k) { if (doc[k] != null) nd[k] = doc[k]; }); Object.keys(doc).forEach(function (k) { delete doc[k]; }); Object.assign(doc, nd); }
      else doc = nd;
      st.dirty = true; saveNow().then(function () { monthTab(); }).catch(function (e) { KR.toast(e.message, true); });
    }
    if (!doc) {
      main.appendChild(h('div', { class: 'empty-state' }, [
        h('div', { class: 'es-ic', text: '▦' }),
        h('h3', { text: m.name + ' 월간보고 초안이 아직 없습니다' }),
        h('p', { text: have.length ? '주간보고 ' + have.length + '개의 지난 실적을 분야·소제목별로 합치고, 마지막 주의 향후 계획을 가져와 초안을 만듭니다. 만든 뒤 자유롭게 고칠 수 있어요.' : '이 달에 취합된 주간보고가 없습니다. 주간 취합을 먼저 진행하세요.' }),
        h('button', { class: 'btn primary lg', disabled: !have.length, onclick: build }, '주간보고로 월간 초안 만들기')
      ]));
      return;
    }
    var orgChk = h('input', { type: 'checkbox', checked: !!doc.showOrg, onchange: function () { doc.showOrg = orgChk.checked; onChange(); } });
    main.appendChild(h('div', { class: 'toolbar' }, [
      h('button', { class: 'btn primary', onclick: function () { meetPreview(function () { return doc; }); } }, '▶ 회의 화면으로 보기'),
      h('button', { class: 'btn', onclick: function () { docPreview(doc); } }, '문서로 보기'),
      h('label', { class: 'chk' }, [orgChk, ' 업체명 표기']),
      h('button', { class: 'btn ghost', onclick: function () { infoModal(doc, m, onChange); } }, '제목·기간 고치기'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost', onclick: async function () { if (await KR.confirm('편집한 내용을 버리고 주간보고에서 다시 만들까요?', '다시 만들기', true)) build(); } }, '주간보고에서 다시 만들기'),
      h('button', { class: 'btn', onclick: function () { R.print(doc); } }, '인쇄·PDF'),
      h('button', { class: 'btn', onclick: function () { R.hwpx(doc, lastShared ? lastShared.ver : '1').catch(function (e) { KR.toast(e.message, true); }); } }, '한글 파일'),
      P.share ? h('button', { class: 'btn gold', onclick: function () { share(m.key, doc, saveNow, { lastVer: lastShared && lastShared.ver, done: function () { monthTab(); } }); } }, lastShared ? '갱신해서 공유' : '한예종에 공유') : null
    ]));
    main.appendChild(h('div', { class: 'tip' }, [h('b', { text: '월간 초안 ' }), '같은 소제목은 한 항목으로 합쳤습니다. 주차별로 겹치는 줄은 정리하고, 결과 위주로 다듬어 주세요.']));
    var ed = editor({ doc: doc, w: m, onChange: onChange });
    var sp = schedulePanel(doc, onChange);
    main.appendChild(h('div', { class: 'hub-grid' }, [ed.el, h('aside', { class: 'hub-side' }, [sp.el, sharedList(st.shared, m.key)])]));
  }

  drawTabs(); show();
})();

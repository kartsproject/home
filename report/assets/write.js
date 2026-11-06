/* 작성 화면 — 허용된 분야만 단계로 + 확인·제출. 업체 작성분 관리 권한이 있으면 같은 주체 사람 것을 대신 작성 */
(async function () {
  'use strict';
  var KR = window.KR, R = window.KRReport, h = KR.h;
  var b = await KR.requireLogin('write');
  KR.topbar(b, 'write');
  var app = document.getElementById('app');
  app.className = 'wrap';
  var qk = KR.param('key');
  var S = { w: /^W-\d{4}-\d{2}-\d{2}$/.test(qk) ? KR.fromKey(qk) : KR.current(), uid: KR.param('uid') || b.user.id, who: null, team: null, cats: [0, 1, 2, 3, 4],
    data: KR.emptyData(), entry: null, prevEntry: null, sharedVer: '', step: 0, timer: null, saving: false, dirty: false, savedAt: '' };

  function nstep() { return S.cats.length; }
  function catAt(step) { return S.cats[step]; }
  function lsKey() { return 'kr4_local_' + S.uid + '_' + S.w.key; }
  async function load() {
    app.innerHTML = '<div class="loading">불러오는 중…</div>';
    try {
      var r = await KR.call('my.get', { key: S.w.key, uid: S.uid === b.user.id ? '' : S.uid });
      S.who = r.who; S.team = r.team || null; S.cats = r.who.cats.slice().sort();
      S.entry = r.entry; S.prevEntry = r.prevEntry; S.sharedVer = r.sharedVer;
      S.data = KR.normData(r.entry && r.entry.data);
      S.savedAt = r.entry ? r.entry.updated : ''; S.dirty = false;
      if (S.step > nstep()) S.step = 0;
      var local = null; try { local = JSON.parse(localStorage.getItem(lsKey()) || 'null'); } catch (e) { }
      if (local && local.at && (!S.savedAt || local.at > S.savedAt) && JSON.stringify(local.data) !== JSON.stringify(S.data)) {
        draw();
        if (await KR.confirm('저장되지 못한 작성 내용이 이 브라우저에 남아 있습니다. 불러올까요?', '불러오기')) { S.data = KR.normData(local.data); S.dirty = true; queueSave(); }
        else localStorage.removeItem(lsKey());
      }
    } catch (e) { app.innerHTML = ''; app.appendChild(h('div', { class: 'notice warn', text: e.message })); return; }
    draw();
  }

  /* ---------- 저장 ---------- */
  function touch() {
    S.dirty = true;
    try { localStorage.setItem(lsKey(), JSON.stringify({ at: new Date().toISOString(), data: S.data })); } catch (e) { }
    setSaveText('작성 중…'); queueSave();
  }
  function queueSave() { clearTimeout(S.timer); S.timer = setTimeout(save, 1200); }
  async function save(submit) {
    clearTimeout(S.timer);
    if (S.saving) { S.timer = setTimeout(function () { save(submit); }, 400); return; }
    S.saving = true; setSaveText('저장 중…');
    try {
      var e = await KR.call('my.save', { key: S.w.key, data: S.data, submit: !!submit, uid: S.uid === b.user.id ? '' : S.uid });
      S.entry = e; S.savedAt = e.updated; S.dirty = false;
      try { localStorage.removeItem(lsKey()); } catch (x) { }
      setSaveText('저장됨 ' + KR.fmtTime(e.updated).split(' ').pop());
      drawHead(); return true;
    } catch (err) { setSaveText('저장 실패 — 다시 시도합니다'); KR.toast(err.message, true); S.timer = setTimeout(save, 5000); return false; }
    finally { S.saving = false; }
  }
  function setSaveText(t) { var el = document.getElementById('savestate'); if (el) el.textContent = t; }
  window.addEventListener('beforeunload', function (e) { if (S.dirty) { save(); e.preventDefault(); e.returnValue = ''; } });

  /* ---------- 그리기 ---------- */
  var headBox, stepBox, bodyBox, footBox;
  function draw() {
    app.innerHTML = '';
    headBox = h('div', { class: 'w-head' }); stepBox = h('nav', { class: 'stepper', 'aria-label': '작성 단계' });
    bodyBox = h('div', { class: 'w-body' }); footBox = h('div', { class: 'w-foot' });
    app.appendChild(headBox); app.appendChild(stepBox); app.appendChild(bodyBox); app.appendChild(footBox);
    if (!S.cats.length) { drawHead(); bodyBox.appendChild(h('div', { class: 'empty-state' }, [h('h3', { text: '작성할 수 있는 분야가 없습니다' }), h('p', { text: '관리자에게 작성 분야 권한을 요청하세요.' })])); return; }
    drawHead(); drawSteps(); drawBody(); drawFoot();
  }
  function counts(i) { var c = S.data.cats[i]; return { p: c.prev.filter(function (x) { return !KR.blockEmpty(x); }).length, n: c.next.filter(function (x) { return !KR.blockEmpty(x); }).length }; }
  function drawHead() {
    if (!headBox) return;
    var e = S.entry, st = !e ? ['미작성', 'none'] : e.status === '제출' ? (e.updated > e.submitted ? ['제출 후 수정됨', 'mod'] : ['제출 완료', 'ok']) : ['작성 중', 'run'];
    var forOther = S.who && S.who.id !== b.user.id;
    headBox.innerHTML = '';
    headBox.appendChild(h('div', { class: 'wh-in' }, [
      h('div', { class: 'wh-l' }, [
        h('div', { class: 'eyebrow', text: (S.who ? S.who.company + ' · ' + S.who.name : '') + (forOther ? ' (대신 작성)' : '') }),
        h('h1', {}, [S.w.planName + ' 업무보고']),
        h('div', { class: 'wh-meta' }, [
          h('span', {}, [h('b', { text: '지난 실적 ' }), S.w.periodPrev]),
          h('span', {}, [h('b', { text: '향후 계획 ' }), S.w.periodNext]),
          h('span', {}, [h('b', { text: '대면보고 ' }), KR.kd(S.w.nmon)])
        ])
      ]),
      h('div', { class: 'wh-r' }, [
        h('div', { class: 'weeknav' }, [
          h('button', { class: 'wn-btn', 'aria-label': '이전 주', onclick: function () { move(-1); } }, '‹'),
          h('span', { text: S.w.planName }),
          h('button', { class: 'wn-btn', 'aria-label': '다음 주', onclick: function () { move(1); } }, '›')
        ]),
        h('span', { class: 'status-pill ' + st[1], text: st[0] }),
        b.writeDue ? h('span', { class: 'due', text: '작성 마감 · ' + b.writeDue }) : null
      ])
    ]));
    if (S.team && S.team.length > 1) {
      headBox.appendChild(h('div', { class: 'team' }, [h('span', { class: 'team-l', text: '업체 작성분' })].concat(S.team.map(function (m) {
        var cls = m.status === '제출' ? 'ok' : m.status ? 'run' : 'none';
        return h('button', { class: 'team-p ' + cls + (m.id === S.uid ? ' on' : ''), onclick: async function () { if (m.id === S.uid) return; if (S.dirty) await save(); S.uid = m.id; S.step = 0; sync(); load(); } }, [h('i'), m.name + (m.id === b.user.id ? ' (나)' : ''), h('small', { text: m.status === '제출' ? '제출' : m.status ? '작성 중' : '미작성' })]);
      }))));
    }
    if (S.sharedVer) headBox.appendChild(h('div', { class: 'wh-note', text: '이 주차 보고서는 한예종에 공유되었습니다(v' + S.sharedVer + '). 지금 고치면 취합 화면에 변경 알림이 표시됩니다.' }));
  }
  function sync() { KR.setParams({ key: S.w.key, uid: S.uid === b.user.id ? '' : S.uid }); }
  async function move(d) {
    if (S.dirty) await save();
    S.w = d < 0 ? S.w.prev() : S.w.next(); S.step = 0; sync(); load();
  }
  function drawSteps() {
    stepBox.innerHTML = '';
    S.cats.forEach(function (ci, j) {
      var c = counts(ci), filled = c.p + c.n > 0;
      stepBox.appendChild(h('button', { class: 'st' + (S.step === j ? ' on' : '') + (filled ? ' filled' : ''), style: '--c1:' + R.CAT_C[ci][0] + ';--c2:' + R.CAT_C[ci][1], onclick: function () { go(j); }, 'aria-current': S.step === j ? 'step' : null }, [
        h('span', { class: 'st-n', text: filled ? '✓' : String(j + 1) }),
        h('span', { class: 'st-t' }, [h('b', { text: KR.CAT_SHORT[ci] }), h('small', { text: filled ? '실적 ' + c.p + ' · 계획 ' + c.n : '비어 있음' })])
      ]));
    });
    stepBox.appendChild(h('button', { class: 'st final' + (S.step === nstep() ? ' on' : ''), onclick: function () { go(nstep()); } }, [h('span', { class: 'st-n', text: '✔' }), h('span', { class: 'st-t' }, [h('b', { text: '확인·제출' }), h('small', { text: S.entry && S.entry.status === '제출' ? '제출함' : '마지막 단계' })])]));
    stepBox.style.setProperty('--n', S.cats.length + 1);
  }
  function go(j) { S.step = j; drawSteps(); drawBody(); drawFoot(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function drawFoot() {
    footBox.innerHTML = '';
    var last = S.step === nstep(), c = !last && counts(catAt(S.step));
    var nextLabel = last ? null : (S.step === nstep() - 1 ? '확인·제출' : KR.CAT_SHORT[catAt(S.step + 1)]);
    if (c && !c.p && !c.n) nextLabel = '해당 없음 · ' + nextLabel;
    footBox.appendChild(h('div', { class: 'wf-in' }, [
      h('button', { class: 'btn', disabled: S.step === 0, onclick: function () { go(S.step - 1); } }, '‹ 이전'),
      h('span', { class: 'savestate', id: 'savestate', text: S.dirty ? '작성 중…' : (S.savedAt ? '저장됨 ' + KR.fmtTime(S.savedAt).split(' ').pop() : '입력하면 자동 저장됩니다') }),
      last ? h('button', { class: 'btn gold lg', onclick: submit }, S.entry && S.entry.status === '제출' ? '다시 제출하기' : '제출하기')
        : h('button', { class: 'btn primary lg', onclick: function () { go(S.step + 1); } }, nextLabel + ' ›')
    ]));
  }

  /* ---------- 분야 단계 ---------- */
  function drawBody() {
    bodyBox.innerHTML = '';
    if (S.step === nstep()) return drawReview();
    var i = catAt(S.step);
    bodyBox.appendChild(h('div', { class: 'cat-head', style: '--c1:' + R.CAT_C[i][0] + ';--c2:' + R.CAT_C[i][1] }, [
      h('div', { class: 'ch-n', text: String(S.step + 1).padStart(2, '0') }),
      h('div', { class: 'ch-t' }, [h('h2', { text: KR.CATS[i] }), h('p', { text: KR.CAT_HINT[i] })]),
      h('button', { class: 'btn', onclick: function () { pasteModal(i); } }, '한글 문서에서 붙여넣기')
    ]));
    bodyBox.appendChild(h('div', { class: 'pair' }, [sideCard(i, 'prev', '지난 실적', S.w.periodPrev), sideCard(i, 'next', '향후 계획', S.w.periodNext)]));
    if (S.step === 0 && !S.entry) bodyBox.appendChild(h('div', { class: 'tip' }, [h('b', { text: '처음이라면  ' }), '한글로 쓰던 보고 내용을 통째로 복사해 「한글 문서에서 붙여넣기」에 넣어 보세요. □ 분야, ㅇ(소제목), - 세부 줄을 읽어 분야별로 나눠 넣습니다.']));
  }
  function importable(i) {
    if (!S.prevEntry) return [];
    var used = {}; S.data.cats[i].prev.forEach(function (x) { if (x.from) used[x.from] = 1; });
    return (KR.normData(S.prevEntry.data).cats[i].next || []).filter(function (x) { return !KR.blockEmpty(x) && !used[x.id]; });
  }
  function sideCard(i, side, label, period) {
    var list = S.data.cats[i][side], listBox = h('div', { class: 'blocks' });
    function redraw() {
      listBox.innerHTML = '';
      if (!list.length) listBox.appendChild(h('div', { class: 'empty-b', text: side === 'prev' ? '이번 주에 한 일이 없으면 비워 두세요' : '다음 주에 할 일이 없으면 비워 두세요' }));
      list.forEach(function (blk, j) { listBox.appendChild(blockEditor(i, side, list, j, redraw)); });
    }
    redraw();
    var imp = side === 'prev' ? importable(i) : [];
    return h('section', { class: 'side ' + side }, [
      h('header', {}, [
        h('div', {}, [h('span', { class: 'side-l', text: label }), h('span', { class: 'side-p', text: period })]),
        imp.length ? h('button', { class: 'btn sm tint', title: '지난주에 쓴 「향후 계획」을 이번 주 실적으로 가져옵니다', onclick: function () {
          imp.forEach(function (x) { list.push({ id: KR.uid(), t: x.t, c: x.c, d: x.d, from: x.id }); });
          touch(); drawBody(); drawSteps(); drawFoot(); KR.toast('지난주 계획 ' + imp.length + '건을 가져왔습니다. 실제 한 일에 맞게 고쳐 주세요');
        } }, '지난주 계획 가져오기 · ' + imp.length) : null
      ]),
      listBox,
      h('button', { class: 'add-b', onclick: function () { list.push({ id: KR.uid(), t: '', c: '', d: '' }); touch(); redraw(); drawSteps(); drawFoot(); var t = listBox.querySelectorAll('.be-t'); if (t.length) t[t.length - 1].focus(); } }, '＋ 항목 추가')
    ]);
  }
  function blockEditor(i, side, list, j, redraw) {
    var blk = list[j];
    var t = h('input', { class: 'be-t', value: blk.t, placeholder: '소제목', maxlength: 40, 'aria-label': '소제목' });
    var c = h('textarea', { class: 'be-c', rows: 1, value: blk.c, placeholder: side === 'prev' ? '한 일  예) 2026. 10. 31.(토) 10:00~12:00 /비대면' : '할 일  예) 2차 리뷰 시사 보고(11/10,화)', 'aria-label': '내용' });
    var d = h('textarea', { class: 'be-d', rows: 2, value: blk.d, placeholder: '세부 내용 — 한 줄에 하나씩 쓰면 앞에 「-」가 붙습니다', 'aria-label': '세부 내용' });
    var dates = h('div', { class: 'be-dates' });
    function showDates() {
      dates.innerHTML = '';
      var ds = R.blockDates(blk, S.w.mon).filter(function (x) { return KR.parse(x.date) >= S.w.nmon || side === 'next'; });
      if (!ds.length) return;
      dates.appendChild(h('span', { class: 'bd-l', text: '일정에 표시' }));
      ds.slice(0, 6).forEach(function (x) { var dt = KR.parse(x.date); dates.appendChild(h('span', { class: 'bd', text: (dt.getMonth() + 1) + '.' + dt.getDate() + ' ' + '일월화수목금토'[dt.getDay()] + (x.time ? ' ' + x.time : '') })); });
    }
    function upd() { blk.t = t.value; blk.c = c.value; blk.d = d.value; touch(); showDates(); drawStepsLight(); }
    [t, c, d].forEach(function (el) { el.addEventListener('input', function () { if (el.tagName === 'TEXTAREA') KR.autosize(el); upd(); }); });
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !c.value.includes('\n')) { e.preventDefault(); d.focus(); } });
    setTimeout(function () { KR.autosize(c); KR.autosize(d); }, 0);
    showDates();
    function mv(k) { var x = list.splice(j, 1)[0]; list.splice(j + k, 0, x); touch(); redraw(); }
    return h('div', { class: 'be', style: '--c1:' + R.CAT_C[i][0] + ';--c2:' + R.CAT_C[i][1] }, [
      h('div', { class: 'be-row' }, [h('span', { class: 'be-o', text: 'ㅇ' }), t, c]),
      h('div', { class: 'be-row sub' }, [h('span', { class: 'be-dash', text: '–' }), d]),
      dates,
      h('div', { class: 'be-tools' }, [
        blk.from ? h('span', { class: 'be-from', text: '지난주 계획에서' }) : null,
        h('span', { class: 'spacer' }),
        h('button', { class: 'icon-btn', title: '위로', 'aria-label': '위로', disabled: j === 0, onclick: function () { mv(-1); } }, '↑'),
        h('button', { class: 'icon-btn', title: '아래로', 'aria-label': '아래로', disabled: j === list.length - 1, onclick: function () { mv(1); } }, '↓'),
        h('button', { class: 'icon-btn danger', title: '삭제', 'aria-label': '삭제', onclick: async function () {
          if (!KR.blockEmpty(blk) && !(await KR.confirm('이 항목을 지울까요?', '지우기', true))) return;
          list.splice(j, 1); touch(); redraw(); drawSteps(); drawFoot();
        } }, '✕')
      ])
    ]);
  }
  var lightTimer = null;
  function drawStepsLight() { clearTimeout(lightTimer); lightTimer = setTimeout(function () { drawSteps(); drawFoot(); }, 500); }

  /* ---------- 붙여넣기 ---------- */
  function pasteModal(i) {
    var ta = h('textarea', { class: 'input mono', rows: 12, placeholder: '□ K예술영재 겨울캠프\nㅇ(키비주얼) 1차 시안 협의(11/2,월)\n  - 시안 3개 리뷰\n  - B안 시즌 컬러 배경으로 디벨롭 및 수정' });
    var side = h('div', { class: 'seg light' }, [['prev', '지난 실적에'], ['next', '향후 계획에']].map(function (x, k) { return h('button', { type: 'button', class: k === 0 ? 'on' : '', 'data-v': x[0], onclick: function (e) { Array.prototype.forEach.call(side.children, function (bt) { bt.classList.toggle('on', bt === e.currentTarget); }); } }, x[1]); }));
    var info = h('div', { class: 'muted small', style: 'margin-top:8px' });
    function sideVal() { return side.querySelector('.on').getAttribute('data-v'); }
    function preview() {
      var p = KR.parseText(ta.value, i), parts = [], skip = 0;
      p.cats.forEach(function (l, k) { if (!l.length) return; if (S.cats.indexOf(k) < 0) { skip += l.length; return; } parts.push(KR.CAT_SHORT[k] + ' ' + l.length + '건'); });
      info.textContent = parts.length ? '읽은 내용 · ' + parts.join(' · ') + (p.found ? '  (□ 분야 표시대로 나눠 넣습니다)' : '  (지금 분야에 넣습니다)') + (skip ? '  · 작성 권한이 없는 분야 ' + skip + '건은 넣지 않습니다' : '') : '';
    }
    ta.addEventListener('input', preview);
    var m = KR.modal('한글 문서에서 붙여넣기', [
      h('p', { class: 'muted', style: 'margin:0 0 12px', text: '「ㅇ(소제목) 내용」은 항목, 「- 」로 시작하는 줄은 세부 내용이 됩니다. □ 분야 줄이 있으면 분야별로 자동으로 나눠 넣습니다.' }),
      h('div', { style: 'margin-bottom:10px' }, [side]), ta, info
    ], [
      h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); } }),
      h('button', { class: 'btn primary', text: '넣기', onclick: function () {
        var p = KR.parseText(ta.value, i), n = 0, sv = sideVal();
        p.cats.forEach(function (l, k) { if (S.cats.indexOf(k) < 0) return; l.forEach(function (x) { S.data.cats[k][sv].push(x); n++; }); });
        if (!n) { KR.toast('넣을 내용이 없습니다', true); return; }
        m.close(); touch(); drawBody(); drawSteps(); drawFoot(); KR.toast(n + '건을 넣었습니다');
      } })
    ], { wide: true });
  }

  /* ---------- 확인·제출 ---------- */
  function drawReview() {
    var total = 0; S.cats.forEach(function (i) { var c = counts(i); total += c.p + c.n; });
    var doc = R.newDoc(S.w);
    doc.title = S.who.company + ' · ' + S.who.name;
    doc.cats = S.data.cats.map(function (c, i) { return S.cats.indexOf(i) >= 0 ? { prev: c.prev, next: c.next } : { prev: [], next: [] }; });
    var sch = R.schedule(doc);
    bodyBox.appendChild(h('div', { class: 'review-head' }, [
      h('div', { class: 'eyebrow', text: '마지막 단계' }),
      h('h2', { text: '이렇게 보고됩니다.' }),
      h('p', { text: total ? '케이브레인이 업체별 내용을 모아 한 장으로 취합합니다. 제출한 뒤에도 고칠 수 있어요.' : '아직 쓴 내용이 없습니다. 앞 단계에서 내용을 넣어 주세요.' }),
      h('div', { class: 'rv-chips' }, S.cats.map(function (i, j) { var c = counts(i); return h('button', { class: 'rv-chip' + (c.p + c.n ? '' : ' empty'), style: '--c2:' + R.CAT_C[i][1], onclick: function () { go(j); } }, [h('i'), KR.CAT_SHORT[i] + ' ', h('b', { text: c.p + c.n ? c.p + ' · ' + c.n : '없음' })]); }))
    ]));
    bodyBox.appendChild(h('div', { class: 'review-grid' }, [
      h('div', { class: 'paper' }, [R.docEl(doc, { showOrg: false })]),
      h('aside', { class: 'rv-side' }, [h('h3', { text: '다가오는 일정에 표시될 것' }), R.agendaEl(sch, { max: 12 })])
    ]));
  }
  async function submit() {
    var total = 0; S.cats.forEach(function (i) { var c = counts(i); total += c.p + c.n; });
    if (!total) { KR.toast('작성한 내용이 없습니다', true); return; }
    var btn = footBox.querySelector('.btn.gold'); KR.busy(btn, true);
    var ok = await save(true);
    KR.busy(btn, false);
    if (ok) {
      drawSteps(); drawFoot();
      var m = KR.modal('제출했습니다', [h('div', { class: 'done-mark', text: '✓' }), h('p', { style: 'text-align:center;margin:0', text: S.w.planName + ' 보고 내용을 제출했습니다. 고칠 일이 생기면 언제든 다시 들어와 고치면 됩니다.' })], [h('button', { class: 'btn primary', text: '확인', onclick: function () { m.close(); } })]);
    }
  }

  load();
})();

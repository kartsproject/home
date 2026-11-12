/* 작성 화면 — 허용된 분야만 단계로 + 확인·제출. 업체 작성분 관리 권한이 있으면 같은 주체 사람 것을, 관리자는 모든 주체의 사람 것을 대신 수정
 * 참고 자료: 회차마다 파일을 첨부(서버가 구글 드라이브에 저장) */
(async function () {
  'use strict';
  var KR = window.KR, R = window.KRReport, h = KR.h;
  var b = await KR.requireLogin('write');
  KR.topbar(b, 'write');
  var masterP = R.loadMaster();   // 일정 관리 목록 (확인 화면의 다가오는 일정)
  var app = document.getElementById('app');
  app.className = 'wrap deckwrap';
  var qk = KR.param('key');
  var S = { w: /^W-\d{4}-\d{2}-\d{2}$/.test(qk) || /^M-\d{4}-\d{2}$/.test(qk) ? KR.fromKey(qk) : KR.current(), uid: KR.param('uid') || ((b.user.perm || {}).write ? b.user.id : ''), who: null, team: null, admin: false, files: [], coSel: '', cats: [0, 1, 2, 3, 4],
    data: KR.emptyData(), entry: null, prevEntry: null, sharedVer: '', step: 0, timer: null, saving: false, dirty: false, savedAt: '' };

  function nstep() { return S.cats.length; }
  /** 주간·월간에 따라 바뀌는 말 */
  function L() {
    return S.w.type === 'M'
      ? { unit: '달', cur: '이번 달', nxt: '다음 달', last: '지난달', name: S.w.name + ' 월간', title: S.w.name + ' 월간보고', start: S.w.first, nstart: S.w.nfirst }
      : { unit: '주', cur: '이번 주', nxt: '다음 주', last: '지난주', name: S.w.planName, title: S.w.planName + ' 업무보고', start: S.w.mon, nstart: S.w.nmon };
  }
  function catAt(step) { return S.cats[step]; }
  function lsKey() { return 'kr4_local_' + S.uid + '_' + S.w.key; }
  async function load() {
    await masterP;
    app.innerHTML = '<div class="loading">불러오는 중…</div>';
    try {
      var r = await KR.call('my.get', { key: S.w.key, uid: S.uid === b.user.id ? '' : S.uid });
      S.who = r.who; S.team = r.team || null; S.admin = !!r.admin; S.files = r.files || [];
      if (!r.who) { drawPick(); return; }   // 작성 권한 없는 관리자: 고칠 사람부터 고름
      S.cats = r.who.cats.slice().sort();
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
        h('div', { class: 'eyebrow', text: (S.who ? S.who.company + ' · ' + S.who.name : '') + (forOther ? (S.admin && S.who.company !== b.user.company ? ' (관리자 대신 수정)' : ' (대신 작성)') : '') }),
        h('h1', {}, [L().title]),
        h('div', { class: 'wh-meta' }, [
          h('span', {}, [h('b', { text: (S.w.type === 'M' ? '이달 실적 ' : '지난 실적 ') }), S.w.periodPrev]),
          h('span', {}, [h('b', { text: (S.w.type === 'M' ? '다음 달 계획 ' : '향후 계획 ') }), S.w.periodNext]),
          S.w.type === 'M' ? h('span', {}, [h('b', { text: '서면보고 ' }), KR.kd(S.w.fri) + ' 17:00까지']) : h('span', {}, [h('b', { text: '대면보고 ' }), KR.kd(S.w.nmon)])
        ])
      ]),
      h('div', { class: 'wh-r' }, [
        h('div', { class: 'seg light', role: 'tablist', 'aria-label': '보고 종류' }, [['W', '주간'], ['M', '월간']].map(function (x) {
          return h('button', { class: S.w.type === x[0] || (x[0] === 'W' && S.w.type !== 'M') ? 'on' : '', role: 'tab', 'aria-selected': (S.w.type === 'M') === (x[0] === 'M') ? 'true' : 'false', onclick: function () { switchKind(x[0]); } }, x[1]);
        })),
        h('div', { class: 'weeknav' }, [
          h('button', { class: 'wn-btn', 'aria-label': '이전 ' + L().unit, onclick: function () { move(-1); } }, '‹'),
          h('span', { text: L().name }),
          h('button', { class: 'wn-btn', 'aria-label': '다음 ' + L().unit, onclick: function () { move(1); } }, '›')
        ]),
        h('span', { class: 'status-pill ' + st[1], text: st[0] }),
        h('button', { class: 'btn sm hw-btn', onclick: pickFile, title: '.hwp · .hwpx 보고서를 올리면 분야별로 나눠 채웁니다' }, '한글 파일 불러오기'),
        b.writeDue ? h('span', { class: 'due', text: '작성 마감 · ' + b.writeDue }) : null
      ])
    ]));
    var tb = teamBar(); if (tb) headBox.appendChild(tb);
    headBox.appendChild(filesBar());
    if (S.w.type === 'M') headBox.appendChild(h('div', { class: 'wh-note', text: '월간 입력은 주간보고에 없던 내용(이달 전체 성과·수치, 다음 달 계획 등)을 적는 곳입니다. 주간보고 내용은 취합할 때 자동으로 합쳐지니 다시 쓰지 않아도 됩니다.' }));
    if (S.sharedVer) headBox.appendChild(h('div', { class: 'wh-note', text: '이 ' + (S.w.type === 'M' ? '월간' : '주차') + ' 보고서는 한예종에 공유되었습니다(v' + S.sharedVer + '). 지금 고치면 취합 화면에 변경 알림이 표시됩니다.' }));
  }
  /** 대신 수정할 사람 고르기: 관리자는 주체를 고른 뒤 사람, 「업체 작성분 관리」는 같은 주체 사람 */
  function teamBar() {
    if (!S.team || !S.team.length || (!S.admin && S.team.length < 2)) return null;
    var cos = []; S.team.forEach(function (m) { if (cos.indexOf(m.company) < 0) cos.push(m.company); });
    var cur = S.team.filter(function (m) { return m.id === S.uid; })[0];
    if (!S.coSel || cos.indexOf(S.coSel) < 0) S.coSel = cur ? cur.company : cos[0];
    var people = S.admin ? S.team.filter(function (m) { return m.company === S.coSel; }) : S.team;
    var kids = [h('span', { class: 'team-l', text: S.admin ? '관리자 · 대신 수정' : '업체 작성분' })];
    if (S.admin && cos.length > 1) {
      var sel = h('select', { class: 'team-co', 'aria-label': '주체 고르기', onchange: function () { S.coSel = sel.value; drawHead(); } }, cos.map(function (c) { return h('option', { value: c, selected: c === S.coSel ? true : null, text: c }); }));
      kids.push(sel);
    }
    people.forEach(function (m) {
      var cls = m.status === '제출' ? 'ok' : m.status ? 'run' : 'none';
      kids.push(h('button', { class: 'team-p ' + cls + (m.id === S.uid ? ' on' : ''), onclick: function () { pick(m.id); } }, [h('i'), m.name + (m.id === b.user.id ? ' (나)' : ''), h('small', { text: m.status === '제출' ? '제출' : m.status ? '작성 중' : '미작성' })]));
    });
    return h('div', { class: 'team' }, kids);
  }
  async function pick(uid) { if (uid === S.uid) return; if (S.dirty) await save(); S.uid = uid; S.step = 0; sync(); load(); }
  /** 작성 권한이 없는 관리자가 처음 들어왔을 때: 사람 고르기만 */
  function drawPick() {
    app.innerHTML = '';
    headBox = h('div', { class: 'w-head' });
    headBox.appendChild(h('div', { class: 'wh-in' }, [h('div', { class: 'wh-l' }, [h('div', { class: 'eyebrow', text: '관리자 · 작성분 대신 수정' }), h('h1', { text: L().title }), h('div', { class: 'wh-meta' }, [h('span', { text: '아래에서 주체와 사람을 고르면 그 사람이 쓴 내용을 바로 고칠 수 있습니다.' })])])]));
    var tb = teamBar(); if (tb) headBox.appendChild(tb);
    app.appendChild(headBox);
    if (!S.team || !S.team.length) app.appendChild(h('div', { class: 'empty-state' }, [h('h3', { text: '작성하는 사람이 아직 없습니다' })]));
  }
  /** 참고 자료: 이 회차에 첨부한 파일 (구글 드라이브에 저장) */
  function filesBar() {
    var inp = h('input', { type: 'file', multiple: true, style: 'display:none', onchange: function () { upload(Array.prototype.slice.call(inp.files || [])); inp.value = ''; } });
    var list = h('div', { class: 'fl-list' }, S.files.map(function (f) { return KR.fileItem(f, { onDel: function () { S.files = S.files.filter(function (x) { return x.id !== f.id; }); drawHead(); } }); }));
    return h('div', { class: 'files-bar' }, [
      h('div', { class: 'fb-h' }, [h('b', { text: '참고 자료' }), h('small', { text: S.files.length ? S.files.length + '개 · 구글 드라이브에 저장됨' : '회의 자료·사진 등을 이 ' + (S.w.type === 'M' ? '달' : '주차') + ' 보고에 첨부할 수 있습니다 (파일 하나 10MB까지)' }),
        h('button', { class: 'btn sm fb-add', onclick: function () { inp.click(); } }, '＋ 파일 첨부'), inp]),
      S.files.length ? list : null
    ]);
  }
  async function upload(files) {
    if (!files.length) return;
    var big = files.filter(function (f) { return f.size > KR.FILE_MAX; });
    if (big.length) KR.toast(big.map(function (f) { return f.name; }).join(', ') + ' — 10MB가 넘어 올리지 않았습니다', true);
    files = files.filter(function (f) { return f.size <= KR.FILE_MAX; });
    for (var i = 0; i < files.length; i++) {
      var note = headBox && headBox.querySelector('.fb-h small'), add = headBox && headBox.querySelector('.fb-add');
      if (note) note.textContent = '올리는 중 ' + (i + 1) + '/' + files.length + ' · ' + files[i].name + ' …';
      KR.busy(add, true);
      try { var f = await KR.fileUpload(S.w.key, S.uid === b.user.id ? '' : S.uid, files[i]); S.files.push(f); }
      catch (e) { KR.toast(e.message, true); }
      finally { KR.busy(add, false); }
    }
    drawHead();
    if (files.length) KR.toast('첨부했습니다');
  }
  function sync() { KR.setParams({ key: S.w.key, uid: S.uid === b.user.id ? '' : S.uid }); }
  async function switchKind(k) {
    if ((S.w.type === 'M') === (k === 'M')) return;
    if (S.dirty) await save();
    S.w = k === 'M' ? KR.currentMonth() : KR.current(); S.step = 0; sync(); load();
  }
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
  function go(j) {
    j = Math.max(0, Math.min(nstep(), j));
    if (j === S.step && deck) return;
    S.step = j; drawSteps(); drawFoot(); place(true);
    var top = stepBox.getBoundingClientRect().top + window.scrollY - 60;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
  }
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

  /* ---------- 카드 덱: 분야마다 카드 한 장, 좌우로 넘김 ---------- */
  var deck = null, track = null, slides = [], ro = null;
  function drawBody() {
    bodyBox.innerHTML = '';
    track = h('div', { class: 'track' });
    deck = h('div', { class: 'deck', 'aria-roledescription': '카드 넘기기' }, [track]);
    slides = S.cats.map(function (i, j) { return catSlide(i, j); });
    slides.push(h('section', { class: 'slide review-slide', 'aria-label': '확인·제출' }));
    slides.forEach(function (sl, j) {
      sl.addEventListener('click', function (e) { if (j !== S.step) { e.preventDefault(); e.stopPropagation(); go(j); } }, true);
      track.appendChild(sl);
    });
    bodyBox.appendChild(deck);
    bodyBox.appendChild(h('div', { class: 'deck-hint', text: '← → 키(입력칸 밖에서), 옆 카드 누르기, 휴대폰에서는 좌우로 밀어서 넘길 수 있어요' }));
    swipe(deck);
    place(false);
  }
  function catSlide(i, j) {
    var kids = [
      h('div', { class: 'cat-head', style: '--c1:' + R.CAT_C[i][0] + ';--c2:' + R.CAT_C[i][1] }, [
        h('div', { class: 'ch-n', text: String(j + 1).padStart(2, '0') + ' / ' + String(S.cats.length).padStart(2, '0') }),
        h('div', { class: 'ch-t' }, [h('h2', { text: KR.CATS[i] }), h('p', { text: KR.CAT_HINT[i] })]),
        h('button', { class: 'btn', onclick: function () { pasteModal(i); } }, '한글 문서에서 붙여넣기')
      ]),
      h('div', { class: 'pair' }, [sideCard(i, 'prev', '지난 실적', S.w.periodPrev), sideCard(i, 'next', '향후 계획', S.w.periodNext)])
    ];
    if (j === 0 && !S.entry) kids.push(h('div', { class: 'tip' }, [h('b', { text: '처음이라면  ' }), '한글로 쓴 보고서가 있으면 위쪽 「한글 파일 불러오기」로 올리거나 화면에 끌어다 놓으세요. 표의 왼쪽 칸은 지난 실적, 오른쪽 칸은 향후 계획으로 분야별로 나눠 넣습니다. 글만 복사했다면 「한글 문서에서 붙여넣기」를 쓰세요.']));
    return h('section', { class: 'slide', style: '--c1:' + R.CAT_C[i][0] + ';--c2:' + R.CAT_C[i][1], 'aria-label': KR.CATS[i] }, kids);
  }
  /** 지금 카드를 가운데로 옮기고, 덱 높이를 지금 카드에 맞춤 */
  function place(animate) {
    if (!track) return;
    var cur = slides[S.step];
    var rv = slides[nstep()];
    if (S.step >= nstep() - 1) { rv.innerHTML = ''; drawReview(rv); }
    slides.forEach(function (sl, j) {
      sl.classList.toggle('on', j === S.step);
      sl.classList.toggle('near', Math.abs(j - S.step) === 1);
      sl.setAttribute('aria-hidden', j === S.step ? 'false' : 'true');
      Array.prototype.forEach.call(sl.children, function (c) { c.inert = j !== S.step; }); // 옆 카드 안은 못 건드리고, 카드 자체를 누르면 넘어감
    });
    track.classList.toggle('instant', !animate);
    var x = cur.offsetLeft - (deck.clientWidth - cur.offsetWidth) / 2;
    track.style.transform = 'translate3d(' + (-x) + 'px,0,0)';
    fitHeight();
    if (ro) ro.disconnect();
    if (window.ResizeObserver) { ro = new ResizeObserver(fitHeight); ro.observe(cur); }
    if (!animate) requestAnimationFrame(function () { track.classList.remove('instant'); });
  }
  function fitHeight() { var cur = slides[S.step]; if (deck && cur) deck.style.height = (cur.offsetHeight + 40) + 'px'; }
  window.addEventListener('resize', function () { place(false); });
  document.addEventListener('keydown', function (e) {
    if (!deck || document.querySelector('.modal-bg') || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(t) || (e.target && e.target.isContentEditable)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(S.step + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(S.step - 1); }
  });
  /** 휴대폰·트랙패드: 가로로 민 거리가 충분하면 넘김 (입력칸 안에서 시작한 동작은 무시) */
  function swipe(el) {
    var x0 = null, y0 = 0, dx = 0, locked = false;
    el.addEventListener('touchstart', function (e) {
      var t = e.target.tagName; if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(t)) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; locked = false;
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (x0 == null) return;
      dx = e.touches[0].clientX - x0; var dy = e.touches[0].clientY - y0;
      if (!locked && Math.abs(dy) > Math.abs(dx)) { x0 = null; return; }
      if (Math.abs(dx) > 10) { locked = true; track.classList.add('drag'); track.style.setProperty('--drag', dx + 'px'); }
    }, { passive: true });
    el.addEventListener('touchend', function () {
      track.classList.remove('drag'); track.style.removeProperty('--drag');
      if (x0 != null && locked && Math.abs(dx) > 60) go(S.step + (dx < 0 ? 1 : -1));
      x0 = null;
    });
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
      if (!list.length) listBox.appendChild(h('div', { class: 'empty-b', text: side === 'prev' ? L().cur + '에 한 일이 없으면 비워 두세요' : L().nxt + '에 할 일이 없으면 비워 두세요' }));
      list.forEach(function (blk, j) { listBox.appendChild(blockEditor(i, side, list, j, redraw)); });
    }
    redraw();
    var imp = side === 'prev' ? importable(i) : [];
    return h('section', { class: 'side ' + side }, [
      h('header', {}, [
        h('div', {}, [h('span', { class: 'side-l', text: label }), h('span', { class: 'side-p', text: period })]),
        imp.length ? h('button', { class: 'btn sm tint', title: L().last + '에 쓴 「향후 계획」을 ' + L().cur + ' 실적으로 가져옵니다', onclick: function () {
          imp.forEach(function (x) { list.push({ id: KR.uid(), t: x.t, c: x.c, d: x.d, box: x.box || '', from: x.id }); });
          touch(); drawBody(); drawSteps(); drawFoot(); KR.toast(L().last + ' 계획 ' + imp.length + '건을 가져왔습니다. 실제 한 일에 맞게 고쳐 주세요');
        } }, L().last + ' 계획 가져오기 · ' + imp.length) : null
      ]),
      listBox,
      h('button', { class: 'add-b', onclick: function () { list.push({ id: KR.uid(), t: '', c: '', d: '' }); touch(); redraw(); drawSteps(); drawFoot(); var t = listBox.querySelectorAll('.be-t'); if (t.length) t[t.length - 1].focus(); } }, '＋ 항목 추가')
    ]);
  }
  function blockEditor(i, side, list, j, redraw) {
    var blk = list[j];
    var t = h('input', { class: 'be-t', value: blk.t, placeholder: '소제목', maxlength: 40, 'aria-label': '소제목' });
    var c = h('textarea', { class: 'be-c', rows: 1, value: blk.c, placeholder: side === 'prev' ? '한 일  예) 2026. 10. 31.(토) 10:00~12:00 /비대면' : '할 일  예) 2차 리뷰 시사 보고(11/10,화)', 'aria-label': '내용' });
    // 세부 내용(「-」 줄): 줄마다 칸 하나. Enter로 다음 「-」 줄, 빈 줄에서 Backspace로 지움, 여러 줄 붙여넣기는 줄마다 나눔
    var dl = String(blk.d || '').split('\n');
    var subBox = h('div', { class: 'be-subs' });
    function dSync() { blk.d = dl.join('\n').replace(/\n+$/, ''); }
    function drawSubs(focusK, caret) {
      subBox.innerHTML = '';
      if (!dl.length) dl = [''];
      dl.forEach(function (line, k) {
        var ta = h('textarea', { class: 'be-d', rows: 1, value: line, placeholder: k === 0 ? '세부 내용 — Enter를 누르면 다음 「-」 줄' : '세부 내용', 'aria-label': '세부 내용 ' + (k + 1) });
        var kind = KR.lineKind(line);
        var mark = h('span', { class: 'be-dash', text: kind === 'item' ? '–' : '' });
        ta.addEventListener('input', function () { KR.autosize(ta); dl[k] = ta.value.replace(/\n/g, ' '); var kd = KR.lineKind(dl[k]); mark.textContent = kd === 'item' ? '–' : ''; upd(); });
        ta.addEventListener('keydown', function (e) {
          if (e.isComposing || e.keyCode === 229) return;          // 한글 조합 중에는 건드리지 않음
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            var pos = ta.selectionStart;
            dl.splice(k, 1, ta.value.slice(0, pos), ta.value.slice(ta.selectionEnd));
            upd(); drawSubs(k + 1, 0);
          } else if (e.key === 'Backspace' && ta.selectionStart === 0 && ta.selectionEnd === 0 && (k > 0 || (ta.value === '' && dl.length > 1))) {
            e.preventDefault();
            var keep = k > 0 ? dl[k - 1].length : 0;
            if (k > 0) dl[k - 1] += dl[k];
            dl.splice(k, 1);
            upd(); drawSubs(Math.max(0, k - 1), keep);
          } else if (e.key === 'ArrowUp' && k > 0 && ta.selectionStart === 0) { e.preventDefault(); drawFocus(k - 1, dl[k - 1].length); }
          else if (e.key === 'ArrowDown' && k < dl.length - 1 && ta.selectionEnd === ta.value.length) { e.preventDefault(); drawFocus(k + 1, 0); }
        });
        ta.addEventListener('paste', function (e) {
          var tx = ((e.clipboardData || window.clipboardData) || { getData: function () { return ''; } }).getData('text');
          if (!/\n/.test(tx)) return;
          e.preventDefault();
          var parts = tx.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(function (x) { return x.replace(/^\s*[-–]\s*/, ''); });
          var before = ta.value.slice(0, ta.selectionStart), after = ta.value.slice(ta.selectionEnd);
          parts[0] = before + parts[0]; var lastLen = parts[parts.length - 1].length; parts[parts.length - 1] += after;
          dl.splice.apply(dl, [k, 1].concat(parts));
          upd(); drawSubs(k + parts.length - 1, lastLen);
        });
        var del = h('button', { class: 'icon-btn be-x', title: '이 줄 지우기', 'aria-label': '세부 ' + (k + 1) + '번째 줄 지우기', hidden: dl.length === 1 && !line ? true : null, onclick: function () { dl.splice(k, 1); upd(); drawSubs(Math.min(k, dl.length - 1), null); } }, '✕');
        subBox.appendChild(h('div', { class: 'be-row sub' }, [mark, ta, del]));
        setTimeout(function () { KR.autosize(ta); }, 0);
      });
      if (focusK != null) drawFocus(focusK, caret);
    }
    function drawFocus(k, caret) {   // 바로 옮김(빨리 이어 치는 글자가 앞 칸에 들어가지 않게)
      var ta = subBox.querySelectorAll('.be-d')[k]; if (!ta) return;
      ta.focus(); var p = caret == null ? ta.value.length : Math.min(caret, ta.value.length); ta.setSelectionRange(p, p);
    }
    function addSub() { if (dl.length === 1 && dl[0] === '') { drawFocus(0, 0); return; } dl.push(''); upd(); drawSubs(dl.length - 1, 0); }
    drawSubs(null);
    var dates = h('div', { class: 'be-dates' });
    function showDates() {
      dates.innerHTML = '';
      var ds = R.blockDates(blk, L().start).filter(function (x) { return KR.parse(x.date) >= L().nstart || side === 'next'; });
      if (!ds.length) return;
      dates.appendChild(h('span', { class: 'bd-l', text: '일정에 표시' }));
      ds.slice(0, 6).forEach(function (x) { var dt = KR.parse(x.date); dates.appendChild(h('span', { class: 'bd', text: (dt.getMonth() + 1) + '.' + dt.getDate() + ' ' + '일월화수목금토'[dt.getDay()] + (x.time ? ' ' + x.time : '') })); });
    }
    // 상세 박스: 자세한 내용(주요 의견·검토 의견 등)을 상자 안에 따로 적음. 첫 줄을 「* 제목」으로 쓰면 박스 제목
    var bx = h('textarea', { class: 'be-box', rows: 3, value: blk.box || '', placeholder: '* 주요 의견\n배경은 무채색 계열로\n2안은 타이포를 달리해 재시안', 'aria-label': '상세 박스' });
    var bxWrap = h('div', { class: 'be-boxwrap' + (String(blk.box || '').trim() ? ' on' : '') }, [h('div', { class: 'be-boxh' }, [h('span', { text: '상세 박스' }), h('small', { text: '「* 」로 시작하는 줄은 박스 제목, 나머지는 한 줄에 하나씩' }), h('button', { class: 'icon-btn', title: '박스 지우기', 'aria-label': '박스 지우기', onclick: function () { bx.value = ''; bxWrap.classList.remove('on'); boxBtn.hidden = false; upd(); } }, '✕')]), bx]);
    var boxBtn = h('button', { class: 'chip-btn', hidden: String(blk.box || '').trim() ? true : null, onclick: function () { bxWrap.classList.add('on'); boxBtn.hidden = true; if (!bx.value) bx.value = '* 주요 의견\n'; KR.autosize(bx); bx.focus(); } }, '＋ 상세 박스');
    function upd() { blk.t = t.value; blk.c = c.value; dSync(); blk.box = bx.value.replace(/\s+$/, '').replace(/^\* 주요 의견$/, ''); touch(); showDates(); drawStepsLight(); }
    bx.addEventListener('input', function () { KR.autosize(bx); upd(); });
    [t, c].forEach(function (el) { el.addEventListener('input', function () { if (el.tagName === 'TEXTAREA') KR.autosize(el); upd(); }); });
    c.addEventListener('keydown', function (e) { if (e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' && !e.shiftKey && !c.value.includes('\n')) { e.preventDefault(); drawFocus(0, 0); } });
    setTimeout(function () { KR.autosize(c); KR.autosize(bx); }, 0);
    showDates();
    function mv(k) { var x = list.splice(j, 1)[0]; list.splice(j + k, 0, x); touch(); redraw(); }
    return h('div', { class: 'be', style: '--c1:' + R.CAT_C[i][0] + ';--c2:' + R.CAT_C[i][1] }, [
      h('div', { class: 'be-row' }, [h('span', { class: 'be-o', text: 'ㅇ' }), t, c]),
      subBox,
      bxWrap,
      dates,
      h('div', { class: 'be-tools' }, [
        h('button', { class: 'chip-btn', title: '「-」 세부 줄 하나 더', onclick: addSub }, '＋ 세부(-)'),
        boxBtn,
        blk.from ? h('span', { class: 'be-from', text: L().last + ' 계획에서' }) : null,
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

  /* ---------- 한글 파일 불러오기 (.hwp · .hwpx) — 파일은 이 브라우저 안에서만 읽음 ---------- */
  function pickFile() {
    var inp = h('input', { type: 'file', accept: '.hwp,.hwpx', style: 'display:none' });
    inp.addEventListener('change', function () { if (inp.files[0]) importFile(inp.files[0]); inp.remove(); });
    document.body.appendChild(inp); inp.click();
  }
  function loadReader() {
    if (window.KRHwp) return Promise.resolve();
    return new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = 'assets/hwpread.js'; sc.onload = ok; sc.onerror = function () { no(new Error('파일 읽기 도구를 불러오지 못했습니다')); }; document.head.appendChild(sc); });
  }
  function digits(s) { return (String(s || '').match(/\d+/g) || []).map(Number).join('.'); }
  async function importFile(file) {
    if (!/\.hwpx?$/i.test(file.name)) { KR.toast('.hwp 또는 .hwpx 파일만 불러올 수 있습니다', true); return; }
    var wait = KR.modal('한글 파일 읽는 중', [h('div', { class: 'loading', style: 'padding:30px 0', text: file.name + ' 읽는 중…' })], [], { locked: true, noFocus: true });
    var r, got;
    try { await loadReader(); r = await window.KRHwp.read(file); got = window.KRHwp.toData(r); }
    catch (e) { wait.close(); KR.toast(e.message || '파일을 읽지 못했습니다', true); return; }
    wait.close();
    var rows = [], pick = {}, total = 0;
    got.cats.forEach(function (c, i) {
      var n = c.prev.length + c.next.length; if (!n) return;
      var allowed = S.cats.indexOf(i) >= 0; total += n;
      if (allowed) pick[i] = true;
      var tags = c.prev.concat(c.next).map(function (b) { return b.t; }).filter(String);
      tags = tags.filter(function (t, k) { return tags.indexOf(t) === k; }).slice(0, 5).join(', ');
      var chk = h('input', { type: 'checkbox', checked: allowed, disabled: !allowed, onchange: function (e) { pick[i] = e.target.checked; } });
      rows.push(h('label', { class: 'imp-row' + (allowed ? '' : ' off'), style: '--c2:' + R.CAT_C[i][1] }, [
        chk, h('i'), h('div', {}, [h('b', { text: KR.CATS[i] }), h('small', { text: allowed ? '실적 ' + c.prev.length + ' · 계획 ' + c.next.length + (tags ? '  —  ' + tags : '') : '작성 권한이 없는 분야라 넣지 않습니다' })])
      ]));
    });
    if (!total) { KR.toast('파일에서 보고 내용(□ 분야, ㅇ 항목)을 찾지 못했습니다', true); return; }
    var mismatch = r.period && digits(r.period) !== digits(S.w.periodPrev);
    var mode = 'add';
    var seg = h('div', { class: 'seg light' }, [['add', '지금 내용 뒤에 추가'], ['replace', '고른 분야를 파일 내용으로 바꾸기']].map(function (x, k) {
      return h('button', { type: 'button', class: k === 0 ? 'on' : '', onclick: function (e) { mode = x[0]; Array.prototype.forEach.call(seg.children, function (bt) { bt.classList.toggle('on', bt === e.currentTarget); }); } }, x[1]);
    }));
    var m = KR.modal('한글 파일 불러오기', [
      h('div', { class: 'imp-file' }, [h('b', { text: file.name }), h('span', { text: [r.title, r.dateLine.replace(/^\/\s*/, ''), r.period ? '지난 실적 ' + r.period : ''].filter(String).join(' · ') })]),
      mismatch ? h('div', { class: 'notice warn', style: 'margin:0 0 12px' }, '파일의 실적 기간(' + r.period + ')이 지금 쓰는 ' + L().unit + '(' + S.w.periodPrev + ')와 다릅니다. 지난 보고서라면 날짜를 확인하고 고쳐 주세요.') : null,
      h('p', { class: 'muted small', style: 'margin:0 0 10px', text: '표의 왼쪽 칸은 「지난 실적」, 오른쪽 칸은 「향후 계획」으로 넣습니다. 넣을 분야를 고르세요.' }),
      h('div', { class: 'imp-list' }, rows),
      h('div', { style: 'margin-top:14px' }, [seg])
    ], [
      h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); } }),
      h('button', { class: 'btn primary', text: '넣기', onclick: function () {
        var n = 0, first = -1;
        got.cats.forEach(function (c, i) {
          if (!pick[i] || S.cats.indexOf(i) < 0) return;
          ['prev', 'next'].forEach(function (sd) {
            if (mode === 'replace') S.data.cats[i][sd] = [];
            c[sd].forEach(function (b) { S.data.cats[i][sd].push({ id: KR.uid(), t: b.t, c: b.c, d: b.d, box: b.box || '' }); n++; });
          });
          if (first < 0) first = S.cats.indexOf(i);
        });
        if (!n) { KR.toast('고른 분야가 없습니다', true); return; }
        m.close(); touch();
        if (first >= 0 && S.step !== nstep()) S.step = first;
        drawBody(); drawSteps(); drawFoot();
        KR.toast(n + '건을 넣었습니다. 카드를 넘기며 확인해 주세요');
      } })
    ], { wide: true });
  }
  // 파일을 화면에 끌어다 놓아도 불러옴
  document.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); document.body.classList.add('dropping'); } });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
  document.addEventListener('drop', function (e) {
    document.body.classList.remove('dropping');
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return; e.preventDefault();
    if (S.cats.length) importFile(f);
  });

  /* ---------- 확인·제출 ---------- */
  function drawReview(box) {
    var total = 0; S.cats.forEach(function (i) { var c = counts(i); total += c.p + c.n; });
    var doc = R.newDoc(S.w);
    doc.title = S.who.company + ' · ' + S.who.name;
    doc.cats = S.data.cats.map(function (c, i) { return S.cats.indexOf(i) >= 0 ? { prev: c.prev, next: c.next } : { prev: [], next: [] }; });
    var sch = R.schedule(doc);
    box.appendChild(h('div', { class: 'review-head' }, [
      h('div', { class: 'eyebrow', text: '마지막 단계' }),
      h('h2', { text: '이렇게 보고됩니다.' }),
      h('p', { text: total ? '케이브레인이 업체별 내용을 모아 한 장으로 취합합니다. 제출한 뒤에도 고칠 수 있어요.' : '아직 쓴 내용이 없습니다. 앞 단계에서 내용을 넣어 주세요.' }),
      h('div', { class: 'rv-chips' }, S.cats.map(function (i, j) { var c = counts(i); return h('button', { class: 'rv-chip' + (c.p + c.n ? '' : ' empty'), style: '--c2:' + R.CAT_C[i][1], onclick: function () { go(j); } }, [h('i'), KR.CAT_SHORT[i] + ' ', h('b', { text: c.p + c.n ? c.p + ' · ' + c.n : '없음' })]); }))
    ]));
    box.appendChild(h('div', { class: 'review-grid' }, [
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
      var m = KR.modal('제출했습니다', [h('div', { class: 'done-mark', text: '✓' }), h('p', { style: 'text-align:center;margin:0', text: L().name + ' 보고 내용을 제출했습니다. 고칠 일이 생기면 언제든 다시 들어와 고치면 됩니다.' })], [h('button', { class: 'btn primary', text: '확인', onclick: function () { m.close(); } })]);
    }
  }

  load();
})();

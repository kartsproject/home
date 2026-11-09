/* 일정 관리 — 분야별 멘토링·사업 일정을 달력과 일정표로 보고, 「취합·편집」·「관리자」 권한이면 추가·수정·삭제
 * 데이터: 백엔드 일정 탭 (sched.list · sched.save · sched.remove). 여기서 고친 일정은 취합·작성·최종본의 「다가오는 일정」 달력에도 나온다 */
(async function () {
  'use strict';
  var KR = window.KR, R = window.KRReport, h = KR.h;
  var b = await KR.requireLogin();
  KR.topbar(b, 'sched');
  var app = document.getElementById('app');
  app.className = 'wrap wide sc';
  document.title = '일정 관리 · K예술영재 업무보고';

  var FIELDS = ['음악', '무용', '전통예술', '미술', '공통'];
  var FIELD_KEY = { '음악': 'mu', '무용': 'da', '전통예술': 'tr', '미술': 'ar', '공통': 'co' };
  var KINDS = ['회차', '신청·제출', '행사', '준비', '회의'];
  var MODES = ['', '대면', '비대면', '온라인'];
  var STATUS = ['', '확인 필요', '취소'];
  var HOLI = { '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴', '2026-10-03': '개천절', '2026-10-09': '한글날', '2026-12-25': '성탄절', '2027-01-01': '신정' };
  var WD = '일월화수목금토';
  var TODAY = KR.ymd(KR.today());

  var S = { items: [], canEdit: false, on: {}, cat: -1, month: '', loaded: false };
  FIELDS.forEach(function (f) { S.on[f] = true; });
  try { var sv = JSON.parse(localStorage.getItem('kr4_sched_filter') || 'null'); if (sv) { FIELDS.forEach(function (f) { if (f in (sv.on || {})) S.on[f] = !!sv.on[f]; }); if (typeof sv.cat === 'number') S.cat = sv.cat; } } catch (e) { }
  function saveFilter() { try { localStorage.setItem('kr4_sched_filter', JSON.stringify({ on: S.on, cat: S.cat })); } catch (e) { } }

  /* ---------- 날짜 도우미 ---------- */
  function last(x) { return x.end || x.date; }
  function md(s) { var d = KR.parse(s); return (d.getMonth() + 1) + '/' + d.getDate(); }
  function wd(s) { return WD[KR.parse(s).getDay()]; }
  function monthKey(s) { return String(s).slice(0, 7); }
  function isSession(x) { return Number(x.cat) === 0 && x.kind === '회차' && x.field !== '공통'; }
  function stateOf(x) {
    if (x.status === '취소') return 'cancel';
    if (last(x) < TODAY) return 'done';
    if (x.date <= TODAY) return 'today';
    return x.status === '확인 필요' ? 'check' : 'plan';
  }
  var STATE_LABEL = { cancel: '취소', done: '완료', today: '오늘', check: '확인 필요', plan: '예정', soon: '다가오는 회차' };
  function upcoming() { return S.items.filter(function (x) { return isSession(x) && x.status !== '취소' && last(x) >= TODAY; }); }
  function visible(x) { return S.on[x.field] !== false && (S.cat < 0 || Number(x.cat) === S.cat); }

  /* ---------- 틀 ---------- */
  var head = h('header', { class: 'sc-head' });
  var sumBox = h('div', { class: 'sc-sum' });
  var filt = h('div', { class: 'sc-filt' });
  var cal = h('section', { class: 'sc-cal', 'aria-label': '월간 달력' });
  var agenda = h('section', { class: 'sc-ag', 'aria-label': '날짜순 일정표' });
  app.appendChild(head); app.appendChild(sumBox); app.appendChild(filt); app.appendChild(cal); app.appendChild(agenda);

  function drawHead() {
    head.innerHTML = '';
    head.appendChild(h('div', {}, [
      h('div', { class: 'eyebrow', text: '일정 관리' }),
      h('h1', { text: 'K예술영재 사업 일정' }),
      h('p', { class: 'muted', text: S.canEdit
        ? '분야별 멘토링 회차와 캠프·공연 준비 일정을 관리합니다. 날짜 칸이나 일정을 눌러 추가·수정하세요. 여기서 고친 일정은 보고서의 「다가오는 일정」에도 바로 나옵니다.'
        : '분야별 멘토링 회차와 캠프·공연 준비 일정입니다. 일정 수정은 취합·편집 권한이 있는 담당자가 합니다.' })
    ]));
    head.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'btn sm', onclick: function () { load(true); } }, '새로고침'),
      S.canEdit ? h('button', { class: 'btn primary', onclick: function () { edit(null, TODAY); } }, '+ 일정 추가') : null
    ]));
  }

  /* ---------- 요약 ---------- */
  function drawSummary() {
    sumBox.innerHTML = '';
    var up = upcoming(), nx = up[0];
    var next = h('div', { class: 'sc-tile next' });
    if (nx) {
      var dd = Math.round((KR.parse(nx.date) - KR.today()) / 864e5);
      var same = up.filter(function (x) { return x.date === nx.date && x !== nx; }).map(function (x) { return x.field + ' ' + (x.round || ''); });
      next.appendChild(h('span', { class: 'k', text: '다음 멘토링' }));
      next.appendChild(h('span', { class: 'v' }, [h('em', { class: 'dday', text: dd === 0 ? 'D-DAY' : 'D-' + dd }), md(nx.date) + '(' + wd(nx.date) + ') ' + nx.field + ' ' + (nx.round || '')]));
      next.appendChild(h('span', { class: 's', text: nx.title + (same.length ? ' · 같은 날 ' + same.join(', ') : '') }));
    } else {
      next.appendChild(h('span', { class: 'k', text: '다음 멘토링' }));
      next.appendChild(h('span', { class: 'v', text: '남은 회차 없음' }));
    }
    sumBox.appendChild(next);
    FIELDS.slice(0, 4).forEach(function (f) {
      var list = S.items.filter(function (x) { return x.field === f && isSession(x) && x.status !== '취소'; });
      var done = list.filter(function (x) { return last(x) < TODAY; }).length;
      sumBox.appendChild(h('div', { class: 'sc-tile f-' + FIELD_KEY[f] }, [
        h('span', { class: 'k', text: f }),
        h('span', { class: 'v', text: done + ' / ' + list.length + '회' }),
        h('span', { class: 's', text: '진행 완료 / 전체 회차' }),
        h('span', { class: 'bar' }, h('i', { style: 'width:' + (list.length ? Math.round(done / list.length * 100) : 0) + '%' }))
      ]));
    });
    var chk = S.items.filter(function (x) { return x.status === '확인 필요' && last(x) >= TODAY; });
    if (chk.length) sumBox.appendChild(h('div', { class: 'sc-tile warn' }, [h('span', { class: 'k', text: '확인 필요' }), h('span', { class: 'v', text: chk.length + '건' }), h('span', { class: 's', text: chk.map(function (x) { return md(x.date) + ' ' + x.field + ' ' + (x.round || x.title); }).join(' · ') })]));
  }

  /* ---------- 필터 ---------- */
  function drawFilters() {
    filt.innerHTML = '';
    filt.appendChild(h('span', { class: 'lab', text: '분야' }));
    FIELDS.forEach(function (f) {
      filt.appendChild(h('button', { type: 'button', class: 'sc-chip f-' + FIELD_KEY[f], 'aria-pressed': S.on[f] ? 'true' : 'false', onclick: function () { S.on[f] = !S.on[f]; saveFilter(); redraw(); } }, [h('i'), f]));
    });
    filt.appendChild(h('span', { class: 'lab sp', text: '업무 분류' }));
    var sel = h('select', { class: 'input sel-sm', 'aria-label': '업무 분류', onchange: function () { S.cat = Number(sel.value); saveFilter(); redraw(); } },
      [h('option', { value: '-1', text: '전체' })].concat(KR.CAT_SHORT.map(function (n, k) { return h('option', { value: String(k), text: n }); })));
    sel.value = String(S.cat);
    filt.appendChild(sel);
  }

  /* ---------- 달력 ---------- */
  function months() {
    var keys = {}, from = '2026-09', to = '2027-01';
    S.items.forEach(function (x) { keys[monthKey(x.date)] = 1; keys[monthKey(last(x))] = 1; });
    var all = Object.keys(keys).concat([from, to, monthKey(TODAY)]).sort();
    var a = all[0], z = all[all.length - 1], out = [], y = +a.slice(0, 4), m = +a.slice(5, 7);
    while (true) { var k = y + '-' + (m < 10 ? '0' : '') + m; out.push(k); if (k >= z) break; m++; if (m > 12) { m = 1; y++; } }
    return out;
  }
  function onDay(day) { return S.items.filter(function (x) { return visible(x) && x.date <= day && day <= last(x); }); }
  function drawCal() {
    var ms = months();
    if (!S.month || ms.indexOf(S.month) < 0) S.month = ms.indexOf(monthKey(TODAY)) >= 0 ? monthKey(TODAY) : ms[0];
    var mi = ms.indexOf(S.month), y = +S.month.slice(0, 4), mo = +S.month.slice(5, 7) - 1;
    cal.innerHTML = '';
    var tabs = h('div', { class: 'sc-mtabs', role: 'tablist' }, ms.map(function (k, i) {
      var cnt = S.items.filter(function (x) { return visible(x) && (monthKey(x.date) === k || monthKey(last(x)) === k); }).length;
      var lab = (i === 0 || k.slice(5) === '01' ? k.slice(2, 4) + '. ' : '') + (+k.slice(5)) + '월';
      return h('button', { role: 'tab', class: k === S.month ? 'on' : '', 'aria-selected': k === S.month ? 'true' : 'false', onclick: function () { S.month = k; drawCal(); } }, [lab, cnt ? h('em', { text: String(cnt) }) : null]);
    }));
    cal.appendChild(h('div', { class: 'sc-ctop' }, [
      h('h2', { text: y + '년 ' + (mo + 1) + '월' }), tabs,
      h('div', { class: 'row' }, [
        h('button', { class: 'icon-btn sc-nav', 'aria-label': '이전 달', disabled: mi <= 0, onclick: function () { S.month = ms[mi - 1]; drawCal(); } }, '‹'),
        h('button', { class: 'icon-btn sc-nav', 'aria-label': '다음 달', disabled: mi >= ms.length - 1, onclick: function () { S.month = ms[mi + 1]; drawCal(); } }, '›')
      ])
    ]));
    var grid = h('div', { class: 'sc-grid' });
    WD.split('').forEach(function (w, i) { grid.appendChild(h('div', { class: 'sc-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : ''), text: w })); });
    var first = new Date(y, mo, 1), lastD = new Date(y, mo + 1, 0), start = KR.add(first, -first.getDay());
    var cells = Math.ceil((first.getDay() + lastD.getDate()) / 7) * 7;
    for (var i = 0; i < cells; i++) {
      var dt = KR.add(start, i), key = KR.ymd(dt), out = dt.getMonth() !== mo, w = dt.getDay();
      var evs = out ? [] : onDay(key);
      var sessFields = {}; evs.forEach(function (x) { if (isSession(x) && x.status !== '취소') sessFields[x.field] = 1; });
      var cell = h('div', { class: 'sc-day' + (out ? ' out' : '') + (w === 0 || HOLI[key] ? ' sun' : '') + (w === 6 ? ' sat' : '') + (key === TODAY ? ' today' : '') + (Object.keys(sessFields).length > 1 ? ' busy' : '') });
      cell.appendChild(h('div', { class: 'dh' }, [h('span', { class: 'dn', text: String(dt.getDate()) }), HOLI[key] && !out ? h('span', { class: 'hn', text: HOLI[key] }) : null]));
      evs.forEach(function (x) { cell.appendChild(pill(x, key)); });
      if (!out && S.canEdit) (function (k) { cell.appendChild(h('button', { class: 'sc-addday', 'aria-label': md(k) + ' 일정 추가', title: '이 날 일정 추가', onclick: function () { edit(null, k); } }, '+')); })(key);
      grid.appendChild(cell);
    }
    cal.appendChild(h('div', { class: 'sc-gscroll' }, grid));
    cal.appendChild(h('div', { class: 'sc-legend' }, [
      h('span', {}, [h('i', { class: 'lg sess' }), '멘토링 회차·행사']),
      h('span', {}, [h('i', { class: 'lg dl' }), '신청·제출·준비']),
      h('span', { text: '✓ 진행 완료' }),
      h('span', { text: '! 확인 필요' }),
      h('span', {}, [h('i', { class: 'lg busy' }), '같은 날 2개 분야 회차'])
    ]));
  }
  function pill(x, key) {
    var st = stateOf(x), light = x.kind === '신청·제출' || x.kind === '준비' || x.kind === '회의';
    var lab = x.end ? (key === x.date ? '시작' : key === x.end ? '마감' : '기간') : '';
    var head = x.field === '공통' ? (x.round || KR.CAT_SHORT[Number(x.cat) || 0]) : x.field + (x.round ? ' ' + x.round : '');
    var sub = x.kind === '회차' || x.kind === '행사' ? (x.time || '') : x.title;
    if (x.field === '공통' || (!x.round && x.kind !== '회차')) sub = x.title;
    return h('button', { type: 'button', class: 'sc-ev f-' + FIELD_KEY[x.field] + (light ? ' lt' : '') + ' st-' + st, title: R.schedLabel(x) + (x.time ? ' ' + x.time : ''), onclick: function () { if (S.canEdit) edit(x); else jump(x.id); } }, [
      h('b', { text: head + (lab ? ' ' + lab : '') }), h('span', { class: 't', text: sub })
    ]);
  }

  /* ---------- 일정표 ---------- */
  function drawAgenda() {
    agenda.innerHTML = '';
    var list = S.items.filter(visible), soonDate = (upcoming()[0] || {}).date;
    agenda.appendChild(h('div', { class: 'sc-agh' }, [h('h2', { text: '날짜순 일정표' }), h('span', { class: 'muted small', text: list.length + '건 · 시간은 한국 시간' })]));
    if (!list.length) { agenda.appendChild(h('div', { class: 'ag-empty', text: S.items.length ? '고른 분야·분류에 해당하는 일정이 없습니다' : '아직 등록된 일정이 없습니다' })); return; }
    var groups = {};
    list.forEach(function (x) { (groups[monthKey(x.date)] = groups[monthKey(x.date)] || []).push(x); });
    Object.keys(groups).sort().forEach(function (k) {
      var sec = h('div', { class: 'sc-mg' }, [h('h3', { text: k.slice(0, 4) + '년 ' + (+k.slice(5)) + '월' })]);
      groups[k].forEach(function (x) {
        var st = stateOf(x); if (st === 'plan' && isSession(x) && x.date === soonDate) st = 'soon';
        var details = String(x.detail || '').split('\n').filter(function (l) { return l.trim(); });
        sec.appendChild(h('article', { class: 'sc-row f-' + FIELD_KEY[x.field] + ' st-' + st, id: 'ev-' + x.id }, [
          h('div', { class: 'd' }, [x.end ? md(x.date) + '–' + md(x.end) : md(x.date), h('small', { text: x.end ? wd(x.date) + '–' + wd(x.end) : wd(x.date) + '요일' + (HOLI[x.date] ? ' · ' + HOLI[x.date] : '') })]),
          h('div', { class: 't' }, [x.time || (x.end ? '기간' : '시간 미정'), h('small', { text: x.mode || x.kind })]),
          h('div', { class: 'b' }, [
            h('div', { class: 'ttl' }, [h('span', { class: 'tag', text: (x.field === '공통' ? KR.CAT_SHORT[Number(x.cat) || 0] : x.field) + (x.round ? ' ' + x.round : '') }), x.title]),
            x.place || x.people ? h('div', { class: 'meta' }, [x.place ? h('span', {}, [h('b', { text: '장소 ' }), x.place]) : null, x.people ? h('span', {}, [h('b', { text: '멘토·교강사 ' }), x.people]) : null]) : null,
            details.length ? h('ul', { class: 'det' }, details.map(function (l) { return h('li', { text: l.replace(/^[-·•]\s*/, '') }); })) : null
          ]),
          h('div', { class: 's' }, [
            h('span', { class: 'pill st-' + st, text: STATE_LABEL[st] }),
            S.canEdit ? h('div', { class: 'row' }, [
              h('button', { class: 'btn sm', onclick: function () { edit(x); } }, '수정'),
              h('button', { class: 'btn sm danger-ghost', onclick: function () { remove(x); } }, '삭제')
            ]) : null
          ])
        ]));
      });
      agenda.appendChild(sec);
    });
  }
  function jump(id) {
    var r = document.getElementById('ev-' + id); if (!r) return;
    r.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
  }

  /* ---------- 추가 · 수정 ---------- */
  function edit(x, date) {
    var isNew = !x; x = x || { date: date || TODAY, field: '음악', cat: 0, kind: '회차' };
    function sel(opts, val, labels) { var s = h('select', { class: 'input' }, opts.map(function (o, i) { return h('option', { value: String(o), text: labels ? labels[i] : (o === '' ? '(없음)' : String(o)) }); })); s.value = String(val == null ? '' : val); return s; }
    var f = {
      date: h('input', { class: 'input', type: 'date', value: x.date || '' }),
      end: h('input', { class: 'input', type: 'date', value: x.end || '' }),
      time: h('input', { class: 'input', value: x.time || '', placeholder: '예) 10:00~12:00 · 오후 · 23:59' }),
      field: sel(FIELDS, x.field || '음악'),
      cat: sel([0, 1, 2, 3, 4], Number(x.cat) || 0, KR.CAT_SHORT),
      kind: sel(KINDS, x.kind || '회차'),
      round: h('input', { class: 'input', value: x.round || '', placeholder: '예) 2회차 · 사전' }),
      title: h('input', { class: 'input', value: x.title || '', placeholder: '예) 1:1 개별 멘토링' }),
      place: h('input', { class: 'input', value: x.place || '', placeholder: '예) 한예종 서초동캠퍼스 음악원 · Zoom' }),
      mode: sel(MODES, x.mode || ''),
      people: h('input', { class: 'input', value: x.people || '', placeholder: '예) 정은영 (국립발레단 수석무용수)' }),
      detail: h('textarea', { class: 'input', rows: '4', placeholder: '한 줄에 하나씩 (예: 10:00–11:00 전체 수업)' }),
      status: sel(STATUS, x.status || '', ['날짜로 자동 (완료·예정)', '확인 필요', '취소'])
    };
    f.detail.value = x.detail || '';
    // 분야를 공통 외로 고르면 업무 분류는 심화멘토링이 기본
    f.field.addEventListener('change', function () { if (isNew && f.field.value !== '공통') f.cat.value = '0'; });
    var err = h('div', { class: 'err', role: 'alert' });
    function fld(label, el, wide) { return h('label', { class: 'field' + (wide ? ' wide' : '') }, [h('span', { text: label }), el]); }
    var save = h('button', { class: 'btn primary', text: isNew ? '추가' : '저장' });
    var m = KR.modal(isNew ? '일정 추가' : '일정 수정', h('div', { class: 'sc-form' }, [
      fld('날짜', f.date), fld('끝 날짜 (여러 날일 때)', f.end), fld('시간', f.time),
      fld('분야', f.field), fld('업무 분류', f.cat), fld('구분', f.kind),
      fld('회차', f.round), fld('방식', f.mode), fld('상태', f.status),
      fld('내용', f.title, true), fld('장소', f.place, true), fld('멘토·교강사', f.people, true), fld('세부 (줄마다 하나)', f.detail, true), err
    ]), [
      isNew ? null : h('button', { class: 'btn danger-ghost', style: 'margin-right:auto', onclick: function () { m.close(); remove(x); } }, '삭제'),
      h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); } }), save
    ], { wide: true });
    save.onclick = async function () {
      err.textContent = '';
      if (!f.date.value) { err.textContent = '날짜를 넣으세요'; return; }
      if (!f.title.value.trim()) { err.textContent = '내용을 넣으세요'; return; }
      if (f.end.value && f.end.value < f.date.value) { err.textContent = '끝 날짜가 시작 날짜보다 빠릅니다'; return; }
      var item = { id: isNew ? '' : x.id };
      Object.keys(f).forEach(function (k) { item[k] = f[k].value; });
      KR.busy(save, true);
      try { var r = await KR.call('sched.save', { item: item }); apply(r); m.close(); KR.toast(isNew ? '일정을 추가했습니다' : '일정을 고쳤습니다'); S.month = monthKey(item.date); redraw(); }
      catch (e) { err.textContent = e.message; }
      KR.busy(save, false);
    };
  }
  async function remove(x) {
    if (!(await KR.confirm(md(x.date) + ' ' + (x.field !== '공통' ? x.field + ' ' : '') + (x.round ? x.round + ' ' : '') + x.title + ' 일정을 지울까요? 보고서 달력에서도 빠집니다.', '삭제', true))) return;
    try { var r = await KR.call('sched.remove', { id: x.id }); apply(r); KR.toast('일정을 지웠습니다'); redraw(); }
    catch (e) { KR.toast(e.message, true); }
  }

  /* ---------- 불러오기 ---------- */
  function apply(r) { S.items = r.items || []; S.canEdit = !!r.canEdit; R.masterSaved(r); }
  function redraw() { drawHead(); drawSummary(); drawFilters(); drawCal(); drawAgenda(); }
  async function load(fresh) {
    if (!S.loaded) { cal.innerHTML = '<div class="loading">불러오는 중…</div>'; }
    var r = await R.loadMaster({ fresh: !!fresh });
    if (!r) {
      head.innerHTML = ''; sumBox.innerHTML = ''; filt.innerHTML = ''; agenda.innerHTML = '';
      cal.innerHTML = '';
      cal.appendChild(h('div', { class: 'notice warn' }, [h('b', { text: '일정을 불러오지 못했습니다. ' }), '백엔드(Code.gs)가 일정 기능이 들어간 v4.1로 배포됐는지 확인하세요. 배포 뒤 편집기에서 setup을 한 번 실행해야 「일정」 탭이 생깁니다.']));
      return;
    }
    apply(r); S.loaded = true; redraw();
    if (fresh) KR.toast('최신 일정으로 고쳤습니다');
  }
  load(false);
})();

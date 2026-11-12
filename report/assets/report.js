/* K예술영재 주간업무보고 v4.1 — 보고서 (취합 합치기 · 일정 인식 · 일정 관리 연결 · 월간 합치기 · 문서 화면 · 회의 화면 · 달력 · 인쇄 · 한글 파일) */
(function (root) {
  'use strict';
  var KR = root.KR, h = KR.h;
  // 분야 색 (애플 시스템 색 계열) — [밝은 색, 진한 색]
  var CAT_C = [['#64D2FF', '#0A84FF'], ['#5DE38A', '#28A745'], ['#FF6B8B', '#FF2D55'], ['#FFB340', '#F08A00'], ['#D18CFF', '#AF52DE']];
  var SIDES = ['prev', 'next'];
  var WD = '일월화수목금토';

  /* =========================================================
   * 1) 취합 — 개인 작성분을 분야·구분별로 업체 순서대로 모으기
   * ========================================================= */
  function sig(b) { return [b.t || '', b.c || '', b.d || '', b.box || ''].join('\u0001'); }
  function newDoc(w) {
    return {
      type: w.type || 'W', key: w.key, title: w.title, dateLine: w.dateLine,
      headPrev: '지난 실적', headNext: '향후 계획', periodPrev: w.periodPrev, periodNext: w.periodNext,
      author: (KR.boot && KR.boot.author) || '(주)케이브레인컴퍼니',
      showOrg: false, cats: KR.CATS.map(function () { return { prev: [], next: [] }; }),
      schedOff: {}, schedAdd: []
    };
  }
  function sortEntries(entries, companies) {
    return entries.slice().sort(function (a, b) {
      var ca = companies.indexOf(a.company), cb = companies.indexOf(b.company);
      if (ca < 0) ca = 99; if (cb < 0) cb = 99;
      return ca - cb || String(a.name).localeCompare(String(b.name), 'ko');
    });
  }
  function sourceBlocks(entries, companies) {
    var list = [];
    sortEntries(entries, companies).forEach(function (e) {
      var d = KR.normData(e.data);
      d.cats.forEach(function (c, i) {
        SIDES.forEach(function (s) {
          c[s].forEach(function (b) {
            if (KR.blockEmpty(b)) return;
            list.push({ src: e.uid + ':' + b.id, cat: i, side: s, org: e.company, by: e.name, t: b.t || '', c: b.c || '', d: b.d || '', box: b.box || '' });
          });
        });
      });
    });
    return list;
  }
  function fromSource(x) { return { id: KR.uid(), src: x.src, org: x.org, by: x.by, t: x.t, c: x.c, d: x.d, box: x.box, sig: sig(x), edited: false }; }
  function compile(entries, companies, w) {
    var doc = newDoc(w);
    sourceBlocks(entries, companies).forEach(function (x) { doc.cats[x.cat][x.side].push(fromSource(x)); });
    return doc;
  }
  /** 편집본과 지금 작성분 비교 → {added, changed, removed} */
  /** 정리(AI)하면서 다른 항목에 합쳐진 원본: 내용이 그대로면 없는 셈 친다 */
  function absorbed(doc, x) { var a = doc.absorbed || {}; return Object.prototype.hasOwnProperty.call(a, x.src) && a[x.src] === sig(x); }
  function diff(doc, entries, companies) {
    var cur = {}, seen = {}, r = { added: 0, changed: 0, removed: 0 }, gone = doc.removed || {};
    sourceBlocks(entries, companies).forEach(function (x) { if (!gone[x.src] && !absorbed(doc, x)) cur[x.src] = x; });
    doc.cats.forEach(function (c) { SIDES.forEach(function (s) { c[s].forEach(function (b) {
      if (!b.src) return;
      seen[b.src] = 1;
      var x = cur[b.src];
      if (!x) { if (!b.edited) r.removed++; }
      else if (sig(x) !== b.sig) r.changed++;
    }); }); });
    var ab = doc.absorbed || {};
    Object.keys(cur).forEach(function (k) { if (!seen[k]) { if (Object.prototype.hasOwnProperty.call(ab, k)) r.changed++; else r.added++; } });
    r.total = r.added + r.changed + r.removed;
    return r;
  }
  /** 변경분 반영: 손대지 않은 블록은 새 내용으로, 손댄 블록은 그대로, 새 블록은 같은 업체 뒤에 */
  function remerge(doc, entries, companies) {
    var cur = {}, seen = {}, gone = doc.removed || {};
    sourceBlocks(entries, companies).forEach(function (x) { if (!gone[x.src] && !absorbed(doc, x)) cur[x.src] = x; });
    doc.cats.forEach(function (c) { SIDES.forEach(function (s) {
      c[s] = c[s].filter(function (b) {
        if (!b.src) return true;
        var x = cur[b.src];
        if (!x) return !!b.edited;
        seen[b.src] = 1;
        if (!b.edited && sig(x) !== b.sig) { b.t = x.t; b.c = x.c; b.d = x.d; b.box = x.box; b.sig = sig(x); b.org = x.org; b.by = x.by; }
        else if (b.edited) b.sig = sig(x); // 원본이 바뀌었어도 손댄 내용 유지
        return true;
      });
    }); });
    Object.keys(cur).forEach(function (k) {
      if (seen[k]) return;
      var x = cur[k], list = doc.cats[x.cat][x.side], at = -1;
      for (var i = list.length - 1; i >= 0; i--) if (list[i].org === x.org) { at = i; break; }
      if (at < 0) { var ci = companies.indexOf(x.org); for (var j = 0; j < list.length; j++) if (companies.indexOf(list[j].org) > ci) { at = j - 1; break; } if (at < 0 && list.length && companies.indexOf(list[list.length - 1].org) <= ci) at = list.length - 1; }
      list.splice(at + 1, 0, fromSource(x));
    });
    return doc;
  }

  /* =========================================================
   * 2) 일정 인식 — 문장 속 날짜를 찾아 달력에 올린다
   * ========================================================= */
  var RE_DATE = new RegExp([
    '(20\\d\\d)\\s*\\.\\s*(\\d{1,2})\\s*\\.\\s*(\\d{1,2})\\.?(?:\\s*\\(([월화수목금토일])\\))?', // 2026. 11. 21.(토)
    '(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일(?:\\s*\\(([월화수목금토일])\\))?',                    // 11월 9일(월)
    '(?:^|[^\\d/.])(\\d{1,2})\\/(\\d{1,2})(?![\\d/])(?:\\s*[,(]\\s*([월화수목금토일])\\)?)?',     // 11/10,화  (11/2,월)
    '(?:^|[^\\d.])(\\d{1,2})\\.\\s?(\\d{1,2})\\.?\\s*\\(([월화수목금토일])\\)'                  // 11.21.(토)
  ].join('|'), 'g');
  var RE_TIME = /^\s*(\d{1,2}:\d{2}(?:\s*[~-]\s*\d{1,2}:\d{2})?)/;
  function inferYear(m, d, ref) {
    var y = ref.getFullYear(), dt = new Date(y, m - 1, d);
    if (dt - ref < -120 * 864e5) dt = new Date(y + 1, m - 1, d);
    else if (dt - ref > 240 * 864e5) dt = new Date(y - 1, m - 1, d);
    return dt;
  }
  /** @return [{date: Date, time, start, end}] */
  function findDates(text, ref) {
    var out = [], m;
    RE_DATE.lastIndex = 0;
    while ((m = RE_DATE.exec(text))) {
      var dt = null, s = m.index, e = RE_DATE.lastIndex;
      if (m[1]) dt = new Date(+m[1], +m[2] - 1, +m[3]);
      else if (m[5]) dt = inferYear(+m[5], +m[6], ref);
      else if (m[8]) { dt = inferYear(+m[8], +m[9], ref); s = m.index + m[0].indexOf(m[8] + '/'); }
      else if (m[11]) { dt = inferYear(+m[11], +m[12], ref); s = m.index + m[0].indexOf(m[11]); }
      if (!dt || isNaN(dt) || dt.getMonth() + 1 !== (+(m[2] || m[5] || m[8] || m[11]))) continue;
      if (/~\s*$/.test(text.slice(0, s))) continue; // 기간의 끝(~11/13)은 건너뜀
      var tm = text.slice(e).match(RE_TIME), time = '';
      if (tm) { time = tm[1].replace(/\s+/g, ''); e += tm[0].length; }
      out.push({ date: dt, time: time, start: s, end: e });
    }
    return out;
  }
  function balance(s) {
    var out = '', depth = 0;
    for (var i = 0; i < s.length; i++) { var ch = s[i]; if (ch === '(') depth++; if (ch === ')') { if (!depth) continue; depth--; } out += ch; }
    while (depth-- > 0) out = out.replace(/\((?!.*\()/, '');
    return out;
  }
  function cleanLabel(s) {
    return balance(String(s || '').replace(/^\s*~\s*\d{1,2}(?:\/\d{1,2})?/, ''))
      .replace(/\(\s*[,]?\s*[월화수목금토일]?\s*\)/g, '').replace(/[,]\s*[월화수목금토일]\s*\)/g, '')
      .replace(/^[\s\-–:·,)\]]+|[\s\-–:·,(\[]+$/g, '').replace(/\s*\/\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  }
  function blockLines(b) {
    var lines = [];
    String(b.c || '').split('\n').forEach(function (l, i) { if (i === 0) l = KR.dropLead(b.t, l); if (l.trim()) lines.push({ text: l, main: i === 0 }); });
    String(b.d || '').split('\n').forEach(function (l) { if (l.trim()) lines.push({ text: l, main: false }); });
    return lines;
  }
  /** 블록 하나에서 찾은 일정들 */
  function blockDates(b, ref) {
    var res = [];
    blockLines(b).forEach(function (ln) {
      var ds = findDates(ln.text, ref), last = 0;
      ds.forEach(function (d, i) {
        var before = cleanLabel(ln.text.slice(last, d.start)), after = i === ds.length - 1 ? cleanLabel(ln.text.slice(d.end)) : '';
        var label = [before, after].filter(String).join(' ');
        last = d.end;
        var t = cleanLabel(b.t);
        if (ln.main) label = t ? t + (label ? ' · ' + label : '') : label;
        else label = (t ? t + ' · ' : '') + (label || cleanLabel(ln.text.replace(/\d/g, '')));
        res.push({ date: KR.ymd(d.date), time: d.time, text: label || '일정' });
      });
    });
    return res;
  }
  /** 늘 보이는 사업 일정(보고마다 넣지 않아도 달력에 나옴). end가 있으면 여러 날 */
  // 출처: 주간업무보고(11월 1주차) · 주간회의 회의록(10/26, 11/2) · 무용 멘토링 확정 일정(10/15) · 심화과정 수요조사(캠프 기간)
  // match: 같은 날 보고 내용에서 자동으로 읽힌 일정 중 이 낱말이 든 것은 겹치므로 이 일정 하나로 대신함
  var FIXED_EVENTS = [
    // 심화멘토링 (cat 0)
    { id: 'fixed|m-dance-1', date: '2026-10-25', time: '11:00~13:00', text: '무용 멘토링 1회차 · 비대면 1:1', cat: 0, match: ['무용'] },
    { id: 'fixed|m-art-1', date: '2026-10-31', time: '10:00~12:00', text: '미술 멘토링 · 비대면', cat: 0, match: ['미술'] },
    { id: 'fixed|m-music-1', date: '2026-11-01', time: '10:00~18:00', text: '음악 멘토링 · 서초동캠퍼스', cat: 0, match: ['음악'] },
    { id: 'fixed|m-trad', date: '2026-11-21', time: '10:00~17:00', text: '전통예술 멘토링 · 석관동캠퍼스', cat: 0, match: ['전통'] },
    { id: 'fixed|m-dance-2', date: '2026-11-22', time: '11:00~13:00', text: '무용 멘토링 2회차 · 비대면 1:1', cat: 0, match: ['무용'] },
    { id: 'fixed|m-music-2', date: '2026-11-22', time: '15:00~18:00', text: '음악 멘토링 · 서초동캠퍼스', cat: 0, match: ['음악'] },
    { id: 'fixed|m-art-2', date: '2026-11-28', time: '10:00~12:00', text: '미술 멘토링 · 비대면', cat: 0, match: ['미술'] },
    { id: 'fixed|m-dance-3', date: '2026-12-06', time: '17:30~19:30', text: '무용 멘토링 3회차 · 비대면 1:1', cat: 0, match: ['무용'] },
    // 겨울캠프 (cat 1)
    { id: 'fixed|camp-review-1110', date: '2026-11-10', time: '', text: '키비주얼 2차 리뷰 · 기념품·웰컴키트·유니폼 샘플 확인(주간회의)', cat: 1, match: ['키비주얼', '기념품', '웰컴', '유니폼'] },
    { id: 'fixed|camp-venue', date: '2026-12-01', time: '', text: '전통예술 대관 예약 접수 시작(12월 초, YMCA·동구청소년수련관)', cat: 1, match: ['대관'] },
    { id: 'fixed|winter-camp', date: '2027-01-24', end: '2027-01-30', time: '', text: '겨울캠프 · 광주캠퍼스 6박 7일', short: '겨울캠프', cat: 1 },
    // 공연 (cat 2)
    { id: 'fixed|acc-visit', date: '2026-11-09', time: '', text: 'ACC 극장1 현장 답사(휴관일)', cat: 2, match: ['답사'] },
    { id: 'fixed|perf-program', date: '2026-11-30', time: '', text: '공연 프로그램 구성 기본안 확정(11월 말)', cat: 2, match: ['프로그램 구성'] },
    { id: 'fixed|perf-cast', date: '2026-12-15', time: '', text: '공연 출연진 명단 확정(12월 중순)', cat: 2, match: ['출연진'] },
    // 홍보·다큐·아카이빙 (cat 3)
    { id: 'fixed|video-recheck', date: '2026-11-13', time: '', text: '미스매칭 영상 재검수 마감', cat: 3, match: ['재검수', '미스매칭'] },
    // 기타 (cat 4)
    { id: 'fixed|site-open', date: '2026-11-09', time: '', text: '홈페이지 최종 보고·오픈', cat: 4, match: ['홈페이지'] }
  ];
  /* ----- 일정 관리(#/sched)에서 고친 일정 — 받으면 위 FIXED_EVENTS 대신 이것을 씀 (못 받으면 FIXED_EVENTS 그대로) ----- */
  var MASTER = null, MASTER_KEY = 'kr4_sched', MASTER_TTL = 5 * 60 * 1000;
  var SCHED_FIELD_WORD = { '음악': '음악', '무용': '무용', '전통예술': '전통', '미술': '미술' };
  var MATCH_STOP = /^(확정|마감|시작|접수|예정|진행|확인|현장|기본안|명단|구성|공지|신청|최종|보고|운영)$/;
  /** 일정 한 건 → 달력 한 칸 글 (예: 무용 2회차 · 1:1 개별 멘토링 · 비대면) */
  function schedLabel(x) {
    var head = [x.field && x.field !== '공통' ? x.field : '', x.round || ''].filter(String).join(' ');
    return (head ? head + ' · ' : '') + x.title + (x.mode && x.kind === '회차' ? ' · ' + x.mode : '');
  }
  function schedMatch(x) {
    if (Number(x.cat) === 0 && SCHED_FIELD_WORD[x.field]) return [SCHED_FIELD_WORD[x.field]];
    return String(x.title || '').split(/[^0-9A-Za-z가-힣]+/).filter(function (w) { return w.length >= 2 && !MATCH_STOP.test(w); }).slice(0, 4);
  }
  function setMaster(items) {
    MASTER = (items || []).filter(function (x) { return x.status !== '취소'; }).map(function (x) {
      return { id: 'sched|' + x.id, date: x.date, end: x.end || '', time: x.time || '', text: schedLabel(x), short: x.end ? x.title : '', cat: Number(x.cat) || 0, match: schedMatch(x), field: x.field };
    });
    return MASTER;
  }
  /** 일정 목록 받기 (이 탭 안에 5분 기억). opts.code = 열람 코드, opts.fresh = 기억 무시 */
  async function loadMaster(opts) {
    opts = opts || {};
    try {
      var c = JSON.parse(sessionStorage.getItem(MASTER_KEY) || 'null');
      if (c && !opts.fresh && Date.now() - c.at < MASTER_TTL) { setMaster(c.r.items); return c.r; }
    } catch (e) { }
    try {
      var r = await KR.call('sched.list', opts.code ? { code: opts.code } : {});
      setMaster(r.items);
      try { sessionStorage.setItem(MASTER_KEY, JSON.stringify({ at: Date.now(), r: r })); } catch (e) { }
      return r;
    } catch (e) { return null; }   // 백엔드가 아직 v4면(일정 기능 없음) 예전 고정 일정으로
  }
  function masterSaved(r) { setMaster(r.items); try { sessionStorage.setItem(MASTER_KEY, JSON.stringify({ at: Date.now(), r: r })); } catch (e) { } }

  /** 다가오는 일정은 보고 시점부터 1월 말(겨울캠프 끝)까지 — 2월 이후 보고면 다음 해 1월 말 */
  function calEnd(from) { return new Date(from.getFullYear() + (from.getMonth() > 0 ? 1 : 0), 0, 31); }
  /** 다가오는 일정: from 이후 날짜만, 같은 날·같은 내용은 하나로 */
  function schedule(doc, opts) {
    opts = opts || {};
    var w = KR.fromKey(doc.key), ref = w.mon || w.first;
    var from = opts.from || (w.type === 'M' ? w.nfirst : w.nmon);
    var until = opts.until || calEnd(from);
    var list = [], seen = {};
    doc.cats.forEach(function (c, ci) {
      SIDES.forEach(function (s) {
        c[s].forEach(function (b) {
          if (b.hide) return;
          blockDates(b, ref).forEach(function (x) {
            var dt = KR.parse(x.date); if (dt < from || dt > until) return;
            var id = x.date + '|' + x.text;
            if (seen[id]) return; seen[id] = 1;
            list.push({ id: id, date: x.date, time: x.time, text: x.text, cat: ci, org: b.org || '', auto: true, off: !!(doc.schedOff || {})[id] });
          });
        });
      });
    });
    list = withFixed(list, doc, from, until);
    (doc.schedAdd || []).forEach(function (x) { list.push(Object.assign({ auto: false, off: false }, x)); });
    sortSched(list);
    return opts.all ? list : list.filter(function (x) { return !x.off; });
  }
  function sortSched(list) { list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.time).localeCompare(String(b.time)); }); return list; }
  /** 고정 일정을 더하고, 보고 내용에서 읽힌 같은 날 같은 일정은 고정 일정 하나로 */
  function withFixed(list, doc, from, until) {
    var fixed = [];
    (MASTER || FIXED_EVENTS).forEach(function (x) {
      var a = KR.parse(x.date), z = KR.parse(x.end || x.date); if (z < from || a > until) return;
      fixed.push(Object.assign({ org: '', auto: true, fixed: true, off: !!(doc.schedOff || {})[x.id] }, x));
    });
    return list.filter(function (y) {
      return y.fixed ? false : !fixed.some(function (x) { return !x.off && x.date === y.date && (x.match || []).some(function (w) { return String(y.text).indexOf(w) >= 0; }); });
    }).concat(fixed);
  }
  /** 공유 직전에 일정 목록을 굳혀 넣는다 */
  function freeze(doc) { var d = JSON.parse(JSON.stringify(doc)); d.schedule = schedule(doc); d.schedUntil = 'jan'; return d; }
  /** 공유본은 굳힌 목록을 쓰되 고정 일정은 늘 최신으로. 예전(10주까지만 굳힌) 공유본은 1월 말까지 다시 읽음 */
  function docSchedule(doc) {
    if (!doc.schedule || !doc.schedUntil) return schedule(doc);
    var w = KR.fromKey(doc.key), from = w.type === 'M' ? w.nfirst : w.nmon;
    var manual = doc.schedule.filter(function (x) { return !x.auto; }), auto = doc.schedule.filter(function (x) { return x.auto; });
    return sortSched(withFixed(auto, doc, from, calEnd(from)).filter(function (x) { return !x.off; }).concat(manual));
  }
  /** 달력 — 보고 시점이 든 달부터 끝 날짜가 든 달까지, 달마다 넘겨 봄 */
  function monthCalEl(list, from, end, opts) {
    opts = opts || {};
    var months = [], d = new Date(from.getFullYear(), from.getMonth(), 1);
    while (d <= end) { months.push(new Date(d)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    var cur = Math.max(0, Math.min(months.length - 1, opts.month || 0));
    var wrap = h('div', { class: 'mcal' }), tabs = h('div', { class: 'mcal-tabs', role: 'tablist' }), grid = h('div', { class: 'mcal-grid' });
    function draw() {
      tabs.innerHTML = '';
      months.forEach(function (m, k) {
        var n = list.filter(function (x) { var dt = KR.parse(x.date); return dt.getFullYear() === m.getFullYear() && dt.getMonth() === m.getMonth(); }).length;
        tabs.appendChild(h('button', { class: k === cur ? 'on' : '', role: 'tab', 'aria-selected': k === cur ? 'true' : 'false', onclick: function () { cur = k; if (opts.onMonth) opts.onMonth(k); draw(); } }, [(m.getFullYear() !== from.getFullYear() || k === 0 ? (String(m.getFullYear()).slice(2) + '. ') : '') + (m.getMonth() + 1) + '월', n ? h('em', { text: String(n) }) : null]));
      });
      var m = months[cur], first = new Date(m.getFullYear(), m.getMonth(), 1), last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      var start = KR.add(first, -first.getDay());
      // 첫 달은 보고 시점이 든 주부터(지난 주는 건너뜀)
      var fromWk = KR.add(from, -from.getDay()); if (fromWk > start) start = fromWk;
      var weeks = Math.ceil((Math.round((last - start) / 864e5) + 1) / 7);
      grid.innerHTML = '';
      grid.appendChild(calendarEl(list, from, weeks, { maxPer: opts.maxPer, start: start, month: m.getMonth() }));
    }
    draw();
    wrap.appendChild(tabs); wrap.appendChild(grid);
    return wrap;
  }

  /* =========================================================
   * 3) 월간 합치기 — 그달 주간 최종본들을 분야·소제목별로
   * ========================================================= */
  function normT(t) { return String(t || '').replace(/\s+/g, '').replace(/[·.]/g, ''); }
  function uniqLines(arr) { var seen = {}, out = []; arr.forEach(function (l) { var k = l.trim().replace(/\s+/g, ' '); if (!k || seen[k]) return; seen[k] = 1; out.push(l); }); return out; }
  function mergeBlocks(list) {
    var groups = [], byT = {};
    list.forEach(function (b) {
      var k = normT(b.t);
      if (k && byT[k]) { var g = byT[k]; g.items.push(b); if (b.org && g.orgs.indexOf(b.org) < 0) g.orgs.push(b.org); return; }
      var ng = { t: b.t, items: [b], orgs: b.org ? String(b.org).split(', ') : [] };
      groups.push(ng); if (k) byT[k] = ng;
    });
    return groups.map(function (g) {
      var first = g.items[0], cl = String(first.c || '').split('\n');
      var lines = cl.slice(1).filter(function (x) { return x.trim(); }).map(function (x) { return '  ' + x.trim(); });
      lines = lines.concat(String(first.d || '').split('\n'));
      g.items.slice(1).forEach(function (b) {
        String(b.c || '').split('\n').forEach(function (x, j) { if (x.trim()) lines.push(j === 0 ? x.trim() : '  ' + x.trim()); });
        lines = lines.concat(String(b.d || '').split('\n'));
      });
      var boxes = uniqLines(g.items.map(function (b) { return b.box || ''; }).join('\n').split('\n'));
      // 세부 줄은 박스와 한 묶음으로 같은 것만 하나로(박스 제목 「* 주요 의견」이 여러 번 나와도 박스끼리 섞이지 않게)
      var seenU = {}, units = KR.dParse(lines.join('\n')).filter(function (u) { var k = (u.t.trim().replace(/\s+/g, ' ') + '§' + String(u.box || '').trim()); if (!u.t.trim() && !u.box) return false; if (seenU[k]) return false; seenU[k] = 1; return true; });
      return { id: KR.uid(), src: '', org: g.orgs.join(', '), by: g.items.length > 1 ? '주간보고 ' + g.items.length + '건 합침' : '주간보고에서', t: g.t, c: cl[0] || '', d: KR.dJoin(units), box: boxes.join('\n'), sig: '', edited: false };
    });
  }
  /** weekDocs: [{key, doc}] 날짜순 */
  /**
   * 월간 초안 = 그달 주간보고(지난 실적, 같은 소제목끼리 합침 · 마지막 주의 향후 계획) + 주체별 월간 입력
   * 월간 입력 블록은 출처(src)를 달아 두어, 나중에 입력이 바뀌면 주간처럼 「편집본에 반영」으로 따라감.
   * 다음 달 계획은 월간 입력이 먼저, 그 뒤에 마지막 주 계획.
   */
  function monthCompile(weekDocs, m, entries, companies) {
    var doc = newDoc(m), docs = weekDocs.filter(function (x) { return x.doc; });
    var mine = sourceBlocks(entries || [], companies || []);
    KR.CATS.forEach(function (_, ci) {
      var prev = [], next = [];
      docs.forEach(function (x) { (x.doc.cats[ci].prev || []).forEach(function (b) { if (!b.hide) prev.push(b); }); });
      var last = docs[docs.length - 1];
      if (last) (last.doc.cats[ci].next || []).forEach(function (b) { if (!b.hide) next.push(b); });
      var mp = mine.filter(function (x) { return x.cat === ci && x.side === 'prev'; }).map(fromSource);
      var mn = mine.filter(function (x) { return x.cat === ci && x.side === 'next'; }).map(fromSource);
      doc.cats[ci].prev = mergeBlocks(prev).concat(mp);
      doc.cats[ci].next = mn.concat(mergeBlocks(next));
    });
    doc.showOrg = docs.some(function (x) { return x.doc.showOrg; });
    doc.fromWeeks = docs.map(function (x) { return x.key; });
    return doc;
  }

  /* =========================================================
   * 4) 문서 보기 — 한예종 보고 양식(2단 표) 그대로
   * ========================================================= */
  function linkify(text) {
    var frag = document.createDocumentFragment(), re = /(https?:\/\/[^\s)]+)/g, last = 0, m;
    text = String(text || '');
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(h('a', { href: m[1], target: '_blank', rel: 'noopener', text: m[1] }));
      last = re.lastIndex;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }
  function span(cls, text) { var s = h('span', { class: cls }); s.appendChild(linkify(text)); return s; }
  /** 블록 → 보고서 줄들 (문서 보기·작성 미리보기 공용) */
  /** 상세 박스 (* 로 시작하는 줄은 박스 제목) */
  function boxEl(text, cls) {
    var lines = String(text || '').split('\n').filter(function (l) { return l.trim(); });
    if (!lines.length) return null;
    return h('div', { class: cls || 'rb-box' }, lines.map(function (l) {
      var t = l.trim();
      if (/^[*※]/.test(t)) return h('div', { class: 'bx-h' }, [span('', t.replace(/^[*※]\s*/, ''))]);
      return h('div', { class: 'bx-l' }, [span('', t.replace(/^[-–·]\s*/, ''))]);
    }));
  }
  /** 블록 → 보고서 줄들 (문서 보기·작성 미리보기 공용). 글머리: ㅇ→● , -→– , *→※ 모양은 CSS가 그림 */
  function blockEl(b, opts) {
    opts = opts || {};
    var lines = String(b.c || '').split('\n');
    lines[0] = KR.dropLead(b.t, lines[0]);                           // 「(미술) 미술분야 …」처럼 소제목과 겹치는 첫머리 거름
    var head = h('div', { class: 'rb-o' }, [h('span', { class: 'o', 'aria-hidden': 'true', text: 'ㅇ' }), b.t ? h('b', { class: 'rb-t', text: b.t }) : null, ' ', span('', lines[0] || '')]);
    if (opts.showOrg && b.org) head.appendChild(h('span', { class: 'rb-org', text: b.org }));
    var kids = [head];
    lines.slice(1).forEach(function (l) { if (l.trim()) kids.push(h('div', { class: 'rb-cont' }, [span('', l.trim())])); });
    KR.dParse(b.d).forEach(function (u) {
      var l = u.t, k = KR.lineKind(l), t = l.trim();
      if (!t) { /* 빈 줄 */ }
      else if (k === 'item') kids.push(h('div', { class: 'rb-d' }, [h('span', { class: 'dash', 'aria-hidden': 'true', text: '-' }), span('', t)]));
      else if (/^[*※]/.test(t)) kids.push(h('div', { class: 'rb-note' }, [span('', t.replace(/^[*※]\s*/, ''))]));
      else kids.push(h('div', { class: k === 'cont' ? 'rb-dc' : 'rb-raw' }, [span('', t)]));
      var sb = boxEl(u.box, 'rb-box sub'); if (sb) kids.push(sb);                       // 세부 줄의 상세 박스
    });
    var bx = boxEl(b.box); if (bx) kids.push(bx);
    return h('div', { class: 'rb' + (b.hide ? ' hidden-b' : '') }, kids);
  }
  /**
   * 세부 「-」 줄 입력(작성 화면 · 취합 화면 고치기 창 공용): 줄마다 칸 하나, 줄마다 ↑↓ 이동 · 상세 박스 · 지우기
   * Enter로 다음 줄, 줄 맨 앞 Backspace로 윗줄과 합침(빈 줄이면 지움), ↑↓ 키로 줄 이동, 여러 줄 붙여넣기는 줄마다 나눔(앞의 「- 」는 뗌)
   * 줄의 상세 박스는 세부 내용 안에 「§」 줄로 저장(common.js dParse·dJoin) — 줄을 옮기면 박스도 따라감
   */
  function subRows(d, onChange) {
    var us = KR.dParse(d); if (!us.length) us = [{ t: '', box: null }];
    var el = h('div', { class: 'be-subs' });
    function text() { return KR.dJoin(us.map(function (u) { return { t: u.t, box: String(u.box || '').replace(/\s+$/, '').replace(/^\* 주요 의견$/, '') }; })); }
    function changed() { onChange(text()); }
    function draw(focusK, caret, focusBox) {
      el.innerHTML = '';
      if (!us.length) us = [{ t: '', box: null }];
      us.forEach(function (u, k) {
        var ta = h('textarea', { class: 'be-d', rows: 1, value: u.t, placeholder: k === 0 ? '세부 내용 — Enter를 누르면 다음 「-」 줄' : '세부 내용', 'aria-label': '세부 내용 ' + (k + 1) });
        var mark = h('span', { class: 'be-dash', text: KR.lineKind(u.t) === 'item' ? '–' : '' });
        ta.addEventListener('input', function () { KR.autosize(ta); u.t = ta.value.replace(/\n/g, ' ').replace(/^\s*§\s*/, ''); /* 「§」는 박스 표시용이라 줄 맨 앞에 쓰지 않음 */ mark.textContent = KR.lineKind(u.t) === 'item' ? '–' : ''; changed(); });
        ta.addEventListener('keydown', function (e) {
          if (e.isComposing || e.keyCode === 229) return;
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            var rest = ta.value.slice(ta.selectionEnd); u.t = ta.value.slice(0, ta.selectionStart);
            us.splice(k + 1, 0, { t: rest, box: null });
            changed(); draw(k + 1, 0);
          } else if (e.key === 'Backspace' && ta.selectionStart === 0 && ta.selectionEnd === 0 && (k > 0 || (ta.value === '' && us.length > 1))) {
            e.preventDefault();
            var keep = k > 0 ? us[k - 1].t.length : 0;
            if (k > 0) { var pu = us[k - 1]; pu.t += u.t; if (u.box) pu.box = pu.box ? pu.box + '\n' + u.box : u.box; }
            us.splice(k, 1);
            changed(); draw(Math.max(0, k - 1), keep);
          } else if (e.key === 'ArrowUp' && k > 0 && ta.selectionStart === 0) { e.preventDefault(); focus(k - 1, us[k - 1].t.length); }
          else if (e.key === 'ArrowDown' && k < us.length - 1 && ta.selectionEnd === ta.value.length) { e.preventDefault(); focus(k + 1, 0); }
        });
        ta.addEventListener('paste', function (e) {
          var tx = ((e.clipboardData || window.clipboardData) || { getData: function () { return ''; } }).getData('text');
          if (!/\n/.test(tx)) return;
          e.preventDefault();
          var parts = tx.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(function (x) { return x.replace(/^\s*[-–]\s*/, ''); });
          var before = ta.value.slice(0, ta.selectionStart), after = ta.value.slice(ta.selectionEnd);
          parts[0] = before + parts[0]; var lastLen = parts[parts.length - 1].length; parts[parts.length - 1] += after;
          u.t = parts[0];
          us.splice.apply(us, [k + 1, 0].concat(parts.slice(1).map(function (x) { return { t: x, box: null }; })));
          changed(); draw(k + parts.length - 1, lastLen);
        });
        var empty = us.length === 1 && !u.t && u.box == null;
        function mv(dk) { var x = us.splice(k, 1)[0]; us.splice(k + dk, 0, x); changed(); draw(k + dk, null); }
        var tools = h('span', { class: 'be-st', hidden: empty ? true : null }, [
          h('button', { class: 'icon-btn', title: '위로', 'aria-label': '세부 ' + (k + 1) + '번째 줄 위로', disabled: k === 0, onclick: function () { mv(-1); } }, '↑'),
          h('button', { class: 'icon-btn', title: '아래로', 'aria-label': '세부 ' + (k + 1) + '번째 줄 아래로', disabled: k === us.length - 1, onclick: function () { mv(1); } }, '↓'),
          h('button', { class: 'icon-btn be-sb' + (u.box != null ? ' on' : ''), title: u.box != null ? '이 줄의 상세 박스가 있습니다' : '이 줄 아래에 상세 박스 넣기', 'aria-label': '세부 ' + (k + 1) + '번째 줄 상세 박스', disabled: u.box != null, onclick: function () { u.box = '* 주요 의견\n'; changed(); draw(k, null, true); } }, '▢'),
          h('button', { class: 'icon-btn', title: '이 줄 지우기', 'aria-label': '세부 ' + (k + 1) + '번째 줄 지우기', onclick: function () { us.splice(k, 1); changed(); draw(Math.min(k, Math.max(0, us.length - 1)), null); } }, '✕')
        ]);
        el.appendChild(h('div', { class: 'be-row sub' }, [mark, ta, tools]));
        if (u.box != null) {
          var bta = h('textarea', { class: 'be-box', rows: 2, value: u.box, placeholder: '* 주요 의견\n이 줄에 대한 자세한 내용을 한 줄에 하나씩', 'aria-label': '세부 ' + (k + 1) + '번째 줄 상세 박스' });
          bta.addEventListener('input', function () { KR.autosize(bta); u.box = bta.value; changed(); });
          el.appendChild(h('div', { class: 'be-boxwrap on sub' }, [h('div', { class: 'be-boxh' }, [h('span', { text: '상세 박스' }), h('small', { text: '위 「-」 줄 아래에 들어갑니다 · 「* 」 줄은 박스 제목' }),
            h('button', { class: 'icon-btn', title: '박스 지우기', 'aria-label': '세부 ' + (k + 1) + '번째 줄 상세 박스 지우기', onclick: function () { u.box = null; changed(); draw(k, null); } }, '✕')]), bta]));
          setTimeout(function () { KR.autosize(bta); }, 0);
          if (focusBox && focusK === k) setTimeout(function () { bta.focus(); bta.setSelectionRange(bta.value.length, bta.value.length); }, 0);
        }
        setTimeout(function () { KR.autosize(ta); }, 0);
      });
      if (focusK != null && !focusBox) focus(focusK, caret);
    }
    function focus(k, caret) {   // 바로 옮김(빨리 이어 치는 글자가 앞 칸에 들어가지 않게)
      var ta = el.querySelectorAll('.be-d')[k]; if (!ta) return;
      ta.focus(); var p = caret == null ? ta.value.length : Math.min(caret, ta.value.length); ta.setSelectionRange(p, p);
    }
    function add() { var lu = us[us.length - 1]; if (lu && lu.t === '' && lu.box == null) { focus(us.length - 1, 0); return; } us.push({ t: '', box: null }); changed(); draw(us.length - 1, 0); }
    draw(null);
    return { el: el, focus: focus, add: add };
  }
  function visible(list) { return (list || []).filter(function (b) { return !b.hide && !KR.blockEmpty(b); }); }
  function docEl(doc, opts) {
    opts = opts || {};
    var showOrg = opts.showOrg != null ? opts.showOrg : doc.showOrg;
    var rows = [];
    doc.cats.forEach(function (c, i) {
      var p = visible(c.prev), n = visible(c.next);
      if (!p.length && !n.length) return;
      function cell(list) {
        return h('td', { style: '--c1:' + CAT_C[i][0] + ';--c2:' + CAT_C[i][1] }, [h('div', { class: 'rc-h' }, [h('i'), KR.CATS[i]])].concat(
          list.length ? list.map(function (b) { return blockEl(b, { showOrg: showOrg }); }) : [h('div', { class: 'rb-none', text: '해당 사항 없음' })]));
      }
      rows.push(h('tr', { class: 'rc' }, [cell(p), cell(n)]));
    });
    if (!rows.length) rows.push(h('tr', {}, h('td', { colspan: 2, class: 'rb-none', text: '아직 내용이 없습니다' })));
    return h('article', { class: 'rdoc' }, [
      h('h1', { class: 'rd-title', text: doc.title }),
      h('div', { class: 'rd-date', text: String(doc.dateLine || '').replace(/^\/\s*/, '') + (doc.author && String(doc.dateLine || '').indexOf(doc.author) < 0 ? '/' + doc.author : '') }),
      h('table', { class: 'rd-table' }, [
        h('thead', {}, [
          h('tr', { class: 'rh' }, [h('th', { text: doc.headPrev || '지난 실적' }), h('th', { text: doc.headNext || '향후 계획' })]),
          h('tr', { class: 'rp' }, [h('th', { text: doc.periodPrev }), h('th', { text: doc.periodNext })])
        ]),
        h('tbody', {}, rows)
      ])
    ]);
  }

  /* =========================================================
   * 5) 달력 — 다가오는 일정
   * ========================================================= */
  function calendarEl(list, from, weeks, opts) {
    opts = opts || {};
    var start = opts.start || KR.add(from, -from.getDay()), today = KR.ymd(KR.today()), by = {};
    list.forEach(function (x) {
      if (!x.end || x.end <= x.date) { (by[x.date] = by[x.date] || []).push(x); return; }
      var a = KR.parse(x.date), z = KR.parse(x.end), n = Math.round((z - a) / 864e5) + 1;
      for (var q = 0; q < n; q++) { var kq = KR.ymd(KR.add(a, q)); (by[kq] = by[kq] || []).push(q === 0 ? x : Object.assign({}, x, { text: (x.short || x.text) + ' ' + (q + 1) + '일차', time: '', cont: true })); }
    });
    var head = h('div', { class: 'cal-row cal-head' }, '일월화수목금토'.split('').map(function (d, i) { return h('div', { class: i === 0 ? 'we sun' : i === 6 ? 'we sat' : '', text: d }); }));
    var rows = [head];
    for (var wk = 0; wk < weeks; wk++) {
      var cells = [];
      for (var d = 0; d < 7; d++) {
        var dt = KR.add(start, wk * 7 + d), k = KR.ymd(dt), ev = by[k] || [];
        var first = dt.getDate() === 1 || (wk === 0 && d === 0);
        var other = opts.month != null && dt.getMonth() !== opts.month;
        if (other) ev = [];
        cells.push(h('div', { class: 'cal-cell' + (d === 0 ? ' we sun' : d === 6 ? ' we sat' : '') + (k === today ? ' today' : '') + (dt < from ? ' past' : '') + (other ? ' other' : '') + (ev.length ? ' has' : '') }, [
          h('div', { class: 'cal-n' }, [first && !other && opts.month == null ? h('span', { class: 'cal-m', text: (dt.getMonth() + 1) + '월' }) : null, String(dt.getDate())]),
          h('div', { class: 'cal-ev' }, ev.slice(0, opts.maxPer || 3).map(function (x) {
            return h('div', { class: 'cal-chip' + (x.end ? ' span' : '') + (x.cont ? ' cont' : ''), style: 'border-color:' + CAT_C[x.cat || 0][0] + ';background:' + CAT_C[x.cat || 0][0] + '26', title: (x.time ? x.time + ' ' : '') + x.text }, [x.time ? h('b', { text: x.time.split('~')[0] + ' ' }) : null, x.text]);
          }).concat(ev.length > (opts.maxPer || 3) ? [h('div', { class: 'cal-more', text: '+' + (ev.length - (opts.maxPer || 3)) + '건' })] : []))
        ]));
      }
      rows.push(h('div', { class: 'cal-row' }, cells));
    }
    return h('div', { class: 'cal' }, rows);
  }
  /** 시간 칸: 시간이 있으면 시간, 여러 날 일정이면 「1.24~1.30」 */
  function timeOf(x) {
    if (x.time) return x.time;
    if (!x.end || x.end <= x.date) return '';
    var a = KR.parse(x.date), z = KR.parse(x.end);
    return (a.getMonth() + 1) + '.' + a.getDate() + '~' + (z.getMonth() + 1) + '.' + z.getDate();
  }
  function agendaEl(list, opts) {
    opts = opts || {};
    if (!list.length) return h('div', { class: 'ag-empty', text: '향후 계획에 날짜가 적힌 일정이 없습니다' });
    var by = {}, keys = [];
    list.forEach(function (x) { if (!by[x.date]) { by[x.date] = []; keys.push(x.date); } by[x.date].push(x); });
    return h('div', { class: 'agenda' }, keys.slice(0, opts.max || 99).map(function (k) {
      var dt = KR.parse(k), dd = Math.round((dt - KR.today()) / 864e5);
      return h('div', { class: 'ag-day' }, [
        h('div', { class: 'ag-date' }, [h('b', { text: String(dt.getDate()) }), h('span', { text: (dt.getMonth() + 1) + '월 ' + WD[dt.getDay()] }), dd >= 0 && dd <= 30 ? h('em', { text: dd === 0 ? '오늘' : 'D-' + dd }) : null]),
        h('div', { class: 'ag-items' }, by[k].map(function (x) {
          return h('div', { class: 'ag-it' }, [h('i', { style: 'background:' + CAT_C[x.cat || 0][1] }), timeOf(x) ? h('span', { class: 'ag-t', text: timeOf(x) }) : null, h('span', { class: 'ag-x', text: x.text }), h('span', { class: 'ag-c', text: KR.CAT_SHORT[x.cat || 0] })]);
        }))
      ]);
    }));
  }

  /** 같은 날짜 일정을 하나로 묶음 */
  function byDate(list) {
    var out = [], m = {};
    list.forEach(function (x) { if (!m[x.date]) { m[x.date] = { date: x.date, items: [] }; out.push(m[x.date]); } m[x.date].items.push(x); });
    return out;
  }
  /* =========================================================
   * 6) 회의 화면 — 띄워 놓고 넘기며 보는 화면
   * ========================================================= */
  /** 분야 안의 항목을 소제목별로 묶음(실적·계획 짝 맞춤). 소제목이 없는 항목은 「그 밖의 내용」 하나로 */
  function topics(cat) {
    var out = [], m = {};
    [['prev', visible(cat.prev)], ['next', visible(cat.next)]].forEach(function (x) {
      x[1].forEach(function (b) {
        var t = String(b.t || '').trim(), k = t.replace(/\s+/g, '');
        if (!m[k]) { m[k] = { t: t, prev: [], next: [] }; out.push(m[k]); }
        m[k][x[0]].push(b);
      });
    });
    var none = m[''];
    if (none) { out.splice(out.indexOf(none), 1); out.push(none); }
    return out;
  }
  function counts(doc) { return doc.cats.map(function (c) { return { p: visible(c.prev).length, n: visible(c.next).length }; }); }
  function meetCard(b, i, showOrg, big) {
    var lines = String(b.c || '').split('\n'), det = [];
    lines[0] = KR.dropLead(b.t, lines[0]);
    lines.slice(1).forEach(function (l) { if (l.trim()) det.push(h('li', { class: 'cont' }, [span('', l.trim())])); });
    KR.dParse(b.d).forEach(function (u) {
      var l = u.t, k = KR.lineKind(l), t = l.trim();
      if (t) {
        if (/^[*※]/.test(t)) det.push(h('li', { class: 'note' }, [span('', t.replace(/^[*※]\s*/, ''))]));
        else det.push(h('li', { class: k }, [span('', t)]));
      }
      var sb = boxEl(u.box, 'mc-box sub'); if (sb) det.push(h('li', { class: 'sbx' }, [sb]));
    });
    return h('div', { class: 'mc' + (big ? ' big' : '') }, [
      h('div', { class: 'mc-top' }, [b.t && !big ? h('span', { class: 'mc-tag', style: 'background:' + CAT_C[i][0] + '33;color:' + CAT_C[i][1], text: b.t }) : null, showOrg && b.org ? h('span', { class: 'mc-org', text: b.org }) : null]),
      lines[0] ? h('div', { class: 'mc-main' }, [span('', lines[0])]) : null,
      det.length ? h('ul', { class: 'mc-det' }, det) : null,
      boxEl(b.box, 'mc-box')
    ]);
  }
  /**
   * @param getDoc  최신 문서를 돌려주는 함수
   * @param opts {startAt, onExit}
   * @return {el, go, refresh, destroy}
   */
  function meeting(getDoc, opts) {
    opts = opts || {};
    var calMonth = 0, idx = opts.startAt || 0, scale = Number(localStorage.getItem('kr3_scale') || 1);
    var el = h('section', { class: 'meet', tabindex: '-1' });
    var rail = h('nav', { class: 'm-rail', 'aria-label': '회의 순서' }), stage = h('div', { class: 'm-stage' }), bar = h('div', { class: 'm-bar' });
    el.appendChild(rail); el.appendChild(h('div', { class: 'm-main' }, [stage, bar]));
    function slides() {
      var doc = getDoc(), c = counts(doc), s = [{ k: 'ov', name: '한눈에 보기' }];
      c.forEach(function (x, i) {
        if (!x.p && !x.n) return;
        var tp = topics(doc.cats[i]), at = s.length;
        s.push({ k: 'cat', i: i, name: KR.CAT_SHORT[i], cnt: x, topics: tp });
        tp.forEach(function (t, j) { s.push({ k: 'top', i: i, j: j, n: tp.length, cat: at, t: t.t, prev: t.prev, next: t.next, name: t.t || '그 밖의 내용' }); });
      });
      s.push({ k: 'cal', name: '다가오는 일정' });
      return s;
    }
    function draw() {
      var doc = getDoc(), list = slides(), w = KR.fromKey(doc.key), sch = docSchedule(doc), showOrg = doc.showOrg;
      if (idx >= list.length) idx = list.length - 1; if (idx < 0) idx = 0;
      var cur = list[idx];
      // 왼쪽 순서
      rail.innerHTML = '';
      rail.appendChild(h('div', { class: 'm-brand' }, [h('div', { class: 'm-kind', text: w.type === 'M' ? '월간업무보고' : '주간업무보고' }), h('div', { class: 'm-name', text: w.type === 'M' ? w.name : w.planName }), h('div', { class: 'm-sub', text: doc.dateLine.replace(/^\/\s*/, '보고일 ') })]));
      var openCat = cur.k === 'cat' || cur.k === 'top' ? cur.i : -1;
      list.forEach(function (s, j) {
        if (s.k === 'top') {
          if (s.i !== openCat) return;
          rail.appendChild(h('button', { class: 'm-step sub' + (j === idx ? ' on' : ''), style: '--c1:' + CAT_C[s.i][0], 'aria-current': j === idx ? 'step' : null, onclick: function () { go(j); } }, [h('span', { class: 'm-sn', text: s.name })]));
          return;
        }
        rail.appendChild(h('button', { class: 'm-step' + (j === idx ? ' on' : '') + (s.k === 'cat' && s.i === openCat && j !== idx ? ' open' : ''), 'aria-current': j === idx ? 'step' : null, onclick: function () { go(j); } }, [
          h('span', { class: 'm-dot', style: s.k === 'cat' ? 'background:' + CAT_C[s.i][0] : '' , text: s.k === 'cat' ? '' : (s.k === 'ov' ? '◎' : '▦') }),
          h('span', { class: 'm-sn', text: s.name }),
          s.cnt ? h('span', { class: 'm-sc', title: '한 일 ' + s.cnt.p + ' · 할 일 ' + s.cnt.n, text: s.cnt.p + ' · ' + s.cnt.n }) : (s.k === 'cal' ? h('span', { class: 'm-sc', text: String(sch.length) }) : null)
        ]));
      });
      // 본문
      stage.innerHTML = '';
      stage.style.setProperty('--ms', scale);
      var body;
      if (cur.k === 'ov') {
        var c = counts(doc), tp = 0, tn = 0; c.forEach(function (x) { tp += x.p; tn += x.n; });
        var soon = sch.filter(function (x) { return KR.parse(x.date) <= KR.add(w.type === 'M' ? w.nfirst : w.nmon, 13); });
        body = h('div', { class: 's-ov' }, [
          h('div', { class: 'ov-hero' }, [
            h('div', { class: 'ov-k', text: (w.type === 'M' ? 'MONTHLY' : 'WEEKLY') + ' · K ARTS GIFTED PROJECT' }),
            h('h2', { class: 'ov-t' }, [h('span', { class: 'grad', text: w.type === 'M' ? w.name : w.planName }), h('br'), '업무보고']),
            h('div', { class: 'ov-p' }, [h('span', {}, [h('b', { text: '지난 실적 ' }), doc.periodPrev]), h('span', {}, [h('b', { text: '향후 계획 ' }), doc.periodNext])]),
            h('div', { class: 'ov-n' }, [h('div', {}, [h('b', { text: String(tp) }), h('span', { text: '한 일' })]), h('div', {}, [h('b', { text: String(tn) }), h('span', { text: '할 일' })]), h('div', {}, [h('b', { text: String(sch.length) }), h('span', { text: '다가오는 일정' })])])
          ]),
          h('div', { class: 'ov-grid' }, KR.CATS.map(function (name, i) {
            var cc = doc.cats[i], tags = visible(cc.prev).concat(visible(cc.next)).map(function (b) { return b.t; }).filter(String);
            tags = tags.filter(function (t, k) { return tags.indexOf(t) === k; }).slice(0, 6);
            var empty = !c[i].p && !c[i].n, target = list.findIndex(function (s) { return s.k === 'cat' && s.i === i; });
            return h('button', { class: 'ov-cat' + (empty ? ' empty' : ''), style: '--c1:' + CAT_C[i][0] + ';--c2:' + CAT_C[i][1], disabled: empty, onclick: function () { if (target >= 0) go(target); } }, [
              h('div', { class: 'ovc-n', text: String(i + 1).padStart(2, '0') }),
              h('div', { class: 'ovc-name', text: KR.CAT_SHORT[i] }),
              h('div', { class: 'ovc-cnt' }, empty ? '이번 회차 내용 없음' : [h('span', { text: '실적 ' + c[i].p }), h('span', { text: '계획 ' + c[i].n })]),
              h('div', { class: 'ovc-tags' }, tags.map(function (t) { return h('span', { text: t }); }))
            ]);
          })),
          soon.length ? h('div', { class: 'ov-soon' }, [h('div', { class: 'ov-sh', text: '다음 2주 일정' }), h('div', { class: 'ov-strip' }, byDate(soon).slice(0, 8).map(function (g) {
            var dt = KR.parse(g.date);
            return h('div', { class: 'ov-ev' }, [h('b', { text: (dt.getMonth() + 1) + '.' + dt.getDate() + ' ' + WD[dt.getDay()] })].concat(g.items.map(function (x) {
              return h('div', { class: 'ov-ei', style: '--c1:' + CAT_C[x.cat || 0][1] }, [x.time ? h('em', { text: x.time.split('~')[0] }) : null, h('span', { text: x.text })]);
            })));
          }))]) : null
        ]);
      } else if (cur.k === 'cat') {
        var i = cur.i;
        body = h('div', { class: 's-cat', style: '--c1:' + CAT_C[i][0] + ';--c2:' + CAT_C[i][1] }, [
          h('div', { class: 'sc-top' }, [h('span', { class: 'sc-n', text: String(i + 1).padStart(2, '0') }), h('h2', { text: KR.CATS[i] }), h('div', { class: 'sc-sum', text: '실적 ' + cur.cnt.p + ' · 계획 ' + cur.cnt.n + ' · 소제목 ' + cur.topics.length + '개' })]),
          h('div', { class: 'sct-list' }, cur.topics.map(function (t, j) {
            function first(list2) { var b0 = list2[0]; return b0 ? String(b0.c || '').split('\n')[0] || String(b0.d || '').split('\n')[0].replace(/^\s*[-ㅇ*※]\s*/, '') : ''; }
            var pv = first(t.prev), nx = first(t.next);
            return h('button', { class: 'sct', onclick: function () { go(idx + 1 + j); } }, [
              h('span', { class: 'sct-n', text: String(j + 1) }),
              h('span', { class: 'sct-t', text: t.t || '그 밖의 내용' }),
              h('span', { class: 'sct-x' }, [
                pv ? h('span', { class: 'sct-l' }, [h('em', { text: '실적' }), span('', pv)]) : null,
                nx ? h('span', { class: 'sct-l nx' }, [h('em', { text: '계획' }), span('', nx)]) : null
              ]),
              h('span', { class: 'sct-go', 'aria-hidden': 'true', text: '›' })
            ]);
          }))
        ]);
      } else if (cur.k === 'top') {
        var ti = cur.i;
        function tcol(side, label, period, list2) {
          return h('div', { class: 'tp-col ' + side + (list2.length ? '' : ' none') }, [
            h('div', { class: 'sc-h' }, [h('span', { class: 'sc-l', text: label }), h('span', { class: 'sc-p', text: period })]),
            h('div', { class: 'tp-list' }, list2.length ? list2.map(function (b) { return meetCard(b, ti, showOrg, true); }) : [h('div', { class: 'sc-none', text: '해당 사항 없음' })])
          ]);
        }
        body = h('div', { class: 's-top', style: '--c1:' + CAT_C[ti][0] + ';--c2:' + CAT_C[ti][1] }, [
          h('div', { class: 'tp-crumb' }, [h('span', { class: 'sc-n', text: String(ti + 1).padStart(2, '0') }), h('span', { text: KR.CATS[ti] }), h('span', { class: 'tp-pos', text: (cur.j + 1) + ' / ' + cur.n })]),
          h('h2', { class: 'tp-t', text: cur.t || '그 밖의 내용' }),
          h('div', { class: 'tp-cols' + (!cur.prev.length || !cur.next.length ? ' one' : '') }, [tcol('prev', doc.headPrev || '지난 실적', doc.periodPrev, cur.prev), tcol('next', doc.headNext || '향후 계획', doc.periodNext, cur.next)])
        ]);
      } else {
        var from = w.type === 'M' ? w.nfirst : w.nmon;
        body = h('div', { class: 's-cal' }, [
          h('div', { class: 'scal-top' }, [h('h2', { text: '다가오는 일정' }), h('div', { class: 'scal-leg' }, KR.CAT_SHORT.map(function (n, k) { return h('span', {}, [h('i', { style: 'background:' + CAT_C[k][1] }), n]); }))]),
          h('div', { class: 'scal-body' }, [monthCalEl(sch, from, calEnd(from), { maxPer: 3, month: calMonth, onMonth: function (k) { calMonth = k; } }), h('div', { class: 'scal-side' }, [h('div', { class: 'ov-sh', text: '날짜순 · ' + (calEnd(from).getMonth() + 1) + '월 ' + calEnd(from).getDate() + '일까지' }), agendaEl(sch)])])
        ]);
      }
      body.classList.add('slide-in');
      stage.appendChild(body);
      stage.scrollTop = 0;
      fit();
      // 아래 막대
      bar.innerHTML = '';
      bar.appendChild(h('button', { class: 'm-btn', 'aria-label': '이전', disabled: idx === 0, onclick: function () { go(idx - 1); } }, '←'));
      bar.appendChild(h('div', { class: 'm-prog' }, list.length > 16 ? [] : list.map(function (_, j) { return h('i', { class: j === idx ? 'on' : j < idx ? 'done' : '' }); })));
      bar.appendChild(h('span', { class: 'm-pg', text: (idx + 1) + ' / ' + list.length }));
      bar.appendChild(h('button', { class: 'm-btn', 'aria-label': '다음', disabled: idx === list.length - 1, onclick: function () { go(idx + 1); } }, '→'));
      bar.appendChild(h('span', { class: 'spacer' }));
      bar.appendChild(h('button', { class: 'm-btn sm', title: '글자 작게', onclick: function () { zoom(-0.1); } }, '가−'));
      bar.appendChild(h('button', { class: 'm-btn sm', title: '글자 크게', onclick: function () { zoom(0.1); } }, '가+'));
      bar.appendChild(h('button', { class: 'm-btn sm', title: '전체 화면 (F)', onclick: full }, document.fullscreenElement ? '전체화면 끄기' : '전체 화면'));
      if (opts.extra) opts.extra(bar);
    }
    function zoom(d) { scale = Math.max(0.7, Math.min(1.6, Math.round((scale + d) * 10) / 10)); try { localStorage.setItem('kr3_scale', scale); } catch (e) { } stage.style.setProperty('--ms', scale); fit(); }
    /** 분야 표지·소제목 화면은 화면을 채우도록 키우고, 넘치면 줄임(0.6~1.4배) */
    function fit() {
      var body = stage.firstChild;
      if (!body || !(body.classList.contains('s-top') || body.classList.contains('s-cat'))) return;
      function over(f) { body.style.fontSize = f + 'em'; return stage.scrollHeight > stage.clientHeight + 2; }
      var lo = 0.6, hi = 1.4;
      if (!over(hi)) return;
      for (var k = 0; k < 7; k++) { var mid = (lo + hi) / 2; if (over(mid)) hi = mid; else lo = mid; }
      body.style.fontSize = Math.floor(lo * 100) / 100 + 'em';
    }
    var rz = null;
    function onResize() { clearTimeout(rz); rz = setTimeout(fit, 120); }
    function full() { if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); }
    function go(j) { idx = j; draw(); }
    function key(e) {
      if (!document.body.contains(el) || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') || document.querySelector('.modal-bg')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); if (idx < slides().length - 1) go(idx + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); if (idx > 0) go(idx - 1); }
      else if (e.key === 'Home') go(0); else if (e.key === 'End') go(slides().length - 1);
      else if (e.key === 'f' || e.key === 'F') full();
    }
    function fsChange() { el.classList.toggle('is-full', !!document.fullscreenElement); draw(); }
    document.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', fsChange);
    window.addEventListener('resize', onResize);
    draw();
    requestAnimationFrame(fit);
    return { el: el, go: go, refresh: draw, destroy: function () { document.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', fsChange); window.removeEventListener('resize', onResize); } };
  }

  /* =========================================================
   * 7) 인쇄 · 한글 파일
   * ========================================================= */
  /* 인쇄·PDF — 한글 파일(회의록 양식)과 같은 모양을 별도 틀(iframe)에 그려 인쇄.
   * 화면용 스타일·반응형 규칙의 영향을 받지 않도록 화면과 분리한다. 입력값은 textContent로만 넣는다. */
  var PRINT_CSS = [
    "@font-face{font-family:'RHead';src:local('HY헤드라인M'),local('HYHeadLine M'),local('HYHeadLine-Medium'),local('HYHeadLineM');}",
    "@font-face{font-family:'RHeadFB';font-weight:400;src:local('Malgun Gothic Bold'),local('MalgunGothicBold'),local('맑은 고딕 Bold'),local('AppleSDGothicNeo-Bold'),local('NanumGothicBold'),local('Noto Sans KR Bold'),local('NotoSansKR-Bold'),local('Noto Sans CJK KR Bold');}",
    "@page{size:A4;margin:15mm 20mm 17mm;@bottom-center{content:'- ' counter(page) ' -';font:10pt 'Malgun Gothic',sans-serif;}}",
    "html,body{margin:0;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}",
    "body{font:12pt/1.5 '휴먼명조','HCR Batang','함초롬바탕','HYSinMyeongJo-Medium','Batang','바탕','AppleMyungjo','Noto Serif KR','Noto Serif CJK KR',serif;word-break:keep-all;overflow-wrap:anywhere;}",
    ".hd{font-family:'RHead','RHeadFB','Malgun Gothic',sans-serif;font-weight:400;}",
    ".gd{font-family:'한양중고딕','HY중고딕','HYGothic-Medium','Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif;}",
    ".ttl{width:100%;border-collapse:collapse;margin:0 0 2mm;}",
    ".ttl td{padding:0;}.ttl .b1{height:1.35mm;background:#BBDDFF;}.ttl .b2{height:1.35mm;background:#0000FF;}",
    ".ttl .t{font-size:18pt;line-height:1.6;text-align:center;padding:1.2mm 0;}",
    ".dl{text-align:right;font-size:13pt;margin:0 0 3mm;}",
    ".bd{width:100%;border-collapse:collapse;table-layout:fixed;}",
    ".bd th,.bd td{border:.12mm solid #000;vertical-align:top;width:50%;}",
    ".bd thead th{font-size:13pt;text-align:center;padding:1.2mm 1.5mm;background:#DCE6F2;font-weight:400;}",
    ".bd thead tr.pr th{font-size:11pt;background:#F2F4F7;}",
    ".bd td{padding:0 1.5mm;}",
    ".bd td.top{padding-top:2.4mm;}.bd td.bot{padding-bottom:2.4mm;}",
    ".bd td.ctop{border-bottom:none;}.bd td.cmid{border-top:none;border-bottom:none;}.bd td.cbot{border-top:none;}",
    ".bd tr{break-inside:avoid;page-break-inside:avoid;}",
    ".ch{font-size:13pt;line-height:1.5;margin:0 0 .6mm;}",
    ".it{padding-left:2.4em;text-indent:-1.8em;line-height:1.5;margin:0;}",
    ".it b{font-weight:700;}",
    ".ct{padding-left:2.4em;line-height:1.5;margin:0;}",
    ".sb{padding-left:2.9em;text-indent:-1.1em;line-height:1.45;margin:0;}",
    ".nt{padding-left:3.8em;text-indent:-1em;font-size:10pt;line-height:1.4;margin:0;}",
    ".rw{padding-left:2.9em;line-height:1.45;margin:0;}",
    ".org{font-size:9pt;color:#6E6E73;}",
    ".bx{border:.12mm dotted #000;margin:.8mm 0 1.2mm 1.6em;padding:1mm 2.2mm;font:10pt/1.45 'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif;}",
    ".bx .bh{font-weight:700;}.bx .bl{padding-left:1.1em;text-indent:-.75em;}",
    ".bx.sub{margin-left:2.6em;}",
    ".gap{height:1.4mm;}"
  ].join('\n');
  /** 분야 안 항목을 소제목별로 묶어 행으로 — 한글 파일(hwpx.js rowsOf)과 같은 규칙 */
  function printRows(pv, nx) {
    var out = [], m = {}, lp = [], ln = [];
    function key(b) { return String(b.t || '').replace(/\s+/g, ''); }
    var nk = {}; nx.forEach(function (b) { var k = key(b); if (k) nk[k] = 1; });
    var pk = {}; pv.forEach(function (b) { var k = key(b); if (k) pk[k] = 1; });
    // 실적·계획 양쪽에 같은 소제목이 있으면 같은 행에, 한쪽에만 있는 항목은 순서대로 짝지어 빈칸 없이
    pv.forEach(function (b) { var k = key(b); if (k && nk[k]) { if (!m[k]) { m[k] = { prev: [], next: [] }; out.push(m[k]); } m[k].prev.push(b); } else lp.push(b); });
    nx.forEach(function (b) { var k = key(b); if (k && pk[k]) m[k].next.push(b); else ln.push(b); });
    // 짝 없는 항목: 양쪽을 각각 이어 쓰되 대략 8줄마다 행을 끊어(쪽 나눔 지점) 칸 사이 빈자리를 줄임
    function lines(b) {
      var n = Math.ceil(String(String(b.c || '').split('\n')[0]).length / 22) || 1;
      String(b.c || '').split('\n').slice(1).concat(String(b.d || '').split('\n')).forEach(function (l) { if (l.trim()) n += Math.ceil(l.trim().length / 24); });
      String(b.box || '').split('\n').forEach(function (l) { if (l.trim()) n += 0.9; });
      return n + 0.5;
    }
    function take(list) { var row = [], h = 0; while (list.length && (!row.length || h + lines(list[0]) <= 8)) { h += lines(list[0]); row.push(list.shift()); } return row; }
    while (lp.length || ln.length) out.push({ prev: take(lp), next: take(ln) });
    return out.length ? out : [{ prev: [], next: [] }];
  }
  function print(doc) {
    var old = document.getElementById('kr-print'); if (old) old.remove();
    var fr = document.createElement('iframe');
    fr.id = 'kr-print'; fr.setAttribute('aria-hidden', 'true'); fr.title = '인쇄용';
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(fr);
    var d = fr.contentDocument;
    d.open(); d.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title></title></head><body></body></html>'); d.close();
    d.title = doc.title || '업무보고';
    var st = d.createElement('style'); st.textContent = PRINT_CSS; d.head.appendChild(st);
    function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function add(parent, kids) { kids.forEach(function (k) { if (k) parent.appendChild(k); }); return parent; }
    // 제목 상자
    var ttl = el('table', 'ttl'), tb = el('tbody');
    [['b1', ''], ['t hd', doc.title || ''], ['b2', '']].forEach(function (r) { var tr = el('tr'); tr.appendChild(el('td', r[0], r[1])); tb.appendChild(tr); });
    ttl.appendChild(tb);
    var dl = String(doc.dateLine || '').replace(/^\/\s*/, '');
    var author = doc.author || (KR.boot && KR.boot.author) || '';
    if (author && dl.indexOf(author) < 0) dl += '/' + author;
    // 본문 표
    var bd = el('table', 'bd'), th = el('thead'), tbody = el('tbody');
    th.appendChild(add(el('tr'), [el('th', 'hd', doc.headPrev || '지난 실적'), el('th', 'hd', doc.headNext || '향후 계획')]));
    th.appendChild(add(el('tr', 'pr'), [el('th', 'gd', doc.periodPrev || ''), el('th', 'gd', doc.periodNext || '')]));
    function block(b) {
      var out = [], cl = String(b.c || '').split('\n');
      cl[0] = KR.dropLead(b.t, cl[0]);
      var it = el('p', 'it'); it.appendChild(d.createTextNode('ㅇ '));
      if (b.t) it.appendChild(el('b', '', '(' + b.t + ') '));
      it.appendChild(d.createTextNode((cl[0] || '').trim()));
      if (doc.showOrg && b.org) it.appendChild(el('span', 'org gd', ' [' + b.org + ']'));
      out.push(it);
      cl.slice(1).forEach(function (l) { if (l.trim()) out.push(el('p', 'ct', l.trim())); });
      function pbox(text, cls) {
        var bl = String(text || '').split('\n').filter(function (x) { return x.trim(); });
        if (!bl.length) return;
        var bx = el('div', cls);
        bl.forEach(function (l) { var t = l.trim(); bx.appendChild(/^[*※]/.test(t) ? el('div', 'bh', t) : el('div', 'bl', '- ' + t.replace(/^[-–·]\s*/, ''))); });
        out.push(bx);
      }
      KR.dParse(b.d).forEach(function (u) {
        var l = u.t, k = KR.lineKind(l), t = l.trim();
        if (t) {
          if (/^[*※]/.test(t)) out.push(el('p', 'nt gd', t));
          else if (k === 'item') out.push(el('p', 'sb', '- ' + t.replace(/^[-–]\s*/, '')));
          else out.push(el('p', 'rw', t));
        }
        pbox(u.box, 'bx sub');                                                           // 세부 줄의 상세 박스
      });
      pbox(b.box, 'bx');
      return out;
    }
    var any = false;
    doc.cats.forEach(function (c, i) {
      var pv = visible(c.prev), nx = visible(c.next);
      if (!pv.length && !nx.length) return;
      any = true;
      var groups = printRows(pv, nx), n = groups.length;
      groups.forEach(function (g, k) {
        var pos = n === 1 ? '' : k === 0 ? 'ctop' : k === n - 1 ? 'cbot' : 'cmid';
        var tr = el('tr');
        [[g.prev, pv], [g.next, nx]].forEach(function (sd) {
          var td = el('td', [pos, k === 0 ? 'top' : '', k === n - 1 ? 'bot' : ''].join(' ').trim());
          if (k === 0) td.appendChild(el('p', 'ch hd', '□ ' + KR.CATS[i]));
          if (!sd[1].length) { if (k === 0) td.appendChild(el('p', 'it', 'ㅇ 해당 사항 없음')); }
          else sd[0].forEach(function (b, j) { if (j) td.appendChild(el('div', 'gap')); add(td, block(b)); });
          if (k > 0 && sd[0].length) td.insertBefore(el('div', 'gap'), td.firstChild);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    });
    if (!any) tbody.appendChild(add(el('tr'), [el('td', 'top bot', 'ㅇ 해당 사항 없음'), el('td', 'top bot', 'ㅇ 해당 사항 없음')]));
    add(bd, [th, tbody]);
    add(d.body, [ttl, el('p', 'dl gd', dl), bd]);
    var w = fr.contentWindow;
    var go = function () { try { w.focus(); w.print(); } finally { setTimeout(function () { fr.remove(); }, 1000); } };
    // 글꼴이 준비된 뒤 인쇄
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { setTimeout(go, 80); }); else setTimeout(go, 200);
  }

  var tplCache = null;
  var HWPX_REV = '20261112c';   // 한글 파일 생성기·양식이 바뀌면 올림(브라우저에 남은 예전 파일을 쓰지 않게)
  async function hwpx(doc, ver) {
    if (!root.JSZip) await new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'assets/vendor/jszip.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    if (!root.HWPX) await new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'assets/hwpx.js?v=' + HWPX_REV; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    tplCache = tplCache || await (await fetch('template/report_template.hwpx?v=' + HWPX_REV, { cache: 'no-cache' })).arrayBuffer();
    var blob = await root.HWPX.generate(tplCache, doc, 'blob');
    var a = h('a', { href: URL.createObjectURL(blob), download: KR.fileBase(KR.fromKey(doc.key), ver) + '.hwpx' });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  root.KRReport = {
    CAT_C: CAT_C, newDoc: newDoc, compile: compile, sig: sig, diff: diff, remerge: remerge, sortEntries: sortEntries,
    findDates: findDates, blockDates: blockDates, schedule: schedule, freeze: freeze, docSchedule: docSchedule,
    loadMaster: loadMaster, masterSaved: masterSaved, schedLabel: schedLabel, hasMaster: function () { return !!MASTER; },
    monthCompile: monthCompile, mergeBlocks: mergeBlocks,
    blockEl: blockEl, boxEl: boxEl, byDate: byDate, docEl: docEl, timeOf: timeOf, calendarEl: calendarEl, monthCalEl: monthCalEl, calEnd: calEnd, agendaEl: agendaEl, meeting: meeting, visible: visible, counts: counts,
    print: print, hwpx: hwpx, subRows: subRows
  };
})(window);

/* K예술영재 업무보고 v4.1 — 공통 (설정 · 주차 · API · 붙여넣기 해석 · 화면 도우미) */
(function (root) {
  'use strict';

  var CONFIG = {
    // Apps Script 웹앱 주소 (배포 관리 → 수정 → 새 버전으로 배포하면 주소가 그대로 유지됩니다)
    API_URL: 'https://script.google.com/macros/s/AKfycbx8Hm-SJBB4C7qXKwbNCjV5S0SiYqIZYmFOzBAoBaPq8Q3TQmELTt4G7JstLcynBYY/exec'
  };
  var CATS = ['K예술영재 심화멘토링', 'K예술영재 겨울캠프', 'K예술영재 공연', '홍보/다큐/아카이빙', '기타'];
  var CAT_SHORT = ['심화멘토링', '겨울캠프', '공연', '홍보·다큐·아카이빙', '기타'];
  var CAT_HINT = [
    '분야별(음악·무용·전통예술·미술) 멘토링 운영 일정, 준비, 참가 인원, 강사비 등',
    '키비주얼, 기념품, 유니폼, 프로그램 준비 등 캠프 준비 사항',
    '답사, 기획, 운영 준비 등 성과공연 관련 사항',
    '언론홍보, 유튜브·인스타 업로드와 성과, 다큐 촬영, 영상·데이터 아카이빙',
    '홈페이지, 도메인, 산출물 관리, 중간보고, 소통 체계 등'
  ];

  /* ===== 날짜 · 주차 ===== */
  var WD = '일월화수목금토';
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2] || 1); }
  function add(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function mondayOf(d) { var w = d.getDay(); return add(d, w === 0 ? -6 : 1 - w); }
  /** 11.02.(월) — 보고서 표의 기간 표기 */
  function md(d) { return pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + '.(' + WD[d.getDay()] + ')'; }
  /** 11. 6.(금) — 화면 표기 */
  function kd(d) { if (typeof d === 'string') d = parse(d); return (d.getMonth() + 1) + '. ' + d.getDate() + '.(' + WD[d.getDay()] + ')'; }
  /** 주차 이름: 그 주 목요일이 속한 달 기준 (11월 1주차) */
  function weekName(mon) { var thu = add(mon, 3); return (thu.getMonth() + 1) + '월 ' + Math.ceil(thu.getDate() / 7) + '주차'; }

  /** 주차 키 W-YYYY-MM-DD = 실적 주간의 월요일. 보고일은 그 주 금요일, 향후 계획은 다음 주 */
  function week(dt) {
    var mon = mondayOf(dt), fri = add(mon, 4), nmon = add(mon, 7), nfri = add(mon, 11);
    var planName = weekName(nmon);
    return {
      type: 'W', key: 'W-' + ymd(mon), mon: mon, fri: fri, nmon: nmon, nfri: nfri,
      name: weekName(mon),            // 실적 주간 이름 (작성 화면 표시용)
      planName: planName,             // 향후 계획 주간 = 대면보고(월요일 Zoom) 주간
      title: '(' + planName + ') 주간업무보고',
      dateLine: '’' + String(fri.getFullYear()).slice(2) + '. ' + (fri.getMonth() + 1) + '. ' + fri.getDate() + '.(' + WD[fri.getDay()] + ')',
      periodPrev: md(mon) + ' ~ ' + md(fri),
      periodNext: md(nmon) + ' ~ ' + md(nfri),
      prevKey: 'W-' + ymd(add(mon, -7)),
      prev: function () { return week(add(mon, -7)); }, next: function () { return week(add(mon, 7)); }
    };
  }
  /** 월간 키 M-YYYY-MM = 실적 월. 포함 주차 = 목요일이 그 달에 속한 주 */
  function month(y, m) {
    var first = new Date(y, m - 1, 1), last = new Date(y, m, 0);
    var nfirst = new Date(y, m, 1), nlast = new Date(y, m + 1, 0);
    var due = last; while (due.getDay() === 0 || due.getDay() === 6) due = add(due, -1);
    var weeks = [];
    for (var d = mondayOf(first); d <= last; d = add(d, 7)) if (add(d, 3).getMonth() === m - 1) weeks.push('W-' + ymd(d));
    var nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y, pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
    return {
      type: 'M', key: 'M-' + y + '-' + pad(m), y: y, m: m, first: first, last: last, nfirst: nfirst, nlast: nlast, fri: due,
      name: m + '월', planName: nm + '월', weekKeys: weeks,
      title: '(' + m + '월) 월간업무보고',
      dateLine: '’' + String(due.getFullYear()).slice(2) + '. ' + (due.getMonth() + 1) + '. ' + due.getDate() + '.(' + WD[due.getDay()] + ')',
      periodPrev: md(first) + ' ~ ' + md(last), periodNext: md(nfirst) + ' ~ ' + md(nlast),
      prev: function () { return month(py, pm); }, next: function () { return month(ny, nm); }
    };
  }
  function fromKey(key) {
    key = String(key);
    if (key[0] === 'M') { var a = key.slice(2).split('-').map(Number); return month(a[0], a[1]); }
    return week(parse(key.slice(2)));
  }
  function current() { return week(today()); }
  function currentMonth() { var t = today(); var thu = add(mondayOf(t), 3); return month(thu.getFullYear(), thu.getMonth() + 1); }
  function dday(d) { var n = Math.round((d - today()) / 864e5); return n === 0 ? '오늘' : (n > 0 ? n + '일 남음' : (-n) + '일 지남'); }
  function fmtTime(iso) { if (!iso) return ''; var d = new Date(iso); return (d.getMonth() + 1) + '. ' + d.getDate() + '. ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /** 파일명: K예술영재 프로젝트_주간업무보고_11월2주차_Ver.1_20261106 */
  function fileBase(w, ver) {
    var d = today();
    return ['K예술영재 프로젝트', w.type === 'M' ? '월간업무보고' : '주간업무보고', (w.type === 'M' ? w.name : w.planName).replace(/\s/g, ''), 'Ver.' + (ver || '1'), '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())].join('_');
  }

  /* ===== 블록 ===== */
  function uid() { return 'b' + Math.random().toString(36).slice(2, 10); }
  function emptyData() { return { cats: CATS.map(function () { return { prev: [], next: [] }; }) }; }
  function normData(d) {
    var e = emptyData();
    ((d && d.cats) || []).forEach(function (c, i) { if (e.cats[i]) { e.cats[i].prev = (c.prev || []).slice(); e.cats[i].next = (c.next || []).slice(); } });
    return e;
  }
  function blockEmpty(b) { return !String(b.t || '').trim() && !String(b.c || '').trim() && !String(b.d || '').trim() && !String(b.box || '').trim(); }

  /**
   * 소제목과 겹치는 첫머리 걸러 내기: 「(미술) 미술분야 비대면 운영」 → 「(미술) 비대면 운영」
   * 내용 첫 줄이 소제목(뒤의 분야·부문·관련 등은 빼고 비교, 띄어쓰기 무시)으로 시작하고 그 뒤가 빈칸·쌍점이면 그 부분을 뺀다.
   * 「미술관」「미술·음악」처럼 다른 낱말로 이어지면 그대로 둔다. 저장된 글은 바꾸지 않고 보여 줄 때만 거른다.
   */
  var LEAD_SUF = '(?:분야|부문|파트|분과|관련|사항)';
  function dropLead(t, line) {
    var core = String(t || '').replace(/[\s()[\]]+/g, '').replace(new RegExp(LEAD_SUF + '$'), '');
    var s = String(line || '');
    if (!core || !s.trim()) return s;
    var pat = core.split('').map(function (ch) { return ch.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }).join('\\s*');
    var re = new RegExp('^\\s*[\\[(]?\\s*' + pat + '\\s*' + LEAD_SUF + '?\\s*[\\])]?(?:(?:은|는|이|가|의|도)(?=\\s)|\\s*[:：]|(?=\\s|$))');
    var m = s.match(re);
    if (!m) return s;
    return s.slice(m[0].length).replace(/^\s*[-–·,]?\s*/, '');
  }

  /** 세부 한 줄의 종류: cont(앞 줄 이어짐) · raw(기호·링크 그대로) · item(- 항목) */
  function lineKind(s) {
    if (/^\s*§/.test(s)) return 'box';
    if (/^\s+\S/.test(s)) return 'cont';
    if (/^(\*|※|\[|·|○|►|▶|→|https?:\/\/)/.test(s)) return 'raw';
    return 'item';
  }

  /**
   * 세부 줄별 상세 박스: 세부 내용(d) 안에서 「§」로 시작하는 줄은 바로 위 세부 줄의 상세 박스 줄이다.
   *   예) 시안 3개 리뷰 / § * 주요 의견 / § 배경은 무채색 계열로 / 다음 세부 줄
   * 한 글자로 저장해 두어 순서를 바꾸거나 합쳐도 박스가 제 줄을 따라간다.
   */
  var SUBBOX = '§';
  function dParse(d) {
    var out = [];
    String(d || '').split('\n').forEach(function (l) {
      if (lineKind(l) === 'box') {
        var x = l.replace(/^\s*§\s?/, '');
        if (!out.length) out.push({ t: '', box: null });
        var u = out[out.length - 1]; u.box = u.box == null ? x : u.box + '\n' + x;
      } else out.push({ t: l, box: null });
    });
    return out;
  }
  function dJoin(items) {
    var lines = [];
    items.forEach(function (u) {
      lines.push(u.t);
      var bx = String(u.box || '').replace(/\s+$/, '');
      if (bx.trim()) bx.split('\n').forEach(function (x) { lines.push(SUBBOX + ' ' + x); });
    });
    return lines.join('\n').replace(/\n+$/, '');
  }

  /**
   * 지난 실적·향후 계획 줄 맞추기: 「ㅇ」 소제목이 같은 항목은 같은 행(같은 선상)에 놓는다.
   * 지난 실적 순서를 기준으로, 소제목이 같은 향후 계획 항목을 그 옆으로 끌어오고,
   * 짝 없는 향후 계획 항목은 원래 바로 앞에 있던 짝 항목 뒤에 둔다(앞에 짝이 없으면 맨 위).
   * opts.split: 짝 없는 항목이 길면 약 8줄마다 행을 나눔(인쇄·한글 파일의 쪽 나눔 지점)
   * 반환: [{ prev:[블록], next:[블록], match: 소제목 짝이면 true }]
   */
  function pairRows(pv, nx, opts) {
    opts = opts || {};
    function key(b) { return String(b.t || '').replace(/[\s()]+/g, ''); }
    var used = {}, mate = {};   // mate[prev index] = next index
    pv.forEach(function (p, i) {
      var k = key(p); if (!k) return;
      for (var j = 0; j < nx.length; j++) if (!used[j] && key(nx[j]) === k) { used[j] = 1; mate[i] = j; break; }
    });
    // 짝 없는 향후 계획: 원래 순서에서 바로 앞의 짝 항목(없으면 -1)에 붙임
    var after = {}, anchor = -1, prevOfNext = {};
    Object.keys(mate).forEach(function (i) { prevOfNext[mate[i]] = Number(i); });
    nx.forEach(function (b, j) { if (used[j]) { anchor = prevOfNext[j]; return; } (after[anchor] = after[anchor] || []).push(b); });
    function lines(x) {
      var k = Math.ceil(String(String(x.c || '').split('\n')[0]).length / 22) || 1;
      String(x.c || '').split('\n').slice(1).concat(String(x.d || '').split('\n')).forEach(function (l) { if (l.trim()) k += Math.ceil(l.trim().length / 24); });
      String(x.box || '').split('\n').forEach(function (l) { if (l.trim()) k += 0.9; });
      return k + 0.5;
    }
    function take(list) { var row = [], hh = 0; while (list.length && (!row.length || hh + lines(list[0]) <= 8)) { hh += lines(list[0]); row.push(list.shift()); } return row; }
    var out = [], lp = [], ln = (after[-1] || []).slice();
    function flush() {
      if (!lp.length && !ln.length) return;
      if (!opts.split) out.push({ prev: lp, next: ln, match: false });
      else while (lp.length || ln.length) out.push({ prev: take(lp), next: take(ln), match: false });
      lp = []; ln = [];
    }
    pv.forEach(function (p, i) {
      if (mate[i] == null) { lp.push(p); return; }
      flush();
      out.push({ prev: [p], next: [nx[mate[i]]], match: true });
      ln = (after[i] || []).slice();
    });
    flush();
    return out.length ? out : [{ prev: [], next: [], match: false }];
  }

  /** 분야 이름 맞추기 (□ 줄) */
  function catIndex(s) {
    s = String(s || '');
    if (/멘토링/.test(s)) return 0;
    if (/캠프/.test(s)) return 1;
    if (/공연/.test(s)) return 2;
    if (/홍보|다큐|아카이빙/.test(s)) return 3;
    if (/기타/.test(s)) return 4;
    return -1;
  }

  /**
   * 한글 문서에서 복사한 글을 블록으로 바꾼다.
   *  □ 분야  → 분야 전환     ㅇ(소제목) 내용 → 새 항목     - 세부 → 세부 줄     그 밖의 줄 → 앞 내용에 이어 붙임
   * @return {cats: [[블록]...5], found: 분야 표기가 있었는지}
   */
  function parseText(text, defCat) {
    var cats = CATS.map(function () { return []; }), cur = defCat == null ? 0 : defCat, found = false, b = null;
    String(text || '').replace(/\r/g, '').replace(/[ \t\u00a0]{2,}(?=(?:ㅇ|○)\s*\()/g, '\n').split('\n').forEach(function (raw) {
      var line = raw.replace(/ /g, ' ').replace(/\s+$/, ''), t = line.trim();
      if (raw.charAt(0) === '\u0007') { // 한글 파일 속 상자(1칸 표) → 상세 박스
        var bt = raw.slice(1).trim(); if (!bt) return;
        if (!b) { b = { id: uid(), t: '', c: '', d: '', box: '' }; cats[cur].push(b); }
        b.box = (b.box ? b.box + '\n' : '') + bt; return;
      }
      if (!t) return;
      var m;
      if ((m = t.match(/^[□■◻]\s*(.*)$/))) { var ci = catIndex(m[1]); if (ci >= 0) { cur = ci; found = true; } b = null; return; }
      if ((m = t.match(/^(?:ㅇ|○|◦|●|•|o(?=\s*\())\s*(.*)$/))) {
        var rest = m[1], tt = '', cc = rest;
        var pm = rest.match(/^\(([^)]{1,40})\)\s*(.*)$/);
        if (pm) { tt = pm[1].trim(); cc = pm[2]; }
        b = { id: uid(), t: tt, c: cc.trim(), d: '' };
        cats[cur].push(b); return;
      }
      if (!b) { b = { id: uid(), t: '', c: t, d: '' }; cats[cur].push(b); return; }
      if ((m = t.match(/^[-–‧]\s*(.*)$/))) { b.d += (b.d ? '\n' : '') + m[1].trim(); return; }
      if (lineKind(t) === 'raw' && !/^https?:/.test(t)) { b.d += (b.d ? '\n' : '') + t; return; }
      if (b.d) b.d += '\n' + (lineKind(t) === 'raw' ? t : '  ' + t);
      else b.c += (b.c ? '\n' : '') + t;
    });
    return { cats: cats, found: found };
  }

  /* ===== 체험 모드 (?demo=1) — Code.gs를 브라우저 안에서 그대로 실행 ===== */
  var DEMO = /[?&]demo=1/.test(location.search) || sessionStorage.getItem('kr4_demo') === '1';
  if (/[?&]demo=1/.test(location.search)) sessionStorage.setItem('kr4_demo', '1');
  var demoApi = null;
  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  async function demo() {
    if (demoApi) return demoApi;
    var res = await fetch('apps-script/Code.gs', { cache: 'no-store' }).catch(function () { return null; });
    if (!res || !res.ok) throw new Error('체험 모드는 이 사이트에서 쓸 수 없습니다. 주소 끝의 ?demo=1을 지우고 들어가세요');
    var src = await res.text();
    if (!root.GasMock) await loadScript('assets/gas-mock.js');
    var store = {
      load: function () { try { return JSON.parse(localStorage.getItem('kr4_demo_db') || 'null'); } catch (e) { return null; } },
      save: function (d) { try { localStorage.setItem('kr4_demo_db', JSON.stringify(d)); } catch (e) { } },
      loadCache: function () { try { return JSON.parse(localStorage.getItem('kr4_demo_cache') || 'null'); } catch (e) { return null; } },
      saveCache: function (c) { try { localStorage.setItem('kr4_demo_cache', JSON.stringify(c)); } catch (e) { } }
    };
    var fresh = !store.load();
    demoApi = root.GasMock.load(src, store);
    if (fresh) {
      if (!root.KRDemoSeed) await loadScript('assets/demo-seed.js');
      if (!root.KRReport) await loadScript('assets/report.js');
      root.KRDemoSeed(demoApi);
    }
    return demoApi;
  }
  function resetDemo() { localStorage.removeItem('kr4_demo_db'); localStorage.removeItem('kr4_demo_cache'); demoApi = null; }

  /* ===== API ===== */
  function token() { return sessionStorage.getItem('kr4_token') || ''; }
  /* 로그인 정보(me) 기억 — 화면을 옮길 때마다 서버를 기다리지 않도록 이 탭 안에 잠시 둠.
   * 권한 판단은 서버가 요청마다 다시 하므로 화면 표시용일 뿐. 뒤에서 새로 받아 바뀌었으면 다시 그림 */
  var ME_KEY = 'kr4_me', ME_TTL = 10 * 60 * 1000;
  function meCached() { try { var c = JSON.parse(sessionStorage.getItem(ME_KEY) || 'null'); return c && c.t === token() && Date.now() - c.at < ME_TTL ? c.b : null; } catch (e) { return null; } }
  function meSave(b) { try { var x = Object.assign({}, b); delete x.token; sessionStorage.setItem(ME_KEY, JSON.stringify({ t: token(), at: Date.now(), b: x })); } catch (e) { } }
  function meClear() { try { sessionStorage.removeItem(ME_KEY); } catch (e) { } }
  async function me() {
    var c = meCached();
    if (c) {
      call('me').then(function (b) { var changed = JSON.stringify(b) !== JSON.stringify(c); meSave(b); if (changed) location.reload(); }).catch(function () { });
      return c;
    }
    var b = await call('me'); meSave(b); return b;
  }
  async function call(action, data) {
    var q = Object.assign({ action: action, token: token() }, data || {}), j;
    if (DEMO) {
      j = (await demo()).post(q);
    } else {
      var res, txt;
      try {
        res = await fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(q), cache: 'no-store' });
        txt = await res.text();
      } catch (e) { throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요'); }
      try { j = JSON.parse(txt); }
      catch (e) { throw new Error('서버 응답 오류(' + res.status + '). Apps Script 배포의 액세스가 "모든 사용자"인지 확인하세요'); }
    }
    if (!j.ok) {
      if (j.code === 'auth' && action !== 'login' && !/^view\./.test(action)) { sessionStorage.removeItem('kr4_token'); go('#/login?next=' + encodeURIComponent(ROUTE.name)); }
      if (j.code === 'pw') { go('#/login'); }
      var e = new Error(j.error || '서버 오류'); e.code = j.code; throw e;
    }
    return j.data;
  }
  /* ===== 화면 전환 (report/index.html 하나에서 #/화면) ===== */
  function parseRoute() {
    var m = (location.hash || '').match(/^#\/([a-z]+)(?:\?(.*))?$/), params = {};
    (m && m[2] || '').split('&').forEach(function (kv) { if (!kv) return; var i = kv.indexOf('='); params[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1)); });
    return { name: m ? m[1] : 'login', params: params };
  }
  var ROUTE = parseRoute();
  /** 'write.html?key=…' 같은 옛 형식도 받아 '#/write?key=…'로 */
  function link(url) {
    url = String(url || '');
    if (url[0] === '#') return url;
    var m = url.match(/^([a-z]+)\.html(?:\?(.*))?$/);
    if (!m) return url;
    var name = m[1] === 'index' ? 'login' : m[1];
    return '#/' + name + (m[2] ? '?' + m[2] : '');
  }
  function go(url) { var h = link(url); if (location.hash === h) location.reload(); else location.hash = h; }
  function param(k) { return ROUTE.params[k] || ''; }
  /** 주소 표시만 바꾸기 (화면 다시 그리지 않음) */
  function setParams(obj) {
    var q = Object.keys(obj).filter(function (k) { return obj[k] != null && obj[k] !== ''; }).map(function (k) { return k + '=' + encodeURIComponent(obj[k]); }).join('&');
    history.replaceState(null, '', location.pathname + location.search + '#/' + ROUTE.name + (q ? '?' + q : ''));
  }
  function baseUrl() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }

  var PERM_LABEL = { write: '보고 작성', team: '업체 작성분 관리', view: '최종본 열람', compile: '취합·편집', share: '한예종 공유', admin: '관리자', open: '공개 시점 설정' };
  var PERM_DESC = {
    write: '분야 단계를 넘기며 본인의 실적·계획을 작성·제출',
    team: '같은 주체 사람들의 작성분을 보고 대신 작성(업체 대표용)',
    view: '한예종에 공유된 최종본(회의 화면·문서) 열람',
    compile: '작성분 취합·편집, 주간·월간 회의자료 만들기',
    share: '취합본을 한예종에 공유(판 올리기)',
    admin: '사람 등록, 주체·개인 권한, 열람 코드 관리 (공개 시점도 정할 수 있음)',
    open: '주간·월간 공유본을 주체별로 언제부터 보여 줄지 정함'
  };
  async function requireLogin(permKey) {
    if (!token()) { go('#/login?next=' + ROUTE.name); return new Promise(function () { }); }
    var b = await me();
    if (b.user.mustChange) { go('#/login'); return new Promise(function () { }); }
    var p = b.user.perm || {};
    if (permKey && !p[permKey] && !(permKey === 'view' && p.compile) && !(permKey === 'write' && p.admin)) { toast('이 화면을 볼 권한이 없습니다', true); go(homeOf(p)); return new Promise(function () { }); }
    root.KR.boot = b;
    return b;
  }
  function homeOf(p) { p = p || {}; return p.compile ? '#/hub' : p.write ? '#/write' : p.view || p.open ? '#/view' : p.admin ? '#/admin' : '#/login'; }

  /* ===== 화면 도우미 ===== */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    [].concat(kids == null ? [] : kids).forEach(function (c) { if (c != null && c !== false) el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return el;
  }
  function toast(msg, bad) {
    var t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status', text: msg });
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, bad ? 4200 : 2400);
  }
  function modal(title, body, buttons, opts) {
    opts = opts || {};
    var bg = h('div', { class: 'modal-bg' });
    var close = function () { bg.remove(); document.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape' && !opts.locked) close(); };
    document.addEventListener('keydown', esc);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg && !opts.locked) close(); });
    var m = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      h('header', {}, [h('h3', { text: title }), opts.locked ? null : h('button', { class: 'icon-btn', 'aria-label': '닫기', text: '✕', onclick: close })]),
      h('div', { class: 'body' }, body),
      buttons && buttons.length ? h('footer', {}, buttons) : null
    ]);
    bg.appendChild(m); document.body.appendChild(bg);
    var f = m.querySelector('input,textarea,select'); if (f && !opts.noFocus) setTimeout(function () { f.focus(); }, 30);
    bg.close = close;
    return bg;
  }
  function confirmBox(msg, okText, danger) {
    return new Promise(function (ok) {
      var m = modal('확인', h('p', { style: 'margin:0', text: msg }), [
        h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); ok(false); } }),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), text: okText || '확인', onclick: function () { m.close(); ok(true); } })
      ]);
    });
  }
  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }
  function busy(btn, on) { if (!btn) return; btn.disabled = !!on; btn.classList.toggle('busy', !!on); }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('복사했습니다'); }
    catch (e) { var ta = h('textarea', { value: text }); document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('복사했습니다'); } catch (x) { toast('복사하지 못했습니다', true); } ta.remove(); }
  }

  function passwordModal(forced) {
    return new Promise(function (resolve) {
      var old = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
      var n1 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
      var n2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
      var err = h('div', { class: 'err' });
      var btn = h('button', { class: 'btn primary', text: '비밀번호 바꾸기' });
      btn.onclick = async function () {
        err.textContent = '';
        if (n1.value.length < 6) { err.textContent = '6자 이상으로 정하세요'; return; }
        if (n1.value !== n2.value) { err.textContent = '새 비밀번호가 서로 다릅니다'; return; }
        busy(btn, true);
        try { await call('password', { old: old.value, next: n1.value }); meClear(); m.close(); toast('비밀번호를 바꿨습니다'); resolve(true); }
        catch (e) { err.textContent = e.message; }
        busy(btn, false);
      };
      [old, n1, n2].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); }); });
      var m = modal(forced ? '본인 비밀번호 정하기' : '비밀번호 변경', [
        forced ? h('p', { class: 'muted', style: 'margin:0 0 14px', text: '처음 받은 기본 비밀번호를 본인만 아는 비밀번호로 바꿔 주세요. 바꾸기 전에는 다른 화면을 쓸 수 없습니다.' }) : null,
        h('label', { class: 'field' }, [h('span', { text: forced ? '기본 비밀번호' : '현재 비밀번호' }), old]),
        h('label', { class: 'field' }, [h('span', { text: '새 비밀번호 (6자 이상)' }), n1]),
        h('label', { class: 'field' }, [h('span', { text: '새 비밀번호 확인' }), n2]), err
      ], [forced ? null : h('button', { class: 'btn', text: '취소', onclick: function () { m.close(); resolve(false); } }), btn], { locked: forced });
    });
  }

  /* ===== 참고 자료(첨부) ===== */
  var FILE_MAX = 10 * 1024 * 1024;
  function fileSize(n) { n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
  function readB64(file) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result || ''); ok(s.slice(s.indexOf(',') + 1)); };
      r.onerror = function () { no(new Error('파일을 읽지 못했습니다')); };
      r.readAsDataURL(file);
    });
  }
  /** 파일 하나 올리기 (서버가 구글 드라이브에 저장) */
  async function fileUpload(key, uid, file) {
    if (file.size > FILE_MAX) throw new Error(file.name + ' — 파일은 하나에 10MB까지 올릴 수 있습니다');
    var b64 = await readB64(file);
    return call('file.upload', { key: key, uid: uid || '', name: file.name, mime: file.type || '', b64: b64 });
  }
  /** 내려받기 (권한은 서버가 확인) */
  async function fileDownload(f) {
    var r = await call('file.get', { id: f.id });
    var bin = atob(r.b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    var a = h('a', { href: URL.createObjectURL(new Blob([arr], { type: r.mime || 'application/octet-stream' })), download: r.name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  /** 첨부 목록 한 줄씩: 이름(누르면 내려받기) · 크기 · 올린 사람 · 지우기 */
  function fileItem(f, opts) {
    opts = opts || {};
    var busy = false;
    return h('div', { class: 'fl-it' }, [
      h('button', { class: 'fl-name', title: '내려받기', onclick: async function () { if (busy) return; busy = true; try { await fileDownload(f); } catch (e) { toast(e.message, true); } busy = false; } }, [h('i', { class: 'fl-ic', 'aria-hidden': 'true', text: '📎' }), h('span', { text: f.file })]),
      h('small', { text: fileSize(f.size) + (opts.who ? ' · ' + f.company + ' ' + f.name : '') + ' · ' + fmtTime(f.at) + (f.by && f.by !== f.name ? ' · ' + f.by + ' 올림' : '') }),
      opts.onDel ? h('button', { class: 'icon-btn fl-del', title: '지우기', 'aria-label': f.file + ' 지우기', onclick: async function () {
        if (!(await confirmBox('「' + f.file + '」을(를) 지울까요? 구글 드라이브 휴지통으로 옮겨집니다.', '지우기'))) return;
        try { await call('file.del', { id: f.id }); opts.onDel(f); toast('지웠습니다'); } catch (e) { toast(e.message, true); }
      } }, '✕') : null
    ]);
  }

  /** 상단 바 */
  function topbar(b, active) {
    var u = b.user, p = u.perm || {}, nav = [];
    if (p.write || p.admin) nav.push(['write', p.write ? '작성' : '작성분 수정']);
    if (p.compile) nav.push(['hub', '취합']);
    if (p.view || p.compile || p.open || p.admin) nav.push(['view', '최종본']);
    nav.push(['sched', '일정']);
    if (p.admin) nav.push(['admin', '관리']);
    var bar = h('header', { class: 'topbar' }, h('div', { class: 'in' }, [
      h('a', { class: 'brand', href: homeOf(p) }, [h('span', { class: 'mark', 'aria-hidden': 'true' }), h('span', { text: 'K예술영재 업무보고' })]),
      h('nav', { class: 'nav' }, nav.length > 1 ? nav.map(function (n) { return h('a', { href: '#/' + n[0], class: n[0] === active ? 'on' : '', text: n[1] }); }) : []),
      h('div', { class: 'who' }, [
        h('span', { class: 'me', text: u.name + ' · ' + u.company }),
        h('button', { class: 'btn-ghost-w', text: '비밀번호', onclick: function () { passwordModal(false); } }),
        h('button', { class: 'btn-ghost-w', text: '로그아웃', onclick: async function () { try { await call('logout'); } catch (e) { } sessionStorage.removeItem('kr4_token'); go('#/login'); } })
      ])
    ]));
    document.body.insertBefore(bar, document.body.firstChild);
    demoBar(bar);
  }
  function demoBar(after) {
    if (!DEMO || document.querySelector('.demo-bar')) return;
    var d = h('div', { class: 'demo-bar' }, ['체험 모드 — 이 브라우저 안에서만 저장됩니다. ', h('button', { class: 'linklike', text: '체험 데이터 처음으로', onclick: function () { resetDemo(); sessionStorage.removeItem('kr4_token'); sessionStorage.removeItem('kr4_vcode'); go('#/login'); } })]);
    if (after) document.body.insertBefore(d, after.nextSibling); else document.body.insertBefore(d, document.body.firstChild);
  }

  root.KR = {
    CONFIG: CONFIG, CATS: CATS, CAT_SHORT: CAT_SHORT, CAT_HINT: CAT_HINT, DEMO: DEMO,
    call: call, me: me, meSave: meSave, meClear: meClear, link: link, go: go, param: param, setParams: setParams, route: ROUTE, baseUrl: baseUrl, requireLogin: requireLogin, homeOf: homeOf, token: token,
    PERMS: ['write', 'team', 'view', 'compile', 'share', 'open', 'admin'], PERM_LABEL: PERM_LABEL, PERM_DESC: PERM_DESC,
    week: week, month: month, fromKey: fromKey, current: current, currentMonth: currentMonth, dday: dday, kd: kd, md: md, ymd: ymd, parse: parse, add: add, today: today, fmtTime: fmtTime, fileBase: fileBase,
    uid: uid, emptyData: emptyData, fileUpload: fileUpload, fileDownload: fileDownload, fileItem: fileItem, fileSize: fileSize, FILE_MAX: FILE_MAX, normData: normData, blockEmpty: blockEmpty, lineKind: lineKind, dropLead: dropLead, dParse: dParse, dJoin: dJoin, SUBBOX: SUBBOX, pairRows: pairRows, parseText: parseText, catIndex: catIndex,
    h: h, toast: toast, modal: modal, confirm: confirmBox, autosize: autosize, busy: busy, copy: copy, passwordModal: passwordModal, topbar: topbar, demoBar: demoBar, resetDemo: resetDemo
  };
})(window);

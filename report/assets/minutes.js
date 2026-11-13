/* 지난 회의록 — 구글 드라이브 회의록 폴더(관리 → 설정에서 지정)의 파일을 날짜순 목록으로 보여 주고 링크로 연다
 * 데이터: 백엔드 minutes.list (로그인한 사람 누구나). 링크는 드라이브 공유 설정을 따른다 */
(async function () {
  'use strict';
  var KR = window.KR, h = KR.h;
  var b = await KR.requireLogin();
  KR.topbar(b, 'minutes');
  var app = document.getElementById('app');
  app.className = 'wrap mi';
  document.title = '지난 회의록 · K예술영재 업무보고';
  var P = (b.user && b.user.perm) || {};
  var WD = '일월화수목금토';
  var S = { data: null, q: '' };

  function dateLabel(s) { var d = KR.parse(s); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.(' + WD[d.getDay()] + ')'; }
  function title(f) { return String(f.name).replace(/^\d{6}[_\s-]*/, '').replace(/\.[A-Za-z0-9]{2,5}$/, '') || f.name; }
  function ext(f) { var m = String(f.name).match(/\.([A-Za-z0-9]{2,5})$/); if (m) return m[1].toUpperCase(); if (/google-apps\.document/.test(f.mime)) return '문서'; if (/google-apps\.spreadsheet/.test(f.mime)) return '시트'; return '파일'; }

  var head = h('header', { class: 'sc-head' });
  var tools = h('div', { class: 'mi-tools' });
  var list = h('div', { class: 'mi-list' });
  app.appendChild(head); app.appendChild(tools); app.appendChild(list);

  function drawHead() {
    var d = S.data;
    head.innerHTML = '';
    head.appendChild(h('div', {}, [
      h('div', { class: 'eyebrow', text: '회의 기록' }),
      h('h1', { text: '지난 회의록' }),
      h('p', { class: 'muted', text: '주간회의 회의록을 날짜순으로 모았습니다. 제목을 누르면 구글 드라이브에서 열립니다.' })
    ]));
    if (d && d.folder) head.appendChild(h('div', { class: 'mi-folder' }, [
      h('a', { class: 'btn', href: d.folder.url, target: '_blank', rel: 'noopener' }, '드라이브 폴더 열기 ↗'),
      h('button', { class: 'btn', title: '드라이브의 최신 목록 다시 읽기', onclick: function (e) { load(true, e.target); } }, '새로고침')
    ]));
  }
  function drawTools() {
    tools.innerHTML = '';
    if (!S.data || !S.data.files.length) return;
    var q = h('input', { class: 'input', type: 'search', placeholder: '제목·날짜로 찾기 (예: 1110, 겨울캠프)', value: S.q, 'aria-label': '회의록 찾기' });
    q.addEventListener('input', function () { S.q = q.value; drawList(); });
    tools.appendChild(q);
    tools.appendChild(h('span', { class: 'muted small', text: '총 ' + S.data.files.length + '건 · ' + (S.data.folder ? S.data.folder.name : '') + (S.data.at ? ' · ' + KR.fmtTime(S.data.at) + ' 기준' : '') }));
  }
  function drawList() {
    list.innerHTML = '';
    var d = S.data;
    if (!d) return;
    if (!d.configured) {
      list.appendChild(h('div', { class: 'empty-state' }, [
        h('h3', { text: '회의록 폴더가 아직 정해지지 않았습니다' }),
        h('p', { text: P.admin ? '관리 → 설정의 「지난 회의록」에 구글 드라이브 회의록 폴더 주소를 넣어 주세요.' : '관리자가 회의록 폴더를 정하면 여기에 목록이 나옵니다.' }),
        P.admin ? h('a', { class: 'btn primary', href: '#/admin?tab=settings' }, '설정으로 가기') : null
      ]));
      return;
    }
    var k = S.q.trim().replace(/\s+/g, '');
    var files = d.files.filter(function (f) {
      if (!k) return true;
      var hay = [f.name, f.date || '', f.date ? dateLabel(f.date) : '', f.path || ''].map(function (x) { return String(x).replace(/[\s.\-()]/g, ''); }).join('|');
      return hay.indexOf(k.replace(/[.\-()]/g, '')) >= 0;
    });
    if (!files.length) { list.appendChild(h('div', { class: 'empty-state' }, [h('h3', { text: d.files.length ? '찾는 회의록이 없습니다' : '폴더에 파일이 없습니다' })])); return; }
    var month = '';
    files.forEach(function (f) {
      var key = f.date || f.modified.slice(0, 10), m = key.slice(0, 7);
      if (m !== month) { month = m; list.appendChild(h('h2', { class: 'mi-month', text: Number(m.slice(0, 4)) + '년 ' + Number(m.slice(5, 7)) + '월' })); }
      list.appendChild(h('a', { class: 'mi-it', href: f.url, target: '_blank', rel: 'noopener', title: f.name + ' — 드라이브에서 열기' }, [
        h('div', { class: 'mi-date' }, [h('b', { text: f.date ? String(Number(f.date.slice(8, 10))) : '–' }), h('small', { text: f.date ? Number(f.date.slice(5, 7)) + '월 ' + WD[KR.parse(f.date).getDay()] : '날짜 없음' })]),
        h('div', { class: 'mi-body' }, [
          h('strong', { text: title(f) }),
          h('small', { text: (f.date ? dateLabel(f.date) + ' 회의' : '') + (f.path ? ' · ' + f.path : '') + ' · 수정 ' + f.modified + (f.size ? ' · ' + KR.fileSize(f.size) : '') })
        ]),
        h('span', { class: 'mi-ext', text: ext(f) }),
        h('span', { class: 'mi-go', 'aria-hidden': 'true', text: '↗' })
      ]));
    });
  }
  async function load(fresh, btn) {
    if (btn) KR.busy(btn, true);
    if (!S.data) list.appendChild(h('div', { class: 'empty-state' }, [h('h3', { text: '회의록을 불러오는 중…' })]));
    try { S.data = await KR.call('minutes.list', { fresh: !!fresh }); }
    catch (e) {
      list.innerHTML = '';
      list.appendChild(h('div', { class: 'empty-state err' }, [h('h3', { text: '회의록을 불러오지 못했습니다' }), h('p', { text: /알 수 없는 요청/.test(e.message) ? '백엔드(Code.gs)를 회의록 기능이 들어간 판으로 바꾸고 새 버전으로 배포해야 합니다.' : e.message })]));
      if (btn) KR.busy(btn, false);
      return;
    }
    if (btn) KR.busy(btn, false);
    drawHead(); drawTools(); drawList();
  }
  drawHead();
  load(false);
})();

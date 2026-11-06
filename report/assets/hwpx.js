/* 업무보고 HWPX 생성기 (v5) — 회의록 양식(제목 상자 · 날짜/작성자 줄)에 2단 표(지난 실적 | 향후 계획)
 * template/report_template.hwpx: tools/build_template.py로 회의록 양식에서 만든 템플릿
 *   문단·글자 id는 템플릿에 덧붙인 것(아래 S). 모든 문단은 어절 단위 줄바꿈(KEEP_WORD).
 * 분야 안에서 소제목마다 한 행(같은 분야의 행 사이에는 선 없음) → 실적과 계획이 소제목별로 나란히 놓이고,
 *   행이 작아 쪽 경계에서 행 단위로 자연스럽게 나뉜다(표는 글자처럼 취급하지 않음, 머리행 반복). 상세 박스는 칸 안의 1칸짜리 표.
 * 브라우저(window.JSZip)와 Node(require('jszip')) 모두에서 동작. */
(function (root) {
  'use strict';

  // 템플릿 스타일 id (build_template.py 출력과 같아야 함)
  var S = {
    C_HEAD: 21, C_ITEM: 22, C_ITEMB: 23, C_NOTE: 24, C_BOX: 25, C_BOXB: 26, C_TH: 27, C_PERIOD: 28, C_ORG: 29,
    P_HEAD: 11, P_ITEM: 12, P_SUB: 13, P_NOTE: 14, P_BOX: 15, P_TH: 16, P_PLAIN: 17,
    B_CELL: 8, B_TH: 9, B_PERIOD: 10, B_HEAD: 11, B_CTOP: 12, B_CMID: 13, B_CBOT: 14, B_BOXTBL: 5, B_BOXCELL: 4
  };
  var CATS = ['K예술영재 심화멘토링', 'K예술영재 겨울캠프', 'K예술영재 공연', '홍보/다큐/아카이빙', '기타'];
  var TBL_W = 47800, COL_W = 23900, CELL_M = 425, BOX_W = COL_W - CELL_M * 2 - 200;
  var pid = 2147482000, tid = 1900000000;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function run(cp, text) { return text == null ? '<hp:run charPrIDRef="' + cp + '"/>' : '<hp:run charPrIDRef="' + cp + '"><hp:t>' + esc(text) + '</hp:t></hp:run>'; }
  function p(pp, runs) { return '<hp:p id="' + (pid++) + '" paraPrIDRef="' + pp + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">' + runs.join('') + '</hp:p>'; }
  function lineKind(s) {
    if (/^\s+\S/.test(s)) return 'cont';
    if (/^(\*|※)/.test(s)) return 'note';
    if (/^(\[|·|○|►|▶|→|https?:\/\/)/.test(s)) return 'raw';
    return 'item';
  }
  function visible(list) { return (list || []).filter(function (b) { return b && !b.hide && (String(b.t || '').trim() || String(b.c || '').trim() || String(b.d || '').trim() || String(b.box || '').trim()); }); }

  /** 상세 박스: 칸 안의 1칸짜리 표 (점선 칸, 맑은 고딕) */
  function boxTable(text) {
    var lines = String(text || '').split('\n').filter(function (l) { return l.trim(); });
    if (!lines.length) return '';
    var paras = lines.map(function (l, i) {
      var t = l.trim();
      if (/^[*※]/.test(t)) return p(S.P_BOX, [run(S.C_BOXB, t)]);
      return p(S.P_BOX, [run(S.C_BOX, ' - ' + t.replace(/^[-–·]\s*/, ''))]);
    }).join('');
    var h = 600 + lines.length * 520;
    var tbl = '<hp:tbl id="' + (tid++) + '" zOrder="3" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="1" colCnt="1" cellSpacing="0" borderFillIDRef="' + S.B_BOXTBL + '" noAdjust="0">' +
      '<hp:sz width="' + BOX_W + '" widthRelTo="ABSOLUTE" height="' + h + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="425" right="425" top="141" bottom="141"/>' +
      '<hp:tr><hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="' + S.B_BOXCELL + '">' +
      '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' + paras + '</hp:subList>' +
      '<hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="' + BOX_W + '" height="' + h + '"/><hp:cellMargin left="425" right="425" top="141" bottom="141"/></hp:tc></hp:tr></hp:tbl>';
    return p(S.P_PLAIN, [run(S.C_ITEM, '  ').replace('</hp:run>', '') + tbl + '<hp:t/></hp:run>']);
  }

  /** 항목 하나(ㅇ 요지 + 세부 + 박스) */
  function blockXml(b, opt) {
    var out = [], lines = 0, cl = String(b.c || '').split('\n');
    var runs = [run(S.C_ITEM, ' ㅇ ')];
    if (b.t) runs.push(run(S.C_ITEMB, '(' + b.t + ') '));
    runs.push(run(S.C_ITEM, (cl[0] || '').trim()));
    if (opt.showOrg && b.org) runs.push(run(S.C_ORG, ' [' + b.org + ']'));
    out.push(p(S.P_ITEM, runs)); lines += est(cl[0]) * 1.25 + 0.35;
    cl.slice(1).forEach(function (l) { if (l.trim()) { out.push(p(S.P_ITEM, [run(S.C_ITEM, '    ' + l.trim())])); lines += est(l) * 1.25; } });
    String(b.d || '').split('\n').forEach(function (l) {
      if (!l.trim()) return;
      var k = lineKind(l), t = l.trim();
      if (k === 'note') out.push(p(S.P_NOTE, [run(S.C_NOTE, '     ' + t)]));
      else if (k === 'item') out.push(p(S.P_SUB, [run(S.C_ITEM, '   - ' + t.replace(/^[-–]\s*/, ''))]));
      else out.push(p(S.P_SUB, [run(S.C_ITEM, '     ' + t)]));
      lines += est(t) * 1.2;
    });
    if (String(b.box || '').trim()) { out.push(boxTable(b.box)); lines += 1 + String(b.box).split('\n').filter(function (x) { return x.trim(); }).length * 0.9; }
    return { xml: out.join(''), lines: lines };
  }
  /** 한 줄에 들어가는 글자 수(반 칸 너비 기준)로 줄 수 어림 */
  function est(t) { return Math.max(1, Math.ceil(String(t || '').length / 30)); }
  /** 분야 안 항목을 소제목별로 묶어 행으로(실적·계획 짝 맞춤). 소제목 없는 항목은 순서대로 짝지음 */
  function rowsOf(pv, nx) {
    var out = [], m = {}, lp = [], ln = [];
    function key(b) { return String(b.t || '').replace(/\s+/g, ''); }
    var nk = {}; nx.forEach(function (b) { var k = key(b); if (k) nk[k] = 1; });
    var pk = {}; pv.forEach(function (b) { var k = key(b); if (k) pk[k] = 1; });
    // 실적·계획 양쪽에 같은 소제목이 있으면 같은 행에, 한쪽에만 있는 항목은 순서대로 짝지어 빈칸 없이
    pv.forEach(function (b) { var k = key(b); if (k && nk[k]) { if (!m[k]) { m[k] = { prev: [], next: [] }; out.push(m[k]); } m[k].prev.push(b); } else lp.push(b); });
    nx.forEach(function (b) { var k = key(b); if (k && pk[k]) m[k].next.push(b); else ln.push(b); });
    // 짝 없는 항목: 양쪽을 각각 이어 쓰되 대략 14줄마다 행을 끊어(쪽 나눔 지점) 칸 사이 빈자리를 줄임
    function lines(b) {
      var n = Math.ceil(String(String(b.c || '').split('\n')[0]).length / 22) || 1;
      String(b.c || '').split('\n').slice(1).concat(String(b.d || '').split('\n')).forEach(function (l) { if (l.trim()) n += Math.ceil(l.trim().length / 24); });
      String(b.box || '').split('\n').forEach(function (l) { if (l.trim()) n += 0.9; });
      return n + 0.5;
    }
    function take(list) { var row = [], h = 0; while (list.length && (!row.length || h + lines(list[0]) <= 14)) { h += lines(list[0]); row.push(list.shift()); } return row; }
    while (lp.length || ln.length) out.push({ prev: take(lp), next: take(ln) });
    return out.length ? out : [{ prev: [], next: [] }];
  }
  function cell(col, row, bf, body, height, o) {
    o = o || {};
    return '<hp:tc name="" header="' + (o.header ? 1 : 0) + '" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="' + bf + '">' +
      '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="' + (o.header ? 'CENTER' : 'TOP') + '" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' + body + '</hp:subList>' +
      '<hp:cellAddr colAddr="' + col + '" rowAddr="' + row + '"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="' + COL_W + '" height="' + height + '"/>' +
      '<hp:cellMargin left="' + CELL_M + '" right="' + CELL_M + '" top="' + (o.top != null ? o.top : 141) + '" bottom="' + (o.bottom != null ? o.bottom : 141) + '"/></hp:tc>';
  }
  function bodyTable(doc) {
    var opt = { showOrg: !!doc.showOrg }, rows = [], total = 0, r = 0;
    function add(a, b, bf, hgt, o) { rows.push('<hp:tr>' + cell(0, r, bf, a, hgt, o) + cell(1, r, bf, b, hgt, o) + '</hp:tr>'); total += hgt; r++; }
    add(p(S.P_TH, [run(S.C_TH, doc.headPrev || '지난 실적')]), p(S.P_TH, [run(S.C_TH, doc.headNext || '향후 계획')]), S.B_TH, 1700, { header: true });
    add(p(S.P_TH, [run(S.C_PERIOD, doc.periodPrev || '')]), p(S.P_TH, [run(S.C_PERIOD, doc.periodNext || '')]), S.B_PERIOD, 1300, { header: true });
    doc.cats.forEach(function (c, i) {
      var pv = visible(c.prev), nx = visible(c.next);
      if (!pv.length && !nx.length) return;
      var groups = rowsOf(pv, nx), n = groups.length, head = p(S.P_HEAD, [run(S.C_HEAD, '□ ' + CATS[i])]);
      var none = p(S.P_ITEM, [run(S.C_ITEM, ' ㅇ 해당 사항 없음')]);
      groups.forEach(function (g, k) {
        function side(list, all) {
          var xml = k === 0 ? head : '', ln = k === 0 ? 1.6 : 0;
          if (!all.length) { if (k === 0) { xml += none; ln += 1.3; } }
          else list.forEach(function (b) { var x = blockXml(b, opt); xml += x.xml; ln += x.lines + 0.3; });
          if (!xml) xml = p(S.P_PLAIN, [run(S.C_ITEM, null)]);
          return { xml: xml, lines: ln };
        }
        var a = side(g.prev, pv), b = side(g.next, nx);
        var top = k === 0 ? 340 : 60, bottom = k === n - 1 ? 340 : 60;
        var bf = n === 1 ? S.B_CELL : k === 0 ? S.B_CTOP : k === n - 1 ? S.B_CBOT : S.B_CMID;
        var hgt = Math.max(1200, Math.round(Math.max(a.lines, b.lines) * 640 + top + bottom));
        add(a.xml, b.xml, bf, hgt, { top: top, bottom: bottom });
      });
    });
    if (r === 2) add(p(S.P_ITEM, [run(S.C_ITEM, ' ㅇ 해당 사항 없음')]), p(S.P_ITEM, [run(S.C_ITEM, ' ㅇ 해당 사항 없음')]), S.B_CELL, 2400, { top: 340, bottom: 340 });
    // 글자처럼 취급하지 않고 쪽 경계에서 행 단위로 나눔(CELL) — 행을 소제목 단위로 작게 나눴으므로 쪽이 자연스럽게 넘어감. 머리행(지난 실적·기간)은 쪽마다 반복
    return '<hp:tbl id="' + (tid++) + '" zOrder="1" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="' + r + '" colCnt="2" cellSpacing="0" borderFillIDRef="' + S.B_CELL + '" noAdjust="0">' +
      '<hp:sz width="' + TBL_W + '" widthRelTo="ABSOLUTE" height="' + total + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="' + CELL_M + '" right="' + CELL_M + '" top="141" bottom="141"/>' +
      rows.join('') + '</hp:tbl>';
  }

  function plainText(doc) {
    var lines = [doc.title, doc.dateLine];
    doc.cats.forEach(function (c, i) {
      var pv = visible(c.prev), nx = visible(c.next);
      if (!pv.length && !nx.length) return;
      lines.push('□ ' + CATS[i]);
      pv.concat(nx).forEach(function (b) { lines.push(' ㅇ' + (b.t ? ' (' + b.t + ') ' : ' ') + String(b.c || '').split('\n')[0]); });
    });
    return lines.join('\r\n').slice(0, 1000);
  }

  /**
   * @param template  report_template.hwpx (ArrayBuffer|Uint8Array)
   * @param doc  {title, dateLine, author, headPrev, headNext, periodPrev, periodNext, cats:[{prev,next}], showOrg}
   */
  async function generate(template, doc, type) {
    var JSZip = root.JSZip || (typeof require === 'function' ? require('jszip') : null);
    var zip = await JSZip.loadAsync(template);
    var sec = await zip.file('Contents/section0.xml').async('string');
    var dateLine = String(doc.dateLine || '').replace(/^\/\s*/, '');
    if (doc.author && dateLine.indexOf(doc.author) < 0) dateLine += '/' + doc.author;
    sec = sec.split('__TITLE__').join(esc(doc.title)).split('__DATELINE__').join(esc(dateLine)).split('__BODY__').join(bodyTable(doc));
    zip.file('Contents/section0.xml', sec);
    var hpf = await zip.file('Contents/content.hpf').async('string');
    hpf = hpf.replace('__DOCTITLE__', esc(doc.title)).replace('__MODIFIED__', new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
    zip.file('Contents/content.hpf', hpf);
    zip.file('Preview/PrvText.txt', plainText(doc));
    var mt = await zip.file('mimetype').async('uint8array');
    zip.file('mimetype', mt, { compression: 'STORE' });
    return zip.generateAsync({ type: type || 'blob', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
  }

  var api = { generate: generate, rowsOf: rowsOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HWPX = api;
})(typeof window !== 'undefined' ? window : globalThis);

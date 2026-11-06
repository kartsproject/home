/* 업무보고 HWPX 생성기 (v5) — 회의록 양식(제목 상자 · 날짜/작성자 줄)에 2단 표(지난 실적 | 향후 계획)
 * template/report_template.hwpx: tools/build_template.py로 회의록 양식에서 만든 템플릿
 *   문단·글자 id는 템플릿에 덧붙인 것(아래 S). 모든 문단은 어절 단위 줄바꿈(KEEP_WORD).
 * 분야마다 한 행 → 실적과 계획이 같은 높이에서 나란히 비교된다. 상세 박스는 칸 안의 1칸짜리 표.
 * 브라우저(window.JSZip)와 Node(require('jszip')) 모두에서 동작. */
(function (root) {
  'use strict';

  // 템플릿 스타일 id (build_template.py 출력과 같아야 함)
  var S = {
    C_HEAD: 21, C_ITEM: 22, C_ITEMB: 23, C_NOTE: 24, C_BOX: 25, C_BOXB: 26, C_TH: 27, C_PERIOD: 28, C_ORG: 29,
    P_HEAD: 11, P_ITEM: 12, P_SUB: 13, P_NOTE: 14, P_BOX: 15, P_TH: 16, P_PLAIN: 17,
    B_CELL: 8, B_TH: 9, B_PERIOD: 10, B_HEAD: 11, B_BOXTBL: 5, B_BOXCELL: 4
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

  /** 한 칸(한 분야의 실적 또는 계획) */
  function cellBody(catName, list, opt) {
    var out = [p(S.P_HEAD, [run(S.C_HEAD, '□ ' + catName)])], lines = 1;
    if (!list.length) { out.push(p(S.P_ITEM, [run(S.C_ITEM, ' ㅇ 해당 사항 없음')])); return { xml: out.join(''), lines: 2 }; }
    list.forEach(function (b) {
      var cl = String(b.c || '').split('\n');
      var runs = [run(S.C_ITEM, ' ㅇ ')];
      if (b.t) runs.push(run(S.C_ITEMB, '(' + b.t + ') '));
      runs.push(run(S.C_ITEM, (cl[0] || '').trim()));
      if (opt.showOrg && b.org) runs.push(run(S.C_ORG, ' [' + b.org + ']'));
      out.push(p(S.P_ITEM, runs)); lines += 1.6;
      cl.slice(1).forEach(function (l) { if (l.trim()) { out.push(p(S.P_ITEM, [run(S.C_ITEM, '    ' + l.trim())])); lines += 1.3; } });
      String(b.d || '').split('\n').forEach(function (l) {
        if (!l.trim()) return;
        var k = lineKind(l), t = l.trim();
        if (k === 'note') out.push(p(S.P_NOTE, [run(S.C_NOTE, '     ' + t)]));
        else if (k === 'item') out.push(p(S.P_SUB, [run(S.C_ITEM, '   - ' + t.replace(/^[-–]\s*/, ''))]));
        else out.push(p(S.P_SUB, [run(S.C_ITEM, '     ' + t)]));
        lines += 1.4;
      });
      if (String(b.box || '').trim()) { out.push(boxTable(b.box)); lines += 1 + String(b.box).split('\n').length; }
    });
    return { xml: out.join(''), lines: lines };
  }
  function cell(col, row, bf, body, height, header) {
    return '<hp:tc name="" header="' + (header ? 1 : 0) + '" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="' + bf + '">' +
      '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="' + (header ? 'CENTER' : 'TOP') + '" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' + body + '</hp:subList>' +
      '<hp:cellAddr colAddr="' + col + '" rowAddr="' + row + '"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="' + COL_W + '" height="' + height + '"/>' +
      '<hp:cellMargin left="' + CELL_M + '" right="' + CELL_M + '" top="' + (header ? 141 : 340) + '" bottom="' + (header ? 141 : 340) + '"/></hp:tc>';
  }
  function bodyTable(doc) {
    var opt = { showOrg: !!doc.showOrg }, rows = [], total = 0;
    rows.push('<hp:tr>' + cell(0, 0, S.B_TH, p(S.P_TH, [run(S.C_TH, doc.headPrev || '지난 실적')]), 1700, true) + cell(1, 0, S.B_TH, p(S.P_TH, [run(S.C_TH, doc.headNext || '향후 계획')]), 1700, true) + '</hp:tr>');
    rows.push('<hp:tr>' + cell(0, 1, S.B_PERIOD, p(S.P_TH, [run(S.C_PERIOD, doc.periodPrev || '')]), 1300, true) + cell(1, 1, S.B_PERIOD, p(S.P_TH, [run(S.C_PERIOD, doc.periodNext || '')]), 1300, true) + '</hp:tr>');
    total += 3000;
    var r = 2;
    doc.cats.forEach(function (c, i) {
      var pv = visible(c.prev), nx = visible(c.next);
      if (!pv.length && !nx.length) return;
      var a = cellBody(CATS[i], pv, opt), b = cellBody(CATS[i], nx, opt);
      var hgt = Math.max(2400, Math.round(Math.max(a.lines, b.lines) * 620 + 700));
      rows.push('<hp:tr>' + cell(0, r, S.B_CELL, a.xml, hgt) + cell(1, r, S.B_CELL, b.xml, hgt) + '</hp:tr>');
      total += hgt; r++;
    });
    if (r === 2) { rows.push('<hp:tr>' + cell(0, 2, S.B_CELL, p(S.P_ITEM, [run(S.C_ITEM, ' ㅇ 해당 사항 없음')]), 2400) + cell(1, 2, S.B_CELL, p(S.P_ITEM, [run(S.C_ITEM, ' ㅇ 해당 사항 없음')]), 2400) + '</hp:tr>'); total += 2400; r++; }
    return '<hp:tbl id="' + (tid++) + '" zOrder="1" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="' + r + '" colCnt="2" cellSpacing="0" borderFillIDRef="' + S.B_CELL + '" noAdjust="0">' +
      '<hp:sz width="' + TBL_W + '" widthRelTo="ABSOLUTE" height="' + total + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
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

  var api = { generate: generate, cellBody: cellBody };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HWPX = api;
})(typeof window !== 'undefined' ? window : globalThis);

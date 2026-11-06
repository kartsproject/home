/* 한예종 업무보고 HWPX 생성기 (v3)
 * template/report_template.hwpx(한예종 양식 2단 표)의 본문 행을 분야 수만큼 복제해 채운다.
 * 분야마다 한 행 → 지난 실적·향후 계획이 같은 높이에서 나란히 비교된다.
 * 브라우저(window.JSZip)와 Node(require('jszip')) 모두에서 동작.
 */
(function (root) {
  'use strict';

  var PARA_BODY = 19;   // 본문 문단(양쪽 정렬, 줄간격 200%)
  var PARA_ITEM = 21;   // ㅇ 항목 (내어쓰기)
  var PARA_SUB = 22;    // - 세부 항목 (들여쓰기 + 내어쓰기)
  var CHAR_HEAD = 1;    // 휴먼명조 12pt 진하게
  var CHAR_TEXT = 11;   // 휴먼명조 12pt
  var CHAR_SPACER = 10; // 5pt 빈 줄
  var CHAR_TAG = 13;    // 기관 표기 10pt 회색
  var CATS = ['K예술영재 심화멘토링', 'K예술영재 겨울캠프', 'K예술영재 공연', '홍보/다큐/아카이빙', '기타'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function p(paraId, runs) {
    return '<hp:p id="2147483648" paraPrIDRef="' + paraId + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">' +
      runs.map(function (r) {
        return r.text == null ? '<hp:run charPrIDRef="' + r.cp + '"/>' : '<hp:run charPrIDRef="' + r.cp + '"><hp:t>' + esc(r.text) + '</hp:t></hp:run>';
      }).join('') + '</hp:p>';
  }
  function lineKind(s) {
    if (/^\s+\S/.test(s)) return 'cont';
    if (/^(\*|※|\[|·|○|►|▶|→|https?:\/\/)/.test(s)) return 'raw';
    return 'item';
  }
  function visible(list) { return (list || []).filter(function (b) { return b && !b.hide && (String(b.t || '').trim() || String(b.c || '').trim() || String(b.d || '').trim()); }); }

  /** 한 칸(한 분야의 지난 실적 또는 향후 계획) */
  function cellBody(catName, list, opt) {
    var out = [p(PARA_BODY, [{ cp: CHAR_HEAD, text: '□ ' + catName }])];
    if (!list.length) { out.push(p(PARA_ITEM, [{ cp: CHAR_TEXT, text: ' ㅇ 해당 사항 없음' }])); return out.join(''); }
    list.forEach(function (b) {
      var lines = String(b.c || '').split('\n');
      var runs = [{ cp: CHAR_TEXT, text: ' ㅇ' + (b.t ? '(' + b.t + ') ' : ' ') + (lines[0] || '').trim() }];
      if (opt.showOrg && b.org) runs.push({ cp: CHAR_TAG, text: ' [' + b.org + ']' });
      out.push(p(PARA_ITEM, runs));
      lines.slice(1).forEach(function (l) { if (l.trim()) out.push(p(PARA_SUB, [{ cp: CHAR_TEXT, text: '  ' + l.trim() }])); });
      String(b.d || '').split('\n').forEach(function (l) {
        if (!l.trim()) return;
        var k = lineKind(l);
        out.push(p(PARA_SUB, [{ cp: CHAR_TEXT, text: (k === 'item' ? '- ' : '  ') + l.trim() }]));
      });
    });
    return out.join('');
  }

  function plainText(doc) {
    var lines = [doc.title, doc.dateLine, '', '<' + (doc.headPrev || '지난 실적') + '> ' + doc.periodPrev + ' / <' + (doc.headNext || '향후 계획') + '> ' + doc.periodNext];
    doc.cats.forEach(function (c, i) {
      var pv = visible(c.prev), nx = visible(c.next);
      if (!pv.length && !nx.length) return;
      lines.push('□ ' + CATS[i]);
      pv.concat(nx).forEach(function (b) { lines.push(' ㅇ' + (b.t ? '(' + b.t + ') ' : ' ') + String(b.c || '').split('\n')[0]); });
    });
    return lines.join('\r\n').slice(0, 1000);
  }

  /**
   * @param {ArrayBuffer|Uint8Array} template  report_template.hwpx
   * @param {object} doc  {title,dateLine,headPrev,headNext,periodPrev,periodNext,cats:[{prev,next}],showOrg}
   */
  async function generate(template, doc, type) {
    var JSZip = root.JSZip || (typeof require === 'function' ? require('jszip') : null);
    var zip = await JSZip.loadAsync(template);
    var opt = { showOrg: !!doc.showOrg };
    var sec = await zip.file('Contents/section0.xml').async('string');

    // 본문 행(자리표시자 __BODY_PREV__가 든 <hp:tr>)을 분야 수만큼 복제
    var trs = sec.split('<hp:tr>');
    var bodyIdx = trs.findIndex(function (s) { return s.indexOf('__BODY_PREV__') >= 0; });
    var rowTpl = '<hp:tr>' + trs[bodyIdx].slice(0, trs[bodyIdx].indexOf('</hp:tr>') + 8);
    var cats = [];
    doc.cats.forEach(function (c, i) { var pv = visible(c.prev), nx = visible(c.next); if (pv.length || nx.length) cats.push({ i: i, pv: pv, nx: nx }); });
    if (!cats.length) cats.push({ i: 4, pv: [], nx: [] });
    var rows = cats.map(function (c, k) {
      var r = rowTpl.split('__BODY_PREV__').join(cellBody(CATS[c.i], c.pv, opt)).split('__BODY_NEXT__').join(cellBody(CATS[c.i], c.nx, opt));
      r = r.replace(/rowAddr="2"/g, 'rowAddr="' + (2 + k) + '"').replace(/<hp:cellSz width="(\d+)" height="57025"\/>/g, '<hp:cellSz width="$1" height="4000"/>');
      return r;
    }).join('');
    sec = sec.replace(rowTpl, rows)
      .replace('rowCnt="3"', 'rowCnt="' + (2 + cats.length) + '"')
      .replace('height="63959" heightRelTo="ABSOLUTE"', 'height="' + (6934 + 4000 * cats.length) + '" heightRelTo="ABSOLUTE"');

    var map = {
      __TITLE__: esc(doc.title), __DATELINE__: esc(doc.dateLine),
      __HEAD_PREV__: esc(doc.headPrev || '지난 실적'), __HEAD_NEXT__: esc(doc.headNext || '향후 계획'),
      __PERIOD_PREV__: esc(doc.periodPrev), __PERIOD_NEXT__: esc(doc.periodNext)
    };
    Object.keys(map).forEach(function (k) { sec = sec.split(k).join(map[k]); });
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

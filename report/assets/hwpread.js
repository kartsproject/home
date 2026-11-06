/* 한글 파일(.hwp · .hwpx) 읽기 — 브라우저 안에서만 읽고 서버로 보내지 않는다.
 * 보고 양식(2단 표: 왼쪽 지난 실적, 오른쪽 향후 계획)의 칸을 열 번호로 구분해 줄 단위 글로 돌려준다.
 *   read(file) → { title, dateLine, period, cells: [{col, row, lines}], outside: [줄] }
 * .hwp(한글 5.0)는 OLE 복합 파일 + 압축(deflate-raw) 레코드, .hwpx는 zip 안의 XML이다. */
(function (root) {
  'use strict';

  /* ---------- 공통: 표 칸 모으기 ---------- */
  function Collector() {
    var cells = [], outside = [], cur = null, nested = null;
    function flushNested() {
      if (!nested || !cur) { nested = null; return; }
      var maxCol = 0, rows = {};
      nested.cells.forEach(function (c) { if (c.col > maxCol) maxCol = c.col; (rows[c.row] = rows[c.row] || []).push(c); });
      if (maxCol === 0) { // 한 열짜리 상자(피드백 상자 등): 문단을 그대로
        nested.cells.forEach(function (c) { c.lines.forEach(function (l) { if (l.trim()) cur.lines.push(/^\s*[-*※\[·○]/.test(l) ? l.trim() : '  ' + l.trim()); }); });
      } else {            // 여러 열 표(도메인 표 등): 한 행을 한 줄로
        Object.keys(rows).sort(function (a, b) { return a - b; }).forEach(function (r) {
          var line = rows[r].sort(function (a, b) { return a.col - b.col; }).map(function (c) { return c.lines.join(' ').trim(); }).filter(String).join(' · ');
          if (line) cur.lines.push('  ' + line);
        });
      }
      nested = null;
    }
    return {
      outerCell: function (col, row) { flushNested(); cur = { col: col, row: row, lines: [] }; cells.push(cur); },
      nestedStart: function () { flushNested(); nested = { cells: [] }; },
      nestedCell: function (col, row) { if (!nested) nested = { cells: [] }; nested.cur = { col: col, row: row, lines: [] }; nested.cells.push(nested.cur); },
      text: function (t, where) {
        if (where === 'outside') { flushNested(); cur = null; outside.push(t); }
        else if (where === 'nested' && nested && nested.cur) nested.cur.lines.push(t);
        else if (cur) { flushNested(); cur.lines.push(t); }
        else outside.push(t);
      },
      endTable: function () { flushNested(); cur = null; },
      done: function () { flushNested(); return { cells: cells, outside: outside }; }
    };
  }
  function finish(res) {
    var out = res.outside.map(function (s) { return s.trim(); }).filter(String);
    var title = out.filter(function (s) { return /업무보고|보고/.test(s); })[0] || '';
    var dateLine = out.filter(function (s) { return /\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\./.test(s); })[0] || '';
    var period = '';
    res.cells.forEach(function (c) { var t = c.lines.join(' ').trim(); if (!period && c.col === 0 && /\d{1,2}\.\s*\d{1,2}\.?\s*\(.\)\s*~/.test(t) && t.length < 40) period = t; });
    return { title: title, dateLine: dateLine, period: period, cells: res.cells, outside: out };
  }

  /* ---------- .hwp (한글 5.0) ---------- */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  /** OLE 복합 파일(CFB)에서 스트림 꺼내기 */
  function Cfb(buf) {
    var b = new Uint8Array(buf);
    if (u32(b, 0) !== 0xE011CFD0) throw new Error('한글 파일 형식이 아닙니다');
    var ss = 1 << u16(b, 30), mss = 1 << u16(b, 32), nfat = u32(b, 44), dirStart = u32(b, 48), cutoff = u32(b, 56), miniStart = u32(b, 60), difat = u32(b, 68);
    var END = 0xFFFFFFFE, FREE = 0xFFFFFFFF;
    function sec(i) { var o = (i + 1) * ss; return b.subarray(o, o + ss); }
    var fatSecs = [];
    for (var k = 0; k < 109; k++) fatSecs.push(u32(b, 76 + k * 4));
    var guard = 0;
    while (difat !== END && difat !== FREE && guard++ < 1000) { var d = sec(difat); for (var k2 = 0; k2 < ss / 4 - 1; k2++) fatSecs.push(u32(d, k2 * 4)); difat = u32(d, ss - 4); }
    var fat = [];
    fatSecs.slice(0, nfat).forEach(function (s) { var x = sec(s); for (var q = 0; q < ss / 4; q++) fat.push(u32(x, q * 4)); });
    function chain(i) { var parts = [], n = 0; while (i !== END && i !== FREE && i < fat.length && n++ < 200000) { parts.push(sec(i)); i = fat[i]; } return concat(parts); }
    var dir = chain(dirStart), ents = [];
    for (var e = 0; e + 128 <= dir.length; e += 128) {
      var nl = u16(dir, e + 64), name = '';
      for (var c = 0; c < Math.max(nl - 2, 0); c += 2) name += String.fromCharCode(u16(dir, e + c));
      ents.push({ name: name, type: dir[e + 66], l: u32(dir, e + 68), r: u32(dir, e + 72), c: u32(dir, e + 76), start: u32(dir, e + 116), size: u32(dir, e + 120) });
    }
    var ministream = chain(ents[0].start);
    var minifat = [];
    if (miniStart < 0xFFFFFFF0) { var mf = chain(miniStart); for (var m = 0; m + 4 <= mf.length; m += 4) minifat.push(u32(mf, m)); }
    function mchain(i) { var parts = [], n = 0; while (i !== END && i !== FREE && i < minifat.length && n++ < 200000) { parts.push(ministream.subarray(i * mss, (i + 1) * mss)); i = minifat[i]; } return concat(parts); }
    function children(idx) { var res = []; (function walk(i) { if (i === FREE || i >= ents.length) return; walk(ents[i].l); res.push(i); walk(ents[i].r); })(ents[idx].c); return res; }
    function find(path) { var idx = 0; for (var p = 0; p < path.length; p++) { var hit = children(idx).filter(function (i) { return ents[i].name === path[p]; })[0]; if (hit == null) return -1; idx = hit; } return idx; }
    return {
      read: function (path) { var i = find(path); if (i < 0) return null; var en = ents[i]; var data = en.size < cutoff ? mchain(en.start) : chain(en.start); return data.subarray(0, en.size); },
      list: function (path) { var i = find(path); return i < 0 ? [] : children(i).map(function (x) { return ents[x].name; }); }
    };
  }
  function concat(parts) { var n = 0; parts.forEach(function (p) { n += p.length; }); var out = new Uint8Array(n), o = 0; parts.forEach(function (p) { out.set(p, o); o += p.length; }); return out; }
  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 한글(.hwp) 파일 읽기를 지원하지 않습니다. 최신 크롬·엣지·사파리를 쓰거나 .hwpx로 저장해 올려 주세요');
    // 한글 본문 뒤에 붙은 여분 바이트 때문에 브라우저가 끝에서 오류를 낼 수 있어, 그때까지 푼 내용은 그대로 쓴다
    var reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = [];
    try { for (;;) { var r = await reader.read(); if (r.done) break; parts.push(r.value); } }
    catch (e) { if (!parts.length) throw new Error('한글 파일 본문을 풀지 못했습니다'); }
    return concat(parts);
  }
  function paraText(rec) {
    var out = '';
    for (var j = 0; j + 1 < rec.length;) {
      var c = u16(rec, j);
      if (c < 32) {
        if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].indexOf(c) >= 0) { if (c === 9) out += ' '; j += 16; continue; }
        if (c === 10 || c === 24 || c === 30 || c === 31) out += ' ';
        j += 2; continue;
      }
      out += String.fromCharCode(c); j += 2;
    }
    return out;
  }
  async function readHwp(buf) {
    var f = Cfb(buf);
    var head = f.read(['FileHeader']);
    if (!head) throw new Error('한글 파일 머리 정보를 찾지 못했습니다');
    var flags = u32(head, 36);
    if (flags & 2) throw new Error('암호가 걸린 한글 파일은 읽을 수 없습니다');
    if (flags & 4) throw new Error('배포용 문서는 읽을 수 없습니다');
    var compressed = !!(flags & 1);
    var secs = f.list(['BodyText']).filter(function (n) { return /^Section\d+$/.test(n); }).sort(function (a, b) { return +a.slice(7) - +b.slice(7); });
    var col = Collector(), outerL = null, nestedL = null;
    for (var s = 0; s < secs.length; s++) {
      var d = f.read(['BodyText', secs[s]]);
      if (compressed) d = await inflateRaw(d);
      for (var i = 0; i + 4 <= d.length;) {
        var hd = u32(d, i); i += 4;
        var tag = hd & 0x3ff, lvl = (hd >>> 10) & 0x3ff, size = (hd >>> 20) & 0xfff;
        if (size === 0xfff) { size = u32(d, i); i += 4; }
        var rec = d.subarray(i, i + size); i += size;
        if (tag === 71 && size >= 4 && String.fromCharCode(rec[3], rec[2], rec[1], rec[0]) === 'tbl ') {
          if (outerL == null || lvl <= outerL) { col.endTable(); outerL = lvl; nestedL = null; }
          else { nestedL = lvl; col.nestedStart(); }
        } else if (tag === 72 && size >= 12) {
          var cAddr = u16(rec, 8), rAddr = u16(rec, 10);
          if (outerL != null && lvl === outerL + 1) col.outerCell(cAddr, rAddr);
          else if (nestedL != null && lvl === nestedL + 1) col.nestedCell(cAddr, rAddr);
        } else if (tag === 67) {
          var t = paraText(rec);
          if (outerL == null || lvl <= outerL) { outerL = null; nestedL = null; col.text(t, 'outside'); }
          else if (nestedL != null && lvl >= nestedL + 2) col.text(t, 'nested');
          else col.text(t, 'cell');
        }
      }
    }
    return finish(col.done());
  }

  /* ---------- .hwpx ---------- */
  async function readHwpx(buf) {
    if (!root.JSZip) await new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = 'assets/vendor/jszip.min.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
    var zip = await root.JSZip.loadAsync(buf);
    var names = Object.keys(zip.files).filter(function (n) { return /^Contents\/section\d+\.xml$/i.test(n); }).sort();
    if (!names.length) throw new Error('한글(.hwpx) 본문을 찾지 못했습니다');
    var col = Collector();
    for (var k = 0; k < names.length; k++) {
      var xml = new DOMParser().parseFromString(await zip.file(names[k]).async('string'), 'application/xml');
      walk(xml.documentElement, 0);
    }
    function local(n) { return (n.localName || n.nodeName || '').replace(/^.*:/, ''); }
    function textOf(p) { // 문단 글자 (안에 든 표의 글자는 빼고)
      var s = '';
      (function rec(n) { for (var c = n.firstChild; c; c = c.nextSibling) { if (c.nodeType !== 1) continue; var ln = local(c); if (ln === 'tbl') continue; if (ln === 't') s += c.textContent; else if (ln === 'tab' || ln === 'lineBreak') s += ' '; else rec(c); } })(p);
      return s;
    }
    function cellAddr(tc) { var a = null; for (var c = tc.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && local(c) === 'cellAddr') a = c; return a ? [+a.getAttribute('colAddr'), +a.getAttribute('rowAddr')] : [0, 0]; }
    function walk(node, depth) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        var ln = local(c);
        if (ln === 'p') {
          var t = textOf(c);
          if (t.trim() || depth > 0) col.text(t, depth === 0 ? 'outside' : depth === 1 ? 'cell' : 'nested');
          walk(c, depth); // 문단 안의 표
        } else if (ln === 'tbl') {
          if (depth === 0) col.endTable(); else col.nestedStart();
          for (var tr = c.firstChild; tr; tr = tr.nextSibling) {
            if (tr.nodeType !== 1 || local(tr) !== 'tr') continue;
            for (var tc = tr.firstChild; tc; tc = tc.nextSibling) {
              if (tc.nodeType !== 1 || local(tc) !== 'tc') continue;
              var ad = cellAddr(tc);
              if (depth === 0) col.outerCell(ad[0], ad[1]); else col.nestedCell(ad[0], ad[1]);
              walk(tc, depth + 1);
            }
          }
          if (depth === 0) col.endTable();
        } else walk(c, depth);
      }
    }
    return finish(col.done());
  }

  async function read(file) {
    var buf = await file.arrayBuffer(), b = new Uint8Array(buf);
    if (b[0] === 0xD0 && b[1] === 0xCF) return readHwp(buf);
    if (b[0] === 0x50 && b[1] === 0x4B) return readHwpx(buf);
    throw new Error('.hwp 또는 .hwpx 파일만 읽을 수 있습니다');
  }

  /** 읽은 결과 → 보고 자료 {cats:[{prev,next}]} (왼쪽 열 = 지난 실적, 그 오른쪽 열 = 향후 계획) */
  function toData(r) {
    var KR = root.KR, data = KR.emptyData(), any = false;
    var body = r.cells.filter(function (c) {
      var t = c.lines.join(' ').replace(/\s+/g, ' ').trim();
      if (!t) return false;
      if (/^(지난\s*실적|향후\s*계획|실적|계획)$/.test(t)) return false;
      if (t.length < 40 && /\d{1,2}\.\s*\d{1,2}\.?\s*\(.\)\s*~/.test(t)) return false;
      return true;
    });
    var cols = body.map(function (c) { return c.col; }), minCol = Math.min.apply(null, cols.length ? cols : [0]);
    body.forEach(function (c) {
      var side = c.col === minCol ? 'prev' : 'next';
      var p = KR.parseText(c.lines.join('\n'), 4);
      p.cats.forEach(function (list, i) { list.forEach(function (bk) { data.cats[i][side].push(bk); any = true; }); });
    });
    if (!any && r.outside.length) { // 표가 없는 문서: 전부 지난 실적으로 읽고 고르게 함
      var p2 = KR.parseText(r.outside.join('\n'), 4);
      p2.cats.forEach(function (list, i) { data.cats[i].prev = list; });
    }
    return data;
  }

  root.KRHwp = { read: read, toData: toData };
})(window);

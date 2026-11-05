/**
 * 글쓰기 도구로 쓴 글 검사 (2026-11-05 사용자 — 「글꼴 · 문장 정렬 등 글쓰기 도구」).
 * 화면 assets/js/richtext.js와 같은 모양만 통과시킨다. 모르는 칸은 버리고, 값이 틀리면 null(INVALID_INPUT).
 *   조각 run = { x:글, b:1 굵게, i:1 기울임, u:1 밑줄, m:1 형광, s:'s'|'l', c:'teal'|'navy'|'red'|'gray', f:'g', h:링크 주소 }
 *   글 묶음 doc = { v:1, b:[ { t:'p'|'h'|'ul'|'ol', a:'c'|'r'|'l', r:[조각] | i:[[조각], …] } ] }
 * 공지 본문은 시트 「본문」 칸에 doc JSON으로 둔다(예전 본문은 그냥 글 — 둘 다 읽는다).
 * 페이지 직접 편집의 글자 칸은 예전처럼 글(문자열) 또는 { r:[조각], a } (Pages.js cleanPageCell_).
 */
var RICH_COLORS_ = ['teal', 'navy', 'red', 'gray'];
var RICH_SIZES_ = ['s', 'l'];
var RICH_FONTS_ = ['g'];
var RICH_ALIGNS_ = ['l', 'c', 'r'];
var RICH_LINK_ = /^(https?:\/\/|mailto:)[^\s<>"]{1,490}$/i;

// 조각 배열. maxRuns개까지, 각 글은 제어 문자(줄바꿈 빼고)를 지운다
function cleanRuns_(runs, maxRuns) {
  if (!Array.isArray(runs) || runs.length > maxRuns) return null;
  var out = [];
  for (var i = 0; i < runs.length; i++) {
    var r = runs[i];
    if (!r || typeof r !== 'object' || Array.isArray(r) || typeof r.x !== 'string') return null;
    var x = r.x.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '');
    if (x.length > 20000) return null;
    if (!x) continue;
    var o = { x: x };
    ['b', 'i', 'u', 'm'].forEach(function (f) { if (r[f]) o[f] = 1; });
    if (r.s != null) { if (RICH_SIZES_.indexOf(r.s) === -1) return null; o.s = r.s; }
    if (r.c != null) { if (RICH_COLORS_.indexOf(r.c) === -1) return null; o.c = r.c; }
    if (r.f != null) { if (RICH_FONTS_.indexOf(r.f) === -1) return null; o.f = r.f; }
    if (r.h != null) { if (typeof r.h !== 'string' || !RICH_LINK_.test(r.h)) return null; o.h = r.h; }
    out.push(o);
  }
  return out;
}

function richRunsText_(runs) {
  return (runs || []).map(function (r) { return r.x; }).join('');
}

// 글 묶음. limits: { blocks, runs, items }
function cleanRichDoc_(doc, limits) {
  limits = limits || { blocks: 500, runs: 500, items: 300 };
  if (!doc || typeof doc !== 'object' || doc.v !== 1 || !Array.isArray(doc.b) || doc.b.length > limits.blocks) return null;
  var out = [];
  for (var i = 0; i < doc.b.length; i++) {
    var b = doc.b[i];
    if (!b || typeof b !== 'object' || ['p', 'h', 'ul', 'ol'].indexOf(b.t) === -1) return null;
    var o = { t: b.t };
    if (b.a != null) {
      if (RICH_ALIGNS_.indexOf(b.a) === -1) return null;
      if (b.a !== 'l') o.a = b.a;
    }
    if (b.t === 'ul' || b.t === 'ol') {
      if (!Array.isArray(b.i) || b.i.length > limits.items) return null;
      o.i = [];
      for (var n = 0; n < b.i.length; n++) {
        var item = cleanRuns_(b.i[n], limits.runs);
        if (!item) return null;
        if (item.length) o.i.push(item);
      }
      if (!o.i.length) continue;
    } else {
      var runs = cleanRuns_(b.r == null ? [] : b.r, limits.runs);
      if (!runs) return null;
      o.r = runs;
    }
    out.push(o);
  }
  return { v: 1, b: out };
}

// 글 묶음 → 글자만 (글자 수 세기 · 목록 미리보기)
function richDocText_(doc) {
  return ((doc && doc.b) || []).map(function (b) {
    if (b.t === 'ul' || b.t === 'ol') return b.i.map(function (r, i) { return (b.t === 'ul' ? '• ' : (i + 1) + '. ') + richRunsText_(r); }).join('\n');
    return richRunsText_(b.r);
  }).join('\n');
}

// 시트 「본문」 칸 → { body: 글자, rich: 글 묶음|null }. 글 묶음이 아니거나 깨졌으면 그냥 글
function readRichBody_(cell) {
  var s = String(cell == null ? '' : cell);
  if (s.indexOf('{"v":1') === 0) {
    try {
      var doc = cleanRichDoc_(JSON.parse(s));
      if (doc) return { body: richDocText_(doc), rich: doc };
    } catch (err) { /* 그냥 글로 */ }
  }
  return { body: s, rich: null };
}

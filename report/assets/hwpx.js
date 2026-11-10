/* 업무보고 HWPX 생성기 (v6) — 회의록 양식(제목 상자 · 날짜/작성자 줄)에 2단 표(지난 실적 | 향후 계획)
 * template/report_template.hwpx: build_template.py로 회의록 양식에서 만든 템플릿
 *   글꼴·굵기·자간·줄간격·내어쓰기·상세 박스 모양은 회의록을 따르고, 크기만 칸 폭에 맞춰 15 → 11pt 비율로 줄였다.
 * 줄 맞춤(fit): 문단마다 글자 폭을 어림해
 *   1) 자간 0 → -3 → -5 → -8 순으로 한 줄에 들어가는 가장 느슨한 자간을 고른다(회의록처럼 괄호 안은 작은 글자 · 자간 -8).
 *   2) -8로도 넘치면 줄 수가 가장 적게, 쉼표 뒤 · 화살표 앞뒤 · 어절 사이 순으로 나눌 자리를 골라 강제 줄 나눔을 넣는다.
 *      괄호 안이나 소제목 바로 뒤는 되도록 나누지 않고, 다음 줄은 내어쓰기로 머리 글자 뒤에 맞춘다.
 * 분야 안에서 소제목마다 한 행(같은 분야의 행 사이에는 선 없음) → 실적과 계획이 소제목별로 나란히 놓인다.
 * 표는 글자처럼 취급하고, 행 높이를 어림해 쪽마다 표 하나씩 나눠 넣는다(표마다 머리행, 둘째 표부터 쪽 나눔). 상세 박스는 칸 안의 1칸짜리 표.
 * 브라우저(window.JSZip)와 Node(require('jszip')) 모두에서 동작. */
(function (root) {
  'use strict';

  // 템플릿 스타일 id (build_template.py 출력과 같아야 함)
  var S = {
    C_ITEM0: 21, C_ITEMB0: 22, C_NOTE0: 23, C_BOX0: 24, C_BOXB0: 25,
    C_ITEM3: 26, C_ITEMB3: 27, C_NOTE3: 28, C_BOX3: 29, C_BOXB3: 30,
    C_ITEM5: 31, C_ITEMB5: 32, C_NOTE5: 33, C_BOX5: 34, C_BOXB5: 35,
    C_ITEM8: 36, C_ITEMB8: 37, C_NOTE8: 38, C_BOX8: 39, C_BOXB8: 40,
    C_PAREN: 41, C_HSYM: 42, C_HEAD: 43, C_TH: 44, C_PERIOD: 45, C_ORG: 46, C_GAP: 47, C_GAP2: 48,
    P_HEAD: 11, P_ITEM: 12, P_ITEM_L: 13, P_SUB: 14, P_SUB_L: 15, P_NOTE: 16, P_NOTE_L: 17, P_BOX: 18, P_BOX_L: 19,
    P_TH: 20, P_PLAIN: 21, P_BOXHOST: 22, P_GAP: 23,
    B_CELL: 8, B_TH: 9, B_PERIOD: 10, B_HEAD: 11, B_CTOP: 12, B_CMID: 13, B_CBOT: 14, B_BOXTBL: 5, B_BOXCELL: 4
  };
  var CATS = ['K예술영재 심화멘토링', 'K예술영재 겨울캠프', 'K예술영재 공연', '홍보/다큐/아카이빙', '기타'];
  var TBL_W = 47800, COL_W = 23900, CELL_M = 425, TEXT_W = COL_W - CELL_M * 2;     // 칸 글자 폭 23050
  var BOX_IN = 1600, BOX_M = 400, BOX_W = TEXT_W - BOX_IN - 450, BOX_TEXT = BOX_W - BOX_M * 2;
  var STEPS = [0, -3, -5, -8];
  var SAFE = 0.965;                       // 폭 어림이 조금 빗나가도 한글이 저절로 줄을 넘기지 않게 남겨 두는 몫
  // 글자 모양 묶음: 크기(HWPUNIT) · 자간별 id · 글꼴 계열(M 휴먼명조/HCI Poppy · G 한양중고딕 · B 맑은 고딕)
  var FAM = {
    item: { size: 1100, fam: 'M', id: function (sp) { return S['C_ITEM' + (-sp)]; }, bold: function (sp) { return S['C_ITEMB' + (-sp)]; },
            p: S.P_ITEM, pl: S.P_ITEM_L, hang: 2178, lh: 1760 },
    sub:  { size: 1100, fam: 'M', id: function (sp) { return S['C_ITEM' + (-sp)]; }, bold: function (sp) { return S['C_ITEMB' + (-sp)]; },
            p: S.P_SUB, pl: S.P_SUB_L, hang: 2651, lh: 1705 },
    note: { size: 900, fam: 'G', id: function (sp) { return S['C_NOTE' + (-sp)]; }, bold: function (sp) { return S['C_NOTE' + (-sp)]; },
            p: S.P_NOTE, pl: S.P_NOTE_L, hang: 3096, lh: 1395 },
    box:  { size: 850, fam: 'B', id: function (sp) { return S['C_BOX' + (-sp)]; }, bold: function (sp) { return S['C_BOXB' + (-sp)]; },
            p: S.P_BOX, pl: S.P_BOX_L, hang: 1063, lh: 1275 }
  };
  var FIXED = { par: { id: S.C_PAREN, size: 950, sp: -8 }, org: { id: S.C_ORG, size: 800, sp: 0 } };
  var LH_HEAD = 1920, H_GAP = 640, H_GAP2 = 320;
  var pid = 2147482000, tid = 1900000000;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function run(cp, text) { return text == null ? '<hp:run charPrIDRef="' + cp + '"/>' : '<hp:run charPrIDRef="' + cp + '"><hp:t>' + esc(text) + '</hp:t></hp:run>'; }
  function p(pp, runs) { return '<hp:p id="' + (pid++) + '" paraPrIDRef="' + pp + '" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">' + runs.join('') + '</hp:p>'; }
  function gap(cp) { return p(S.P_GAP, [run(cp, null)]); }
  function lineKind(s) {
    if (/^\s+\S/.test(s)) return 'cont';
    if (/^(\*|※)/.test(s)) return 'note';
    if (/^(\[|·|○|►|▶|→|https?:\/\/)/.test(s)) return 'raw';
    return 'item';
  }
  function visible(list) { return (list || []).filter(function (b) { return b && !b.hide && (String(b.t || '').trim() || String(b.c || '').trim() || String(b.d || '').trim() || String(b.box || '').trim()); }); }
  /** 문장 다듬기: 겹친 빈칸 · 괄호/쉼표 앞뒤 빈칸만 정리(낱말은 바꾸지 않음) */
  function tidy(t) {
    return String(t || '').replace(/[\t 　]/g, ' ').replace(/ {2,}/g, ' ').replace(/\( +/g, '(').replace(/ +\)/g, ')').replace(/ +([,.])(?=\s|$)/g, '$1').trim();
  }

  /* ---------- 글자 폭 어림 (em 단위, 회의록 미리보기에서 맞춘 값) ---------- */
  function em(ch, fam) {
    var B = fam === 'B';
    if (/[가-힣ㄱ-ㆎ一-鿿　-〿＀-｠□■○●◎◇◆△▲▽▼※→←↑↓⇒☞★☆]/.test(ch)) return 1;
    if (ch === ' ') return B ? 0.4 : 0.49;
    if (/[0-9]/.test(ch)) return B ? 0.55 : 0.47;
    if (/[.,:;]/.test(ch)) return 0.27;
    if (/[()[\]{}]/.test(ch)) return B ? 0.35 : 0.5;
    if (ch === '/') return B ? 0.4 : 0.5;
    if (ch === '·') return B ? 0.45 : 0.48;
    if (/[~∼]/.test(ch)) return 0.55;
    if (/[-+=–<>]/.test(ch)) return 0.5;
    if (/[A-Z]/.test(ch)) return B ? 0.62 : 0.66;
    if (/[a-z]/.test(ch)) return B ? 0.52 : 0.5;
    if (/[%@]/.test(ch)) return 0.88;
    if (/[&#*?]/.test(ch)) return 0.55;
    if (/['"‘’“”!|]/.test(ch)) return 0.3;
    return 0.6;
  }

  /* ---------- 문단 조각 → 줄 맞춤 ---------- */
  /** 괄호 묶음을 작은 글자 조각으로(회의록 규칙). 요일 한 글자 「(월)」 같은 짧은 괄호는 본문 크기 그대로 */
  function parenSplit(text) {
    var out = [], re = /\([^()]{2,}\)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ s: 'txt', t: text.slice(last, m.index) });
      out.push({ s: 'par', t: m[0] }); last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ s: 'txt', t: text.slice(last) });
    return out;
  }
  /** 조각들을 글자 하나씩 펼침: {ch, s(조각 종류), inPar} */
  function flatten(segs) {
    var chars = [];
    segs.forEach(function (g) {
      var depth = 0;
      String(g.t).split('').forEach(function (ch) {
        if (g.s !== 'par' && ch === '(') depth++;
        chars.push({ ch: ch, s: g.s, inPar: g.s === 'par' || depth > 0 });
        if (g.s !== 'par' && ch === ')' && depth) depth--;
      });
    });
    return chars;
  }
  function charW(c, F, sp) {
    var fx = FIXED[c.s], size = fx ? fx.size : F.size, s = fx ? fx.sp : (c.s === 'pre' ? 0 : sp);
    return em(c.ch, fx ? 'M' : F.fam) * size + size * s / 100;
  }
  function charId(c, F, sp) {
    if (FIXED[c.s]) return FIXED[c.s].id;
    if (c.s === 'pre') return F.id(0);
    if (c.s === 'lab' || c.s === 'tit') return F.bold(sp);
    return F.id(sp);
  }
  /** 나눌 자리와 값(낮을수록 좋음). 빈칸이면 그 빈칸을 줄 나눔으로 바꾸고, 「→」 뒤 · 붙은 「(」 앞이면 글자 사이에서 나눔
   *  0 쉼표 뒤 · 1 쌍점 뒤, 화살표·빗금 앞뒤 · 2 조사·어미로 끝난 어절 뒤 · 3 괄호 앞 · 4 그 밖의 어절 사이
   *  · 6 짧은 꾸밈말 뒤(「와인 마개」「대형 타월」처럼 붙어 읽는 말) · 9 소제목 바로 뒤 · 25 괄호 안 */
  // 조사·어미로 끝난 어절(「VIP는」「디자인을」「확인하여」). 「보도」「회의」처럼 같은 글자로 끝나는 두 글자 낱말은 빼려고 세 글자 이상만
  function josa(w) { return /[가-힣][은는을를]$/.test(w) || (/^[가-힣·]{3,}$/.test(w) && /[이가에의로도만과와서며고면데게께야요다]$/.test(w)); }
  function wordBefore(chars, i) { var w = ''; for (var k = i - 1; k >= 0 && chars[k].ch !== ' '; k--) w = chars[k].ch + w; return w; }
  function wordAfter(chars, i) { var w = ''; for (var k = i + 1; k < chars.length && chars[k].ch !== ' '; k++) w += chars[k].ch; return w; }
  function breaksOf(chars) {
    var out = [], firstBody = -1;
    chars.forEach(function (c, i) { if (firstBody < 0 && c.s !== 'pre' && c.s !== 'lab' && c.ch !== ' ') firstBody = i; });
    chars.forEach(function (c, i) {
      if (c.s === 'pre' || i === 0 || i === chars.length - 1) return;
      var prev = chars[i - 1].ch, next = chars[i + 1].ch;
      if (c.ch === ' ') {
        if (chars[i - 1].s === 'pre' || chars[i + 1].ch === ' ') return;
        var before = wordBefore(chars, i), after = wordAfter(chars, i), cost = 4;   // 어절 사이
        if (/[,;]/.test(prev)) cost = 0;                                           // 쉼표 뒤
        else if (prev === ':') cost = 1;                                           // 「국내 VIP:」처럼 쌍점 뒤
        else if (/[→⇒/~∼]/.test(prev) || /[→⇒/]/.test(next)) cost = 1;            // 화살표 · 빗금 앞뒤
        else if (josa(before) || /[)\]]$/.test(before)) cost = 2;            // 조사·어미 또는 괄호로 끝난 어절 뒤
        else if (next === '(' || next === '[') cost = 3;
        else if (/^[가-힣]{1,2}$/.test(before) && /^[가-힣A-Za-z]/.test(after)) cost = 6;  // 짧은 꾸밈말 뒤
        if (c.inPar && chars[i + 1].inPar) cost = 25;                              // 괄호 안
        if (firstBody >= 0 && i < firstBody) cost = 9;                             // 소제목 바로 뒤
        out.push({ i: i, sp: true, cost: cost });
      } else if (/[→⇒]/.test(c.ch) && next !== ' ' && prev !== ' ') {
        out.push({ i: i + 1, sp: false, cost: c.inPar ? 25 : 2 });                 // 「초고→피드백」처럼 붙은 화살표 뒤
      } else if (c.ch === '(' && prev !== ' ' && !chars[i - 1].inPar && i > firstBody) {
        // 「일정표(초고→…) 제출」처럼 붙은 괄호 앞. 괄호 뒤가 바로 이어지거나(「담요(기본형)·칫솔」) 짧은 괄호(「일부(3명)」)는 앞말과 떼지 않음
        var close = i; while (close < chars.length && chars[close].ch !== ')') close++;
        var tail = chars[close + 1], inner = close - i - 1;
        if (close < chars.length && (!tail || tail.ch === ' ' || tail.ch === ',') && inner > 4) out.push({ i: i, sp: false, cost: 3.5 });
      }
    });
    return out;
  }
  /** 자간 sp에서 가장 좋은 나눔: 줄 수 최소 → 나눔 값 최소. 못 넣으면 null */
  function bestBreaks(chars, F, sp, W) {
    var n = chars.length, cum = [0];
    for (var i = 0; i < n; i++) cum.push(cum[i] + charW(chars[i], F, sp));
    var cands = breaksOf(chars);
    // 마디: 시작(0) · 나눔 자리들 · 끝
    var nodes = [{ start: 0, end: 0, cost: 0 }].concat(cands.map(function (b) { return { end: b.i, start: b.sp ? b.i + 1 : b.i, cost: b.cost, br: b }; }));
    var W1 = W * SAFE, W2 = (W - F.hang) * SAFE;
    var best = nodes.map(function () { return null; });
    best[0] = { score: 0, lines: 0, prev: -1 };
    function lineW(a, b) { return cum[b] - cum[a]; }
    var endBest = null;
    for (var j = 0; j <= nodes.length; j++) {
      var isEnd = j === nodes.length, nd = isEnd ? { end: n } : nodes[j];
      if (!isEnd && j === 0) continue;
      for (var k = 0; k < (isEnd ? nodes.length : j); k++) {
        if (!best[k]) continue;
        var from = nodes[k].start, w = lineW(from, nd.end), avail = k === 0 ? W1 : W2;
        if (w > avail) continue;
        // 나눔 값 + 앞줄을 덜 채운 만큼 조금 감점(값이 같으면 앞줄을 꽉 채우는 쪽)
        var score = best[k].score + 1000 + (isEnd ? 0 : nd.cost + (avail - w) / avail * 2);
        if (isEnd && k > 0 && w < W2 * 0.28) score += 5;          // 끝줄이 너무 짧으면 감점
        var cur = { score: score, lines: best[k].lines + 1, prev: k };
        if (isEnd) { if (!endBest || score < endBest.score) endBest = cur; }
        else if (!best[j] || score < best[j].score) best[j] = cur;
      }
    }
    if (!endBest) return null;
    var cuts = [], k2 = endBest.prev;
    while (k2 > 0) { cuts.unshift(nodes[k2].br); k2 = best[k2].prev; }
    return { score: endBest.score, lines: endBest.lines, cuts: cuts, sp: sp };
  }
  /** 문단 하나 → { xml, lines, h } */
  function fitPara(segs, F) {
    var chars = flatten(segs), W = F === FAM.box ? BOX_TEXT : TEXT_W, pick = null;
    STEPS.forEach(function (sp) {
      var r = bestBreaks(chars, F, sp, W);
      if (!r) return;
      r.score += Math.abs(sp) * 0.3;                                // 같은 줄 수면 느슨한 자간을 조금 더 좋게
      if (!pick || r.score < pick.score) pick = r;
    });
    if (!pick) {                                                    // 끊을 데 없이 긴 낱말(주소 등): 한글이 알아서 넘기게 둠
      var tot = 0; chars.forEach(function (c) { tot += charW(c, F, -8); });
      pick = { sp: -8, cuts: [], lines: Math.max(1, Math.ceil(tot / (W * SAFE))) };
    }
    // 줄 나눔 자리 표시: 빈칸은 나눔으로 바꾸고, 붙은 화살표 뒤에는 나눔을 끼움
    var cutAt = {}, cutRep = {};
    pick.cuts.forEach(function (b) { if (b.sp) cutRep[b.i] = 1; else cutAt[b.i] = 1; });
    var runs = [], curId = null, buf = [];
    function flush() { if (curId != null && buf.length) runs.push('<hp:run charPrIDRef="' + curId + '"><hp:t>' + buf.join('') + '</hp:t></hp:run>'); buf = []; }
    chars.forEach(function (c, i) {
      var id = charId(c, F, pick.sp);
      if (id !== curId) { flush(); curId = id; }
      if (cutAt[i]) buf.push('<hp:lineBreak/>');
      buf.push(cutRep[i] ? '<hp:lineBreak/>' : esc(c.ch));
    });
    flush();
    var pp = pick.cuts.length ? F.pl : F.p;
    return { xml: p(pp, runs), lines: pick.lines, h: pick.lines * F.lh };
  }

  /* ---------- 항목 ---------- */
  /** 상세 박스: 칸 안의 1칸짜리 표(바깥 실선 · 칸 점선, 맑은 고딕). 「*」로 시작하는 줄은 굵은 박스 제목 */
  function boxTable(text) {
    var lines = String(text || '').split('\n').map(tidy).filter(Boolean);
    if (!lines.length) return null;
    var paras = [], hh = 0;
    lines.forEach(function (t) {
      var segs = /^[*※]/.test(t) ? [{ s: 'tit', t: t }] : [{ s: 'pre', t: ' - ' }, { s: 'txt', t: t.replace(/^[-–·]\s*/, '') }];
      var r = fitPara(segs, FAM.box); paras.push(r.xml); hh += r.h;
    });
    var h = hh + 282 + 120;
    var tbl = '<hp:tbl id="' + (tid++) + '" zOrder="3" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="1" colCnt="1" cellSpacing="0" borderFillIDRef="' + S.B_BOXTBL + '" noAdjust="0">' +
      '<hp:sz width="' + BOX_W + '" widthRelTo="ABSOLUTE" height="' + h + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="' + BOX_M + '" right="' + BOX_M + '" top="141" bottom="141"/>' +
      '<hp:tr><hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="' + S.B_BOXCELL + '">' +
      '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' + paras.join('') + '</hp:subList>' +
      '<hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="' + BOX_W + '" height="' + h + '"/><hp:cellMargin left="' + BOX_M + '" right="' + BOX_M + '" top="141" bottom="141"/></hp:tc></hp:tr></hp:tbl>';
    return { xml: p(S.P_BOXHOST, ['<hp:run charPrIDRef="' + S.C_GAP + '">' + tbl + '<hp:t/></hp:run>']), h: h + 200 };
  }
  /** 본문 줄(ㅇ 요지 · - 세부)의 글을 괄호 조각으로 */
  function bodySegs(text) { return parenSplit(tidy(text)); }
  /** 항목 하나(ㅇ 요지 + 이어지는 줄 + 세부 + 박스) → { xml, h(HWPUNIT) } */
  function blockXml(b, opt) {
    var out = [], h = 0, cl = String(b.c || '').split('\n');
    function put(r) { out.push(r.xml); h += r.h; }
    var segs = [{ s: 'pre', t: ' ㅇ ' }];
    var first = bodySegs(cl[0] || '');
    if (tidy(b.t)) segs.push({ s: 'lab', t: '(' + tidy(b.t) + ')' });
    if (tidy(b.t) && first.length) segs.push({ s: 'txt', t: ' ' });
    segs = segs.concat(first);
    if (opt.showOrg && b.org) segs.push({ s: 'org', t: ' [' + b.org + ']' });
    put(fitPara(segs, FAM.item));
    cl.slice(1).forEach(function (l) { if (tidy(l)) put(fitPara([{ s: 'pre', t: '    ' }].concat(bodySegs(l)), FAM.item)); });
    String(b.d || '').split('\n').forEach(function (l) {
      var t = tidy(l);
      if (!t) return;
      var k = lineKind(l);
      if (k === 'note') {
        var mark = t.charAt(0);
        put(fitPara([{ s: 'pre', t: '     ' + mark + ' ' }, { s: 'txt', t: tidy(t.slice(1)) }], FAM.note));
      } else if (k === 'item') put(fitPara([{ s: 'pre', t: '   - ' }].concat(bodySegs(t.replace(/^[-–]\s*/, ''))), FAM.sub));
      else put(fitPara([{ s: 'pre', t: '     ' }].concat(bodySegs(t)), FAM.sub));
    });
    var bx = boxTable(b.box);
    if (bx) put(bx);
    return { xml: out.join(''), h: h };
  }
  /** 분야 안 항목을 소제목별로 묶어 행으로(실적·계획 짝 맞춤). 소제목 없는 항목은 순서대로 짝지음 */
  function rowsOf(pv, nx) {
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
  function cell(col, row, bf, body, height, o) {
    o = o || {};
    return '<hp:tc name="" header="' + (o.header ? 1 : 0) + '" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="' + bf + '">' +
      '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="' + (o.header ? 'CENTER' : 'TOP') + '" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' + body + '</hp:subList>' +
      '<hp:cellAddr colAddr="' + col + '" rowAddr="' + row + '"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="' + COL_W + '" height="' + height + '"/>' +
      '<hp:cellMargin left="' + CELL_M + '" right="' + CELL_M + '" top="' + (o.top != null ? o.top : 141) + '" bottom="' + (o.bottom != null ? o.bottom : 141) + '"/></hp:tc>';
  }
  /* 쪽 높이 어림: 용지 84188 − 위·아래 여백(4251+머리말 2834)×2 = 본문 70018
   * 1쪽은 제목 상자·날짜 줄이 약 7800을 쓰고, 표 머리 두 행이 약 3800. 어림이 빗나가도 넘치지 않게 92%만 채움 */
  var PAGE_H = 70018, FIRST_USED = 7800, HEAD_H = 3800, FILL = 0.92;
  function tableXml(rowsXml, total, n) {
    return '<hp:tbl id="' + (tid++) + '" zOrder="1" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="' + n + '" colCnt="2" cellSpacing="0" borderFillIDRef="' + S.B_CELL + '" noAdjust="0">' +
      '<hp:sz width="' + TBL_W + '" widthRelTo="ABSOLUTE" height="' + total + '" heightRelTo="ABSOLUTE" protect="0"/>' +
      '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="' + CELL_M + '" right="' + CELL_M + '" top="141" bottom="141"/>' +
      rowsXml + '</hp:tbl>';
  }
  /**
   * 본문: 2단 표를 쪽마다 하나씩(글자처럼 취급) 나눠 넣는다. 표마다 머리행(지난 실적·향후 계획·기간)을 다시 달고,
   * 둘째 표부터는 쪽 나눔 문단으로 시작한다. 분야가 쪽을 넘어가면 다음 표 첫 행에 「□ 분야」를 다시 적는다.
   * 반환값은 템플릿의 __BODY__ 자리(문단 안 글자 run 속)에 그대로 들어간다.
   */
  function bodyXml(doc) {
    var opt = { showOrg: !!doc.showOrg }, items = [];
    var NONE = function () { return fitPara([{ s: 'pre', t: ' ㅇ ' }, { s: 'txt', t: '해당 사항 없음' }], FAM.item); };
    doc.cats.forEach(function (c, i) {
      var pv = visible(c.prev), nx = visible(c.next);
      if (!pv.length && !nx.length) return;
      var groups = rowsOf(pv, nx);
      groups.forEach(function (g, k) {
        function side(list, all) {
          var parts = [], h = 0;
          if (!all.length) { if (k === 0) { var r = NONE(); parts.push(r.xml); h += r.h; } }
          else list.forEach(function (b, j) {
            if (j) { parts.push(gap(S.C_GAP)); h += H_GAP; }               // 항목 사이 띄움(회의록 5pt 빈 줄)
            var x = blockXml(b, opt); parts.push(x.xml); h += x.h;
          });
          return { xml: parts.join(''), h: h };
        }
        items.push({ cat: i, first: k === 0, last: k === groups.length - 1, a: side(g.prev, pv), b: side(g.next, nx) });
      });
    });
    // □ 분야 제목 + 제목 뒤 띄움(회의록 3pt 빈 줄)
    var head = function (i) { return { xml: p(S.P_HEAD, [run(S.C_HSYM, '□ '), run(S.C_HEAD, CATS[i])]) + gap(S.C_GAP2), h: LH_HEAD + H_GAP2 }; };
    var EMPTY = p(S.P_PLAIN, [run(S.C_ITEM0, null)]);
    // 쪽마다 묶기
    var pages = [], cur = [], used = 0, cap = (PAGE_H - FIRST_USED - HEAD_H) * FILL;
    function rowH(it, withHead) {
      var top = it.first || withHead ? 340 : 60, bottom = it.last ? 340 : 60;
      var hh = it.first || withHead ? LH_HEAD + H_GAP2 : 0;
      return Math.round((Math.max(it.a.h, it.b.h) + hh) * 1.03 + top + bottom);
    }
    items.forEach(function (it) {
      var h = rowH(it, !cur.length && !it.first);
      if (cur.length && used + h > cap) { pages.push(cur); cur = []; used = 0; cap = (PAGE_H - HEAD_H) * FILL; h = rowH(it, !it.first); }
      cur.push(it); used += h;
    });
    if (cur.length || !pages.length) pages.push(cur);
    // 표 만들기
    return pages.map(function (rows, pi) {
      var r = 0, total = 0, out = [];
      function add(a, b, bf, hgt, o) { out.push('<hp:tr>' + cell(0, r, bf, a, hgt, o) + cell(1, r, bf, b, hgt, o) + '</hp:tr>'); total += hgt; r++; }
      add(p(S.P_TH, [run(S.C_TH, doc.headPrev || '지난 실적')]), p(S.P_TH, [run(S.C_TH, doc.headNext || '향후 계획')]), S.B_TH, 1700, { header: true });
      add(p(S.P_TH, [run(S.C_PERIOD, doc.periodPrev || '')]), p(S.P_TH, [run(S.C_PERIOD, doc.periodNext || '')]), S.B_PERIOD, 1300, { header: true });
      if (!rows.length) add(NONE().xml, NONE().xml, S.B_CELL, 2400, { top: 340, bottom: 340 });
      rows.forEach(function (it, j) {
        var startsRun = it.first || j === 0;                                  // 이 표 안에서 분야가 시작되는 행
        var endsRun = it.last || j === rows.length - 1 || rows[j + 1].cat !== it.cat;
        var showHead = it.first || j === 0;
        var ha = showHead ? head(it.cat).xml : '', hb = showHead ? head(it.cat).xml : '';   // 칸마다 따로 만들어 문단 id가 겹치지 않게
        // 같은 분야가 이어지는 행: 앞 행과의 사이를 항목 사이만큼 띄움
        var a = ha + (it.a.xml ? (showHead ? '' : gap(S.C_GAP)) + it.a.xml : ''), b = hb + (it.b.xml ? (showHead ? '' : gap(S.C_GAP)) + it.b.xml : '');
        var bf = startsRun && endsRun ? S.B_CELL : startsRun ? S.B_CTOP : endsRun ? S.B_CBOT : S.B_CMID;
        var top = startsRun ? 340 : 60, bottom = endsRun ? 340 : 60;
        add(a || EMPTY, b || EMPTY, bf, rowH(it, showHead && !it.first), { top: top, bottom: bottom });
      });
      var tbl = tableXml(out.join(''), total, r);
      // 둘째 표부터: 앞 문단을 닫고 쪽 나눔 문단을 새로 연다(템플릿의 마지막 닫는 태그가 맨 끝 문단을 닫음)
      return pi === 0 ? tbl : '<hp:t/></hp:run></hp:p><hp:p id="' + (pid++) + '" paraPrIDRef="' + S.P_PLAIN + '" styleIDRef="0" pageBreak="1" columnBreak="0" merged="0"><hp:run charPrIDRef="' + S.C_ITEM0 + '">' + tbl;
    }).join('');
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
    sec = sec.split('__TITLE__').join(esc(doc.title)).split('__DATELINE__').join(esc(dateLine)).split('__BODY__').join(bodyXml(doc));
    zip.file('Contents/section0.xml', sec);
    var hpf = await zip.file('Contents/content.hpf').async('string');
    hpf = hpf.replace('__DOCTITLE__', esc(doc.title)).replace('__MODIFIED__', new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
    zip.file('Contents/content.hpf', hpf);
    zip.file('Preview/PrvText.txt', plainText(doc));
    var mt = await zip.file('mimetype').async('uint8array');
    zip.file('mimetype', mt, { compression: 'STORE' });
    return zip.generateAsync({ type: type || 'blob', compression: 'DEFLATE', mimeType: 'application/hwp+zip' });
  }

  var api = { generate: generate, rowsOf: rowsOf, _fit: { fitPara: fitPara, FAM: FAM, bodySegs: bodySegs, em: em, TEXT_W: TEXT_W, BOX_TEXT: BOX_TEXT } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HWPX = api;
})(typeof window !== 'undefined' ? window : globalThis);

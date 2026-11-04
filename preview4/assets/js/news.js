/* ============================================================
   2026 K예술영재 프로젝트 — news.js
   소식 페이지: 공지 목록 · 상세(#notice/글ID) · 언론홍보 · 갤러리를 data/posts.json으로 채운다.
   ▣ 글 모양은 board.js(관리자 미리보기와 같은 함수)가 만든다. 운영진이 입력한 값은 textContent로만 넣는다.
   ▣ 걸러 보기 (WBS 12.2, decisions.md 「6차 피드백 · 시안 1 확정」) — 목록 위 단추 묶음.
       연도(세 게시판): 전체 + 그 게시판 글 날짜 앞 네 자리(최신이 앞), 처음엔 전체.
       과정 · 분야(갤러리만): 아래 표의 단추가 늘 보인다. 세 묶음은 함께 걸러지고, 분야를 고르면 field가 빈 앨범(공통 · 지정 안 함)은 빠진다.
       고르면 1쪽부터. 공지 글 보기에서는 단추를 숨기고, 목록으로 돌아오면 고른 값이 그대로다.
   ============================================================ */
(function(){
  var NOTICE_PER = 10, PRESS_PER = 10, GALLERY_PER = 8;   // 한 쪽에 보일 개수 (docs/decisions.md 4절)
  var nBox = document.querySelector('[data-board="notice"]'),
      pBox = document.querySelector('[data-board="press"]'),
      gBox = document.querySelector('[data-board="gallery"]');
  if(!nBox || !pBox || !gBox || !window.Board) return;

  var data = null, nPage = 1, pPage = 1, gPage = 1, view = '', baseTitle = document.title,
      fromList = false, listY = null;   // 목록에서 글을 열었으면 「목록」이 뒤로 가기로 돌아가 보던 자리를 찾는다

  // 갤러리 과정 · 분야 코드 → 단추 · 이름표 글자 (docs/sheet-schema.md 「갤러리 과정 · 분야」). 목록에 없는 코드는 없는 것으로 본다
  var COURSE = [['workshop', '워크숍'], ['mentoring', '심화 멘토링'], ['camp', '겨울캠프']],
      FIELD = [['music', '음악'], ['dance', '무용'], ['trad', '전통예술'], ['art', '미술']];
  // 고른 값 — 묶음마다 여러 개(7차 피드백), 빈 목록은 전체
  var pick = { notice:{ year:[] }, press:{ year:[] }, gallery:{ year:[], course:[], field:[] } }, nPick = null;

  function el(tag, cls, text){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }
  function msg(box, text){ box.textContent = ''; box.appendChild(el('p', 'bd-msg', text)); }
  function name(list, code){
    for(var i = 0; i < list.length; i++) if(list[i][0] === code) return list[i][1];
    return '';
  }
  function year(p){ var y = String(p.date || '').slice(0, 4); return /^\d{4}$/.test(y) ? y : ''; }

  // 탭 바로 아래로 올린다 (이미 그보다 위면 그대로)
  function toTop(){
    var crumb = document.getElementById('crumb'), hd = document.getElementById('header');
    var y = crumb.getBoundingClientRect().bottom + window.scrollY - hd.offsetHeight;
    if(window.scrollY > y) window.scrollTo({ top:y, behavior:'instant' });
  }

  // 쪽 번호 — 열 쪽씩 묶어 보이고 ‹ › 는 앞뒤 쪽. 한 쪽뿐이면 그리지 않는다.
  function paging(pages, page, go){
    if(pages < 2) return null;
    var box = el('nav', 'paging'), from = Math.floor((page - 1) / 10) * 10 + 1, to = Math.min(from + 9, pages);
    box.setAttribute('aria-label', '쪽 번호');
    function add(text, p, label){
      var b = el('button', p === page && text === String(p) ? 'on' : null, text);
      b.type = 'button';
      b.setAttribute('aria-label', label || p + '쪽');
      if(b.className === 'on') b.setAttribute('aria-current', 'page');
      else b.addEventListener('click', function(){ go(p); });
      box.appendChild(b);
    }
    if(page > 1) add('‹', page - 1, '이전 쪽');
    for(var p = from; p <= to; p++) add(String(p), p);
    if(page < pages) add('›', page + 1, '다음 쪽');
    return box;
  }

  /* ---------- 걸러 보기 단추 ----------
     groups: [[키, 묶음 이름, [[값, 단추 글자] …]] …] — 첫 단추는 늘 「전체」(''). 목록 칸 바로 앞에 놓는다.
     한 묶음에서 여러 개를 고를 수 있다(7차 피드백): 누르면 켜고, 켜진 것을 다시 누르면 끈다. 하나도 안 켜지면 「전체」.
     「전체」를 누르면 그 묶음의 고른 것을 모두 끈다. 바뀔 때마다 state[키](고른 값 목록)를 고치고 onPick() */
  function picker(box, groups, state, onPick){
    var wrap = el('div', 'pick'), row = el('div', 'pick-in');
    groups.forEach(function(g){
      var grp = el('div', 'pick-g'), btns = el('div', 'pick-b');
      grp.setAttribute('role', 'group'); grp.setAttribute('aria-label', g[1]);
      var n = el('span', 'pick-n', g[1]); n.setAttribute('aria-hidden', 'true');
      grp.appendChild(n);
      var cur = state[g[0]], opts = [['', '전체']].concat(g[2]);
      function mark(){
        [].forEach.call(btns.children, function(x, k){
          x.setAttribute('aria-pressed', String(k ? cur.indexOf(opts[k][0]) >= 0 : !cur.length));
        });
      }
      opts.forEach(function(o){
        var b = el('button', null, o[1]);
        b.type = 'button';
        b.addEventListener('click', function(){
          var i = cur.indexOf(o[0]);
          if(!o[0]){ if(!cur.length) return; cur.length = 0; }
          else if(i >= 0) cur.splice(i, 1);
          else cur.push(o[0]);
          mark();
          onPick();
        });
        btns.appendChild(b);
      });
      mark();
      grp.appendChild(btns);
      row.appendChild(grp);
    });
    wrap.appendChild(row);
    box.parentNode.insertBefore(wrap, box);
    return wrap;
  }
  function years(list){
    var seen = {}, out = [];
    list.forEach(function(p){ var y = year(p); if(y && !seen[y]){ seen[y] = 1; out.push(y); } });
    return out.sort().reverse().map(function(y){ return [y, y]; });
  }
  // 고른 것이 없으면 모두, 있으면 그중 하나에 맞는 것
  function hit(sel, v){ return !sel.length || sel.indexOf(v) >= 0; }
  function byYear(list, ys){ return list.filter(function(p){ return hit(ys, year(p)); }); }

  /* ---------- 공지 ---------- */
  function noticeList(){
    var list = byYear(data.notices, pick.notice.year);
    view = 'list'; fromList = false;
    document.title = baseTitle;
    if(nPick) nPick.hidden = false;
    if(!list.length) return msg(nBox, data.notices.length ? '해당하는 글이 없습니다.' : Board.MSG.empty);
    var pages = Math.ceil(list.length / NOTICE_PER);
    nPage = Math.min(Math.max(1, nPage), pages);
    nBox.textContent = '';
    var ul = el('ul', 'bbs');
    list.slice((nPage - 1) * NOTICE_PER, nPage * NOTICE_PER).forEach(function(n){
      ul.appendChild(Board.noticeItem(n, '#notice/' + encodeURIComponent(n.id), true));
    });
    nBox.appendChild(ul);
    var pg = paging(pages, nPage, function(p){ nPage = p; noticeList(); toTop(); });
    if(pg) nBox.appendChild(pg);
    if(listY !== null){ window.scrollTo({ top:listY, behavior:'instant' }); listY = null; }
  }

  function noticeDetail(id){
    var post = data.notices.filter(function(n){ return n.id === id; })[0];
    view = 'detail';
    if(nPick) nPick.hidden = true;
    nBox.textContent = '';
    if(post){
      nBox.appendChild(Board.renderNotice(post, { onPhoto:function(i){ Board.viewer(post.photos, i, post.title); } }));
      document.title = post.title + ' | ' + baseTitle;
    }else{
      nBox.appendChild(el('p', 'bd-msg', '글을 찾을 수 없습니다. 삭제되었거나 비공개로 바뀐 글입니다.'));
      document.title = baseTitle;
    }
    var foot = el('div', 'post-foot'), back = el('button', 'btn ghost', '목록');
    back.type = 'button';
    back.addEventListener('click', function(){
      if(fromList) history.back();
      else location.hash = '#notice';
    });
    foot.appendChild(back);
    nBox.appendChild(foot);
    toTop();
  }

  function hashId(){
    var m = location.hash.match(/^#notice\/(.+)$/);
    if(!m) return null;
    try{ return decodeURIComponent(m[1]); }catch(e){ return m[1]; }
  }
  // 주소가 바뀔 때: #notice/글ID → 상세, #notice(또는 해시 없음) → 목록. 다른 탭 해시는 공지 칸을 그대로 둔다.
  function route(){
    var id = hashId();
    if(id !== null) return noticeDetail(id);
    if(view === 'detail' && /^#?(notice)?$/.test(location.hash)){
      if(!fromList) listY = null;
      noticeList();
    }
  }

  nBox.addEventListener('click', function(e){
    if(view === 'list' && e.target.closest('a[href^="#notice/"]')){ fromList = true; listY = window.scrollY; }
  });
  // 상세를 보다가 「공지사항」 탭을 다시 누르면 목록으로 (탭 코드는 주소만 바꾸고 hashchange를 내지 않음)
  var tab = document.querySelector('#tabs [data-tab="notice"]');
  if(tab) tab.addEventListener('click', function(){ if(data && view === 'detail'){ listY = null; noticeList(); } });

  /* ---------- 언론홍보 ---------- 누르면 기사 주소가 새 탭으로 열린다 (사이트 안 상세 화면 없음) */
  function press(){
    var list = byYear(data.press, pick.press.year);
    if(!list.length) return msg(pBox, data.press.length ? '해당하는 글이 없습니다.' : Board.MSG.empty);
    var pages = Math.ceil(list.length / PRESS_PER);
    pPage = Math.min(Math.max(1, pPage), pages);
    pBox.textContent = '';
    var ul = el('ul', 'bbs');
    list.slice((pPage - 1) * PRESS_PER, pPage * PRESS_PER).forEach(function(p){ ul.appendChild(Board.pressItem(p)); });
    pBox.appendChild(ul);
    var pg = paging(pages, pPage, function(p){ pPage = p; press(); toTop(); });
    if(pg) pBox.appendChild(pg);
  }

  /* ---------- 갤러리 ---------- */
  // 사진 오른쪽 아래 이름표 — 과정 · 분야 둘 다면 「워크숍 · 음악」, 하나만 있으면 그것만, 둘 다 없으면 이름표 없음
  function tagText(g){
    return [name(COURSE, g.course), name(FIELD, g.field)].filter(Boolean).join(' · ');
  }
  function gallery(){
    var f = pick.gallery, list = byYear(data.gallery, f.year).filter(function(g){
      return hit(f.course, g.course) && hit(f.field, g.field);   // 분야가 빈(공통) 앨범은 분야 「전체」일 때만
    });
    if(!list.length) return msg(gBox, data.gallery.length ? '해당하는 사진이 없습니다.' : Board.MSG.empty);
    var pages = Math.ceil(list.length / GALLERY_PER);
    gPage = Math.min(Math.max(1, gPage), pages);
    gBox.textContent = '';
    var grid = el('div', 'gal');
    list.slice((gPage - 1) * GALLERY_PER, gPage * GALLERY_PER).forEach(function(g, k){
      var fig = el('figure'), th, tag = tagText(g);
      fig.setAttribute('data-rv', ''); fig.setAttribute('data-d', String(k % 4));
      if(g.photos.length){   // 첫 사진이 대표. 누르면 앨범 전체를 확대 보기로
        th = el('button', 'th'); th.type = 'button';
        th.setAttribute('aria-label', (g.title || '') + (tag ? ' (' + tag + ')' : '') + ' — 사진 ' + g.photos.length + '장 보기');
        var img = el('img'); img.src = Board.photoUrl(g.photos[0].fileId, 640); img.alt = ''; img.loading = 'lazy';
        th.appendChild(img);
        th.addEventListener('click', function(){ Board.viewer(g.photos, 0, g.title); });
      }else{   // 사진이 없으면 기본 그라디언트 칸. 마우스 반응은 같고 눌러도 아무 일도 없다
        th = el('div', 'th'); th.appendChild(el('i', 'ph')); fig.className = 'empty';
      }
      fig.appendChild(th);
      if(tag) fig.appendChild(el('span', 'gal-tag', tag));   // 사진 칸과 같은 자리(오른쪽 아래)에 겹쳐 놓는다 — 사진이 커져도 제자리
      fig.appendChild(el('figcaption', null, g.title || ''));
      if(g.desc) fig.appendChild(el('p', 'm', g.desc));
      grid.appendChild(fig);
    });
    gBox.appendChild(grid);
    var pg = paging(pages, gPage, function(p){ gPage = p; gallery(); toTop(); });
    if(pg) gBox.appendChild(pg);
    if(window.__rvObserve) window.__rvObserve(gBox);
  }

  /* ---------- 시작 ---------- 글이 하나도 없는 게시판은 단추 없이 안내만 */
  Board.load().then(function(d){
    if(!d){ msg(nBox, Board.MSG.fail); msg(pBox, Board.MSG.fail); msg(gBox, Board.MSG.fail); return; }
    data = d;
    if(d.notices.length) nPick = picker(nBox, [['year', '연도', years(d.notices)]], pick.notice, function(){ nPage = 1; noticeList(); });
    if(d.press.length) picker(pBox, [['year', '연도', years(d.press)]], pick.press, function(){ pPage = 1; press(); });
    if(d.gallery.length) picker(gBox, [['year', '연도', years(d.gallery)], ['course', '과정', COURSE], ['field', '분야', FIELD]], pick.gallery, function(){ gPage = 1; gallery(); });
    var id = hashId();
    if(id !== null) noticeDetail(id); else noticeList();
    press();
    gallery();
    window.addEventListener('hashchange', route);
  });
})();

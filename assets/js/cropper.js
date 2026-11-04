/* ============================================================
   2026 K예술영재 프로젝트 — cropper.js
   사진 줄이기 · 자르기 창. 관리자 페이지(admin.js)와 페이지 직접 편집(editor.js)이 함께 쓴다 (WBS 17.2 · 18).
     Cropper.shrink(file, maxSide)  → Promise { blob, w, h, preview }   긴 변을 줄인 JPEG
     Cropper.crop(src, opts)        → Promise { blob, w, h, preview } · 'skip'([그대로 쓰기]) · null(취소)
        opts: ratio(처음 비율, 0이면 원본) · maxSide · skip(그대로 쓰기 단추) · remote(드라이브 사진) · onError(알림 함수)
   모양은 .mg-modal · .mg-crop · .mg-btn (admin.css, 편집 화면은 editor.css에 같은 규칙).
   ============================================================ */
window.Cropper = (function(){
  function h(tag, attrs, kids){
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(k){
      var v = attrs[k];
      if(v == null || v === false) return;
      if(k === 'class') e.className = v;
      else if(k === 'text') e.textContent = v;
      else if(k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids == null ? [] : kids).forEach(function(c){
      if(c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function err(opts, msg){ if(opts && opts.onError) opts.onError(msg); else window.alert(msg); }

  // 긴 변을 maxSide로 줄이고 JPEG로 바꾼다. 투명한 부분은 흰색으로 채운다.
  function shrinkPhoto(file, maxSide){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        var scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * scale)), hgt = Math.max(1, Math.round(img.naturalHeight * scale));
        var c = document.createElement('canvas'); c.width = w; c.height = hgt;
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, hgt); g.drawImage(img, 0, 0, w, hgt);
        c.toBlob(function(blob){ blob ? resolve({ blob:blob, w:w, h:hgt, preview:url }) : reject(new Error('toBlob')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function(){ reject(new Error('decode')); };
      img.src = url;
    });
  }

  /* ---------- 사진 자르기 (확대 · 축소 · 위치) ----------
     틀(고른 비율) 안에서 사진을 끌어 옮기고, 아래 막대 · 마우스 휠 · 두 손가락으로 확대 · 축소한다. [적용]을 누르면 틀 안쪽만
     잘라 긴 변 maxSide 이하 JPEG로 만든다. 결과: { blob, w, h, preview } · 'skip'([그대로 쓰기]) · null(취소).
     opts.remote: 드라이브 사진(다른 주소)이라 crossOrigin으로 불러 본다 — 막히면 reject */
  var CROP_RATIOS = [['16:9', 16/9], ['3:2', 3/2], ['4:3', 4/3], ['1:1', 1], ['3:4', 3/4], ['원본', 0]];
  function cropPhoto(src, opts){
    return new Promise(function(resolve, reject){
      var img = new Image();
      if(opts.remote) img.crossOrigin = 'anonymous';
      img.onerror = function(){ reject(new Error('load')); };
      img.onload = function(){ openCrop(img, opts, resolve); };
      img.src = src;
    });
  }
  function openCrop(img, opts, done){
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var st = { ratio:opts.ratio || iw / ih, zoom:1, x:0, y:0, fw:0, fh:0, base:1 };
    var frame = h('div', { class:'fr' }), pic = h('img', { src:img.src, alt:'', draggable:'false' });
    frame.appendChild(pic);
    var zoomIn = h('input', { type:'range', min:'1', max:'4', step:'0.01', value:'1', 'aria-label':'확대' });
    var info = h('span', { class:'hint' });
    var ratioBtns = h('div', { class:'ratios' });
    var choices = [];
    if(opts.ratio && !CROP_RATIOS.some(function(r){ return Math.abs(r[1] - opts.ratio) < 0.01; })) choices.push(['이 자리', opts.ratio]);
    choices = choices.concat(CROP_RATIOS);
    choices.forEach(function(c){
      var b = h('button', { type:'button', class:'mg-btn sm', text:c[0], onclick:function(){ setRatio(c[1] || iw / ih); mark(b); } });
      ratioBtns.appendChild(b);
      if(Math.abs((c[1] || iw / ih) - st.ratio) < 0.01 && !ratioBtns.querySelector('.on')) b.classList.add('on');
    });
    function mark(b){ [].forEach.call(ratioBtns.children, function(x){ x.classList.toggle('on', x === b); }); }

    var box = h('div', { class:'mg-modal mg-crop', role:'dialog', 'aria-label':'사진 자르기' }, [h('div', { class:'in' }, [
      h('h2', { text:'사진 자르기' }),
      h('p', { class:'hint', text:'사진을 끌어 옮기고, 아래 막대 · 마우스 휠 · 두 손가락으로 확대 · 축소하세요. 노란 틀 안쪽만 남습니다.' }),
      ratioBtns, frame,
      h('div', { class:'zoom' }, [h('span', { text:'－' }), zoomIn, h('span', { text:'＋' }), info]),
      h('div', { class:'acts' }, [
        h('button', { type:'button', class:'mg-btn', text:'취소', onclick:function(){ close(null); } }),
        opts.skip ? h('button', { type:'button', class:'mg-btn', text:'자르지 않고 그대로 쓰기', onclick:function(){ close('skip'); } }) : null,
        h('button', { type:'button', class:'mg-btn pri', text:'적용', onclick:apply })
      ])
    ])]);
    document.body.appendChild(box);
    function close(v){ window.removeEventListener('resize', layout); box.parentNode.removeChild(box); done(v); }

    function layout(){
      var maxW = Math.min(760, window.innerWidth - 80), maxH = Math.max(200, window.innerHeight - 330);
      st.fw = Math.min(maxW, maxH * st.ratio); st.fh = st.fw / st.ratio;
      frame.style.width = st.fw + 'px'; frame.style.height = st.fh + 'px';
      st.base = Math.max(st.fw / iw, st.fh / ih);
      draw();
    }
    function draw(){
      var sc = st.base * st.zoom, w = iw * sc, hh = ih * sc;
      st.x = Math.min(0, Math.max(st.fw - w, st.x)); st.y = Math.min(0, Math.max(st.fh - hh, st.y));
      pic.style.width = w + 'px'; pic.style.height = hh + 'px';
      pic.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px)';
      var cw = Math.round(st.fw / sc), ch = Math.round(st.fh / sc);
      info.textContent = cw + ' × ' + ch + 'px' + (Math.max(cw, ch) < 1200 ? ' · 작아서 흐릴 수 있음' : '');
      info.classList.toggle('warn', Math.max(cw, ch) < 1200);
    }
    // 확대 · 축소는 틀 가운데(휠은 마우스 자리)를 기준으로
    function zoomTo(z, cx, cy){
      z = Math.min(4, Math.max(1, z));
      if(cx == null){ cx = st.fw / 2; cy = st.fh / 2; }
      var k = z / st.zoom;
      st.x = cx - (cx - st.x) * k; st.y = cy - (cy - st.y) * k; st.zoom = z;
      zoomIn.value = String(z); draw();
    }
    function setRatio(r){
      var sc = st.base * st.zoom, mx = (st.fw / 2 - st.x) / sc, my = (st.fh / 2 - st.y) / sc;   // 지금 가운데(사진 좌표)를 지킨다
      st.ratio = r; layout();
      sc = st.base * st.zoom; st.x = st.fw / 2 - mx * sc; st.y = st.fh / 2 - my * sc; draw();
    }
    zoomIn.addEventListener('input', function(){ zoomTo(Number(zoomIn.value)); });
    frame.addEventListener('wheel', function(ev){
      ev.preventDefault();
      var r = frame.getBoundingClientRect();
      zoomTo(st.zoom * (ev.deltaY < 0 ? 1.08 : 1 / 1.08), ev.clientX - r.left, ev.clientY - r.top);
    }, { passive:false });
    var pts = {}, last = null;
    frame.addEventListener('pointerdown', function(ev){ frame.setPointerCapture(ev.pointerId); pts[ev.pointerId] = [ev.clientX, ev.clientY]; last = null; });
    frame.addEventListener('pointermove', function(ev){
      if(!pts[ev.pointerId]) return;
      var prev = pts[ev.pointerId]; pts[ev.pointerId] = [ev.clientX, ev.clientY];
      var ids = Object.keys(pts);
      if(ids.length === 1){ st.x += ev.clientX - prev[0]; st.y += ev.clientY - prev[1]; draw(); return; }
      var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]);   // 두 손가락 — 벌리면 확대
      if(last){ var r = frame.getBoundingClientRect(); zoomTo(st.zoom * d / last, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); }
      last = d;
    });
    ['pointerup', 'pointercancel'].forEach(function(t){ frame.addEventListener(t, function(ev){ delete pts[ev.pointerId]; last = null; }); });

    function apply(){
      var sc = st.base * st.zoom;
      var sx = -st.x / sc, sy = -st.y / sc, sw = st.fw / sc, sh = st.fh / sc;
      var out = Math.min(1, opts.maxSide / Math.max(sw, sh));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(sw * out)); c.height = Math.max(1, Math.round(sh * out));
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      try{
        c.toBlob(function(blob){
          if(!blob){ err(opts, '자르지 못했습니다. 다시 해 주세요.'); return; }
          close({ blob:blob, w:c.width, h:c.height, preview:URL.createObjectURL(blob) });
        }, 'image/jpeg', 0.88);
      }catch(x){ err(opts, '이 사진은 여기서 자를 수 없습니다. 원본 파일을 다시 올리면서 잘라 주세요.'); close(null); }
    }
    layout();
  }

  return { shrink:shrinkPhoto, crop:cropPhoto, RATIOS:CROP_RATIOS };
})();

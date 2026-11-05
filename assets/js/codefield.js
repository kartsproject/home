/* ============================================================
   2026 K예술영재 프로젝트 — codefield.js
   접근코드 입력칸 (2026-11-05 사용자 요청). 관리자 페이지(admin.html) · 페이지 직접 편집(editor.js) 로그인이 함께 쓴다.
     ① 영문 · 숫자 · - · _ 만 들어간다. 한글 자판인 채로 치면 그 자리에서 영문으로 바꾸고(「ㅏㄱ」→「kr」, 두벌식 자판 위치 그대로),
        그 밖의 글자(빈칸 · 기호)는 뺀다. 대문자 · 소문자는 친 그대로 둔다 — 코드는 대소문자를 구별한다(2026-11-05 사용자)
     ② 칸 오른쪽 [보기] 단추로 입력한 코드를 보고 다시 숨긴다
   코드가 맞는지는 관문이 확인한다. 이 파일은 입력을 고쳐 보여 줄 뿐이다(CLAUDE.md 보안 1).
   아카이빙 사이트 site/js/hangul.js와 같은 바꾸기 규칙.
     CodeField.toEng(문자열)    한글 → 영문 자판 글자
     CodeField.clean(문자열)    toEng 뒤 영문 · 숫자 · - · _ 만 남김 (로그인 보낼 때)
     CodeField.enhance(input)   입력칸에 ①② 붙이기
   ============================================================ */
window.CodeField = (function(){
  var CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  var JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  var JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  var KEY = {
    'ㄱ':'r','ㄲ':'R','ㄴ':'s','ㄷ':'e','ㄸ':'E','ㄹ':'f','ㅁ':'a','ㅂ':'q','ㅃ':'Q','ㅅ':'t','ㅆ':'T','ㅇ':'d','ㅈ':'w','ㅉ':'W','ㅊ':'c','ㅋ':'z','ㅌ':'x','ㅍ':'v','ㅎ':'g',
    'ㅏ':'k','ㅐ':'o','ㅑ':'i','ㅒ':'O','ㅓ':'j','ㅔ':'p','ㅕ':'u','ㅖ':'P','ㅗ':'h','ㅛ':'y','ㅜ':'n','ㅠ':'b','ㅡ':'m','ㅣ':'l',
    'ㄳ':'rt','ㄵ':'sw','ㄶ':'sg','ㄺ':'fr','ㄻ':'fa','ㄼ':'fq','ㄽ':'ft','ㄾ':'fx','ㄿ':'fv','ㅀ':'fg','ㅄ':'qt',
    'ㅘ':'hk','ㅙ':'ho','ㅚ':'hl','ㅝ':'nj','ㅞ':'np','ㅟ':'nl','ㅢ':'ml'
  };
  function k(j){ return KEY[j] || j; }
  function toEng(str){
    var out = '';
    for(var i = 0; i < String(str).length; i++){
      var ch = String(str).charAt(i), c = ch.charCodeAt(0) - 0xAC00;
      if(c >= 0 && c <= 11171) out += k(CHO[Math.floor(c / 588)]) + k(JUNG[Math.floor((c % 588) / 28)]) + (c % 28 ? k(JONG[c % 28]) : '');
      else out += k(ch);
    }
    return out;
  }

  function clean(str){ return toEng(str).replace(/[^A-Za-z0-9_-]/g, ''); }

  function enhance(input){
    if(!input || input.getAttribute('data-cf')) return;
    input.setAttribute('data-cf', '1');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('lang', 'en');
    input.spellcheck = false;

    var wrap = document.createElement('span');
    wrap.className = 'cf-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cf-eye';
    btn.textContent = '보기';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', '입력한 접근코드 보기');
    wrap.appendChild(btn);

    function show(on){
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.textContent = on ? '숨기기' : '보기';
      btn.setAttribute('aria-label', on ? '접근코드 숨기기' : '입력한 접근코드 보기');
      input.type = on ? 'text' : 'password';   // 보이는 동안 한글 입력기가 켜질 수 있다 — 아래 fix가 영문으로 바꾼다
    }
    btn.addEventListener('mousedown', function(ev){ ev.preventDefault(); });   // 입력칸의 커서를 그대로 둔다
    btn.addEventListener('click', function(){ show(btn.getAttribute('aria-pressed') !== 'true'); input.focus(); });

    // 한글 → 영문. 한글을 조합하는 중에는 건드리지 않고, 조합이 끝나면 바꾼다
    function fix(){
      var v = input.value, n = clean(v);
      if(n === v) return;
      var p = input.selectionStart, np = n.length;
      if(p != null){ np = clean(v.slice(0, p)).length; }
      input.value = n;
      try{ input.setSelectionRange(np, np); }catch(e){}
    }
    input.addEventListener('input', function(ev){ if(!ev.isComposing) fix(); });
    input.addEventListener('compositionend', function(){ setTimeout(fix, 0); });
    input.addEventListener('blur', fix);
    return { hide:function(){ show(false); } };
  }
  return { toEng:toEng, clean:clean, enhance:enhance };
})();

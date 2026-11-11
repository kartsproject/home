#!/usr/bin/env python3
"""페이지 직접 편집(WBS 18) — HTML에 편집 열쇠를 붙인다.

  python3 docs/tools/annotate-edit.py          # 붙이고 결과를 알린다
  python3 docs/tools/annotate-edit.py --check  # 고치지 않고 붙일 곳만 알린다

붙이는 것 (assets/js/content.js · editor.js가 읽는다)
  data-e="k12"      글자 칸(페이지 안에서 하나). 운영진이 고친 글은 data/posts.json pages.<페이지>.t.k12
  data-et=""        글 안에 그림 · 작은 칸이 섞인 칸 — 글자만 바꾼다(굵게 · 형광 없음)
  data-list="l1"    항목을 더하고 빼고 옮길 수 있는 목록(LISTS). 고친 목록은 pages.<페이지>.l.l1
  data-ei="3"       목록 항목 안의 글자 칸(항목 안에서 하나)
  data-sec="s4"     구역 자리 — 편집 화면의 「여기에 구역 추가」가 이 구역 바로 뒤에 새 구역을 넣는다(pages.<페이지>.x.s4)
                    하위 페이지는 탭 칸(.panel > .inner)의 큰 묶음(.p1-lead · .p1-sec · .rc-cards · .rc-wait), 메인은 표지 밑 구역(section)

글자 칸: 낱말이 있는(한글 · 영문 · 숫자) 글을 직접 가진 요소. 안에 b · strong · br · em.mark만 있으면 서식까지 고칠 수 있다.
이미 붙은 열쇠는 그대로 두고 새 칸에만 다음 번호를 붙인다 — 사이트에 문장을 더한 뒤 다시 돌리면 된다.
열쇠를 바꾸거나 지우면 운영진이 고친 글이 그 칸에 다시 들어가지 않으니, 붙은 열쇠는 손으로 고치지 않는다.
파일은 글자 그대로 두고 여는 태그 안에 속성만 끼워 넣는다(BeautifulSoup으로 다시 쓰지 않음).
"""
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag, Comment

ROOT = Path(__file__).resolve().parents[2]
PAGES = ['index', 'about', 'recruit', 'programs', 'mentoring', 'camp', 'news']

# 항목을 더하고 뺄 수 있는 목록. 칸 수에 따라 모양이 무너지지 않는 것만(그 밖은 글자만 고친다)
LISTS = {
    'about': ['dl.ab-dl', 'ul.ab-fs', 'ol.ab-cy'],
    'recruit': ['dl.ab-dl', 'div.rc-cards', 'ol.rc-steps'],
    'programs': ['ol.wk-fw'],
    'mentoring': ['dl.ab-dl', 'div.cp-cards'],   # 2026-11-11 「진행 방식」(ol.p1-st) → 「교육내용」 아이콘 카드
    'camp': ['div.cp-cards'],   # 2026-11-11 「함께 지내는 캠프」(ul.cp-st) 뺌
}

# 구역 자리: 하위 페이지는 탭 칸의 큰 묶음, 메인은 body 바로 아래 구역(표지 빼고)
SEC_SEL = '.panel > .inner > .p1-lead, .panel > .inner > .p1-sec, .panel > .inner > .rc-cards, .panel > .inner > .rc-wait'
SEC_INDEX = ['about', 'journey', 'recruit', 'news']

# 고치지 않는 곳: 머리 · 바닥(common.js가 만든다), 운영진 글이 들어가는 칸, 단추 · 탭, 화면에 안 보이는 제목
SKIP_TAGS = {'script', 'style', 'svg', 'template', 'noscript', 'button', 'nav', 'header', 'footer', 'select', 'option'}
SKIP_CLASS = {'blind', 'pg-photos', 'nw-list', 'mn-nw-list', 'rc-guide', 'zv', 'h-tabs', 'h-logos'}
SKIP_ATTR = ['data-board']
RICH = {'b', 'strong', 'br'}
WORD = re.compile(r'[가-힣A-Za-z0-9]')


def skipped(t):
    if t.name in SKIP_TAGS:
        return True
    if set(t.get('class') or []) & SKIP_CLASS:
        return True
    return any(t.has_attr(a) for a in SKIP_ATTR) or t.get('id') in ('header', 'footer', 'allmenu')


def own_text(t):
    return [c for c in t.children if isinstance(c, NavigableString) and not isinstance(c, Comment) and WORD.search(c)]


def rich(t):
    for c in t.children:
        if isinstance(c, Tag) and not (c.name in RICH or (c.name == 'em' and 'mark' in (c.get('class') or []))):
            return False
    return True


def leaves(root):
    """root 아래 글자 칸 [(요소, 서식 가능)] — 문서 순서"""
    out = []

    def walk(t):
        for c in t.children:
            if not isinstance(c, Tag) or skipped(c):
                continue
            if own_text(c):
                r = rich(c)
                out.append((c, r))
                if r:
                    continue     # 안의 b · em.mark는 이 칸의 서식
            walk(c)
    walk(root)
    return out


def roots(soup):
    body = soup.body
    return [c for c in body.children if isinstance(c, Tag) and not skipped(c)]


def offsets(src):
    starts, n = [0], 0
    for line in src.split('\n'):
        n += len(line) + 1
        starts.append(n)
    return starts


def annotate(page, write):
    path = ROOT / (page + '.html')
    src = path.read_text(encoding='utf-8')
    soup = BeautifulSoup(src, 'html.parser')
    starts = offsets(src)
    inserts = []   # (offset, 넣을 글자)

    def add(t, attrs):
        at = starts[t.sourceline - 1] + t.sourcepos
        head = '<' + t.name
        assert src.startswith(head, at), (page, t.name, t.sourceline)
        inserts.append((at + len(head), ''.join(' %s="%s"' % kv for kv in attrs)))

    # 목록
    lists = []
    for sel in LISTS.get(page, []):
        lists.extend(soup.select(sel))
    used_l = [int(x[1:]) for x in (t.get('data-list') for t in soup.select('[data-list]')) if x and x[1:].isdigit()]
    nl = max(used_l or [0])
    in_list = set()
    for box in lists:
        if not box.has_attr('data-list'):
            nl += 1
            add(box, [('data-list', 'l%d' % nl)])
        for item in [c for c in box.children if isinstance(c, Tag)]:
            used_i = [int(t['data-ei']) for t in ([item] + item.find_all(attrs={'data-ei': True})) if t.get('data-ei', '').isdigit()]
            ni = max(used_i or [0])
            if own_text(item):
                pairs = [(item, rich(item))] + ([] if rich(item) else leaves(item))
            else:
                pairs = leaves(item)
            for t, r in pairs:
                in_list.add(id(t))
                if t.has_attr('data-ei'):
                    continue
                ni += 1
                add(t, [('data-ei', str(ni))] + ([] if r else [('data-et', '')]))
        for t in box.find_all(True):
            in_list.add(id(t))

    # 페이지 글자 칸
    used_e = [int(x[1:]) for x in (t.get('data-e') for t in soup.select('[data-e]')) if x and x[1:].isdigit()]
    ne = max(used_e or [0])
    count = 0
    for r in roots(soup):
        for t, rr in leaves(r):
            if id(t) in in_list or t.has_attr('data-e'):
                continue
            ne += 1
            count += 1
            add(t, [('data-e', 'k%d' % ne)] + ([] if rr else [('data-et', '')]))

    # 구역 자리
    secs = [soup.find(id=i) for i in SEC_INDEX] if page == 'index' else soup.select(SEC_SEL)
    secs = [t for t in secs if t is not None]
    used_s = [int(x[1:]) for x in (t.get('data-sec') for t in soup.select('[data-sec]')) if x and x[1:].isdigit()]
    ns, new_s = max(used_s or [0]), 0
    for t in secs:
        if t.has_attr('data-sec'):
            continue
        ns += 1
        new_s += 1
        add(t, [('data-sec', 's%d' % ns)])

    mixed = [t for r in roots(soup) for t, rr in leaves(r) if not rr and len(own_text(t)) > 1]
    print('%-10s 새 글자 칸 %3d · 목록 %d개 · 새 항목 칸 %3d · 새 구역 자리 %2d' % (page, count, len(lists), sum(1 for _, s in inserts if 'data-ei' in s), new_s))
    for t in mixed:
        print('   ! 글이 둘로 나뉜 칸(앞 글만 고침):', str(t)[:120])
    if write and inserts:
        out = src
        for at, s in sorted(inserts, reverse=True):
            out = out[:at] + s + out[at:]
        path.write_text(out, encoding='utf-8')


if __name__ == '__main__':
    write = '--check' not in sys.argv
    for p in PAGES:
        annotate(p, write)

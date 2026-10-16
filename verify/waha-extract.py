# Convert a Wahapedia 11th-edition faction page into plain text sections, keeping the
# formatting data.js uses: **bold** (keywords and <b>), ~~struck~~, "- " bullets, newlines.
# usage: python3 -I extract.py <page.html> <out.txt>
import sys, re
from bs4 import BeautifulSoup, NavigableString, Tag

src, out = sys.argv[1], sys.argv[2]
soup = BeautifulSoup(open(src, encoding='utf-8').read(), 'html.parser')
for t in soup(['script', 'style', 'noscript']): t.decompose()
# drop fluff text, hidden tooltip contents and the page's navigation/filter widgets
for t in soup.select('.ShowFluff, .tooltip_templates, .DetFilterCols, .DetFilterGroupHeader, .NavDropdown'): t.decompose()

BLOCK = {'div','p','br','li','tr','h1','h2','h3','h4','table','ul','ol'}
def render(node):
    out = []
    def walk(n):
        if isinstance(n, NavigableString):
            out.append(str(n)); return
        if not isinstance(n, Tag): return
        name = n.name
        cls = n.get('class') or []
        if name == 'br': out.append('\n'); return
        if name == 's' or 'kwbs' in cls:
            out.append('~~'); [walk(c) for c in n.children]; out.append('~~'); return
        if name == 'b' or 'kwb' in cls:
            inner = []; save = len(out)
            [walk(c) for c in n.children]
            txt = ''.join(out[save:]); del out[save:]
            out.append('**' + txt + '**' if txt.strip() else txt); return
        if name == 'li':
            out.append('\n- '); [walk(c) for c in n.children]; out.append('\n'); return
        if name in BLOCK: out.append('\n')
        for c in n.children: walk(c)
        if name in BLOCK: out.append('\n')
    walk(node)
    t = ''.join(out).replace('\xa0', ' ')
    t = re.sub(r'\*\*(\s+)\*\*', r'\1', t)       # "**WORLD** **EATERS**" -> "**WORLD EATERS**"
    t = t.replace('****', '')
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r' *\n *', '\n', t)
    t = re.sub(r'\n{2,}', '\n', t)
    return t.strip()

heads = soup.find_all('h2', class_='outline_header')
with open(out, 'w', encoding='utf-8') as f:
    for i, h in enumerate(heads):
        f.write('\n\n######## ' + h.get_text(' ', strip=True) + '\n')
        # everything after this header up to the next outline header
        nxt = heads[i + 1] if i + 1 < len(heads) else None
        frag = BeautifulSoup('<div></div>', 'html.parser').div
        el = h.next_sibling
        # walk up if the header has no siblings with content
        node = h
        while node is not None and node.next_sibling is None: node = node.parent
        el = node.next_sibling if node is not None else None
        parts = []
        while el is not None:
            if isinstance(el, Tag) and (el is nxt or (nxt is not None and nxt in el.descendants)):
                break
            parts.append(el)
            el = el.next_sibling
        for p in parts:
            if isinstance(p, Tag): f.write(render(p) + '\n')
            elif str(p).strip(): f.write(str(p).strip() + '\n')
print('sections', len(heads))

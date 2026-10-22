#!/usr/bin/env python3
"""verify/rules-text.py: Wahapedia's core rules page (with its errata and FAQ boxes) as Markdown text, for the
rules-question chat's context (rules/core-rules.md).

  python3 -I verify/rules-text.py verify/.cache/waha/core.html rules/core-rules.md

Headings stay headings, paragraphs and lists stay, tables become "a | b" rows, Wahapedia's dice icons become
their numbers ("[4]+" → "4+"), flavour text, menus, adverts and scripts are left out. Errata and FAQ boxes are
kept and labelled. Standard library only."""
import sys, re, html
from html.parser import HTMLParser

SKIP = {'script', 'style', 'noscript', 'nav', 'header', 'footer', 'form', 'button', 'select', 'svg', 'iframe'}
BLOCK = {'p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'br', 'table', 'ul', 'ol', 'section', 'article'}
# (adverts: a class "ad"/"ads", not the end of another word: Wahapedia's mode labels are class "redPad", "Ordered Retreat:")
DROP_CLASS = re.compile(r'ShowFluff|Fluff|legend|Disable|\bads?\b|adsbygoogle|NavDropdown|NavColumns|sidebar|menu|tooltip_content|nav', re.I)

class Conv(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.line, self.skip, self.stack = [], [], 0, []
        self.in_main = False
    def flush(self, prefix=''):
        t = re.sub(r'\s+', ' ', ''.join(self.line)).strip()
        self.line = []
        if t: self.out.append(prefix + t)
    def handle_starttag(self, tag, attrs):
        a = dict(attrs); cls = a.get('class', '') or ''
        drop = tag in SKIP or (cls and DROP_CLASS.search(cls)) or a.get('id', '') in ('header', 'footer')
        # a mode's label ("Ongoing Consolidation:", class redPad) stays on its list item's line, also when it is a div
        label = tag == 'div' and bool(re.search(r'\bredPad\b', cls))
        self.stack.append((tag, bool(drop), label))
        if drop: self.skip += 1; return
        if self.skip or label: return
        m = re.match(r'cruD(\d)', cls)
        if m: self.line.append(m.group(1)); return
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5'): self.flush(); self.line.append('\0H' + tag[1])
        elif tag == 'li': self.flush(); self.line.append('\0LI')
        elif tag in ('td', 'th'): self.line.append(' | ')
        elif tag in ('b', 'strong'): self.line.append('**')
        elif tag in BLOCK: self.flush()
        if tag == 'img' and a.get('alt'): self.line.append(a['alt'])
    def handle_endtag(self, tag):
        label = False
        while self.stack:
            t, drop, label = self.stack.pop()
            if drop: self.skip -= 1
            if t == tag: break
        if self.skip or label: return
        if tag in ('b', 'strong'): self.line.append('**')
        elif tag in BLOCK or tag in ('td', 'th'):
            if tag in ('td', 'th'): return
            self.flush()
    def handle_data(self, d):
        if not self.skip: self.line.append(d)

def main(src, dst):
    raw = open(src, encoding='utf-8').read()
    c = Conv(); c.feed(raw); c.flush()
    lines, out = [], []
    for l in c.out:
        l = l.replace('****', '').replace('** **', ' ')
        m = re.match(r'^\x00H(\d)\s*(.*)$', l)
        if m:
            text = m.group(2).replace('**', '').strip()
            if text: lines.append('\n' + '#' * min(int(m.group(1)) + 1, 5) + ' ' + text)
            continue
        if l.startswith('\x00LI'): lines.append('- ' + l[3:].strip()); continue
        l = l.replace('\x00', '')
        l = re.sub(r'^\|\s*', '', l).strip()
        lines.append(l)
    # the page's own parts: from the first rules heading to the end of the last section
    text = '\n'.join(lines)
    start = text.find('BASIC RULES')
    if start > 0: text = text[text.rfind('\n', 0, start) + 1:]
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'\*\*\s*\*\*', '', text)
    text = re.sub(r'(?m)^(Errata|FAQ)\s*\n\s*Show\s*$', r'**\1:**', text)   # the boxes' toggles
    text = re.sub(r'(?m)^Show$\n?', '', text)
    text = re.sub(r'\| (\d)\n\*\*\+\*\*', r'| \1+', text)                         # a table's dice icon and its "+"
    text = re.sub(r'(?m)^\*\*\+\*\*$\n?', '', text)
    head = ('# Warhammer 40,000 Core Rules (11th edition), with errata and FAQs\n\n'
            'Text copy of the rules as Wahapedia publishes them (wahapedia.ru/wh40k11ed/the-rules/core-rules/), which '
            'includes GW\'s errata and FAQ boxes, for the app\'s rules-question chat. Made by verify/rules-text.py.\n')
    open(dst, 'w', encoding='utf-8').write(head + '\n' + text.strip() + '\n')
    print('wrote %s: %d characters' % (dst, len(head) + len(text)))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

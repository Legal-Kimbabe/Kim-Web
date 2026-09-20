#!/usr/bin/env python3
"""One-time, dependency-scoped removal of the hidden legacy service-page vault."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ('about', 'contract-drafting', 'contract-review', 'legal-translation')
DEDICATED = re.compile(
    r'#vault\b|\.clause-library\b|\.clause-semantic-link\b|'
    r'\.cardhead\b|\.short-clause\b|\.long-clause\b|'
    r'\.clause-preview\b|\.clause-item\b|\.clause-num\b|'
    r'\.clause-text\b|\.back-to-top\b|\.toolbar(?:-spacer)?\b|'
    r'\.filters\b|\.filter\b|\.lang\b|\.pizza-note\b|'
    r'\.pizza-content\b|\.pizza-option\b|\.preview-zh\b|\.preview-en\b'
)


def matching_brace(css: str, opening: int) -> int:
    depth = 0
    quote = None
    comment = False
    i = opening
    while i < len(css):
        c = css[i]
        next_c = css[i + 1] if i + 1 < len(css) else ''
        if comment:
            if c == '*' and next_c == '/':
                comment = False
                i += 2
                continue
        elif quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c == '/' and next_c == '*':
            comment = True
            i += 2
            continue
        elif c in ('"', "'"):
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError('unbalanced CSS block')


def trim_css(css: str) -> str:
    """Delete only entire rules exclusively targeting the removed vault.

    Mixed/shared selectors are retained so visible service dependencies survive.
    """
    chunks = []
    start = 0
    i = 0
    while i < len(css):
        opening = css.find('{', i)
        if opening < 0:
            chunks.append(css[start:])
            break
        close = matching_brace(css, opening)
        prefix = css[start:opening]
        selector = re.sub(r'/\*.*?\*/', '', prefix, flags=re.S).strip()
        if selector.startswith('@media') or selector.startswith('@supports'):
            inner = trim_css(css[opening + 1:close])
            if inner.strip():
                chunks.append(prefix + '{' + inner + '}')
        elif selector.startswith('@'):
            chunks.append(css[start:close + 1])
        else:
            parts = selector.split(',')
            if not (parts and all(DEDICATED.search(part) for part in parts)):
                chunks.append(css[start:close + 1])
        i = close + 1
        start = i
    return ''.join(chunks)


def remove_script(page: str, script_id: str) -> str:
    pattern = r'<script id="' + re.escape(script_id) + r'">.*?</script>\s*'
    page, count = re.subn(pattern, '', page, count=1, flags=re.S)
    if count != 1:
        raise ValueError(f'missing script {script_id}')
    return page


def clean(page: str) -> str:
    # Keep a bare, inert section so the existing page-navigation integration
    # and CSS section topology continue to see the same page identifiers.
    page, count = re.subn(
        r'<section class="page active" id="vault">.*?</section>\s*(?=<section class="page" id="draft">)',
        '<section class="page active" id="vault"></section>\n',
        page, count=1, flags=re.S)
    if count != 1:
        raise ValueError('hidden legacy vault boundary not found')
    for script_id in ('clause-language-system-js', 'clause-copy-count-js',
                      'complete-agreement-order-v178', 'homepage-lwyrup-script'):
        page = remove_script(page, script_id)
    for style_id in ('homepage-clause-semantic-link-scope', 'homepage-lwyrup-style'):
        pattern = r'<style id="' + style_id + r'">.*?</style>\s*'
        page, count = re.subn(pattern, '', page, count=1, flags=re.S)
        if count != 1:
            raise ValueError(f'missing style {style_id}')
    page, count = re.subn(
        r'<button class="back-to-top".*?</button>\s*', '',
        page, count=1, flags=re.S)
    if count != 1:
        raise ValueError('missing hidden back-to-top control')
    page, count = re.subn(
        r'<script>\s*\(function\(\)\{\s*const toolbar = document.querySelector\(\'#vault \.toolbar\'\);.*?</script>\s*',
        '', page, count=1, flags=re.S)
    if count != 1:
        raise ValueError('missing old vault-only mobile toolbar script')
    style = re.search(r'(<style id="site-css-consolidated-v155">)(.*?)(</style>)', page, re.S)
    if not style:
        raise ValueError('site CSS missing')
    page = page[:style.start(2)] + trim_css(style.group(2)) + page[style.end(2):]
    return page


for name in PAGES:
    path = ROOT / name / 'index.html'
    original = path.read_text(encoding='utf-8')
    if 'clause-language-system-js' in original:
        result = clean(original)
    else:
        style = re.search(r'(<style id="site-css-consolidated-v155">)(.*?)(</style>)', original, re.S)
        result = original[:style.start(2)] + trim_css(style.group(2)) + original[style.end(2):]
    path.write_text(result, encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {len(original)} -> {len(result)} characters')

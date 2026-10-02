#!/usr/bin/env python3
"""Build static ClauseBank views from the single canonical cards source.

Bootstrap is intentionally one-time: after that, edit only
clausebank/source/clauses.txt when changing clause data.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import re
from xml.etree import ElementTree
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "clausebank/source/clauses.txt"
CARD = re.compile(r'<article class="card(?: [^"]*)?"[^>]*>.*?</article>', re.S)
CODE = re.compile(r'<span class="code">([^<]+)</span>')
CONTENT = '<div class="content clause-library">'
FILTERS = '<div class="filters">'
VERSIONS = {'短版': 'short', '長版': 'long'}
SEO_TITLE_DISAMBIGUATION_CODES = frozenset({
    'IA-01', 'IA-02', 'IA-03', 'IA-04',
    'FM-01', 'FM-02',
    'MI-02', 'MI-03', 'MI-09', 'MI-10', 'MI-11', 'MI-12',
    'DM-01', 'DM-02',
})


def versioned_script(page: str) -> str:
    """Content-address shared implementations to avoid stale CDN/browser JS."""
    version = hashlib.sha256((ROOT / 'clausebank/assets/clausebank.js').read_bytes()).hexdigest()[:12]
    header_version = hashlib.sha256((ROOT / 'assets/editorial-header.js').read_bytes()).hexdigest()[:12]
    page = re.sub(r'(src="(?:/clausebank/assets/|(?:\.\./)?assets/)clausebank\.js)(?:\?v=[^"]*)?("\s*>)',
                  lambda match: match.group(1) + '?v=' + version + match.group(2), page)
    page = re.sub(r'(src="/assets/editorial-header\.js)(?:\?v=[^"]*)?("\s+defer></script>)',
                  lambda match: match.group(1) + '?v=' + header_version + match.group(2), page)
    if '/assets/editorial-header.css' not in page:
        shared_header = ('<link rel="stylesheet" href="/assets/editorial-header.css?v=20260923a"/>\n'
                         f'<script src="/assets/editorial-header.js?v={header_version}" defer></script>\n')
        page = page.replace('</head>', shared_header + '</head>', 1)
    return page


def cards(text: str) -> list[str]:
    return CARD.findall(text)


def code(card: str) -> str:
    found = CODE.search(card)
    if not found:
        raise ValueError("card without code")
    return html.unescape(found.group(1))


def clause_version(card: str) -> str:
    card_code = code(card)
    modes = re.findall(r'<span class="mode(?: [^"]*)?">([^<]+)</span>', card)
    if len(modes) != 1 or modes[0] not in VERSIONS:
        raise ValueError(f"{card_code}: length must be explicitly confirmed as 短版 or 長版")
    return VERSIONS[modes[0]]


def validate_source_card(card: str) -> None:
    card_code = code(card)
    version = clause_version(card)
    label = '短版' if version == 'short' else '長版'
    opening = re.match(r'<article\b[^>]*>', card)
    if not opening:
        raise ValueError(f"{card_code}: invalid card opening")
    classes = re.search(r'class="([^"]*)"', opening.group(0))
    if not classes or classes.group(1).split() != ['card', f'{version}-clause']:
        raise ValueError(f"{card_code}: card class must match its confirmed {label} version")
    if ' open' in classes.group(0):
        raise ValueError(f"{card_code}: canonical source must not set an initial open state")
    search = re.search(r'data-search="([^"]*)"', opening.group(0))
    if not search or search.group(1).split().count(label) != 1:
        raise ValueError(f"{card_code}: data-search must contain exactly one {label} token")
    other = '長版' if label == '短版' else '短版'
    if other in search.group(1).split():
        raise ValueError(f"{card_code}: data-search contains conflicting length metadata")
    if not re.search(r'<a class="clause-semantic-link" href="/clausebank/[a-z0-9-]+/">', card):
        raise ValueError(f"{card_code}: missing semantic URL")
    for cls in ('clause zh', 'clause en-copy'):
        match = re.search(r'<div class="' + re.escape(cls) + r'">(.*?)</div>', card, re.S)
        if not match or not re.sub(r'<[^>]+>', '', match.group(1)).strip():
            raise ValueError(f"{card_code}: missing {cls} content")


def compile_card(card: str) -> str:
    """Normalize interaction scaffolding without changing clause text or version."""
    validate_source_card(card)
    card_code = code(card)
    version = clause_version(card)
    label = '短版' if version == 'short' else '長版'
    card = re.sub(r'<span class="mode(?: [^"]*)?">[^<]+</span>',
                  f'<span class="mode {version}">{label}</span>', card, count=1)
    card = re.sub(r'<div class="clause-preview">.*?</div></div>', '', card, count=1, flags=re.S)
    preview = '<div class="clause-preview"><div class="preview-zh"></div><div class="preview-en"></div></div>'
    card = card.replace('<div class="body">', '<div class="body">' + preview, 1)
    head = re.search(r'(<div class="cardhead">)(.*?)(</div>)', card, re.S)
    if not head:
        raise ValueError(f"{card_code}: missing cardhead")
    content = re.sub(r'<(?:button|span) class="arrow(?: clause-expand)?"[^>]*>.*?</(?:button|span)>',
                     '', head.group(2), flags=re.S)
    arrow = (f'<button class="arrow clause-expand" type="button" '
             f'aria-label="展開 {html.escape(card_code)} 條款" aria-expanded="false" '
             f'onclick="toggle(this.closest(\'.card\'))">⌄</button>')
    return card[:head.start()] + head.group(1) + content + arrow + head.group(3) + card[head.end():]


def validate_compiled_cards(compiled: list[str]) -> None:
    for card in compiled:
        validate_source_card(card)
        card_code = code(card)
        if 'class="clause-preview"' not in card:
            raise ValueError(f"{card_code}: missing collapsed preview scaffold")
        if 'class="arrow clause-expand"' not in card:
            raise ValueError(f"{card_code}: missing disclosure control")


def validate_landing_initial_state(page: str) -> None:
    if 'data-clause-code=""' not in page:
        raise ValueError('ClauseBank landing must not carry a deep-link clause code')
    if any(' open' in re.match(r'<article\b[^>]*>', card).group(0) for card in cards(page)):
        raise ValueError('ClauseBank landing cards must be collapsed initially')


def source_parts(text: str) -> tuple[str, list[str]]:
    start = text.index(FILTERS) + len(FILTERS)
    end = text.index('<div class="lang">', start)
    filters = text[start:end]
    result = cards(text)
    codes = [code(item) for item in result]
    if len(result) < 98 or len(codes) != len(set(codes)):
        raise ValueError(f"expected at least 98 unique canonical cards, got {len(result)}")
    for item in result:
        validate_source_card(item)
    if len(re.findall(r'<button class="filter', filters)) < 23:
        raise ValueError("canonical filters must contain at least 23 buttons")
    return filters, result


def replace_cards(page: str, replacements: list[str]) -> str:
    marker = page.index(CONTENT)
    first = CARD.search(page, marker)
    if not first:
        raise ValueError("ClauseBank card list missing")
    found = list(CARD.finditer(page, marker))
    # Only the ClauseBank card list, never unrelated service cards.
    return page[:first.start()] + '\n'.join(replacements) + page[found[-1].end():]


def replace_filters(page: str, filters: str) -> str:
    start = page.index(FILTERS) + len(FILTERS)
    end = page.index('<div class="lang">', start)
    return page[:start] + filters + page[end:]


def field(card: str, cls: str) -> str | None:
    match = re.search(r'<span class="'+cls+r'">(.*?)</span>', card, re.S)
    return match.group(1) if match else None


def home_card(existing: str, canonical: str) -> str:
    """Keep homepage's native cardhead/onclick; rehydrate every legal field."""
    head_end = existing.index('<div class="body">')
    head = existing[:head_end]
    body = canonical[canonical.index('<div class="body">'):]
    opening = re.match(r'<article\b[^>]*>', canonical).group(0)
    head = re.sub(r'^<article\b[^>]*>', opening, head, count=1)
    for cls in ('code', 'title', 'en', 'applicability'):
        value = field(canonical, cls)
        old = field(head, cls)
        if value is None and old is None:
            continue
        if value is None or old is None:
            raise ValueError(f"homepage {code(canonical)} field topology differs: {cls}")
        head = re.sub(r'(<span class="'+cls+r'">).*?(</span>)',
                      lambda m: m.group(1)+value+m.group(2), head, count=1, flags=re.S)
    mode = re.search(r'<span class="mode(?: [^"]*)?">(.*?)</span>', canonical, re.S)
    old_mode = re.search(r'<span class="mode(?: [^"]*)?">(.*?)</span>', head, re.S)
    if bool(mode) != bool(old_mode):
        raise ValueError(f"homepage {code(canonical)} mode topology differs")
    if mode:
        # Preserve the homepage-specific styling classes; only the label is data.
        updated = old_mode.group(0).replace(old_mode.group(1), mode.group(1), 1)
        head = head[:old_mode.start()] + updated + head[old_mode.end():]
    return head + body


def canonicalize_hub_links(page: str) -> str:
    """Point ClauseBank hub navigation at its canonical root URL."""
    return page.replace('href="/clausebank/"', 'href="/"')


def plain_text(value: str | None) -> str:
    return html.unescape(re.sub(r'<[^>]+>', '', value or '')).strip()


def disambiguated_semantic_title(card: str) -> str:
    """Build natural unique titles only for the historically duplicated set."""
    card_code = code(card)
    zh_title = plain_text(field(card, 'title'))
    context = plain_text(field(card, 'applicability'))
    label = '短版' if clause_version(card) == 'short' else '長版'
    qualifier = f'{context}／{label}' if context else label
    return f'{zh_title}（{qualifier}）｜中英文合約・契約條款｜金法務在線'


def update_semantic_title(head: str, card: str) -> str:
    """Repair known duplicate SEO titles without rewriting other indexed heads."""
    if code(card) not in SEO_TITLE_DISAMBIGUATION_CODES:
        return head
    title = html.escape(disambiguated_semantic_title(card), quote=True)
    head = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', head,
                  count=1, flags=re.S)
    head = re.sub(r'(<meta property="og:title" content=")[^"]*("/>)',
                  lambda match: match.group(1) + title + match.group(2),
                  head, count=1)
    return head


def semantic_landing_body(landing: str, h1: str, card_code: str) -> str:
    """Compose the approved full ClauseBank deep-link body for one target."""
    body = landing[landing.index('<body'):]
    body = body.replace('data-clause-code=""', f'data-clause-code="{card_code}"', 1)
    body = re.sub(r'<h1 class="seo-site-title">.*?</h1>', h1, body,
                  count=1, flags=re.S)
    body = canonicalize_hub_links(body)
    # The canonical landing lives one directory above each semantic page.
    return re.sub(r'((?:src|href)=")assets/', r'\1../assets/', body)


def new_semantic_page(landing: str, original: str, url: str) -> str:
    """Create only a *new* URL; existing indexed heads are never regenerated."""
    card_code = code(original)
    zh_title = html.unescape(field(original, 'title') or '')
    en_title = html.unescape(field(original, 'en') or '')
    context = html.unescape(field(original, 'applicability') or '')
    description = f'{zh_title}（{card_code}）中英文條款全文'
    if context:
        description += f'，適用情境：{context}'
    description += '。'
    title = (disambiguated_semantic_title(original)
             if card_code in SEO_TITLE_DISAMBIGUATION_CODES
             else f'{zh_title}｜{card_code}｜中英文合約條款｜金法務在線')
    canonical = 'https://www.legal-kim.com' + url
    page = landing
    page = re.sub(r'<title>.*?</title>', f'<title>{html.escape(title)}</title>', page, count=1)
    page = re.sub(r'(<meta name="description" content=")[^"]*("/>)',
                  lambda m: m.group(1)+html.escape(description, quote=True)+m.group(2), page, count=1)
    page = re.sub(r'(<link rel="canonical" href=")[^"]*("/>)',
                  lambda m: m.group(1)+canonical+m.group(2), page, count=1)
    for prop, value in (('og:title', title), ('og:description', description), ('og:url', canonical)):
        page = re.sub(r'(<meta property="'+prop+r'" content=")[^"]*("/>)',
                      lambda m: m.group(1)+html.escape(value, quote=True)+m.group(2), page, count=1)
    page = re.sub(r'<h1 class="seo-site-title">.*?</h1>',
                  f'<h1 class="seo-site-title">{html.escape(card_code)} {html.escape(zh_title)}｜{html.escape(en_title)}</h1>',
                  page, count=1)
    h1 = re.search(r'<h1 class="seo-site-title">.*?</h1>', page, re.S)
    if not h1:
        raise ValueError(f'{card_code}: generated semantic page is missing its H1')
    head_end = page.index('</head>') + len('</head>')
    return page[:head_end] + '\n' + semantic_landing_body(page, h1.group(0), card_code)


def refresh_semantic_page(landing: str, existing: str, original: str) -> str:
    """Use the canonical landing shell while preserving an indexed page's SEO head/H1."""
    card_code = code(original)
    head_end = existing.index('</head>') + len('</head>')
    head = update_semantic_title(existing[:head_end], original)
    existing_h1 = re.search(r'<h1 class="seo-site-title">.*?</h1>', existing, re.S)
    if not existing_h1:
        raise ValueError(f'{card_code}: semantic page is missing its indexed H1')
    return head + '\n' + semantic_landing_body(landing, existing_h1.group(0), card_code)


def build() -> None:
    source_text = SOURCE.read_text(encoding='utf-8')
    filters, originals = source_parts(source_text)
    compiled = [compile_card(item) for item in originals]
    validate_compiled_cards(compiled)
# Root and /clausebank/ intentionally share one canonical ClauseBank data source.
    landing_path = ROOT / 'clausebank/index.html'
    landing = landing_path.read_text(encoding='utf-8')
    landing_out = canonicalize_hub_links(
        versioned_script(replace_cards(replace_filters(landing, filters), compiled)))
    validate_landing_initial_state(landing_out)
    if landing_out != landing:
        landing_path.write_text(landing_out, encoding='utf-8')

    home_path = ROOT / 'index.html'
    home = home_path.read_text(encoding='utf-8')
    home_out = canonicalize_hub_links(
        versioned_script(replace_cards(replace_filters(home, filters), compiled)))
    validate_landing_initial_state(home_out)
    if home_out != home:
        home_path.write_text(home_out, encoding='utf-8')

    expected_paths = {re.search(r'href="(/clausebank/[^\"]+/)"', item).group(1): item
                      for item in compiled}
    if len(expected_paths) != len(originals):
        raise ValueError("missing or duplicate semantic slug")
    new_urls = []
    for url, _ in expected_paths.items():
        path = ROOT / url.lstrip('/') / 'index.html'
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(versioned_script(new_semantic_page(landing_out, expected_paths[url], url)), encoding='utf-8')
            new_urls.append(url)
            continue
        page = path.read_text(encoding='utf-8')
        out = versioned_script(refresh_semantic_page(landing_out, page, expected_paths[url]))
        if out != page:
            path.write_text(out, encoding='utf-8')
    if new_urls:
        sitemap_path = ROOT / 'sitemap.xml'
        sitemap = sitemap_path.read_text(encoding='utf-8')
        for url in new_urls:
            absolute = 'https://www.legal-kim.com' + url
            if absolute not in sitemap:
                sitemap = sitemap.replace('</urlset>',
                                          f'<url><loc>{absolute}</loc></url>\n</urlset>', 1)
        ElementTree.fromstring(sitemap)
        sitemap_path.write_text(sitemap, encoding='utf-8')


def bootstrap() -> None:
    if SOURCE.exists():
        raise ValueError('canonical source already exists; refusing to overwrite')
    landing = (ROOT / 'clausebank/index.html').read_text(encoding='utf-8')
    filters, originals = source_parts(landing)
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    home = (ROOT / 'index.html').read_text(encoding='utf-8')
    home_order = ','.join(code(item) for item in cards(home))
    SOURCE.write_text(f'<!-- homepage-order: {home_order} -->\n'
                      + FILTERS + filters + '<div class="lang"></div>\n'
                      + CONTENT + '\n' + '\n'.join(originals) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--bootstrap', action='store_true')
    args = parser.parse_args()
    bootstrap() if args.bootstrap else build()

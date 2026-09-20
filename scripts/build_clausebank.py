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


def versioned_script(page: str) -> str:
    """Content-address the one shared implementation to avoid stale CDN JS."""
    version = hashlib.sha256((ROOT / 'clausebank/assets/clausebank.js').read_bytes()).hexdigest()[:12]
    return re.sub(r'(src="(?:/clausebank/assets/|(?:\.\./)?assets/)clausebank\.js)(?:\?v=[^"]*)?("\s*>)',
                  lambda match: match.group(1) + '?v=' + version + match.group(2), page)


def cards(text: str) -> list[str]:
    return CARD.findall(text)


def code(card: str) -> str:
    found = CODE.search(card)
    if not found:
        raise ValueError("card without code")
    return html.unescape(found.group(1))


def source_parts(text: str) -> tuple[str, list[str]]:
    start = text.index(FILTERS) + len(FILTERS)
    end = text.index('<div class="lang">', start)
    filters = text[start:end]
    result = cards(text)
    codes = [code(item) for item in result]
    if len(result) < 98 or len(codes) != len(set(codes)):
        raise ValueError(f"expected at least 98 unique canonical cards, got {len(result)}")
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
    title = f'{zh_title}｜{card_code}｜中英文合約條款｜金法務在線'
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
    page = page.replace('data-clause-code=""', f'data-clause-code="{card_code}"', 1)
    page = page.replace('href="assets/clausebank.css"', 'href="../assets/clausebank.css"')
    page = page.replace('src="assets/images/clausebank-hero.webp"', 'src="../assets/images/clausebank-hero.webp"')
    page = page.replace('src="assets/clausebank.js"', 'src="../assets/clausebank.js"')
    return page


def build() -> None:
    source_text = SOURCE.read_text(encoding='utf-8')
    filters, originals = source_parts(source_text)
    source_codes = [code(item) for item in originals]
    home_path = ROOT / 'index.html'
    home = home_path.read_text(encoding='utf-8')
    current = {code(item): item for item in cards(home)}
    if len(current) != len(cards(home)):
        raise ValueError("homepage duplicate card code")
    canonical_by_code = dict(zip(source_codes, originals))
    # Homepage has an established, independently approved presentation order.
    # Retain it for existing cards; a new card is appended until its intended
    # position is explicitly encoded in the canonical source.
    order_match = re.search(r'<!-- homepage-order: ([A-Z0-9,-]+) -->', source_text)
    if not order_match:
        raise ValueError('canonical source must record homepage presentation order')
    known_home_order = order_match.group(1).split(',')
    if len(known_home_order) != len(set(known_home_order)):
        raise ValueError('duplicate homepage order code')
    home_codes = [c for c in known_home_order if c in canonical_by_code]
    home_codes += [c for c in source_codes if c not in home_codes]
    rendered = [home_card(current[c], canonical_by_code[c]) if c in current
                else canonical_by_code[c] for c in home_codes]
    home_out = versioned_script(replace_cards(replace_filters(home, filters), rendered))
    if home_out != home:
        home_path.write_text(home_out, encoding='utf-8')

    landing_path = ROOT / 'clausebank/index.html'
    landing = landing_path.read_text(encoding='utf-8')
    landing_out = versioned_script(replace_cards(replace_filters(landing, filters), originals))
    if landing_out != landing:
        landing_path.write_text(landing_out, encoding='utf-8')

    expected_paths = {re.search(r'href="(/clausebank/[^\"]+/)"', item).group(1): item
                      for item in originals}
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
        out = versioned_script(replace_cards(replace_filters(page, filters), originals))
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

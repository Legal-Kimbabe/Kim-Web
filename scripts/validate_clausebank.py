#!/usr/bin/env python3
"""Strict static regression checks against the approved ca99b68 baseline."""
from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree
from pathlib import Path

from build_clausebank import ROOT, SOURCE, cards, code, field, source_parts

BASELINE = 'ca99b687e89082e3617f5cee317b01466c218b96'
NEW_17 = ('COI-01', 'COI-02', 'COI-03', 'SLA-01', 'SLA-02', 'SLA-03',
          'PT-05', 'PT-06', 'WT-01', 'WT-02', 'WT-03', 'PD-01', 'PD-02',
          'PD-03', 'PD-04', 'RL-01', 'RL-02')
SERVICE = ('about', 'contract-drafting', 'contract-review', 'legal-translation')


def baseline(path: str) -> str:
    return subprocess.check_output(['git', 'show', f'{BASELINE}:{path}'],
                                   cwd=ROOT).decode('utf-8')


def digest(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def seo_signature(page: str) -> str:
    # Lock indexed fields, not unrelated presentation CSS within <head>.
    head = page[:page.index('</head>') + len('</head>')]
    h1 = re.search(r'<h1 class="seo-site-title">.*?</h1>', page, re.S)
    fields = []
    for pattern in (r'<title>.*?</title>',
                    r'<meta name="description"[^>]*>',
                    r'<link rel="canonical"[^>]*>',
                    r'<meta property="og:[^"]+"[^>]*>',
                    r'<script type="application/ld\+json">.*?</script>'):
        fields += re.findall(pattern, head, re.S)
    return digest('\n'.join(fields) + (h1.group(0) if h1 else ''))


def text_body(card: str, language: str) -> str:
    found = re.search(r'<div class="clause '+language+r'">(.*?)</div>\s*(?=<div class="clause en-copy">|<button|<div class="pizza-note")', card, re.S)
    if not found:
        # Nested formatting may include divs; use the entire body as fallback.
        found = re.search(r'<div class="clause '+language+r'">(.*?)</div>', card, re.S)
    check(found is not None, f'missing {language} clause: {code(card)}')
    return found.group(1)


def main(expected_count: int) -> None:
    filters, canonical = source_parts(SOURCE.read_text(encoding='utf-8'))
    expected_codes = [code(item) for item in canonical]
    check(len(expected_codes) == expected_count, 'canonical card count')
    check(len(set(expected_codes)) == expected_count, 'duplicate canonical code')
    mode_by_code = {code(item): re.search(r'<span class="mode(?: [^"]*)?">([^<]*)</span>', item).group(1)
                    for item in canonical}
    check(sum(mode in ('短版', '長版') for mode in mode_by_code.values()) == expected_count,
          'invalid mode label')
    if expected_count == 98:
        check(sum(mode == '短版' for mode in mode_by_code.values()) == 48, 'short mode count')
        check(sum(mode == '長版' for mode in mode_by_code.values()) == 50, 'long mode count')
    check(mode_by_code['MI-12'] == '短版', 'MI-12 must be short')
    check(set(NEW_17) <= set(expected_codes), 'new 17 clauses missing')
    approved = {code(item): item for item in cards(baseline('clausebank/index.html'))}
    check(set(approved) <= set(expected_codes), 'approved code set lost')
    for item in (item for item in canonical if code(item) in approved):
        original = approved[code(item)]
        for language in ('zh', 'en-copy'):
            check(digest(text_body(item, language)) == digest(text_body(original, language)),
                  f'canonical {language} text differs from approved landing: {code(item)}')
        for cls in ('title', 'en', 'applicability'):
            check(field(item, cls) == field(original, cls),
                  f'canonical {cls} differs from approved landing: {code(item)}')
    check(len(re.findall(r'<button class="filter', filters)) == 23, 'filter button count')
    check('data-filter="payment"' in filters, 'payment filter missing')
    slugs = {}
    for item in canonical:
        href = re.search(r'<a class="clause-semantic-link" href="([^"]+)"', item)
        check(href is not None, f'missing semantic href: {code(item)}')
        check(href.group(1) not in slugs, 'duplicate semantic href')
        slugs[href.group(1)] = code(item)
    check(len(slugs) == expected_count, 'semantic href count')

    pages = ['index.html', 'clausebank/index.html']
    pages += [url.lstrip('/') + 'index.html' for url in slugs]
    js_version = hashlib.sha256((ROOT / 'clausebank/assets/clausebank.js').read_bytes()).hexdigest()[:12]
    for relative in pages:
        path = ROOT / relative
        check(path.is_file(), f'missing output: {relative}')
        page = path.read_text(encoding='utf-8')
        rendered = cards(page)
        codes = [code(item) for item in rendered]
        check(len(codes) == expected_count and set(codes) == set(expected_codes),
              f'not all {expected_count} cards: {relative}')
        check(len(codes) == len(set(codes)), f'duplicate card: {relative}')
        check('一般版' not in page, f'legacy mode label: {relative}')
        check(f'clausebank.js?v={js_version}' in page,
              f'shared JS cache version mismatch: {relative}')
        check(not re.search(r'(?m)^\s*<\s*$', page), f'stray angle bracket: {relative}')
        check(len(re.findall(r'<button class="filter', page)) == 23,
              f'filter count: {relative}')
        by_code = dict(zip(codes, rendered))
        for original in canonical:
            actual = by_code[code(original)]
            for language in ('zh', 'en-copy'):
                check(digest(text_body(actual, language)) == digest(text_body(original, language)),
                      f'{language} clause changed: {relative} {code(original)}')
            actual_mode = re.search(r'<span class="mode(?: [^"]*)?">([^<]*)</span>', actual)
            check(actual_mode is not None and actual_mode.group(1) == mode_by_code[code(original)],
                  f'mode changed: {relative} {code(original)}')
            for cls in ('title', 'en', 'applicability'):
                check(field(actual, cls) == field(original, cls),
                      f'{cls} changed: {relative} {code(original)}')
            for attr in ('data-cat', 'data-search'):
                approved_value = re.search(attr + r'="([^"]*)"', original)
                output_value = re.search(attr + r'="([^"]*)"', actual)
                check(approved_value is not None and output_value is not None
                      and approved_value.group(1) == output_value.group(1),
                      f'{attr} changed: {relative} {code(original)}')
        if relative not in ('index.html', 'clausebank/index.html') and subprocess.run(['git', 'cat-file', '-e', f'{BASELINE}:{relative}'],
                          cwd=ROOT, stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode == 0:
            check(seo_signature(page) == seo_signature(baseline(relative)),
                  f'SEO head/H1 changed: {relative}')
        if relative.startswith('clausebank/') and relative != 'clausebank/index.html':
            url_path = '/' + relative.removesuffix('index.html')
            target = slugs[url_path]
            check(f'data-clause-code="{target}"' in page,
                  f'deep-link target changed: {relative}')
            canonical_url = 'https://www.legal-kim.com' + url_path
            check(f'<link rel="canonical" href="{canonical_url}"/>' in page,
                  f'canonical mismatch: {relative}')
            check(f'<meta property="og:url" content="{canonical_url}"/>' in page,
                  f'OG URL mismatch: {relative}')
            check('<title></title>' not in page and '<meta name="description" content=""' not in page,
                  f'empty SEO metadata: {relative}')
            check('noindex' not in page.lower(), f'not indexable: {relative}')
    home_text = (ROOT / 'index.html').read_text(encoding='utf-8')
    alias_text = (ROOT / 'clausebank/index.html').read_text(encoding='utf-8')
    check(home_text.count('id="vault"') == 1, 'homepage vault missing')
    check('<link rel="canonical" href="https://www.legal-kim.com/"/>' in home_text,
          'root canonical must be root')
    check('<meta property="og:url" content="https://www.legal-kim.com/"/>' in home_text,
          'root OG URL must be root')
    check('<link rel="canonical" href="https://www.legal-kim.com/"/>' in alias_text,
          'ClauseBank alias canonical must point to root')
    check('<meta property="og:url" content="https://www.legal-kim.com/"/>' in alias_text,
          'ClauseBank alias OG URL must point to root')
    check('clause-copy-count-js' not in (ROOT / 'index.html').read_text(encoding='utf-8'),
          'homepage duplicated copy-count implementation')
    for name in SERVICE:
        relative = f'{name}/index.html'
        page = (ROOT / relative).read_text(encoding='utf-8')
        check(not cards(page) and '一般版' not in page, f'legacy service cards: {relative}')
        check(not re.search(r'#vault\s+\.|\.clause-library\b|function (?:filterCards|copyClause|setLanguage)\b', page),
              f'legacy service styles/scripts: {relative}')
        check(seo_signature(page) == seo_signature(baseline(relative)),
              f'service SEO head/H1 changed: {relative}')
        for section in ('draft', 'review', 'translate', 'about'):
            marker = f'<section class="page" id="{section}">'
            check(marker in page, f'visible service section missing: {relative} {section}')
    sitemap = ElementTree.fromstring((ROOT / 'sitemap.xml').read_text(encoding='utf-8'))
    urls = [node.text for node in sitemap.iter() if node.tag.endswith('loc')]
    check(len(urls) == len(set(urls)) == expected_count + 5,
          'sitemap URL count/uniqueness')
    for url in urls:
        parsed = urlparse(url)
        check(parsed.netloc == 'www.legal-kim.com', f'unexpected sitemap host: {url}')
        target = ROOT / parsed.path.lstrip('/')
        check((target / 'index.html').is_file() if parsed.path.endswith('/') else target.is_file(),
              f'broken sitemap URL: {url}')
    # Local asset references in the generated ClauseBank pages must resolve.
    for relative in pages:
        page = (ROOT / relative).read_text(encoding='utf-8')
        for attr in re.findall(r'(?:src|href)="([^"]+)"', page):
            if attr.startswith(('http:', 'https:', 'mailto:', '#', 'data:')):
                continue
            parsed = urlparse(urljoin('https://www.legal-kim.com/' + relative, attr))
            if parsed.path.endswith(('.css', '.js', '.webp', '.png', '.jpg', '.ico')):
                check((ROOT / parsed.path.lstrip('/')).is_file(),
                      f'broken local asset: {relative} -> {attr}')
    print(f'PASS: {expected_count} cards; '
          f'{sum(m == "短版" for m in mode_by_code.values())} short/'
          f'{sum(m == "長版" for m in mode_by_code.values())} long; '
          f'MI-12 short; 17 baseline additions; 23 filters; {expected_count} URLs')
    print('PASS: bilingual clause hashes, SEO head/H1, deep-link targets, no legacy service data')
    print(f'PASS: {expected_count + 5} unique sitemap URLs, local assets, no stray <')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-count', type=int, default=98)
    main(parser.parse_args().expected_count)

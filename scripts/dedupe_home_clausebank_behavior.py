#!/usr/bin/env python3
"""One-time removal of homepage copies of shared ClauseBank behavior."""
import re
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'index.html'
page = path.read_text(encoding='utf-8')
for ident in ('clause-copy-count-js', 'homepage-lwyrup-script'):
    page, count = re.subn(r'<script id="' + ident + r'">.*?</script>\s*', '', page,
                          count=1, flags=re.S)
    if count != 1:
        raise ValueError(f'missing duplicated script: {ident}')
page, count = re.subn(
    r'<script>\s*\(function\(\)\{\s*const toolbar = document.querySelector\(\'#vault \.toolbar\'\);.*?</script>\s*',
    '', page, count=1, flags=re.S)
if count != 1:
    raise ValueError('missing duplicated mobile toolbar script')
adapter = '''<style id="homepage-clause-toolbar-adapter">
@media(max-width:700px){
  body{overflow-anchor:none;}
  #vault .toolbar.mobile-toolbar-fixed{position:fixed!important;top:0;left:0;right:0;z-index:1000;width:100%!important;margin:0!important;}
  #vault .toolbar-spacer.mobile-toolbar-spacer-active{display:block;}
}
</style>
'''
page = page.replace('<style id="homepage-lwyrup-style">',
                    adapter + '<style id="homepage-lwyrup-style">', 1)
path.write_text(page, encoding='utf-8')

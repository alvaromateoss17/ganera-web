#!/usr/bin/env python3
"""Copia _partials/header.html y _partials/footer.html dentro de cada página.

Cada página marca dónde van con comentarios:
    <!-- partial:header --> ... <!-- /partial:header -->
    <!-- partial:footer --> ... <!-- /partial:footer -->
Edita el parcial y ejecuta:  python3 scripts/sync-partials.py
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
partials = {p.stem: p.read_text().rstrip('\n') for p in (ROOT / '_partials').glob('*.html')}
pages = [p for p in ROOT.rglob('*.html') if '_partials' not in p.parts and 'reference' not in p.parts]

for page in pages:
    html = page.read_text()
    new = html
    for name, body in partials.items():
        pat = re.compile(rf'(<!-- partial:{name} -->\n)(?:.*?\n)?(<!-- /partial:{name} -->)', re.S)
        new = pat.sub(lambda m: m.group(1) + body + '\n' + m.group(2), new)
    if new != html:
        page.write_text(new)
        print('actualizado', page.relative_to(ROOT))

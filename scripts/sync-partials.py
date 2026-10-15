#!/usr/bin/env python3
"""Copia _partials/header.html y _partials/footer.html dentro de cada página.

Cada página marca dónde van con comentarios:
    <!-- partial:header --> ... <!-- /partial:header -->
    <!-- partial:footer --> ... <!-- /partial:footer -->
Además genera bloques a partir de los dos JSON de configuración:
  _partials/precios.json → plans, services, plan-options   (ver scripts/precios.py)
  _partials/legal.json   → legal-identidad, legal-fecha,
                           subencargados, foot-legal, legalnav  (ver scripts/legal.py)
Los marcadores también se resuelven dentro de los propios parciales
(footer.html contiene <!-- partial:foot-legal -->).
Edita el parcial o el JSON y ejecuta:  python3 scripts/sync-partials.py
"""
import pathlib, re

import legal
import precios

ROOT = pathlib.Path(__file__).resolve().parent.parent

partials = {p.stem: p.read_text().rstrip('\n') for p in (ROOT / '_partials').glob('*.html')}
partials.update(precios.generated(ROOT))
partials.update(legal.generated(ROOT))


def expand(html: str) -> str:
    for name, body in partials.items():
        pat = re.compile(rf'(<!-- partial:{name} -->\n)(?:.*?\n)?(<!-- /partial:{name} -->)', re.S)
        html = pat.sub(lambda m: m.group(1) + body + '\n' + m.group(2), html)
    return html


# Un parcial puede incluir otro (footer → foot-legal): resuélvelos antes de insertarlos.
for name, body in list(partials.items()):
    partials[name] = expand(body)

pages = [p for p in ROOT.rglob('*.html') if '_partials' not in p.parts and 'reference' not in p.parts]
for page in pages:
    html = page.read_text()
    new = expand(html)
    if new != html:
        page.write_text(new)
        print('actualizado', page.relative_to(ROOT))

"""Genera el HTML de Planes y Servicios a partir de _partials/precios.json.

Lo usa sync-partials.py; no hace falta ejecutarlo por separado.
"""
import html, json, pathlib
from urllib.parse import quote

ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2.6" stroke-linecap="square" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
e = html.escape


def eur(n):
    """1690 -> '1.690 €', 57.5 -> '57,50 €'"""
    whole, cents = divmod(round(n * 100), 100)
    s = f'{whole:,}'.replace(',', '.')
    return f'{s},{cents:02d} €' if cents else f'{s} €'


def swap(tag, cls, monthly, annual):
    """Elemento cuyo texto cambia con el selector Mensual/Anual (anual por defecto)."""
    return f'<{tag} class="{cls}" data-monthly="{e(monthly)}" data-annual="{e(annual)}">{e(annual)}</{tag}>'


def plan_card(p, cfg, i):
    saving = p['mensual'] * 12 - p['anual']
    featured = 'destacado' in p
    tag = f'<span class="tag tag-accent">{e(p["destacado"])}</span>' if featured else ''
    return f'''<div class="plan{' featured' if featured else ''}" data-reveal="up" data-delay="{i * 90}">
  <div class="plan-top"><span class="plan-name">{e(p['nombre'])}</span>{tag}</div>
  <span class="plan-limit">Hasta {p['ganaderos']} ganaderos gestionados</span>
  <div class="plan-price">{swap('b', 'plan-amount', eur(p['mensual']), eur(p['anual']))}{swap('span', 'plan-per', '/ mes', '/ año')}</div>
  {swap('span', 'plan-save', '', f"{cfg['ahorro_anual']} · ahorras {eur(saving)}")}
  {swap('span', 'plan-note', 'IVA no incluido', f"{eur(p['anual'] / 12)}/mes · IVA no incluido")}
  <a class="btn {'btn-primary' if featured else 'btn-secondary'}" href="/prueba-15-dias?plan={p['id']}">Probar {e(p['nombre'])}{ARROW}</a>
</div>'''


def custom_card(c, i):
    wa = f"https://wa.me/{c['whatsapp']}?text={quote(c['whatsapp_texto'])}"
    return f'''<div class="plan plan-custom" data-reveal="up" data-delay="{i * 90}">
  <div class="plan-top"><span class="plan-name">{e(c['nombre'])}</span></div>
  <span class="plan-limit">Más de {c['desde_ganaderos']} ganaderos gestionados</span>
  <div class="plan-price"><b class="plan-amount">Consultar</b></div>
  <span class="plan-save"></span>
  <span class="plan-note">Precio según el volumen y las necesidades de tu gestoría</span>
  <div class="plan-actions">
    <a class="btn btn-primary" href="/contacto">Pedir presupuesto{ARROW}</a>
    <a class="btn btn-secondary" href="{e(wa)}" target="_blank" rel="noopener">Hablar por WhatsApp<span class="visually-hidden"> (se abre en una pestaña nueva)</span>{ARROW}</a>
  </div>
</div>'''


def render_plans(cfg):
    cards = [plan_card(p, cfg, i) for i, p in enumerate(cfg['planes'])]
    cards.append(custom_card(cfg['a_medida'], len(cards)))
    incl = '\n'.join(f'    <li>{CHECK}{e(t)}</li>' for t in cfg['incluido'])
    return f'''<div class="plans" data-plans>
{chr(10).join(cards)}
</div>
<div class="plans-incl" data-reveal="up">
  <strong>Todos los planes incluyen</strong>
  <ul>
{incl}
  </ul>
</div>'''


def render_services(cfg):
    items = []
    for i, s in enumerate(cfg['servicios']):
        first = i == 0
        label = f'<small>{e(s["etiqueta"])}</small>' if s.get('etiqueta') else ''
        note = ' <em>Precio orientativo: te lo confirmamos antes de contratar.</em>' if s.get('provisional') else ''
        items.append(f'''<div class="acc-item" data-reveal="up">
  <button class="acc-btn" type="button" aria-expanded="{'true' if first else 'false'}" aria-controls="svc-{i}"><span class="name">{e(s['nombre'])}</span><span class="price">{e(s['precio'])}{label}</span><span class="sign" aria-hidden="true">{'−' if first else '+'}</span></button>
  <p class="acc-panel" id="svc-{i}"{'' if first else ' hidden'}>{e(s['detalle'])}{note}</p>
</div>''')
    return '<div class="acc" data-accordion>\n' + '\n'.join(items) + '\n</div>'


def render_plan_options(cfg):
    opts = [f'<option value="{p["id"]}"{" selected" if "destacado" in p else ""}>{e(p["nombre"])} · hasta {p["ganaderos"]} ganaderos</option>' for p in cfg['planes']]
    c = cfg['a_medida']
    opts.append(f'<option value="{c["id"]}">{e(c["nombre"])} · más de {c["desde_ganaderos"]} ganaderos</option>')
    opts.append('<option value="no-se">Aún no lo sé</option>')
    return '\n'.join(opts)


def generated(root: pathlib.Path):
    src = root / '_partials' / 'precios.json'
    if not src.exists():
        return {}
    cfg = json.loads(src.read_text())
    return {
        'plans': render_plans(cfg),
        'services': render_services(cfg),
        'plan-options': render_plan_options(cfg),
    }

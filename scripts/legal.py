"""Genera los bloques HTML de la capa legal a partir de _partials/legal.json.

Fuente única de los datos societarios. Mientras un dato esté vacío en el JSON,
aquí se pinta como [PENDIENTE: etiqueta] resaltado (.pending), para que sea
imposible publicar en real sin rellenarlo.

Lo usa sync-partials.py; no hace falta ejecutarlo por separado.
"""
import html, json, pathlib

e = html.escape


def pendiente(valor, etiqueta):
    """Devuelve el valor o el marcador [PENDIENTE: etiqueta] resaltado en amarillo suave."""
    v = (valor or '').strip()
    return e(v) if v else f'<span class="pending">[PENDIENTE: {e(etiqueta)}]</span>'


def tel(n):
    """+34645562942 -> enlace con el número legible."""
    local = n.replace('+34', '')
    pretty = f'{local[0:3]} {local[3:5]} {local[5:7]} {local[7:9]}'
    return f'<a href="tel:{e(n)}">{e(pretty)}</a>'


def nombre_legal(cfg):
    """Razón social si existe; si no, el marcador."""
    return pendiente(cfg['razonSocial'], 'razón social')


def email_privacidad(cfg):
    return cfg['emailPrivacidad'].strip() or cfg['emailContacto']


def mailto(addr):
    return f'<a href="mailto:{e(addr)}">{e(addr)}</a>'


def render_identidad(cfg):
    """Ficha de identificación del titular (LSSI art. 10). Aviso legal y privacidad."""
    return f'''<dl class="datalist">
  <dt>Razón social</dt><dd>{nombre_legal(cfg)}</dd>
  <dt>NIF / CIF</dt><dd>{pendiente(cfg['nif'], 'NIF')}</dd>
  <dt>Nombre comercial</dt><dd>Ganera</dd>
  <dt>Domicilio</dt><dd>{pendiente(cfg['domicilio'], 'domicilio social')}</dd>
  <dt>Datos registrales</dt><dd>{pendiente(cfg['datosRegistrales'], 'Registro Mercantil, tomo, folio y hoja')}</dd>
  <dt>Correo electrónico</dt><dd>{mailto(cfg['emailContacto'])}</dd>
  <dt>Correo de privacidad</dt><dd>{mailto(email_privacidad(cfg))}</dd>
  <dt>Teléfonos</dt><dd>{' · '.join(tel(t) for t in cfg['telefonos'])}</dd>
  <dt>Dominio</dt><dd>{e(cfg['dominio'])}</dd>
</dl>
<div class="note">
  <p><strong>Sociedad en constitución.</strong> {e(cfg['titularidadActual'])}</p>
</div>'''


def render_fecha(cfg):
    return f'<p class="doc-date">Última actualización: {e(cfg["fechaUltimaActualizacion"])}</p>'


def render_subencargados(cfg):
    rows = []
    for s in cfg['subencargados']:
        rows.append(
            '<tr>'
            f'<td><strong>{e(s["proveedor"])}</strong>'
            + ('<br><small>Responsable independiente</small>' if s.get('responsableIndependiente') else '')
            + '</td>'
            f'<td>{e(s["servicio"])}</td>'
            f'<td>{pendiente(s["ubicacion"], "ubicación de los datos")}</td>'
            f'<td>{e(s["garantia"])}</td>'
            '</tr>'
        )
    return f'''<div class="table-wrap">
  <table>
    <thead><tr><th>Proveedor</th><th>Servicio</th><th>Ubicación de los datos</th><th>Garantía de transferencia</th></tr></thead>
    <tbody>
{chr(10).join('      ' + r for r in rows)}
    </tbody>
  </table>
</div>'''


def render_foot_legal(cfg):
    """Bloque «Legal» del pie, con los siete documentos y el copyright."""
    links = [
        ('/legal/aviso-legal', 'Aviso legal'),
        ('/legal/privacidad', 'Privacidad'),
        ('/legal/cookies', 'Cookies'),
        ('/legal/terminos', 'Condiciones'),
        ('/legal/encargo-tratamiento', 'Encargo del tratamiento'),
        ('/legal/subencargados', 'Subencargados'),
        ('/legal/uso-ia', 'Uso de IA'),
    ]
    titular = cfg['razonSocial'].strip() or 'Ganera'
    year = cfg['fechaUltimaActualizacion'].split()[-1]
    return (
        '<strong>Legal</strong>\n'
        + '\n'.join(f'      <a href="{href}">{e(text)}</a>' for href, text in links)
        + f'\n      <span class="foot-copy">© {e(year)} {e(titular)} · Hecho en Extremadura</span>'
    )


def render_legalnav(cfg):
    links = [
        ('/legal/aviso-legal', 'Aviso legal'),
        ('/legal/privacidad', 'Privacidad'),
        ('/legal/cookies', 'Cookies'),
        ('/legal/terminos', 'Condiciones'),
        ('/legal/encargo-tratamiento', 'Encargo del tratamiento'),
        ('/legal/subencargados', 'Subencargados'),
        ('/legal/uso-ia', 'Uso de IA'),
    ]
    items = '\n'.join(f'  <a href="{href}">{e(text)}</a>' for href, text in links)
    return f'<nav class="subnav subnav-legal" data-reveal="up" aria-label="Páginas legales">\n{items}\n</nav>'


def generated(root: pathlib.Path):
    src = root / '_partials' / 'legal.json'
    if not src.exists():
        return {}
    cfg = json.loads(src.read_text())
    return {
        'legal-identidad': render_identidad(cfg),
        'legal-fecha': render_fecha(cfg),
        'subencargados': render_subencargados(cfg),
        'foot-legal': render_foot_legal(cfg),
        'legalnav': render_legalnav(cfg),
    }

/* Ganera landing — interactions and scroll animations.
   Ported 1:1 from the Claude Design component (reveal-on-scroll, pinned scenes,
   marquee parallax, word-by-word statement, map lighting, pricing toggle, accordions). */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v) => Math.max(0, Math.min(1, v));

  // Animation intensity: 'Marcada' (default) | 'Sutil' | 'Sin animación'.
  // Can be overridden with <html data-motion="Sutil">.
  const mode = document.documentElement.dataset.motion || 'Marcada';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || mode === 'Sin animación';
  const dist = mode === 'Sutil' ? 20 : 56;
  const ease = 'cubic-bezier(0.16,1,0.3,1)';

  /* ── Reveal on scroll ───────────────────────────────── */
  const hide = (el) => {
    const t = el.dataset.reveal;
    if (t === 'rise') el.style.transform = 'translateY(110%)';
    else if (t === 'line') { el.style.transform = 'scaleX(0)'; el.style.transformOrigin = 'left'; }
    else if (t === 'clip') el.style.clipPath = 'inset(100% 0 0 0)';
    else { el.style.opacity = '0'; el.style.transform = `translateY(${dist}px)`; }
  };
  const show = (el) => {
    if (el._shown) return;
    el._shown = true;
    const d = +(el.dataset.delay || 0);
    el.style.transition = `transform 1.1s ${ease} ${d}ms, opacity .9s ${ease} ${d}ms, clip-path 1.3s ${ease} ${d}ms`;
    el.style.opacity = '';
    el.style.transform = '';
    el.style.clipPath = '';
  };

  function initReveal() {
    if (reduce) return;
    const map = new Map();
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = map.get(e.target);
      if (el) show(el);
      io.unobserve(e.target);
    }), { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    $$('[data-reveal]').forEach((el) => {
      if (el.closest('[data-intro]')) {
        hide(el);
        requestAnimationFrame(() => requestAnimationFrame(() => show(el)));
        setTimeout(() => show(el), 1200);
        return;
      }
      const target = (el.dataset.reveal === 'rise' || el.dataset.reveal === 'clip') ? el.parentElement : el;
      if (target.getBoundingClientRect().top > innerHeight * 0.92) {
        hide(el);
        map.set(target, el);
        io.observe(target);
      }
    });
  }

  /* ── Scroll-driven scenes ───────────────────────────── */
  const progress = $('[data-progress]');
  const marquee = $('[data-marquee]');
  const statement = $('[data-statement]');
  const mapSection = $('[data-map-section]');
  const dots = $$('[data-dot]').map((el) => ({ el, lit: false }));
  const appScene = $('[data-app]');
  const appBar = $('[data-app-bar]');
  const rec = $('[data-rec]');

  // Split the statement into words so each one can light up.
  let words = [];
  if (statement) {
    const text = statement.textContent.trim().split(/\s+/);
    statement.textContent = '';
    text.forEach((w) => {
      const s = document.createElement('span');
      s.dataset.w = '1';
      s.textContent = w + ' ';
      statement.appendChild(s);
    });
    words = $$('[data-w]', statement);
  }

  /* App mock: 5 stages (0 idle, 1 WhatsApp arrives, 2 review, 3 approve, 4 sent to OVZ.net).
     The views, states and toasts are styled from the mock's data-stage in site.css. */
  const app = appScene && {
    num: $('[data-app-num]', appScene),
    caps: $$('[data-cap]', appScene),
    mock: $('[data-app-mock]', appScene),
    tram: $('[data-app-c-tram]', appScene),
    bell: $('[data-app-c-bell]', appScene),
  };
  let appStage = -1;
  function renderApp(as) {
    if (!app || as === appStage) return;
    appStage = as;
    const ci = Math.max(0, as - 1);
    app.num.textContent = String(ci + 1).padStart(2, '0');
    app.caps.forEach((c, i) => {
      c.style.opacity = i === ci ? '1' : '0';
      c.style.transform = `translateY(${i === ci ? '0px' : (i < ci ? '-20px' : '20px')})`;
    });
    app.mock.dataset.stage = String(as);
    app.tram.textContent = as >= 1 && as < 3 ? '5' : '4';
    app.bell.textContent = as >= 1 ? '5' : '4';
  }

  /* Recorrido: 5 steps, each with its own panel. */
  const steps = rec ? $$('[data-step]', rec) : [];
  const panels = rec ? $$('[data-panel]', rec) : [];
  const recNums = rec ? $$('[data-rec-num]', rec) : [];
  let recStep = -1;
  function renderRec(step) {
    if (step === recStep) return;
    recStep = step;
    steps.forEach((s, i) => {
      s.classList.toggle('on', i === step);
      s.classList.toggle('is-past', i < step);
    });
    recNums.forEach((n, i) => {
      n.classList.toggle('on', i === step);
      n.classList.toggle('is-past', i < step);
    });
    panels.forEach((p, i) => {
      p.classList.toggle('on', i === step);
      p.classList.toggle('is-past', i < step);
    });
  }

  let litWords = -1;
  function tick() {
    const vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;

    if (marquee && !reduce) {
      marquee.style.transform = `translateX(${(marquee.getBoundingClientRect().top - vh) * 0.45}px)`;
    }

    if (statement && words.length) {
      const r = statement.getBoundingClientRect();
      const p = reduce ? 1 : clamp((vh * 0.8 - r.top) / (r.height + vh * 0.25));
      const n = Math.min(words.length, Math.round(p * words.length * 1.08));
      // Sólo se repinta cuando cambia el número de palabras encendidas, no en cada fotograma.
      if (n !== litWords) {
        litWords = n;
        words.forEach((w, i) => { w.style.color = i < n ? 'var(--color-text)' : 'var(--color-neutral-400)'; });
      }
    }

    if (mapSection && dots.length) {
      const r = mapSection.getBoundingClientRect();
      const p = reduce ? 1 : clamp((vh * 0.85 - r.top) / (r.height * 0.6));
      const n = Math.round(p * dots.length);
      dots.forEach((d, i) => {
        const on = i < n;
        if (on !== d.lit) { d.lit = on; d.el.classList.toggle('lit', on); }
      });
    }

    if (appScene) {
      const r = appScene.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - vh));
      if (appBar) appBar.style.transform = `scaleX(${p})`;
      renderApp(Math.min(4, Math.floor(p * 5)));
    }

    if (rec) {
      const r = rec.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - vh));
      // Drives the vertical rail (desktop) and the horizontal track (mobile).
      rec.style.setProperty('--rec-p', p.toFixed(4));
      renderRec(Math.min(4, Math.floor(p * 5)));
    }
  }

  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; tick(); });
  };

  /* ── Pricing toggle ─────────────────────────────────── */
  function initPricing() {
    // Texts for both billing modes are generated from _partials/precios.json
    // into data-monthly / data-annual; this only swaps them.
    const swaps = $$('[data-plans] [data-monthly]');
    const plans = $('[data-plans]');
    const update = (annual) => {
      swaps.forEach((el) => { el.textContent = annual ? el.dataset.annual : el.dataset.monthly; });
      if (plans) plans.classList.toggle('is-annual', annual);
    };
    $$('input[name="billing"]').forEach((input) => {
      input.addEventListener('change', () => update(input.value === 'annual' && input.checked));
    });
    const checked = $('input[name="billing"]:checked');
    update(!checked || checked.value === 'annual');
  }

  /* ── Accordions: one open at a time, click again to close ─ */
  function initAccordions() {
    $$('[data-accordion]').forEach((acc) => {
      const buttons = $$('.acc-btn', acc);
      buttons.forEach((btn) => btn.addEventListener('click', () => {
        const opening = btn.getAttribute('aria-expanded') !== 'true';
        buttons.forEach((b) => {
          const open = b === btn && opening;
          b.setAttribute('aria-expanded', String(open));
          $('.sign', b).textContent = open ? '−' : '+';
          document.getElementById(b.getAttribute('aria-controls')).hidden = !open;
        });
      }));
    });
  }

  /* ── Mobile menu ────────────────────────────────────── */
  function initMenu() {
    const btn = $('[data-menu-btn]');
    const menu = $('[data-menu]');
    if (!btn || !menu) return;
    const set = (open) => {
      document.body.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    };
    const abierto = () => btn.getAttribute('aria-expanded') === 'true';
    btn.addEventListener('click', () => {
      const abrir = !abierto();
      set(abrir);
      // Con teclado, el foco entra en el menú al abrirlo (el menú es visibility:hidden
      // cerrado, así que hay que esperar a la transición para poder enfocarlo).
      if (abrir) setTimeout(() => { const a = $('a', menu); if (a) a.focus({ preventScroll: true }); }, 60);
    });
    $$('a', menu).forEach((a) => a.addEventListener('click', () => set(false)));
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !abierto()) return;
      set(false);
      btn.focus();
    });
    matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) set(false); });
  }

  /* ── Current page in menus ─────────────────────────── */
  function initCurrent() {
    const clean = (path) => path.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/$/, '') || '/';
    const here = clean(location.pathname);
    $$('.main-nav a, .mnav nav a, .foot-links a, .subnav a').forEach((a) => {
      const url = new URL(a.getAttribute('href'), location.href);
      if (url.hash || url.origin !== location.origin) return;
      const target = clean(url.pathname);
      const exact = target === here;
      // In the main menus, a section stays highlighted on its subpages (Nosotros → Equipo).
      const section = target !== '/' && here.startsWith(target + '/') && !a.closest('.subnav, .foot-links');
      if (exact || section) a.setAttribute('aria-current', 'page');
    });
  }

  /* ── Forms (trial request, contact) ─────────────────── */
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function initForms() {
    $$('form[data-endpoint]').forEach((form) => {
      const status = $('[data-status]', form);
      const plan = new URLSearchParams(location.search).get('plan');
      if (plan && form.plan && form.plan.querySelector(`option[value="${CSS.escape(plan)}"]`)) form.plan.value = plan;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        status.className = 'form-status';
        const invalid = $$('[required]', form).find((el) => !el.value.trim() || (el.type === 'email' && !EMAIL.test(el.value.trim())));
        if (invalid) {
          status.classList.add('err');
          status.textContent = form.dataset.invalid;
          invalid.focus();
          return;
        }
        const btn = $('button[type="submit"]', form);
        btn.disabled = true;
        status.textContent = 'Enviando…';
        try {
          const res = await fetch(form.dataset.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(form))),
          });
          if (!res.ok) {
            // El servidor explica en español qué ha pasado (datos que faltan, demasiados envíos…).
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || '');
          }
          form.reset();
          status.classList.add('ok');
          status.textContent = form.dataset.success;
        } catch (err) {
          status.classList.add('err');
          status.textContent = (err && err.message)
            || 'No se ha podido enviar. Escríbenos a agroganera@gmail.com o llámanos al 645 56 29 42.';
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  /* ── Newsletter ─────────────────────────────────────── */
  function initNewsletter() {
    const form = $('[data-newsletter]');
    if (!form) return;
    const status = $('[data-nl-status]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = 'Escribe un email válido.';
        form.email.focus();
        return;
      }
      // El consentimiento es obligatorio y nunca viene premarcado (LOPDGDD art. 6).
      if (form.consent && !form.consent.checked) {
        status.textContent = 'Marca la casilla para aceptar recibir el boletín.';
        form.consent.focus();
        return;
      }
      status.textContent = 'Enviando…';
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, consent: form.consent ? form.consent.checked : undefined }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '');
        }
        status.textContent = 'Listo. Te escribiremos una vez al mes.';
        form.reset();
      } catch (err) {
        status.textContent = (err && err.message)
          || 'No se ha podido enviar. Prueba de nuevo o escríbenos a agroganera@gmail.com.';
      }
    });
  }

  /* ── Aviso de cookies ───────────────────────────────── */
  // La web no instala cookies. Este aviso es solo informativo: al cerrarlo
  // guardamos la decisión en localStorage (único dato que almacenamos).
  function initCookieNotice() {
    const KEY = 'ganera-cookie-notice';
    let done = false;
    try { done = localStorage.getItem(KEY) === 'ok'; } catch { done = false; }
    if (done) return;

    const el = document.createElement('aside');
    el.className = 'cookie-notice';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Aviso de cookies');
    el.innerHTML =
      '<p>Esta web no usa ninguna cookie ni rastrea tu navegación. Lo único que guardamos es, en tu propio navegador, que has cerrado este aviso. <a href="/legal/cookies">Política de cookies</a>.</p>' +
      '<button class="btn btn-primary" type="button">Entendido</button>';
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));

    el.querySelector('button').addEventListener('click', () => {
      try { localStorage.setItem(KEY, 'ok'); } catch {}
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 500);
    });
  }

  /* ── Checkout de Stripe ─────────────────────────────── */
  // Mejora progresiva: los CTA de los planes son enlaces normales a
  // /prueba-15-dias. Solo si /api/config responde checkoutEnabled:true los
  // convertimos en botones que abren el pago. Con CHECKOUT_ENABLED=false (o si
  // la petición falla) el embudo actual se queda exactamente como está.
  let configPromise = null;
  const publicConfig = () => {
    if (!configPromise) {
      configPromise = fetch('/api/config')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    return configPromise;
  };

  function initCheckout() {
    const plans = $('[data-plans]');
    if (!plans) return;
    const ctasPrueba = $$('a[href*="/prueba-15-dias?plan="]', plans);
    const ctasCompra = $$('[data-comprar]', plans);
    if (!ctasPrueba.length && !ctasCompra.length) return;

    publicConfig().then((cfg) => {
      if (!cfg || !cfg.checkoutEnabled) return;
      const dias = cfg.trialDays || 15;

      // Aviso sobre los botones: la prueba sí pide tarjeta.
      const note = document.createElement('p');
      note.className = 'plans-card-note';
      note.dataset.checkoutNote = '1';
      note.textContent = `${dias} días de prueba. Se solicita tarjeta, pero no se cobra nada hasta el día ${dias + 1}. `
        + 'Cancela cuando quieras. Si ya conoces Ganera, puedes contratar directamente y empezar hoy. Precios sin IVA.';
      plans.parentNode.insertBefore(note, plans);

      // Los errores van en una línea compartida encima de la tabla: cada .plan
      // es un subgrid de 6 filas y meterle un hijo más descuadraría las tarjetas.
      const err = document.createElement('p');
      err.className = 'checkout-err';
      err.setAttribute('role', 'status');
      err.hidden = true;
      plans.parentNode.insertBefore(err, plans);
      const showErr = (msg) => {
        err.textContent = msg;
        err.hidden = false;
        err.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      };

      const periodo = () => {
        const checked = $('input[name="billing"]:checked');
        return !checked || checked.value === 'annual' ? 'anual' : 'mensual';
      };

      /** Pide la sesión de pago y redirige. conPrueba=false es compra directa. */
      const abrirPago = (btn, plan, conPrueba) => {
        const etiqueta = btn.innerHTML;
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (btn.dataset.busy) return;
          btn.dataset.busy = '1';
          err.hidden = true;
          btn.setAttribute('aria-busy', 'true');
          btn.innerHTML = 'Abriendo el pago…';
          try {
            const res = await fetch('/api/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan, periodo: periodo(), prueba: conPrueba }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.url) throw new Error(data.error || 'error');
            location.href = data.url;
            return;
          } catch (e2) {
            showErr((e2 && e2.message !== 'error' && e2.message)
              || 'No se ha podido abrir el pago. Inténtalo de nuevo o escríbenos a agroganera@gmail.com.');
          }
          btn.innerHTML = etiqueta;
          btn.removeAttribute('aria-busy');
          delete btn.dataset.busy;
        });
      };

      ctasPrueba.forEach((cta) => {
        const plan = new URL(cta.href, location.href).searchParams.get('plan');
        if (plan) abrirPago(cta, plan, true);
      });

      // La compra directa sólo existe si se puede cobrar: hasta aquí iba oculta.
      ctasCompra.forEach((btn) => {
        btn.hidden = false;
        abrirPago(btn, btn.dataset.comprar, false);
      });
    });
  }

  /* ── Página /gracias ────────────────────────────────── */
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fechaLarga = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  };

  function initGracias() {
    const root = $('[data-gracias]');
    if (!root) return;
    const view = (name) => $$('[data-view]', root).forEach((el) => { el.hidden = el.dataset.view !== name; });
    const sid = new URLSearchParams(location.search).get('session_id');

    // El botón «Entrar en Ganera» apunta a APP_LOGIN_URL en las dos vistas,
    // así que se fija en cuanto llega la configuración, haya sesión o no.
    const setLogin = (url, email) => $$('[data-login]', root).forEach((el) => {
      el.href = email ? `${url}?email=${encodeURIComponent(email)}` : url;
    });
    const loginUrl = (cfg) => (cfg && cfg.appLoginUrl) || 'https://app.ganera.es/login';
    publicConfig().then((cfg) => setLogin(loginUrl(cfg)));

    if (!sid) { view('error'); return; }
    view('loading');

    Promise.all([
      fetch(`/api/checkout-session?session_id=${encodeURIComponent(sid)}`).then((r) => (r.ok ? r.json() : Promise.reject(r))),
      publicConfig(),
    ]).then(([data, cfg]) => {
      const set = (key, value) => $$(`[data-field="${key}"]`, root).forEach((el) => { el.textContent = value; });
      set('plan', data.planNombre || 'tu plan');
      set('email', data.email || 'tu correo');
      set('periodo', data.periodo === 'mensual' ? 'Facturación mensual' : 'Facturación anual');
      const fin = data.trialEnd && fechaLarga(data.trialEnd);
      // Sin trialEnd es una contratación directa: el texto no puede hablar de prueba.
      set('estado', fin ? 'Tu prueba de 15 días ya está activa.' : 'Tu suscripción ya está activa.');
      set('recordatorio', fin
        ? 'Puedes cancelar antes de que termine la prueba y no se te cobrará nada.'
        : 'Puedes cancelar cuando quieras; el servicio sigue activo hasta el final del periodo que has pagado.');
      $$('[data-trial-end]', root).forEach((el) => {
        el.hidden = !fin;
        if (fin) $('[data-field="trialEnd"]', el).textContent = fin;
      });
      setLogin(loginUrl(cfg), data.email);
      view('ok');
    }).catch(() => view('error'));
  }

  initReveal();
  initPricing();
  initAccordions();
  initNewsletter();
  initMenu();
  initCurrent();
  initForms();
  initCookieNotice();
  initCheckout();
  initGracias();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  tick();
})();

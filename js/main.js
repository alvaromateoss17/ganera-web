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
  const litCountEl = $('[data-lit-count]');
  const dots = $$('[data-dot]').map((el) => ({ el, s: el.dataset.dot, lit: false }));
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

  /* App mock: 5 stages (0 idle, 1 WhatsApp arrives, 2 review, 3 approve, 4 submitted). */
  const app = appScene && {
    num: $('[data-app-num]', appScene),
    caps: $$('[data-cap]', appScene),
    count: $('[data-app-count]', appScene),
    row: $('[data-app-row]', appScene),
    pill: $('[data-app-pill]', appScene),
    mpill: $('[data-app-mpill]', appScene),
    toast: $('[data-app-toast]', appScene),
    overlay: $('[data-app-overlay]', appScene),
    modal: $('[data-app-modal]', appScene),
    btn: $('[data-app-btn]', appScene),
    done: $('[data-app-done]', appScene),
  };
  const setPill = (el, ok, label) => {
    el.textContent = label;
    el.classList.toggle('pill-ok', ok);
    el.classList.toggle('pill-pend', !ok);
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
    app.count.textContent = as >= 1 ? '129 trámites' : '128 trámites';
    app.row.style.height = as >= 1 ? '39px' : '0px';
    app.row.style.background = as === 1 ? '#FFF4DE' : '#ffffff';
    setPill(app.pill, as >= 4, as >= 4 ? 'Ejecutado' : 'Pendiente de revisión');
    setPill(app.mpill, as >= 3, as >= 3 ? 'Aprobado' : 'Pendiente de revisión');
    app.toast.style.opacity = as === 1 ? '1' : '0';
    app.toast.style.transform = `translateY(${as === 1 ? '0px' : '-12px'})`;
    const modalOn = as === 2 || as === 3;
    app.overlay.style.opacity = modalOn ? '1' : '0';
    app.modal.style.opacity = modalOn ? '1' : '0';
    app.modal.style.transform = `translate(-50%, -50%) scale(${modalOn ? 1 : 0.94})`;
    app.btn.style.transform = `scale(${as === 3 ? 0.94 : 1})`;
    app.btn.style.boxShadow = as === 3 ? '0 0 0 4px rgba(31,61,43,.25)' : 'none';
    app.done.style.opacity = as >= 4 ? '1' : '0';
    app.done.style.transform = `translate(-50%, ${as >= 4 ? '0px' : '16px'})`;
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

  let litCount = -1;
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
      const n = Math.round(p * words.length * 1.08);
      words.forEach((w, i) => { w.style.color = i < n ? 'var(--color-text)' : 'var(--color-neutral-400)'; });
    }

    if (mapSection && dots.length) {
      const r = mapSection.getBoundingClientRect();
      const p = reduce ? 1 : clamp((vh * 0.85 - r.top) / (r.height * 0.6));
      const n = Math.round(p * dots.length);
      let lit = 0;
      dots.forEach((d, i) => {
        const on = i < n;
        if (on && d.s !== 'p') lit++;
        if (on !== d.lit) { d.lit = on; d.el.classList.toggle('lit', on); }
      });
      if (lit !== litCount) { litCount = lit; litCountEl.textContent = String(lit); }
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
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => set(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
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
          if (!res.ok) throw new Error(String(res.status));
          form.reset();
          status.classList.add('ok');
          status.textContent = form.dataset.success;
        } catch {
          status.classList.add('err');
          status.textContent = 'No se ha podido enviar. Escríbenos a agroganera@gmail.com o llámanos al 645 56 29 42.';
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
      status.textContent = 'Enviando…';
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error(String(res.status));
        status.textContent = 'Listo. Te escribiremos una vez al mes.';
        form.reset();
      } catch {
        status.textContent = 'No se ha podido enviar. Prueba de nuevo o escríbenos a agroganera@gmail.com.';
      }
    });
  }

  initReveal();
  initPricing();
  initAccordions();
  initNewsletter();
  initMenu();
  initCurrent();
  initForms();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  tick();
})();

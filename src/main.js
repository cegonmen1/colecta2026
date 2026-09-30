(() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = 'cubic-bezier(.2,.7,.2,1)';

  // Modal de registro Luma: el iframe solo se carga al abrir (no penaliza la carga inicial)
  const modal = document.getElementById('luma');
  const frame = modal.querySelector('iframe');
  let lastFocus = null;
  const setLuma = open => {
    if (open) {
      if (!frame.src) frame.src = frame.dataset.src;
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      modal.querySelector('[data-close]').focus();
    } else {
      modal.hidden = true;
      document.documentElement.style.overflow = '';
      lastFocus && lastFocus.focus();
    }
  };
  $$('a[data-luma]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setLuma(true);
  }));
  modal.addEventListener('click', e => { if (!e.target.closest('[data-stop]') || e.target.closest('[data-close]')) setLuma(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) setLuma(false); });

  // Scroll: nav fija, barra de progreso, lista "lit" y parallax
  const nav = document.getElementById('nav');
  const bar = document.getElementById('progress');
  const lit = $$('[data-lit]');
  const para = $$('[data-parallax]').map(el => ({ el, k: parseFloat(el.dataset.parallax), box: el.closest('section') || el.parentElement }));
  let raf = 0, navOn = null;
  const tick = () => {
    raf = 0;
    const y = scrollY, vh = innerHeight, max = document.documentElement.scrollHeight - vh;
    const on = y > vh * 0.7;
    if (on !== navOn) { navOn = on; nav.classList.toggle('on', on); }
    bar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    if (reduce) return;
    for (const el of lit) {
      const b = el.getBoundingClientRect();
      if (b.bottom < -100 || b.top > vh + 100) continue;
      const t = Math.min(1, Math.max(0, 1 - Math.abs(b.top + b.height / 2 - vh * 0.55) / (vh * 0.32)));
      el.firstElementChild.style.opacity = (0.4 + 0.6 * t).toFixed(3);
      el.lastElementChild.style.opacity = (0.2 + 0.8 * t).toFixed(3);
      el.lastElementChild.style.translate = `${((1 - t) * 18).toFixed(1)}px 0`;
    }
    for (const p of para) {
      const box = p.box.getBoundingClientRect();
      if (box.bottom < -200 || box.top > vh + 200) continue;
      p.el.style.translate = `0 ${(-(box.top + box.height / 2 - vh / 2) * p.k).toFixed(1)}px`;
    }
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  const typed = $$('[data-typed]');
  if (reduce) { typed.forEach(el => { el.textContent = el.dataset.typed; }); return; }

  // Revelado al hacer scroll (con escalonado entre hermanos)
  const sel = 'section:not(#top) :is(h2,h3,p,blockquote,[data-reveal])';
  const els = $$(sel).filter(el => !el.parentElement.closest(sel));
  const set = new Set(els);
  const anims = new Map();
  els.forEach(el => {
    const i = [...el.parentElement.children].filter(s => set.has(s)).indexOf(el);
    const a = el.animate([{ opacity: 0, translate: '0 36px' }, { opacity: 1, translate: '0 0' }],
      { duration: 1000, delay: Math.min(i, 6) * 90, easing: ease, fill: 'both' });
    a.pause(); a.currentTime = 0; anims.set(el, a);
  });
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    anims.get(e.target).play(); io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  els.forEach(el => io.observe(el));

  // Contador de la meta
  const cio = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, t0 = performance.now();
    const step = now => { const p = Math.min(1, (now - t0) / 1800); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  $$('[data-count]').forEach(el => cio.observe(el));

  // Checks de la agenda en bucle
  const checks = $$('[data-check]');
  if (checks.length) {
    const step = 750, hold = 2400, out = 700, T = checks.length * step + hold + out, r = (T - out) / T;
    checks.forEach((dot, i) => {
      const s = (i * step + 150) / T, f = s + 260 / T;
      dot.animate([
        { background: '#0a120e', scale: 1, offset: 0 }, { background: '#0a120e', scale: 1, offset: s },
        { background: '#F2C94C', scale: 1.25, offset: (s + f) / 2 }, { background: '#F2C94C', scale: 1, offset: f },
        { background: '#F2C94C', scale: 1, offset: r }, { background: '#0a120e', scale: 1, offset: 1 }
      ], { duration: T, iterations: Infinity, easing: 'linear' });
      dot.querySelector('path').animate([
        { strokeDashoffset: 12, offset: 0 }, { strokeDashoffset: 12, offset: s + 80 / T },
        { strokeDashoffset: 0, offset: f + 120 / T }, { strokeDashoffset: 0, offset: r },
        { strokeDashoffset: 12, offset: 1 }
      ], { duration: T, iterations: Infinity });
    });
  }

  // Máquina de escribir: arranca solo cuando la frase entra en pantalla
  if (!typed.length) return;
  const tio = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    tio.disconnect();
    startTyping(typed);
  }, { threshold: 0.3 });
  tio.observe(typed[0].closest('p'));

  function startTyping(lines) {
    const caret = document.createElement('span');
    caret.style.cssText = 'display:inline-block;width:.06em;height:.82em;margin-left:.06em;vertical-align:-.04em;background:#B11226;';
    caret.animate([{ opacity: 1 }, { opacity: 1, offset: .5 }, { opacity: 0, offset: .51 }, { opacity: 0 }], { duration: 900, iterations: Infinity });
    const txt = lines.map(el => { const t = document.createTextNode(''); el.append(t); return t; });
    const wait = ms => new Promise(res => setTimeout(res, ms));
    (async () => {
      for (;;) {
        for (let i = 0; i < lines.length; i++) {
          lines[i].append(caret);
          const full = lines[i].dataset.typed;
          for (let k = 1; k <= full.length; k++) { txt[i].data = full.slice(0, k); await wait(full[k - 1] === ' ' ? 40 : 55 + Math.random() * 45); }
          await wait(i < lines.length - 1 ? 420 : 2800);
        }
        for (let i = lines.length - 1; i >= 0; i--) {
          lines[i].append(caret);
          while (txt[i].data.length) { txt[i].data = txt[i].data.slice(0, -1); await wait(22); }
          await wait(160);
        }
        await wait(700);
      }
    })();
  }
})();

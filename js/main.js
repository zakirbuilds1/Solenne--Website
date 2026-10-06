// Film chapters. t0/t1 are seconds in video/solenne.mp4; `scroll` is
// viewport-heights of scrolling per chapter; `linger` slows the camera
// mid-chapter while the copy is up; `level` drives the counter + rail.
const FILM = {
  film: 'video/solenne.mp4',
  filmMobile: 'video/solenne-m.mp4',
  filmPortrait: 'video/solenne-p.mp4',
  topLevel: 48,
  chapters: [
    { id: "street",    t0: 0,     t1: 2.2,   scroll: 1.5, linger: 0.3,  level: [0, 0],   levelText: "G", levelLabel: "Street level" },
    { id: "arrival",   t0: 2.2,   t1: 9.58,  scroll: 3.2, linger: 0.15, level: [0, 0],   levelText: "G", levelLabel: "Ground floor · Arrival" },
    { id: "ascent",    t0: 9.58,  t1: 9.92,  scroll: 1.6, lift: true, hold: [0.3, 0.7], level: [1, 48], levelLabel: "Private lift" },
    { id: "penthouse", t0: 9.92,  t1: 19.35, scroll: 3.8, linger: 0.15, level: [48, 48], levelLabel: "The Penthouse" },
    { id: "terrace",   t0: 19.35, t1: 22.55, scroll: 1.8, linger: 0,    level: [48, 48], levelLabel: "Private sky terrace" },
    { id: "skyline",   t0: 22.55, t1: 24.35, scroll: 2.0, linger: 0,    level: [48, 48], levelLabel: "Above it all" }
  ]
};

// ---- text splitting for the reveal animations (before anything is observed) ----
// headlines rise line by line: each <br>-separated line gets its own mask
document.querySelectorAll('.chapter__title, .h2').forEach(el => {
  el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i)
    .map((part, i) => `<span class="ln" style="--l:${i}"><span class="ln__i">${part.trim()}</span></span>`).join('');
});
// the architecture quote appears word by word
document.querySelectorAll('.quote blockquote').forEach(q => {
  q.innerHTML = q.textContent.trim().split(/\s+/)
    .map((w, i) => `<span class="w" style="--w:${i}">${w}</span>`).join(' ');
});
// stagger index for list-like groups
document.querySelectorAll('.stats, .amen-list, .dist, .form, .footer__grid, .contact-lines').forEach(g =>
  [...g.children].forEach((c, i) => c.style.setProperty('--i', i)));
document.querySelectorAll('.residences .res, .gallery figure').forEach((c, i, all) =>
  c.style.setProperty('--i', [...c.parentElement.children].indexOf(c)));

mountFilm(document.getElementById('film'), FILM);

// header: solid after the film
const header = document.querySelector('.header');
const film = document.getElementById('film');
const onScroll = () => header.classList.toggle('is-solid', scrollY > film.offsetTop + film.offsetHeight - innerHeight - 40);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// mobile drawer
const menuBtn = document.querySelector('.menu-btn');
const drawer = document.querySelector('.drawer');
const setMenu = open => { document.body.classList.toggle('menu-open', open); menuBtn.setAttribute('aria-expanded', open); drawer.setAttribute('aria-hidden', !open); };
menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));

// ---- reveal on scroll (root: document keeps rootMargin working inside iframes/previews) ----
const reveal = el => {
  if (el.classList.contains('is-in')) return;
  el.classList.add('is-in'); io.unobserve(el);
  el.dispatchEvent(new CustomEvent('reveal'));
};
const onReveal = es => es.forEach(e => { if (e.isIntersecting) reveal(e.target); });
let io;
try { io = new IntersectionObserver(onReveal, { root: document, rootMargin: '0px 0px -8% 0px' }); }
catch (e) { io = new IntersectionObserver(onReveal, { rootMargin: '0px 0px -8% 0px' }); }
document.querySelectorAll('.rv').forEach(el => io.observe(el));
// safety net for big jumps (End key, menu links): when scrolling settles, reveal
// anything already on or above the screen
let revealT;
addEventListener('scroll', () => {
  clearTimeout(revealT);
  revealT = setTimeout(() => document.querySelectorAll('.rv:not(.is-in)').forEach(el => {
    if (el.getBoundingClientRect().top < innerHeight) reveal(el);
  }), 150);
}, { passive: true });

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// stats count up once they are revealed: 48, 126, 3.4 m, 2,400 m²
document.querySelectorAll('.stats').forEach(stats => stats.addEventListener('reveal', () => {
  stats.querySelectorAll('.stat b').forEach((b, k) => {
    const m = b.innerHTML.match(/^([\d,.]+)([\s\S]*)$/); if (!m || still) return;
    const end = parseFloat(m[1].replace(/,/g, '')), dec = (m[1].split('.')[1] || '').length, comma = m[1].includes(',');
    const fmt = v => { const s = v.toFixed(dec); return comma ? Number(s).toLocaleString('en-US') : s; };
    const t0 = performance.now() + 250 + k * 120, dur = 1700;
    b.innerHTML = fmt(0) + m[2];
    const step = now => {
      const x = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - x, 4);
      b.innerHTML = fmt(end * e) + m[2];
      if (x < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}, { once: true }));

// location map: roads draw in, the river flows, the pin pulses
document.querySelectorAll('.map svg').forEach(svg => {
  svg.querySelectorAll(':scope > path[stroke], :scope > line[stroke]').forEach((p, i) => { p.setAttribute('pathLength', '1'); p.classList.add('map-draw'); p.style.setProperty('--d', i); });
});

// blurred placeholders fade into the real image once it has loaded
document.querySelectorAll('.lqip img').forEach(img => {
  const done = () => img.classList.add('is-loaded');
  if (img.complete && img.naturalWidth) done(); else img.addEventListener('load', done, { once: true });
});

// residence cards: switch between the 3D cutaway and the floor plan
document.querySelectorAll('.res__media').forEach(media => {
  const btns = media.querySelectorAll('.res__view');
  btns.forEach(btn => btn.addEventListener('click', () => {
    const plan = btn.dataset.view === 'plan';
    media.classList.toggle('is-plan', plan);
    btns.forEach(b => { const on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    media.querySelector('.res__plan').setAttribute('aria-hidden', !plan);
  }));
});

// liquid-glass cards: the specular highlight follows the pointer and the mirror
// rim's reflection turns with it (mouse only)
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.glass').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      card.style.setProperty('--rim', (Math.atan2(y - 0.5, x - 0.5) * 180 / Math.PI + 90).toFixed(1) + 'deg');
    });
    card.addEventListener('pointerleave', () => ['--mx', '--my', '--rim'].forEach(p => card.style.removeProperty(p)));
  });
}

// booking form (front-end only: connect to your CRM / form service to receive leads)
const form = document.querySelector('.form');
form.addEventListener('submit', e => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  form.classList.add('is-sent');
  form.querySelector('button[type=submit]').disabled = true;
});

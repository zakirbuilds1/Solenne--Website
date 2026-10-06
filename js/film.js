/* ==========================================================================
   Solenne — scroll-scrubbed film engine
   One continuous camera take (all legs pre-joined into a single MP4). Scroll
   position drives video.currentTime; chapters carry copy, the level counter,
   the altitude rail and timed callouts.

   Techniques (from the scroll-world pipeline):
   - the film is fetched as a Blob and played from an object URL, so it is
     always fully seekable even on hosts without HTTP range support;
   - seeks are coalesced (never issued while the decoder is still seeking),
     which keeps fast flicks smooth on phones;
   - the poster still stays up until the video has painted a real frame
     (iOS paints nothing for a muted, never-played video otherwise);
   - prefers-reduced-motion skips the video and cross-fades chapter stills.
   ========================================================================== */

(function () {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  // Monotone remap so the camera settles mid-chapter (while the copy peaks)
  // and moves quicker toward the seams. f(0)=0, f(1)=1 for any L.
  const linger = (x, L) => { const c = x - 0.5; return (1 - L) * x + L * (4 * c * c * c + 0.5); };
  const pad2 = n => String(Math.round(n)).padStart(2, '0');

  function mountFilm(root, cfg) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
    const isMobile = () => coarse || innerWidth <= 860;

    const video = root.querySelector('.film__video');
    const copies = [...root.querySelectorAll('.chapter')];
    const callouts = [...root.querySelectorAll('.callout')];
    const levelNum = root.querySelector('[data-level-num]');
    const levelLbl = root.querySelector('[data-level-label]');
    const railMark = root.querySelector('.rail__marker');
    const tlFill = root.querySelector('.timeline__fill');
    const tlStops = [...root.querySelectorAll('.timeline__stop')];
    const hint = root.querySelector('.film__hint');
    const stills = [...root.querySelectorAll('.film__still')];
    if (reduce) stills.forEach(s => { if (s.dataset.src) s.src = s.dataset.src; });   // fallback stills: reduced motion only
    const lift = root.querySelector('.lift');
    const liftNum = root.querySelector('[data-lift-num]');
    const levelBox = root.querySelector('.level');

    const CH = cfg.chapters;
    const total = CH.reduce((a, c) => a + c.scroll, 0);
    // chapter scroll bands in 0..1 of the film's scroll length
    let acc = 0;
    CH.forEach(c => { c.p0 = acc / total; acc += c.scroll; c.p1 = acc / total; });

    let vh = innerHeight, laidW = innerWidth, top = 0, len = 1;
    let target = 0, cur = 0, ready = false, painted = false, ticking = false, activeCh = -1;

    function layout() {
      vh = innerHeight; laidW = innerWidth;
      root.style.height = (total * vh + vh) + 'px';
      top = root.getBoundingClientRect().top + scrollY;
      len = Math.max(1, root.offsetHeight - vh);
      read();
    }

    // progress (0..1 through the film) → film time in seconds
    function timeAt(p) {
      for (let i = 0; i < CH.length; i++) {
        const c = CH[i];
        if (p <= c.p1 || i === CH.length - 1) {
          let x = clamp((p - c.p0) / (c.p1 - c.p0));
          if (c.linger) x = linger(x, c.linger);
          // hold: the video only advances inside [h0, h1] of the chapter (the lift
          // doors are shut there, hiding the change of scene)
          if (c.hold) x = clamp((x - c.hold[0]) / (c.hold[1] - c.hold[0]));
          return c.t0 + (c.t1 - c.t0) * x;
        }
      }
      return 0;
    }

    function read() {
      ticking = false;
      const p = clamp((scrollY - top) / len);
      target = timeAt(p);

      // which chapter, and progress inside it
      let ci = 0;
      for (let i = 0; i < CH.length; i++) if (p >= CH[i].p0) ci = i;
      const c = CH[ci];
      const cp = clamp((p - c.p0) / (c.p1 - c.p0));
      const lp = c.hold ? clamp((cp - c.hold[0]) / (c.hold[1] - c.hold[0])) : cp;   // level progress

      // lift doors: close over the first 30% of the lift chapter, stay shut, open over the last 30%
      let shut = 0;
      CH.forEach((k, i) => {
        if (!k.lift) return;
        const q = (p - k.p0) / (k.p1 - k.p0);
        shut = (q <= 0 || q >= 1) ? 0 : q < 0.3 ? smooth(q / 0.3) : q > 0.7 ? smooth((1 - q) / 0.3) : 1;
        k._shut = shut;
      });
      if (lift) {
        lift.style.setProperty('--shut', shut.toFixed(4));
        lift.classList.toggle('is-active', shut > 0.001);
      }
      if (levelBox) levelBox.style.opacity = (1 - shut).toFixed(3);

      // copy: first greets on landing, last holds to the end, others peak mid-chapter
      copies.forEach((el, i) => {
        const k = CH[i];
        const q = (p - k.p0) / (k.p1 - k.p0);
        let o;
        if (i === 0) o = smooth(1 - (q - 0.35) / 0.4);
        else if (i === CH.length - 1) o = smooth((q - 0.25) / 0.3);
        else o = smooth(1 - Math.abs(q - 0.5) / 0.42);
        if (q < 0 && i !== 0) o = 0;
        if (q > 1 && i !== CH.length - 1) o = 0;
        if (k.lift) o = smooth((k._shut - 0.82) / 0.18);   // lift copy lives on the shut doors
        el.style.opacity = o.toFixed(3);
        el.classList.toggle('is-shown', o > 0.35);   // headline lines rise as the chapter appears
        el.style.transform = reduce ? 'none' : `translate3d(0, ${((0.5 - clamp(q)) * 5).toFixed(2)}vh, 0)`;
        el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
        el.toggleAttribute('aria-hidden', o < 0.5);
      });

      // level counter: interpolate across the chapter's [from, to] levels
      const lv = c.level[0] + (c.level[1] - c.level[0]) * smooth(lp);
      if (levelNum) {
        levelNum.textContent = c.levelText || pad2(lv);
        levelLbl.textContent = c.levelLabel;
      }
      if (liftNum && c.lift) liftNum.textContent = pad2(lv);

      // altitude rail: marker height follows the interpolated level
      if (railMark) {
        const h = clamp(lv / cfg.topLevel);
        railMark.parentElement.style.setProperty('--h', h.toFixed(4));   // marker + fill read --h
      }

      // timeline
      if (tlFill) tlFill.style.transform = `scaleX(${p.toFixed(4)})`;
      tlStops.forEach((s, i) => s.classList.toggle('is-past', p >= CH[i].p0));

      // callouts: shown while the film is between data-t0 and data-t1 (seconds)
      callouts.forEach(el => {
        const a = +el.dataset.t0, b = +el.dataset.t1;
        const q = (target - a) / (b - a);
        const o = (q < 0 || q > 1) ? 0 : smooth(Math.min(q / 0.2, (1 - q) / 0.2));
        el.style.opacity = o.toFixed(3);
        el.classList.toggle('is-on', o > 0.6);
      });

      if (ci !== activeCh) {
        activeCh = ci;
        root.dataset.chapter = c.id;
      }
      if (hint) hint.style.opacity = clamp(1 - (scrollY - top) / (0.35 * vh)).toFixed(3);

      // reduced motion: cross-fade per-chapter stills instead of scrubbing
      if (reduce) stills.forEach((s, i) => s.style.opacity = i === ci ? 1 : 0);
    }

    // Eased follow, frame-rate independent. A short time constant keeps the camera
    // tight to the scroll (no drifting on after the wheel stops) while still
    // smoothing the 100px jumps of a mouse wheel.
    let lastT = performance.now();
    function tick(now) {
      now = now || performance.now();
      const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      if (ready && !video.seeking) {
        cur += (target - cur) * (1 - Math.exp(-dt / (isMobile() ? 0.05 : 0.065)));
        if (Math.abs(target - cur) < 0.0005) cur = target;
        const dur = video.duration || 1;
        const t = clamp(cur, 0, dur - 0.04);
        const eps = isMobile() ? 1 / 30 : 1 / 60;
        if (Math.abs(video.currentTime - t) > eps) { try { video.currentTime = t; } catch (e) {} }
      }
      requestAnimationFrame(tick);
    }

    // ---- load the film as a blob, with progress for the preloader ----
    const pre = document.querySelector('.preloader');
    const preBar = pre && pre.querySelector('.preloader__bar i');
    const prePct = pre && pre.querySelector('.preloader__pct');
    // Opening sequence: the preloader is a pair of lift doors. Once the film is ready
    // (and the logo has had time to draw) they slide apart onto the hero, which
    // settles from a slight zoom while the header and headline rise in.
    const html = document.documentElement, T0 = performance.now(), MIN_INTRO = reduce ? 0 : 1900;
    let opened = false;
    const done = () => {
      if (opened) return; opened = true;
      setTimeout(() => {
        html.classList.remove('is-loading');
        if (reduce || !pre) { if (pre) pre.classList.add('is-done'); html.classList.remove('intro'); return; }
        pre.classList.add('is-opening'); html.classList.add('intro-go');
        setTimeout(() => pre.classList.add('is-done'), 2300);
        setTimeout(() => html.classList.remove('intro', 'intro-go'), 4200);
      }, Math.max(0, MIN_INTRO - (performance.now() - T0)));
    };
    // Never trap the visitor behind the preloader: reveal the poster after a while
    // and let the film take over whenever it arrives.
    const bail = setTimeout(done, cfg.maxWait || 9000);

    async function load() {
      if (reduce) { clearTimeout(bail); done(); return; }
      // Portrait phones get the centre-cropped portrait encode; everything else the
      // 16:9 master. Falls back to the master if the variant is missing.
      const portrait = isMobile() && matchMedia('(orientation: portrait)').matches;
      const src = (portrait && cfg.filmPortrait) ? cfg.filmPortrait : (isMobile() && cfg.filmMobile) ? cfg.filmMobile : cfg.film;
      try {
        let res = await fetch(src);
        if (!res.ok && src !== cfg.film) res = await fetch(cfg.film);
        if (!res.ok) throw new Error(res.status);
        const totalBytes = +res.headers.get('content-length') || 0;
        let blob;
        if (res.body && totalBytes) {
          const reader = res.body.getReader(); const parts = []; let got = 0;
          for (;;) {
            const { done: d, value } = await reader.read();
            if (d) break;
            parts.push(value); got += value.length;
            const f = got / totalBytes;
            if (preBar) preBar.style.transform = `scaleX(${f.toFixed(3)})`;
            if (prePct) prePct.textContent = Math.round(f * 100) + '%';
          }
          blob = new Blob(parts, { type: 'video/mp4' });
        } else {
          blob = await res.blob();
        }
        video.src = URL.createObjectURL(blob);
        video.addEventListener('loadedmetadata', () => { ready = true; cur = target; try { video.currentTime = Math.max(0.001, target); } catch (e) {} }, { once: true });
        const reveal = () => { if (painted) return; painted = true; root.classList.add('has-film'); clearTimeout(bail); done(); };
        video.addEventListener('seeked', reveal, { once: true });
        video.addEventListener('loadeddata', () => { try { video.pause(); } catch (e) {} if (video.currentTime === 0) reveal(); });
      } catch (e) {
        clearTimeout(bail); done();   // poster + chapter stills remain a complete page
      }
    }

    // iOS: prime the muted video on first touch so seeks paint immediately
    const prime = () => { if (!isMobile()) return; try { const pr = video.play(); pr && pr.then(() => video.pause()).catch(() => {}); } catch (e) {} };
    addEventListener('touchstart', prime, { once: true, passive: true });

    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(read); } }, { passive: true });
    // Mobile URL-bar show/hide fires height-only resizes; relayout only on width change.
    addEventListener('resize', () => { if (coarse && innerWidth === laidW) return; layout(); });
    addEventListener('orientationchange', () => setTimeout(layout, 150));
    addEventListener('load', layout);

    // chapter jump links (header nav, rail, timeline)
    function jump(id) {
      const c = CH.find(k => k.id === id); if (!c) return;
      const p = c.p0 + (c.p1 - c.p0) * 0.5;
      scrollTo({ top: top + p * len, behavior: reduce ? 'auto' : 'smooth' });
    }
    document.querySelectorAll('[data-jump]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); jump(a.dataset.jump); }));

    layout();
    load();
    requestAnimationFrame(tick);
    return { jump };
  }

  window.mountFilm = mountFilm;
})();

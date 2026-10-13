/**
 * Marble Trace Site — Overlay update rate, in one line
 *
 * Twelve dots are twelve sim ticks at 60 Hz, slowed down so the eye can follow
 * them. A cursor runs along them; on every Nth — N from the rate picked, 60 /
 * 30 / 20 / 15 Hz as the app's own setting offers — the overlay changes and
 * the dot lights, and the readout says how many changes a second that is.
 *
 * The 30 Hz pattern is classes on the markup, so the page shows it without
 * this script. The sweep runs only while the demo is on screen, and not at
 * all for a visitor who asked for reduced motion; the buttons answer either
 * way.
 */

(() => {
  'use strict';

  const SIM_HZ = 60;
  const DEFAULT_RATE_HZ = 30;
  /** One tick of the sweep: 60 Hz slowed about fifteen times. */
  const STEP_MS = 260;
  /** The sweep rests on the last tick before it starts over. */
  const WRAP_PAUSE_MS = 700;

  const CHANGE_CLASS = 'is-change';
  const CURRENT_CLASS = 'is-current';
  const LIT_CLASS = 'is-lit';

  const initRateDemo = () => {
    const demo = document.querySelector('[data-rate-demo]');

    if (!demo) {
      return;
    }

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const template = demo.getAttribute('data-template') || '{n}';
    const options = Array.from(demo.querySelectorAll('[data-rate]'));
    const dots = Array.from(demo.querySelectorAll('[data-rate-dot]'));
    const readout = demo.querySelector('[data-rate-readout]');
    const lastDot = dots.length - 1;

    let every = SIM_HZ / DEFAULT_RATE_HZ;
    let cursor = 0;
    let timer = 0;
    let running = false;

    // Every Nth dot is a change; while the sweep runs, a change lights once
    // the cursor has reached it, and the cursor itself is marked.
    const paint = (reached, withCursor) => {
      dots.forEach((dot, index) => {
        const isChange = index % every === 0;

        dot.classList.toggle(CHANGE_CLASS, isChange);
        dot.classList.toggle(LIT_CLASS, isChange && index <= reached);
        dot.classList.toggle(CURRENT_CLASS, withCursor && index === reached);
      });
    };

    const step = () => {
      paint(cursor, true);

      const atEnd = cursor === lastDot;

      cursor = atEnd ? 0 : cursor + 1;
      timer = window.setTimeout(step, atEnd ? WRAP_PAUSE_MS : STEP_MS);
    };

    const pick = (option) => {
      const rateHz = Number(option.dataset.rate);

      every = SIM_HZ / rateHz;
      options.forEach((candidate) =>
        candidate.setAttribute('aria-pressed', String(candidate === option))
      );
      readout.textContent = template.replace('{n}', String(rateHz));

      if (running) {
        window.clearTimeout(timer);
        cursor = 0;
        step();
      } else {
        paint(lastDot, false);
      }
    };

    options.forEach((option) =>
      option.addEventListener('click', () => pick(option))
    );

    paint(lastDot, false);

    if (reducedMotion || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);

      if (visible && !running) {
        running = true;
        cursor = 0;
        step();
      } else if (!visible && running) {
        running = false;
        window.clearTimeout(timer);
        paint(lastDot, false);
      }
    });

    observer.observe(demo);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRateDemo);
  } else {
    initRateDemo();
  }
})();

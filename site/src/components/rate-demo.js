/**
 * Marble Trace Site — Overlay update rate demo
 *
 * Twelve sim ticks at 60 Hz, slowed down so the eye can follow them. A cursor
 * sweeps the top row; on every Nth tick — N from the rate picked, 60 / 30 /
 * 20 / 15 Hz as the app's own setting offers — the overlay row lights a
 * change, and the readout says how many changes a second that is.
 *
 * The pattern itself is classes on the markup, so the page shows the 30 Hz
 * row without this script. The sweep runs only while the demo is on screen,
 * and not at all for a visitor who asked for reduced motion; the buttons
 * answer either way.
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
    const ticks = Array.from(demo.querySelectorAll('[data-rate-tick]'));
    const frames = Array.from(demo.querySelectorAll('[data-rate-frame]'));
    const readout = demo.querySelector('[data-rate-readout]');

    let every = SIM_HZ / DEFAULT_RATE_HZ;
    let cursor = 0;
    let timer = 0;
    let running = false;

    const isChange = (index) => index % every === 0;

    // The overlay row as the rate draws it: every Nth tick is a change. While
    // the sweep runs, a change lights only once the cursor has reached it.
    const paint = (lightUpTo) => {
      frames.forEach((frame, index) => {
        frame.classList.toggle(CHANGE_CLASS, isChange(index));
        frame.classList.toggle(
          LIT_CLASS,
          isChange(index) && index <= lightUpTo
        );
      });
      ticks.forEach((tick, index) =>
        tick.classList.toggle(CURRENT_CLASS, index === lightUpTo)
      );
    };

    const step = () => {
      paint(cursor);

      const atEnd = cursor === ticks.length - 1;

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
        paint(ticks.length - 1);
      }
    };

    options.forEach((option) =>
      option.addEventListener('click', () => pick(option))
    );

    // The still picture: every change of the rate lit, no cursor.
    paint(ticks.length - 1);
    ticks.forEach((tick) => tick.classList.remove(CURRENT_CLASS));

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
        paint(ticks.length - 1);
        ticks.forEach((tick) => tick.classList.remove(CURRENT_CLASS));
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

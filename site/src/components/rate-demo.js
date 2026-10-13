/**
 * Marble Trace Site — Overlay update rate, in one line
 *
 * Twelve dots are twelve sim ticks at 60 Hz. The ones the overlay changes on
 * — every Nth, N from the rate picked, 60 / 30 / 20 / 15 Hz as the app's own
 * setting offers — glow in a slow CSS wave; the readout says how many changes
 * a second that is.
 *
 * This file only moves the pattern to the rate picked and runs the wave while
 * the line is on screen. The 30 Hz pattern is classes on the markup, so the
 * page shows it without the script, and a visitor who asked for reduced
 * motion gets the pattern without the wave (the stylesheet's own rule).
 */

(() => {
  'use strict';

  const SIM_HZ = 60;

  const CHANGE_CLASS = 'is-change';
  const PLAYING_CLASS = 'is-playing';

  const initRateDemo = () => {
    const demo = document.querySelector('[data-rate-demo]');

    if (!demo) {
      return;
    }

    const template = demo.getAttribute('data-template') || '{n}';
    const options = Array.from(demo.querySelectorAll('[data-rate]'));
    const dots = Array.from(demo.querySelectorAll('[data-rate-dot]'));
    const readout = demo.querySelector('[data-rate-readout]');

    const pick = (option) => {
      const rateHz = Number(option.dataset.rate);
      const every = SIM_HZ / rateHz;

      options.forEach((candidate) =>
        candidate.setAttribute('aria-pressed', String(candidate === option))
      );
      dots.forEach((dot, index) =>
        dot.classList.toggle(CHANGE_CLASS, index % every === 0)
      );
      readout.textContent = template.replace('{n}', String(rateHz));
    };

    options.forEach((option) =>
      option.addEventListener('click', () => pick(option))
    );

    if (!('IntersectionObserver' in window)) {
      demo.classList.add(PLAYING_CLASS);

      return;
    }

    const observer = new IntersectionObserver((entries) => {
      demo.classList.toggle(
        PLAYING_CLASS,
        entries.some((entry) => entry.isIntersecting)
      );
    });

    observer.observe(demo);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRateDemo);
  } else {
    initRateDemo();
  }
})();

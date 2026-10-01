/**
 * Marble Trace Site — Layouts demo
 *
 * The session strip and the screen beside it are the auto-switch acted out:
 * the strip steps through the sessions on its own and the screen crossfades
 * to the screenshot of that session's layout. A click on a session goes
 * straight there and holds it a little longer before the strip moves on.
 *
 * A session is only offered once its screenshot has loaded: one that is
 * missing takes its button out of the strip, so a shot not taken yet never
 * shows up as an empty frame.
 */

(() => {
  'use strict';

  const STEP_MS = 3600;
  const HOLD_AFTER_CLICK_MS = 7000;
  const ACTIVE_CLASS = 'is-active';

  const initLayoutDemo = () => {
    const screen = document.querySelector('[data-layout-screen]');

    if (!screen) {
      return;
    }

    const label = screen.querySelector('[data-layout-label]');
    const entries = Array.from(document.querySelectorAll('[data-session]'))
      .map((button) => ({
        button,
        shot: screen.querySelector(`[data-shot="${button.dataset.session}"]`),
      }))
      .filter((entry) => entry.shot);

    let active = entries.find((entry) =>
      entry.shot.classList.contains(ACTIVE_CLASS)
    );
    let timer = 0;
    let visible = false;

    const available = () => entries.filter((entry) => !entry.button.hidden);

    const show = (entry) => {
      active = entry;

      entries.forEach((candidate) => {
        const isActive = candidate === entry;

        candidate.button.classList.toggle(ACTIVE_CLASS, isActive);
        candidate.button.setAttribute(
          'aria-pressed',
          isActive ? 'true' : 'false'
        );
        candidate.shot.classList.toggle(ACTIVE_CLASS, isActive);
      });

      if (label) {
        label.textContent = entry.button.textContent.trim();
      }
    };

    const schedule = (delay) => {
      window.clearTimeout(timer);

      const offered = available();

      if (!visible || offered.length < 2) {
        return;
      }

      timer = window.setTimeout(() => {
        const next = offered[(offered.indexOf(active) + 1) % offered.length];

        show(next);
        schedule(STEP_MS);
      }, delay);
    };

    const dropSession = (entry) => {
      entry.button.hidden = true;
      entry.shot.remove();

      if (entry === active && available().length > 0) {
        show(available()[available().length - 1]);
      }

      schedule(STEP_MS);
    };

    entries.forEach((entry) => {
      // Every shot is wanted as soon as the block is near, not only the one
      // on top: a lazy image that is never displayed would never load, and
      // its session would never join the strip.
      entry.shot.loading = 'eager';

      // A shot that already failed before this ran fires no error event.
      if (
        entry.shot.complete &&
        entry.shot.naturalWidth === 0 &&
        entry.shot.src
      ) {
        dropSession(entry);

        return;
      }

      entry.shot.addEventListener('error', () => dropSession(entry));

      entry.button.addEventListener('click', () => {
        show(entry);
        schedule(HOLD_AFTER_CLICK_MS);
      });
    });

    if (active) {
      show(active);
    }

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver((observed) => {
      visible = observed.some((entry) => entry.isIntersecting);
      schedule(STEP_MS);
    });

    observer.observe(screen);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLayoutDemo);
  } else {
    initLayoutDemo();
  }
})();

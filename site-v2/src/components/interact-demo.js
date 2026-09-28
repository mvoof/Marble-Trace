/**
 * Marble Trace Site V2 — Interact mode demo
 *
 * Presses the F8 keycap on a loop: the cap goes down, a splash is thrown off
 * its base, and the status under it says the mouse is on the overlay; a few
 * seconds later it says the mouse is back in the game, and the key goes down
 * again. A click on the key presses it at once.
 *
 * The motion is all CSS - this file only restarts it, by taking the class off
 * and putting it back after a forced reflow. It runs only while the band is
 * on screen, and not at all for a visitor who asked for reduced motion.
 */

(() => {
  'use strict';

  const OVERLAY_HOLD_MS = 2800;
  const GAME_HOLD_MS = 1300;

  const PRESSED_CLASS = 'is-pressed';
  const OVERLAY_CLASS = 'is-overlay';

  const STATUS_OVERLAY = 'Mouse on the overlay';
  const STATUS_GAME = 'Mouse back in the game';

  const initInteractDemo = () => {
    const demo = document.querySelector('[data-interact-demo]');
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (!demo || reducedMotion || !('IntersectionObserver' in window)) {
      return;
    }

    const keycap = demo.querySelector('[data-keycap]');
    const status = demo.querySelector('[data-interact-status]');

    let timer = 0;
    let running = false;

    const release = () => {
      demo.classList.remove(OVERLAY_CLASS);
      status.textContent = STATUS_GAME;
      timer = window.setTimeout(press, GAME_HOLD_MS);
    };

    const press = () => {
      window.clearTimeout(timer);

      demo.classList.remove(PRESSED_CLASS);
      // Reading layout here is what lets the same animation play twice.
      void demo.offsetWidth;
      demo.classList.add(PRESSED_CLASS, OVERLAY_CLASS);
      status.textContent = STATUS_OVERLAY;

      if (running) {
        timer = window.setTimeout(release, OVERLAY_HOLD_MS);
      }
    };

    keycap.addEventListener('click', press);

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);

      if (visible && !running) {
        running = true;
        press();
      } else if (!visible && running) {
        running = false;
        window.clearTimeout(timer);
      }
    });

    observer.observe(demo);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInteractDemo);
  } else {
    initInteractDemo();
  }
})();

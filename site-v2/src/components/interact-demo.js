/**
 * Marble Trace Site V2 — Interact mode demo
 *
 * Plays the feature on a loop: the key goes down, the ring runs out over the
 * app's default fifteen seconds while the mouse is on the overlay, then the
 * mouse is handed back to the game for a beat and the loop starts again.
 *
 * The ring itself is CSS - this file only sets --left (the share of the
 * countdown still to run) and which of the two states the demo is in. It
 * runs only while the band is on screen, and not at all for a visitor who
 * asked for reduced motion: the markup already shows a full ring.
 */

(() => {
  'use strict';

  const COUNTDOWN_S = 15;
  const PRESS_MS = 260;
  const GAME_PAUSE_MS = 2600;
  const TICK_MS = 1000;

  const ACTIVE_CLASS = 'is-overlay';
  const PRESSED_CLASS = 'is-pressed';

  const STATUS_OVERLAY = 'Mouse on the overlay';
  const STATUS_GAME = 'Mouse back in the game';

  const formatTime = (seconds) => '0:' + String(seconds).padStart(2, '0');

  const initInteractDemo = () => {
    const demo = document.querySelector('[data-interact-demo]');
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (!demo || reducedMotion || !('IntersectionObserver' in window)) {
      return;
    }

    const status = demo.querySelector('[data-interact-status]');
    const time = demo.querySelector('[data-interact-time]');

    let secondsLeft = COUNTDOWN_S;
    let timer = 0;
    let running = false;

    const render = () => {
      demo.style.setProperty('--left', String(secondsLeft / COUNTDOWN_S));
      time.textContent = formatTime(secondsLeft);
    };

    const handBack = () => {
      demo.classList.remove(ACTIVE_CLASS);
      status.textContent = STATUS_GAME;
      timer = window.setTimeout(press, GAME_PAUSE_MS);
    };

    const tick = () => {
      secondsLeft -= 1;
      render();

      if (secondsLeft <= 0) {
        handBack();

        return;
      }

      timer = window.setTimeout(tick, TICK_MS);
    };

    const press = () => {
      secondsLeft = COUNTDOWN_S;
      demo.classList.add(PRESSED_CLASS, ACTIVE_CLASS);
      status.textContent = STATUS_OVERLAY;
      render();

      window.setTimeout(() => {
        demo.classList.remove(PRESSED_CLASS);
      }, PRESS_MS);

      timer = window.setTimeout(tick, TICK_MS);
    };

    const stop = () => {
      window.clearTimeout(timer);
      running = false;
    };

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);

      if (visible && !running) {
        running = true;
        press();
      } else if (!visible && running) {
        stop();
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

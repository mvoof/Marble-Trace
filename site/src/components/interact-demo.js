/**
 * Marble Trace Site — Two keys demo
 *
 * Presses F8 and F9 in turn: the cap goes down for a moment, a splash is
 * thrown off its base, its legend lights, and the status under the keys says
 * what the mouse can do now. A few seconds later the status says the mouse is
 * back in the game, and the other key goes down. A click on either key
 * presses it at once and starts that mode on the page (page-modes.js).
 *
 * The motion is all CSS - this file only holds a key down for a moment and
 * restarts its splash, by taking the class off and putting it back after a
 * forced reflow. The loop runs only while the band is on screen, and not at
 * all for a visitor who asked for reduced motion.
 */

(() => {
  'use strict';

  const HOLD_MS = 2800;
  const GAME_MS = 1200;
  const KEY_DOWN_MS = 170;

  const DOWN_CLASS = 'is-down';
  const PRESSED_CLASS = 'is-pressed';
  const LIT_CLASS = 'is-lit';

  const STATUS = {
    interact: 'Mouse on the overlay',
    edit: 'Editing the widgets',
  };
  const STATUS_GAME = 'Mouse back in the game';

  const initInteractDemo = () => {
    const demo = document.querySelector('[data-interact-demo]');
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (!demo) {
      return;
    }

    const slots = Array.from(demo.querySelectorAll('[data-key-slot]'));
    const status = demo.querySelector('[data-interact-status]');

    let nextIndex = 0;
    let timer = 0;
    let running = false;

    const release = () => {
      slots.forEach((slot) => slot.classList.remove(LIT_CLASS));
      demo.classList.remove(LIT_CLASS);
      status.textContent = STATUS_GAME;
      timer = window.setTimeout(() => press(slots[nextIndex]), GAME_MS);
    };

    const press = (slot) => {
      window.clearTimeout(timer);

      const key = slot.querySelector('[data-key]');

      slots.forEach((candidate) => candidate.classList.remove(LIT_CLASS));
      slot.classList.remove(PRESSED_CLASS);
      // Reading layout here is what lets the same splash play twice.
      void slot.offsetWidth;
      slot.classList.add(PRESSED_CLASS, LIT_CLASS);
      demo.classList.add(LIT_CLASS);

      key.classList.add(DOWN_CLASS);
      window.setTimeout(() => key.classList.remove(DOWN_CLASS), KEY_DOWN_MS);

      status.textContent = STATUS[key.dataset.key];
      nextIndex = (slots.indexOf(slot) + 1) % slots.length;

      if (running) {
        timer = window.setTimeout(release, HOLD_MS);
      }
    };

    // A press the visitor made also plays the mode itself on the page
    // (page-modes.js); the loop's own presses only animate the caps.
    slots.forEach((slot) => {
      const key = slot.querySelector('[data-key]');

      key.addEventListener('click', () => {
        press(slot);
        document.dispatchEvent(
          new CustomEvent('mt:key', { detail: key.dataset.key })
        );
      });
    });

    // Without motion, or without the observer, the keys still answer a click;
    // only the loop that presses them on its own is left out.
    if (reducedMotion || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);

      if (visible && !running) {
        running = true;
        press(slots[nextIndex]);
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

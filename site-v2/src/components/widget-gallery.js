/**
 * Marble Trace Site V2 - Widget gallery (section 02)
 *
 * A stage and a sheet of frames. The sheet is a tablist and the stage its
 * panel:
 * picking a frame swaps the capture above rather than navigating anywhere. Everything
 * the stage needs is on the frame that was pressed, so the markup stays the
 * source of truth and this file never carries a copy of the catalogue.
 *
 * The next capture is decoded off-screen before it is shown. Swapping the src
 * straight away paints the stage empty for a frame, and a gallery that blinks
 * on every click reads as broken however fast it is.
 */

(() => {
  'use strict';

  const ACTIVE_CLASS = 'is-active';
  const SWAPPING_CLASS = 'is-swapping';

  /* Long enough for the outgoing capture to be gone before the new one takes
     its place, short enough that a run across the sheet does not feel gated. It
     is the stylesheet's own transition, named here because the swap waits for
     it. */
  const FADE_MS = 200;

  const padOrdinal = (value) => (value < 10 ? '0' + value : String(value));

  const initWidgetGallery = () => {
    const gallery = document.querySelector('[data-widget-gallery]');

    if (!gallery) {
      return;
    }

    const stage = gallery.querySelector('.stage');
    const shot = gallery.querySelector('#gw-shot');
    const name = gallery.querySelector('#gw-name');
    const desc = gallery.querySelector('#gw-desc');
    const group = gallery.querySelector('#gw-group');
    const index = gallery.querySelector('#gw-index');
    const total = gallery.querySelector('#gw-total');
    const frames = Array.from(gallery.querySelectorAll('.frame'));

    if (!stage || !shot || !frames.length) {
      return;
    }

    let activeIndex = 0;
    let fadeTimer = 0;

    const isStageInView = () => {
      const box = stage.getBoundingClientRect();

      return box.bottom > 0 && box.top < window.innerHeight;
    };

    const show = (next, moveFocus) => {
      const frame = frames[next];

      if (!frame) {
        return;
      }

      if (moveFocus) {
        frame.focus();
      }

      /* Only a keyboard run scrolls anything. A click already happened where
         the reader was looking, and scrolling after it moved the page under
         the cursor by up to 170px on a phone — which reads as the layout
         jumping, not as the gallery answering. */
      if (moveFocus) {
        frame.scrollIntoView({ block: 'nearest', inline: 'center' });
      }

      if (next === activeIndex) {
        return;
      }

      const previous = frames[activeIndex];

      previous.classList.remove(ACTIVE_CLASS);
      previous.setAttribute('aria-selected', 'false');
      previous.setAttribute('tabindex', '-1');

      frame.classList.add(ACTIVE_CLASS);
      frame.setAttribute('aria-selected', 'true');
      frame.setAttribute('tabindex', '0');
      stage.setAttribute('aria-labelledby', frame.id);

      activeIndex = next;

      /* On a narrow screen the stage is above the sheet and off screen while
         the sheet is being read, so a tap would swap a widget nobody can see.
         There the page is brought back to the stage, smoothly and only when it
         is actually out of view — on a wide screen both halves are visible at
         once and nothing moves at all. */
      if (!moveFocus && !isStageInView()) {
        stage.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }

      const nextSrc = frame.getAttribute('data-shot');
      const loader = new Image();

      stage.classList.add(SWAPPING_CLASS);
      window.clearTimeout(fadeTimer);

      const settle = () => {
        // A slower picture must not overwrite a faster click that came after it.
        if (frames[activeIndex] !== frame) {
          return;
        }

        shot.src = nextSrc;
        shot.alt = frame.getAttribute('data-alt') || '';
        name.textContent = frame.getAttribute('data-name') || '';
        desc.textContent = frame.getAttribute('data-desc') || '';
        group.textContent = frame.getAttribute('data-group') || '';
        index.textContent = padOrdinal(activeIndex + 1);
        stage.classList.remove(SWAPPING_CLASS);
      };

      /* The fade out and the decode run at the same time, and the swap waits
         for whichever finishes last: waiting only on the timer shows a picture
         that has not arrived, waiting only on the decode swaps a cached one
         mid-fade. */
      let faded = false;
      let loaded = false;

      const ready = () => {
        if (faded && loaded) {
          settle();
        }
      };

      loader.onload = () => {
        loaded = true;
        ready();
      };

      loader.onerror = () => {
        loaded = true;
        ready();
      };

      loader.src = nextSrc;

      if (loader.complete) {
        loaded = true;
      }

      fadeTimer = window.setTimeout(() => {
        faded = true;
        ready();
      }, FADE_MS);
    };

    frames.forEach((frame, position) => {
      frame.addEventListener('click', () => {
        show(position, false);
      });

      frame.addEventListener('keydown', (event) => {
        const key = event.key;
        const last = frames.length - 1;

        if (key === 'ArrowRight' || key === 'ArrowDown') {
          event.preventDefault();
          show(position === last ? 0 : position + 1, true);
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          event.preventDefault();
          show(position === 0 ? last : position - 1, true);
        } else if (key === 'Home') {
          event.preventDefault();
          show(0, true);
        } else if (key === 'End') {
          event.preventDefault();
          show(last, true);
        }
      });
    });

    stage.setAttribute('aria-labelledby', frames[0].id);
    total.textContent = frames.length;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidgetGallery);
  } else {
    initWidgetGallery();
  }
})();

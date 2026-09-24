/**
 * Marble Trace Site V2 — Control deck (section 04)
 *
 * A stack of captures and one plate beside it. The deck is a tablist, the
 * plates its panels: bringing a card to the front swaps the plate rather than
 * navigating anywhere. Everything the plate needs is already in the markup, so
 * this file never carries a copy of the catalogue.
 *
 * The pointer browses the stack by running across it — the deck is split into
 * as many bands as there are cards, and the band under the pointer is the card
 * at the front. That is only offered to a pointer that can hover; a touch
 * screen gets the swipe and the two step buttons, which are in the markup for
 * everyone.
 *
 * Geometry lives in the stylesheet. All this file sets is --d, the card's
 * distance from the front, so the fan can be redrawn in CSS without touching
 * the script.
 */

(() => {
  'use strict';

  const ACTIVE_CLASS = 'is-active';
  const PAST_CLASS = 'is-past';

  /* Below this the swipe was a scroll that happened to drift sideways. */
  const SWIPE_THRESHOLD_PX = 40;

  const padOrdinal = (value) => (value < 10 ? '0' + value : String(value));

  const initControlDeck = () => {
    const root = document.querySelector('[data-control-deck]');

    if (!root) {
      return;
    }

    const deck = root.querySelector('.deck');
    const cards = Array.from(root.querySelectorAll('.deck-card'));
    const panels = Array.from(root.querySelectorAll('.deck-panel'));
    const indexOutput = root.querySelector('[data-deck-index]');
    const totalOutput = root.querySelector('[data-deck-total]');
    const prevButton = root.querySelector('[data-deck-prev]');
    const nextButton = root.querySelector('[data-deck-next]');

    if (!deck || cards.length === 0 || cards.length !== panels.length) {
      return;
    }

    let activeIndex = 0;

    const show = (next, moveFocus) => {
      const target = Math.max(0, Math.min(cards.length - 1, next));

      activeIndex = target;

      cards.forEach((card, cardIndex) => {
        const distance = cardIndex - target;
        const isActive = distance === 0;

        card.classList.toggle(ACTIVE_CLASS, isActive);
        card.classList.toggle(PAST_CLASS, distance < 0);
        card.style.setProperty('--d', String(Math.max(distance, 0)));
        /* The fan is drawn front to back, so a card further from the front has
           to sit lower in the stack. */
        card.style.zIndex = String(cards.length - Math.abs(distance));
        card.setAttribute('aria-selected', isActive ? 'true' : 'false');
        card.tabIndex = isActive ? 0 : -1;
      });

      panels.forEach((panel, panelIndex) => {
        panel.hidden = panelIndex !== target;
      });

      if (indexOutput) {
        indexOutput.textContent = padOrdinal(target + 1);
      }

      if (prevButton) {
        prevButton.disabled = target === 0;
      }

      if (nextButton) {
        nextButton.disabled = target === cards.length - 1;
      }

      if (moveFocus) {
        cards[target].focus();
      }
    };

    /* ---- Pointer scrub ----------------------------------------------------
       The deck is as many bands as it has cards. Reading the band rather than
       the card under the pointer is what lets the whole stack be browsed: the
       card at the front covers the ones behind it, so hovering the cards
       themselves would only ever reach the front one and the sliver of each
       card that sticks out. */

    const bandAtPointer = (clientX) => {
      const box = deck.getBoundingClientRect();
      const ratio = (clientX - box.left) / box.width;
      const band = Math.floor(ratio * cards.length);

      return Math.max(0, Math.min(cards.length - 1, band));
    };

    const canHover =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (canHover) {
      let pendingFrame = 0;

      const onPointerMove = (event) => {
        if (pendingFrame !== 0) {
          return;
        }

        /* One read per frame: pointermove fires far faster than the deck is
           redrawn, and each read costs a layout. */
        pendingFrame = window.requestAnimationFrame(() => {
          pendingFrame = 0;

          const band = bandAtPointer(event.clientX);

          if (band !== activeIndex) {
            show(band, false);
          }
        });
      };

      deck.addEventListener('pointermove', onPointerMove);
    }

    /* ---- Swipe, clicks and keys ------------------------------------------- */

    let swipeStartX = 0;
    let swipeTracking = false;

    deck.addEventListener('pointerdown', (event) => {
      swipeStartX = event.clientX;
      swipeTracking = true;
    });

    deck.addEventListener('pointerup', (event) => {
      if (!swipeTracking) {
        return;
      }

      swipeTracking = false;

      const travel = event.clientX - swipeStartX;

      if (Math.abs(travel) < SWIPE_THRESHOLD_PX) {
        return;
      }

      show(travel < 0 ? activeIndex + 1 : activeIndex - 1, false);
    });

    deck.addEventListener('pointercancel', () => {
      swipeTracking = false;
    });

    /* ---- The viewer -------------------------------------------------------
       Clicking the card at the front opens it at the size it was captured at;
       clicking any other card brings that one to the front first. A settings
       window shown at half its width is a page of type nobody can read, and
       the deck is the only place these captures appear. */

    /* The viewer sits at the end of the body rather than in the section: main
       is a stacking context of its own, and inside it nothing can be drawn
       over the header however high its z-index is. */
    const viewer = document.querySelector('[data-deck-viewer]');
    const viewerShot = document.querySelector('[data-deck-viewer-shot]');
    const viewerCaption = document.querySelector('[data-deck-viewer-caption]');
    const dismissers = Array.from(
      document.querySelectorAll('[data-deck-viewer-dismiss]')
    );

    let viewerReturnFocus = null;

    const closeViewer = () => {
      if (!viewer || viewer.hidden) {
        return;
      }

      viewer.hidden = true;
      document.body.classList.remove('is-viewer-open');

      if (viewerReturnFocus) {
        viewerReturnFocus.focus();
        viewerReturnFocus = null;
      }
    };

    const openViewer = (cardIndex) => {
      if (!viewer || !viewerShot) {
        return;
      }

      const shot = cards[cardIndex].querySelector('.deck-shot');
      const name = cards[cardIndex].querySelector('.deck-card-name');

      if (!shot) {
        return;
      }

      viewerShot.src = shot.currentSrc || shot.src;
      viewerShot.alt = shot.alt;

      if (viewerCaption) {
        viewerCaption.textContent = name ? name.textContent : '';
      }

      viewerReturnFocus = cards[cardIndex];
      viewer.hidden = false;
      document.body.classList.add('is-viewer-open');

      const closeButton = viewer.querySelector('.deck-viewer-close');

      if (closeButton) {
        closeButton.focus();
      }
    };

    cards.forEach((card, cardIndex) => {
      card.addEventListener('click', () => {
        if (cardIndex === activeIndex) {
          openViewer(cardIndex);

          return;
        }

        show(cardIndex, false);
      });
    });

    dismissers.forEach((dismisser) => {
      dismisser.addEventListener('click', closeViewer);
    });

    document.addEventListener('keydown', (event) => {
      if (!viewer || viewer.hidden) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closeViewer();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        show(activeIndex + 1, false);
        openViewer(activeIndex);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        show(activeIndex - 1, false);
        openViewer(activeIndex);
      }
    });

    deck.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        show(activeIndex + 1, true);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        show(activeIndex - 1, true);
      } else if (event.key === 'Home') {
        event.preventDefault();
        show(0, true);
      } else if (event.key === 'End') {
        event.preventDefault();
        show(cards.length - 1, true);
      }
    });

    if (prevButton) {
      prevButton.addEventListener('click', () => {
        show(activeIndex - 1, false);
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        show(activeIndex + 1, false);
      });
    }

    /* ---- Wheel ------------------------------------------------------------
       Over the deck the wheel deals the next card instead of scrolling past
       it. Only while there is a card left to deal in that direction: at either
       end the page takes the wheel back, so the section can still be scrolled
       out of rather than trapping the reader in it. */

    const WHEEL_IDLE_MS = 90;

    let wheelBlockedUntil = 0;

    deck.addEventListener(
      'wheel',
      (event) => {
        const forward =
          (Math.abs(event.deltaY) > Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX) > 0;
        const next = forward ? activeIndex + 1 : activeIndex - 1;

        if (next < 0 || next > cards.length - 1) {
          return;
        }

        event.preventDefault();

        /* A trackpad sends a whole flick as a stream of events; without this
           one gesture runs the deck end to end. */
        if (event.timeStamp < wheelBlockedUntil) {
          return;
        }

        wheelBlockedUntil = event.timeStamp + WHEEL_IDLE_MS;
        show(next, false);
      },
      { passive: false }
    );

    /* ---- Plate height -----------------------------------------------------
       The plate is centred on the deck, so a shorter panel would move both of
       its edges and the block would jump as the deck is browsed. It is held at
       the height of its tallest panel instead, measured here rather than
       guessed in the stylesheet, where a line of copy added later would
       silently break it. */

    const plate = root.querySelector('.deck-plate');

    const holdPlateHeight = () => {
      if (!plate) {
        return;
      }

      plate.style.minHeight = '';

      /* Narrow enough and the plate is back in the flow under the deck, where
         nothing is centred on anything and a held height is only a block of
         empty paper under the shortest panel. */
      if (window.getComputedStyle(plate).position === 'static') {
        return;
      }

      const openPanel = panels[activeIndex];
      let tallest = 0;

      panels.forEach((panel) => {
        const wasHidden = panel.hidden;

        panel.hidden = false;
        tallest = Math.max(tallest, panel.offsetHeight);
        panel.hidden = wasHidden;
      });

      openPanel.hidden = false;

      const framing = plate.offsetHeight - openPanel.offsetHeight;

      plate.style.minHeight = tallest + framing + 'px';
    };

    if (totalOutput) {
      totalOutput.textContent = padOrdinal(cards.length);
    }

    show(0, false);
    holdPlateHeight();

    /* The copy is set in a web font. Measured before it arrives, the plate is
       held at the fallback's height and the block jumps once on load. */
    if (document.fonts && document.fonts.ready) {
      void document.fonts.ready.then(holdPlateHeight);
    }

    let resizeTimer = 0;

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(holdPlateHeight, 150);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initControlDeck);
  } else {
    initControlDeck();
  }
})();

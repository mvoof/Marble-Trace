/**
 * Marble Trace Site - Hotspots
 *
 * Markers laid over a screenshot, each opening a note on what is under it
 * (styles in hotspots.css). Hover and focus open a note on their own; this
 * file adds the tap, so a phone can read them, closes a note on a tap
 * elsewhere or on Escape, and turns each note away from the edges it would
 * run into.
 *
 * A tap on a marker never reaches the picture under it: several pictures
 * open full size on a click, and a marker is not a request for that.
 */

(() => {
  'use strict';

  const OPEN_CLASS = 'is-open';

  /* Past these shares of the picture a note would leave the frame, so it
     opens the other way. */
  const LEFT_EDGE_SHARE = 0.6;
  const TOP_EDGE_SHARE = 0.18;
  const BOTTOM_EDGE_SHARE = 0.82;

  const readShare = (marker, property) =>
    parseFloat(marker.style.getPropertyValue(property)) / 100;

  const placeNote = (marker) => {
    const shareX = readShare(marker, '--x');
    const shareY = readShare(marker, '--y');

    marker.classList.toggle('is-left', shareX > LEFT_EDGE_SHARE);
    marker.classList.toggle('is-below', shareY < TOP_EDGE_SHARE);
    marker.classList.toggle('is-above', shareY > BOTTOM_EDGE_SHARE);
  };

  const closeAll = (except) => {
    document.querySelectorAll(`.hotspot.${OPEN_CLASS}`).forEach((marker) => {
      if (marker !== except) {
        marker.classList.remove(OPEN_CLASS);
        marker.setAttribute('aria-expanded', 'false');
      }
    });
  };

  const initHotspots = () => {
    const markers = Array.from(document.querySelectorAll('.hotspot'));

    if (!markers.length) {
      return;
    }

    markers.forEach((marker) => {
      placeNote(marker);
      marker.setAttribute('aria-expanded', 'false');

      marker.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const opening = !marker.classList.contains(OPEN_CLASS);

        closeAll(marker);
        marker.classList.toggle(OPEN_CLASS, opening);
        marker.setAttribute('aria-expanded', opening ? 'true' : 'false');
      });
    });

    document.addEventListener('click', () => closeAll(null));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAll(null);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHotspots);
  } else {
    initHotspots();
  }
})();

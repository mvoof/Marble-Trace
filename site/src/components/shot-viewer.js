/**
 * Marble Trace Site — Screenshot viewer
 *
 * The feature blocks show crops of the app's window and the layouts block a
 * screenshot per session. Clicking one ([data-zoom]) opens the whole picture
 * at the size it was taken at, over the page; the
 * ground, the close button and Escape dismiss it, and focus goes back to the
 * crop that opened it.
 */

(() => {
  'use strict';

  const OPEN_CLASS = 'is-viewer-open';

  const initShotViewer = () => {
    const viewer = document.querySelector('[data-shot-viewer]');
    const viewerShot = document.querySelector('[data-shot-viewer-shot]');
    const viewerCaption = document.querySelector('[data-shot-viewer-caption]');
    const triggers = Array.from(document.querySelectorAll('[data-zoom]'));

    if (!viewer || !viewerShot || triggers.length === 0) {
      return;
    }

    let returnFocus = null;

    const close = () => {
      if (viewer.hidden) {
        return;
      }

      viewer.hidden = true;
      document.body.classList.remove(OPEN_CLASS);

      if (returnFocus) {
        returnFocus.focus();
        returnFocus = null;
      }
    };

    // A trigger may point at another element to take its picture from
    // (data-zoom-from); where that element holds several pictures, the one
    // on show - .is-active - is the one opened.
    const pictureOf = (trigger) => {
      const source = trigger.dataset.zoomFrom
        ? document.querySelector(trigger.dataset.zoomFrom)
        : trigger;

      if (!source) {
        return null;
      }

      return (
        source.querySelector('img.is-active') || source.querySelector('img')
      );
    };

    const open = (trigger) => {
      const shot = pictureOf(trigger);

      if (!shot) {
        return;
      }

      // src is the widest copy (the build sets it so); the viewer shows the
      // picture at full size, not the copy the crop happened to need.
      viewerShot.src = shot.src;
      viewerShot.alt = shot.alt;

      if (viewerCaption) {
        viewerCaption.textContent = shot.alt;
      }

      returnFocus = trigger;
      viewer.hidden = false;

      // Where the picture is wider than the screen it opens on its middle,
      // the part a crop was usually taken from, with room to pan both ways.
      const pan = viewer.querySelector('[data-shot-viewer-pan]');
      const centre = () => {
        if (pan) {
          pan.scrollLeft = (pan.scrollWidth - pan.clientWidth) / 2;
        }
      };

      if (viewerShot.complete) {
        centre();
      } else {
        viewerShot.addEventListener('load', centre, { once: true });
      }
      document.body.classList.add(OPEN_CLASS);

      const closeButton = viewer.querySelector('.shot-viewer-close');

      if (closeButton) {
        closeButton.focus();
      }
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', () => open(trigger));
    });

    document
      .querySelectorAll('[data-shot-viewer-dismiss]')
      .forEach((dismisser) => {
        dismisser.addEventListener('click', close);
      });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !viewer.hidden) {
        event.preventDefault();
        close();
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShotViewer);
  } else {
    initShotViewer();
  }
})();

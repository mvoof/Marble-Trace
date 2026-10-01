/**
 * Marble Trace Site — Remote screens scene
 *
 * A node on each screen of the rig. A click dollies the camera into the same
 * picture until that screen fills the stage, and a caption names it; Back,
 * Escape or a click on the picture pulls the camera out again. The close-up
 * is the preview itself, only nearer. The page loads a srcset copy sized
 * for the full view; the first zoom fetches the full-resolution source and
 * swaps it in once decoded, so the close-up has real pixels to show.
 */

(() => {
  'use strict';

  const ZOOMED_CLASS = 'is-zoomed';
  const FILL = 0.9;
  const FULL_SHOT_URL = new URL(
    '../../assets/screens/rig.webp',
    import.meta.url
  ).href;

  const initScreensScene = () => {
    const stage = document.querySelector('[data-screens-stage]');
    const scene = document.querySelector('[data-screens-scene]');
    const caption = document.querySelector('[data-screens-caption]');

    if (!stage || !scene || !caption) {
      return;
    }

    const captions = Array.from(caption.querySelectorAll('[data-caption]'));
    const shot = scene.querySelector('.screens-scene-shot');
    let active = null;
    let fullShotRequested = false;

    const loadFullShot = () => {
      if (fullShotRequested || !shot) {
        return;
      }

      fullShotRequested = true;

      const full = new Image();

      full.src = FULL_SHOT_URL;
      full
        .decode()
        .then(() => {
          shot.removeAttribute('srcset');
          shot.removeAttribute('sizes');
          shot.src = FULL_SHOT_URL;
        })
        .catch(() => {
          fullShotRequested = false;
        });
    };

    // data-zoom is the screen's box in percent of the picture: x y w h.
    const frame = (spot) => {
      const [left, top, width, height] = spot.dataset.zoom
        .split(/\s+/)
        .map((value) => Number(value) / 100);
      const sceneWidth = scene.offsetWidth;
      const sceneHeight = scene.offsetHeight;
      const boxWidth = width * sceneWidth;
      const boxHeight = height * sceneHeight;
      const scale =
        FILL *
        Math.min(stage.clientWidth / boxWidth, stage.clientHeight / boxHeight);
      const shiftX =
        stage.clientWidth / 2 - scale * (left * sceneWidth + boxWidth / 2);
      const shiftY =
        stage.clientHeight / 2 - scale * (top * sceneHeight + boxHeight / 2);

      scene.style.transform = `translate(${shiftX}px, ${shiftY}px) scale(${scale})`;
    };

    const zoomIn = (spot) => {
      active = spot;
      loadFullShot();
      frame(spot);
      scene.classList.add(ZOOMED_CLASS);
      captions.forEach((entry) => {
        entry.hidden = entry.dataset.caption !== spot.dataset.device;
      });
      caption.hidden = false;
    };

    const zoomOut = () => {
      if (!active) {
        return;
      }

      const spot = active;

      active = null;
      scene.style.transform = '';
      scene.classList.remove(ZOOMED_CLASS);
      caption.hidden = true;
      spot.focus({ preventScroll: true });
    };

    scene.querySelectorAll('[data-device]').forEach((spot) => {
      spot.addEventListener('click', (event) => {
        event.stopPropagation();
        zoomIn(spot);
      });
    });

    scene.addEventListener('click', zoomOut);
    caption
      .querySelector('[data-screens-back]')
      .addEventListener('click', zoomOut);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        zoomOut();
      }
    });

    window.addEventListener('resize', () => {
      if (active) {
        frame(active);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScreensScene);
  } else {
    initScreensScene();
  }
})();

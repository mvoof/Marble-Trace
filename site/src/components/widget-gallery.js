/**
 * Marble Trace Site - Widget gallery (section 02)
 *
 * Groups, the widgets of the open group, and a stage showing one widget in
 * one setup. Everything the stage shows is in the markup: a widget's name and
 * group on its button and tab, its description in the catalogue below, and
 * every setup's picture as a hidden <img> the build has already turned into
 * WebP copies with the source's size. This file only moves them onto the
 * stage.
 *
 * One scale for every widget. The captures are taken at CAPTURE_SCALE, so a
 * picture's width attribute divided by it is the widget's width on the
 * overlay; the stage draws every picture at that width times one shared
 * factor, chosen so the largest setup there is still fits the scene. A small
 * widget therefore stays small next to a large one.
 *
 * While the stage is in view and the reader has not touched the gallery, it
 * walks through the setups of the widget on it, then on to the next widget.
 * The first press anywhere in the gallery ends that for good.
 */

(() => {
  'use strict';

  const ACTIVE_CLASS = 'is-active';
  const SWAPPING_CLASS = 'is-swapping';

  /* The device scale the widget captures are taken at (capture:widgets) */
  const CAPTURE_SCALE = 3;

  /* Never drawn larger than on the overlay itself */
  const MAX_SCALE = 1;

  /* The stylesheet's fade; the swap waits for the old picture to be gone */
  const FADE_MS = 200;

  const AUTOPLAY_MS = 3200;

  const setPressed = (button, pressed) => {
    button.classList.toggle(ACTIVE_CLASS, pressed);
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  };

  const overlayWidthOf = (img) =>
    Number(img.getAttribute('width')) / CAPTURE_SCALE;

  const overlayHeightOf = (img) =>
    Number(img.getAttribute('height')) / CAPTURE_SCALE;

  const initWidgetGallery = () => {
    const gallery = document.querySelector('[data-widget-gallery] .wg');

    if (!gallery) {
      return;
    }

    const stage = gallery.querySelector('.wg-stage');
    const scene = gallery.querySelector('.wg-scene');
    const shot = gallery.querySelector('.wg-shot');
    const groupName = gallery.querySelector('.wg-group-name');
    const widgetName = gallery.querySelector('.wg-name');
    const description = gallery.querySelector('.wg-desc');
    const tabs = Array.from(gallery.querySelectorAll('.wg-tab'));
    const items = Array.from(gallery.querySelectorAll('.wg-item'));
    const setupRows = Array.from(gallery.querySelectorAll('.wg-setups'));
    const pictures = Array.from(gallery.querySelectorAll('.wg-setup img'));

    if (!stage || !scene || !shot || !items.length) {
      return;
    }

    let activeItem =
      items.find((item) => item.classList.contains(ACTIVE_CLASS)) ?? items[0];
    let activeSetup = null;
    let fadeTimer = 0;
    let autoplayTimer = 0;
    let autoplayOn = true;
    let inView = false;

    /* ---- Scale ---------------------------------------------------------- */

    const largest = pictures.reduce(
      (size, img) => ({
        width: Math.max(size.width, overlayWidthOf(img) || 0),
        height: Math.max(size.height, overlayHeightOf(img) || 0),
      }),
      { width: 0, height: 0 }
    );

    const updateScale = () => {
      const style = getComputedStyle(scene);
      const roomX =
        scene.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const roomY =
        scene.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);

      if (!largest.width || !largest.height || roomX <= 0 || roomY <= 0) {
        return;
      }

      const scale = Math.min(
        MAX_SCALE,
        roomX / largest.width,
        roomY / largest.height
      );

      gallery.style.setProperty('--wg-scale', scale.toFixed(4));
      updateSizes();
    };

    /* The browser picks a copy by the width the picture is drawn at */
    const updateSizes = () => {
      const scale =
        parseFloat(gallery.style.getPropertyValue('--wg-scale')) || 1;
      const width = parseFloat(shot.style.getPropertyValue('--shot-w')) || 0;

      if (width) {
        shot.sizes = `${Math.ceil(width * scale)}px`;
      }
    };

    /* ---- Showing -------------------------------------------------------- */

    const putOnStage = (img) => {
      const width = overlayWidthOf(img);

      if (width) {
        shot.style.setProperty('--shot-w', String(width));
      } else {
        // A picture the build has no copies for carries no size: it is
        // measured once it has loaded instead
        shot.addEventListener(
          'load',
          () => {
            shot.style.setProperty(
              '--shot-w',
              String(shot.naturalWidth / CAPTURE_SCALE)
            );
            updateSizes();
          },
          { once: true }
        );
      }

      updateSizes();
      shot.srcset = img.getAttribute('srcset') || '';
      shot.src = img.getAttribute('src') || '';
      shot.alt = activeItem.getAttribute('data-alt') || '';
    };

    const showSetup = (setup, animate = true) => {
      const img = setup.querySelector('img');

      if (!img || setup === activeSetup) {
        return;
      }

      activeSetup = setup;
      setup
        .closest('.wg-setups')
        .querySelectorAll('.wg-setup')
        .forEach((button) => setPressed(button, button === setup));

      window.clearTimeout(fadeTimer);

      if (!animate) {
        putOnStage(img);

        return;
      }

      // Decoded off-screen first: swapping the src straight away paints the
      // stage empty for a frame, and a gallery that blinks reads as broken.
      const loader = new Image();

      loader.sizes = shot.sizes;
      loader.srcset = img.getAttribute('srcset') || '';
      loader.src = img.getAttribute('src') || '';

      stage.classList.add(SWAPPING_CLASS);

      const ready = loader.decode
        ? loader.decode().catch(() => {})
        : Promise.resolve();
      const faded = new Promise((resolve) => {
        fadeTimer = window.setTimeout(resolve, FADE_MS);
      });

      void Promise.all([ready, faded]).then(() => {
        if (activeSetup !== setup) {
          return;
        }

        putOnStage(img);
        stage.classList.remove(SWAPPING_CLASS);
      });
    };

    const showWidget = (item, animate = true) => {
      activeItem = item;
      activeSetup = null;
      items.forEach((candidate) => setPressed(candidate, candidate === item));

      const key = item.getAttribute('data-widget');
      let row = null;

      setupRows.forEach((candidate) => {
        const isRow = candidate.getAttribute('data-setups-for') === key;

        candidate.hidden = !isRow;
        row = isRow ? candidate : row;
      });

      widgetName.textContent =
        item.querySelector('.wg-item-name')?.textContent.trim() ?? '';

      const descriptionSource = document.getElementById(
        item.getAttribute('data-desc-id') || ''
      );

      description.textContent = descriptionSource
        ? descriptionSource.textContent.replace(/\s+/g, ' ').trim()
        : '';

      const tab = tabs.find(
        (candidate) =>
          candidate.getAttribute('data-group-tab') ===
          item.parentElement.getAttribute('data-wg-group')
      );

      groupName.textContent = tab ? tab.textContent.trim() : '';

      const first = row?.querySelector('.wg-setup');

      if (first) {
        showSetup(first, animate);
      }
    };

    const showGroup = (key, animate = true) => {
      tabs.forEach((tab) =>
        setPressed(tab, tab.getAttribute('data-group-tab') === key)
      );

      items.forEach((item) => {
        item.parentElement.hidden =
          item.parentElement.getAttribute('data-wg-group') !== key;
      });

      const first = items.find((item) => !item.parentElement.hidden);

      if (first) {
        showWidget(first, animate);
      }
    };

    /* ---- Autoplay ------------------------------------------------------- */

    const advance = () => {
      const row = activeSetup?.closest('.wg-setups');
      const setups = row ? Array.from(row.querySelectorAll('.wg-setup')) : [];
      const nextSetup = setups[setups.indexOf(activeSetup) + 1];

      if (nextSetup) {
        showSetup(nextSetup);

        return;
      }

      const visibleItems = items.filter((item) => !item.parentElement.hidden);
      const nextItem = visibleItems[visibleItems.indexOf(activeItem) + 1];

      if (nextItem) {
        showWidget(nextItem);

        return;
      }

      const activeTab = tabs.find((tab) =>
        tab.classList.contains(ACTIVE_CLASS)
      );
      const nextTab = tabs[(tabs.indexOf(activeTab) + 1) % tabs.length];

      showGroup(nextTab.getAttribute('data-group-tab'));
    };

    const schedule = () => {
      window.clearTimeout(autoplayTimer);

      if (autoplayOn && inView) {
        autoplayTimer = window.setTimeout(() => {
          advance();
          schedule();
        }, AUTOPLAY_MS);
      }
    };

    const stopAutoplay = () => {
      autoplayOn = false;
      window.clearTimeout(autoplayTimer);
    };

    /* ---- Wiring ----------------------------------------------------------- */

    tabs.forEach((tab) =>
      tab.addEventListener('click', () => {
        stopAutoplay();
        showGroup(tab.getAttribute('data-group-tab'));
      })
    );

    items.forEach((item) =>
      item.addEventListener('click', () => {
        stopAutoplay();
        showWidget(item);
      })
    );

    setupRows.forEach((row) =>
      row.querySelectorAll('.wg-setup').forEach((setup) =>
        setup.addEventListener('click', () => {
          stopAutoplay();
          showSetup(setup);
        })
      )
    );

    // A hand on the gallery is a reader looking: the walk stops for good
    gallery.addEventListener('pointerdown', stopAutoplay);
    gallery.addEventListener('keydown', stopAutoplay);

    window.addEventListener('resize', updateScale, { passive: true });

    showWidget(activeItem, false);
    updateScale();

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      return;
    }

    new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        schedule();
      },
      { threshold: 0.4 }
    ).observe(stage);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidgetGallery);
  } else {
    initWidgetGallery();
  }
})();

/**
 * Marble Trace Site - Widget gallery (section 02)
 *
 * A stage with one widget in one setup, a panel saying what it is, and a
 * strip of every widget under it. Everything the stage shows is in the
 * markup: a widget's name and group on its button and tab, its description
 * in the catalogue below, and every setup's picture as a hidden <img> the
 * build has already turned into WebP copies with the source's size. This
 * file only moves them onto the stage.
 *
 * Scale. The captures are taken at CAPTURE_SCALE, so a picture's width
 * attribute divided by it is the widget's width on the overlay. Every widget
 * is drawn at TARGET_SCALE of that, so the sizes keep their proportions to
 * each other; one whose largest setup would not fit the scene is brought
 * down until it does, and keeps that one scale across its setups.
 *
 * While the stage is in view and the reader has not touched the gallery, it
 * walks through the setups of the widget on it, then on to the next widget.
 * The first touch anywhere in the gallery ends that for good.
 */

(() => {
  'use strict';

  const ACTIVE_CLASS = 'is-active';
  const SWAPPING_CLASS = 'is-swapping';

  /* The device scale the widget captures are taken at (capture:widgets) */
  const CAPTURE_SCALE = 3;

  /* How large every widget is drawn against its size on the overlay. The
     captures hold three times that, so the pictures stay sharp. */
  const TARGET_SCALE = 1.6;

  /* The stylesheet's fade; the swap waits for the old picture to be gone */
  const FADE_MS = 250;

  const AUTOPLAY_MS = 3200;

  const setPressed = (button, pressed) => {
    button.classList.toggle(ACTIVE_CLASS, pressed);
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  };

  const overlayWidthOf = (img) =>
    Number(img.getAttribute('width')) / CAPTURE_SCALE;

  const overlayHeightOf = (img) =>
    Number(img.getAttribute('height')) / CAPTURE_SCALE;

  const padOrdinal = (value) => (value < 10 ? `0${value}` : String(value));

  const initWidgetGallery = () => {
    const gallery = document.querySelector('[data-widget-gallery] .wg');

    if (!gallery) {
      return;
    }

    const scene = gallery.querySelector('.wg-scene');
    const shot = gallery.querySelector('.wg-shot');
    const groupName = gallery.querySelector('.wg-group-name');
    const widgetName = gallery.querySelector('.wg-name');
    const indexNow = gallery.querySelector('.wg-index-now');
    const description = gallery.querySelector('.wg-desc');
    const strip = gallery.querySelector('.wg-strip');
    const tabs = Array.from(gallery.querySelectorAll('.wg-tab'));
    const items = Array.from(gallery.querySelectorAll('.wg-item'));
    const setupRows = Array.from(gallery.querySelectorAll('.wg-setups'));

    if (!scene || !shot || !strip || !items.length) {
      return;
    }

    let activeItem =
      items.find((item) => item.classList.contains(ACTIVE_CLASS)) ?? items[0];
    let activeRow = null;
    let activeSetup = null;
    let fadeTimer = 0;
    let autoplayTimer = 0;
    let autoplayOn = true;
    let inView = false;

    const groupOf = (item) => item.parentElement.getAttribute('data-wg-group');

    /* ---- Scale ---------------------------------------------------------- */

    const roomOfScene = () => {
      const style = getComputedStyle(scene);

      return {
        width:
          scene.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
        height:
          scene.clientHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom),
      };
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

    /* One scale per widget: the largest of its setups decides it */
    const updateScale = () => {
      if (!activeRow) {
        return;
      }

      const largest = Array.from(activeRow.querySelectorAll('img')).reduce(
        (size, img) => ({
          width: Math.max(size.width, overlayWidthOf(img) || 0),
          height: Math.max(size.height, overlayHeightOf(img) || 0),
        }),
        { width: 0, height: 0 }
      );
      const room = roomOfScene();

      if (!largest.width || !largest.height || room.width <= 0) {
        return;
      }

      const scale = Math.min(
        TARGET_SCALE,
        room.width / largest.width,
        room.height / largest.height
      );

      gallery.style.setProperty('--wg-scale', scale.toFixed(4));
      updateSizes();
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

      updateScale();
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
      activeRow
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

      gallery.classList.add(SWAPPING_CLASS);

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
        gallery.classList.remove(SWAPPING_CLASS);
      });
    };

    /* The strip scrolls itself, never the page */
    const bringIntoStrip = (item) => {
      const cell = item.parentElement;
      const left = cell.offsetLeft - strip.offsetLeft;
      const right = left + cell.offsetWidth;

      if (left < strip.scrollLeft) {
        strip.scrollTo({ left, behavior: 'smooth' });
      } else if (right > strip.scrollLeft + strip.clientWidth) {
        strip.scrollTo({
          left: right - strip.clientWidth,
          behavior: 'smooth',
        });
      }
    };

    const showGroupOf = (item) => {
      const key = groupOf(item);

      tabs.forEach((tab) =>
        setPressed(tab, tab.getAttribute('data-group-tab') === key)
      );

      items.forEach((candidate) => {
        candidate.parentElement.hidden = groupOf(candidate) !== key;
      });

      const tab = tabs.find(
        (candidate) => candidate.getAttribute('data-group-tab') === key
      );

      groupName.textContent = tab ? tab.textContent.trim() : '';
    };

    const showWidget = (item, animate = true) => {
      activeItem = item;
      activeSetup = null;
      items.forEach((candidate) => setPressed(candidate, candidate === item));
      showGroupOf(item);

      const key = item.getAttribute('data-widget');

      setupRows.forEach((row) => {
        const isRow = row.getAttribute('data-setups-for') === key;

        row.hidden = !isRow;
        activeRow = isRow ? row : activeRow;
      });

      widgetName.textContent =
        item.querySelector('.wg-item-name')?.textContent.trim() ?? '';
      indexNow.textContent = padOrdinal(items.indexOf(item) + 1);

      const descriptionSource = document.getElementById(
        item.getAttribute('data-desc-id') || ''
      );

      description.textContent = descriptionSource
        ? descriptionSource.textContent.replace(/\s+/g, ' ').trim()
        : '';

      bringIntoStrip(item);

      const first = activeRow?.querySelector('.wg-setup');

      if (first) {
        showSetup(first, animate);
      }
    };

    const step = (direction) => {
      const next =
        items[
          (items.indexOf(activeItem) + direction + items.length) % items.length
        ];

      showWidget(next);
    };

    /* ---- Autoplay ------------------------------------------------------- */

    const advance = () => {
      const setups = Array.from(activeRow?.querySelectorAll('.wg-setup') ?? []);
      const nextSetup = setups[setups.indexOf(activeSetup) + 1];

      if (nextSetup) {
        showSetup(nextSetup);
      } else {
        step(1);
      }
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
        const key = tab.getAttribute('data-group-tab');
        const first = items.find((item) => groupOf(item) === key);

        if (first) {
          showWidget(first);
        }
      })
    );

    items.forEach((item) =>
      item.addEventListener('click', () => showWidget(item))
    );

    setupRows.forEach((row) =>
      row
        .querySelectorAll('.wg-setup')
        .forEach((setup) =>
          setup.addEventListener('click', () => showSetup(setup))
        )
    );

    gallery
      .querySelectorAll('.wg-step')
      .forEach((button) =>
        button.addEventListener('click', () =>
          step(Number(button.getAttribute('data-step')) || 1)
        )
      );

    gallery.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1);
      }
    });

    // A hand on the gallery is a reader looking: the walk stops for good
    gallery.addEventListener('pointerdown', stopAutoplay);
    gallery.addEventListener('keydown', stopAutoplay);

    window.addEventListener('resize', updateScale, { passive: true });

    showWidget(activeItem, false);

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
      { threshold: 0.5 }
    ).observe(scene);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidgetGallery);
  } else {
    initWidgetGallery();
  }
})();

/**
 * Marble Trace Site — Layouts demo
 *
 * The auto-switch acted out: a car class and a session pick the layout, and
 * the screen crossfades to its screenshot. The garage is one layout for every
 * car; practice, qualifying and the race have one per class.
 *
 * Until the reader picks something, the demo steps through every shot on its
 * own: the garage, then each class session by session. The first click on a
 * class or a session hands the choice to the reader for good.
 *
 * A shot that fails to load leaves the demo: its session is hidden for that
 * class, so a missing picture never shows up as an empty frame.
 */

(() => {
  'use strict';

  const STEP_MS = 3600;
  const ACTIVE_CLASS = 'is-active';
  const TIMING_CLASS = 'is-timing';
  const SHARED_SESSION = 'garage';

  const initLayoutDemo = () => {
    const screen = document.querySelector('[data-layout-screen]');

    if (!screen) {
      return;
    }

    const sessionLabel = document.querySelector('[data-layout-label]');
    const classLabel = document.querySelector('[data-layout-class]');
    const classLabelPart = document.querySelector('[data-layout-class-part]');
    const classButtons = Array.from(
      document.querySelectorAll('[data-car-class]')
    );
    const sessionButtons = Array.from(
      document.querySelectorAll('[data-session]')
    );
    const shots = new Map(
      Array.from(screen.querySelectorAll('[data-shot]')).map((shot) => [
        shot.dataset.shot,
        shot,
      ])
    );

    const shotKey = (carClass, session) =>
      session === SHARED_SESSION ? session : `${carClass}-${session}`;

    const hasShot = (carClass, session) =>
      shots.has(shotKey(carClass, session));

    const activeButton = (buttons) =>
      buttons.find((button) => button.classList.contains(ACTIVE_CLASS));

    let carClass = activeButton(classButtons)?.dataset.carClass;
    let session = activeButton(sessionButtons)?.dataset.session;
    let timer = 0;
    let visible = false;
    let playing = true;
    let hovered = false;

    /** Every shot in the order the demo plays them. */
    const playlist = () => {
      const steps = [];

      if (shots.has(SHARED_SESSION) && classButtons.length > 0) {
        steps.push([classButtons[0].dataset.carClass, SHARED_SESSION]);
      }

      classButtons.forEach((classButton) => {
        sessionButtons.forEach((sessionButton) => {
          const step = [
            classButton.dataset.carClass,
            sessionButton.dataset.session,
          ];

          if (step[1] !== SHARED_SESSION && hasShot(...step)) {
            steps.push(step);
          }
        });
      });

      return steps;
    };

    const press = (buttons, isActive) => {
      buttons.forEach((button) => {
        const active = isActive(button);

        button.classList.toggle(ACTIVE_CLASS, active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    const show = (nextClass, nextSession) => {
      carClass = nextClass;
      session = hasShot(carClass, nextSession)
        ? nextSession
        : sessionButtons
            .map((button) => button.dataset.session)
            .findLast((candidate) => hasShot(carClass, candidate));

      const key = shotKey(carClass, session);

      press(classButtons, (button) => button.dataset.carClass === carClass);
      press(sessionButtons, (button) => button.dataset.session === session);

      // A class without a shot for a session has no button for it
      sessionButtons.forEach((button) => {
        button.hidden = !hasShot(carClass, button.dataset.session);
      });

      shots.forEach((shot, shotName) => {
        shot.classList.toggle(ACTIVE_CLASS, shotName === key);
      });

      screen.querySelectorAll('[data-hotspots-for]').forEach((hotspots) => {
        hotspots.hidden = hotspots.dataset.hotspotsFor !== key;
      });

      const classButton = classButtons.find(
        (button) => button.dataset.carClass === carClass
      );
      const sessionButton = sessionButtons.find(
        (button) => button.dataset.session === session
      );

      if (classLabel && classButton) {
        classLabel.textContent = classButton.textContent.trim();
      }

      // The garage is every class's: the label names the session alone
      if (classLabelPart) {
        classLabelPart.hidden = session === SHARED_SESSION;
      }

      if (sessionLabel && sessionButton) {
        sessionLabel.textContent = sessionButton.textContent.trim();
      }
    };

    const stopTiming = () => {
      sessionButtons.forEach((button) => button.classList.remove(TIMING_CLASS));
    };

    const startTiming = () => {
      const button = activeButton(sessionButtons);

      stopTiming();

      if (!button) {
        return;
      }

      // Restart the line even when the same step stays active
      void button.offsetWidth;
      button.style.setProperty('--step-ms', `${STEP_MS}ms`);
      button.classList.add(TIMING_CLASS);
    };

    const schedule = () => {
      window.clearTimeout(timer);
      stopTiming();

      const steps = playlist();

      if (!playing || !visible || hovered || steps.length < 2) {
        return;
      }

      startTiming();

      timer = window.setTimeout(() => {
        const current = steps.findIndex(
          ([stepClass, stepSession]) =>
            shotKey(stepClass, stepSession) === shotKey(carClass, session)
        );
        const [nextClass, nextSession] = steps[(current + 1) % steps.length];

        show(nextClass, nextSession);
        schedule();
      }, STEP_MS);
    };

    const takeOver = () => {
      playing = false;
      schedule();
    };

    const dropShot = (key) => {
      shots.get(key)?.remove();
      shots.delete(key);
      screen.querySelector(`[data-hotspots-for="${key}"]`)?.remove();
      show(carClass, session);
      schedule();
    };

    shots.forEach((shot, key) => {
      // Every shot is wanted as soon as the block is near, not only the one
      // on top: a lazy image that is never displayed would never load, and
      // a missing one would never leave the demo.
      shot.loading = 'eager';

      // A shot that already failed before this ran fires no error event.
      if (shot.complete && shot.naturalWidth === 0 && shot.src) {
        dropShot(key);

        return;
      }

      shot.addEventListener('error', () => dropShot(key));
    });

    classButtons.forEach((button) => {
      button.addEventListener('click', () => {
        takeOver();
        show(button.dataset.carClass, session);
      });
    });

    sessionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        takeOver();
        show(carClass, button.dataset.session);
      });
    });

    if (carClass && session) {
      show(carClass, session);
    }

    // A reader on the screen is reading its notes: the demo waits for them
    // and moves on once the pointer or the focus has left.
    const pause = () => {
      hovered = true;
      schedule();
    };
    const resume = (event) => {
      if (event.relatedTarget && screen.contains(event.relatedTarget)) {
        return;
      }

      hovered = false;
      schedule();
    };

    screen.addEventListener('pointerenter', pause);
    screen.addEventListener('pointerleave', resume);
    screen.addEventListener('focusin', pause);
    screen.addEventListener('focusout', resume);

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver((observed) => {
      visible = observed.some((entry) => entry.isIntersecting);
      schedule();
    });

    observer.observe(screen);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLayoutDemo);
  } else {
    initLayoutDemo();
  }
})();

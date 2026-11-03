/**
 * Marble Trace Site — Voice crew radio
 *
 * Plays one exchange at a time on the radio over the crew screenshot, the way
 * the Crew Radio widget shows it: the driver's line is on the air while the
 * sentence is typed out as it is heard, then the engineer's line takes the
 * air and the reply is typed under it, and a pit command the sim took gets
 * its check. The sentences are the
 * buttons under the radio; their reply is the button's data-reply, translated
 * with the page.
 *
 * It goes round the buttons by itself while the band is on screen. A click
 * on a button plays that one and stops the round: the visitor has the radio
 * now. A visitor who asked for reduced motion gets the lines at once, and no
 * round at all.
 */

(() => {
  'use strict';

  const TYPE_MS = 34;
  const ANSWER_DELAY_MS = 420;
  const NEXT_EXCHANGE_MS = 2600;
  const EMPTY_LINE = ' ';

  const ON_AIR_CLASS = 'is-on-air';
  const ACTIVE_CLASS = 'is-active';
  const SHOWN_CLASS = 'is-shown';

  const initCrewDemo = () => {
    const demo = document.querySelector('[data-crew-demo]');

    if (!demo) {
      return;
    }

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const driverLine = demo.querySelector('[data-crew-driver]');
    const engineerLine = demo.querySelector('[data-crew-engineer]');
    const heard = demo.querySelector('[data-crew-heard]');
    const reply = demo.querySelector('[data-crew-reply]');
    const mark = demo.querySelector('[data-crew-mark]');
    const prompts = Array.from(demo.querySelectorAll('.crew-prompt'));

    let timer = 0;
    let nextIndex = 0;
    let autoplay = !reducedMotion;
    let visible = false;
    // Bumped by every new exchange, so the typing of the one before stops
    let exchange = 0;

    const wait = (ms) =>
      new Promise((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });

    const typeInto = async (element, text, id) => {
      if (reducedMotion) {
        element.textContent = text;

        return;
      }

      for (let length = 1; length <= text.length; length++) {
        if (id !== exchange) {
          return;
        }

        element.textContent = text.slice(0, length);
        await wait(TYPE_MS);
      }
    };

    const play = async (prompt) => {
      window.clearTimeout(timer);
      exchange += 1;

      const id = exchange;

      prompts.forEach((item) =>
        item.classList.toggle(ACTIVE_CLASS, item === prompt)
      );
      heard.textContent = EMPTY_LINE;
      reply.textContent = EMPTY_LINE;
      mark.classList.remove(SHOWN_CLASS);
      engineerLine.classList.remove(ON_AIR_CLASS);
      driverLine.classList.add(ON_AIR_CLASS);

      await typeInto(heard, prompt.textContent.trim(), id);

      if (id !== exchange) {
        return;
      }

      mark.classList.toggle(SHOWN_CLASS, prompt.hasAttribute('data-pit'));
      await wait(reducedMotion ? 0 : ANSWER_DELAY_MS);
      driverLine.classList.remove(ON_AIR_CLASS);
      engineerLine.classList.add(ON_AIR_CLASS);
      await typeInto(reply, prompt.dataset.reply, id);

      if (id !== exchange) {
        return;
      }

      if (autoplay && visible) {
        nextIndex = (prompts.indexOf(prompt) + 1) % prompts.length;
        await wait(NEXT_EXCHANGE_MS);

        if (id === exchange && autoplay && visible) {
          void play(prompts[nextIndex]);
        }
      }
    };

    prompts.forEach((prompt) => {
      prompt.addEventListener('click', () => {
        autoplay = false;
        void play(prompt);
      });
    });

    if (reducedMotion) {
      void play(prompts[0]);

      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);

        if (visible && autoplay) {
          void play(prompts[nextIndex]);
        } else if (!visible) {
          window.clearTimeout(timer);
          exchange += 1;
          driverLine.classList.remove(ON_AIR_CLASS);
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(demo);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCrewDemo);
  } else {
    initCrewDemo();
  }
})();

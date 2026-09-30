/**
 * Marble Trace Site — F9, acted out on the page
 *
 * Pressing F9 (the cap in the two-keys band, or the real key) puts the page
 * into the overlay's own edit mode: the screen takes the blue, hatched tint
 * the overlay canvas gets, the main blocks of copy are framed the way widgets
 * are, with the corner marks, and they can be dragged. It ends on its own
 * after a while, from the exit button, or on Escape - and everything dragged
 * slides back, because a block only ever moves by `translate`, never by
 * layout, so nothing else on the page reflows.
 *
 * F8 has no counterpart here on purpose: what it opens up is our own widgets,
 * and a stand-in drawn for the page would pass for one of them.
 *
 * The band's own loop only animates the caps; edit mode starts only from a
 * press the visitor made. The caps announce theirs with an `mt:key` event.
 */

(() => {
  'use strict';

  const EDIT_SECONDS = 20;
  const RESTORE_MS = 600;
  const LABEL_MAX_CHARS = 26;

  const EDITABLE_SELECTOR = [
    '.hero-content',
    '.gallery-head-title',
    '.screens-head',
    '.feature-copy',
    '.interact-copy',
    '.perf-lead',
    '.faq-lead',
    '.download-copy',
  ].join(', ');

  let mode = null;
  let endTimer = 0;
  let tickTimer = 0;
  let frameRequest = 0;

  // ---- Shared ------------------------------------------------------------

  const element = (tag, className, text) => {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  };

  const formatSeconds = (seconds) =>
    '0:' + String(Math.max(0, seconds)).padStart(2, '0');

  const countdown = (seconds, onTick, onEnd) => {
    let left = seconds;

    onTick(left);
    tickTimer = window.setInterval(() => {
      left -= 1;
      onTick(left);

      if (left <= 0) {
        onEnd();
      }
    }, 1000);
  };

  const stopTimers = () => {
    window.clearInterval(tickTimer);
    window.clearTimeout(endTimer);
    window.cancelAnimationFrame(frameRequest);
  };

  // ---- Edit mode (F9) --------------------------------------------------------

  const edit = {
    root: null,
    frames: [],
    timeLabel: null,
  };

  const labelFor = (block) => {
    const heading = block.querySelector('h1, h2, h3');
    const text = (heading ? heading.textContent : block.textContent)
      .replace(/\s+/g, ' ')
      .trim();

    return text.length > LABEL_MAX_CHARS
      ? text.slice(0, LABEL_MAX_CHARS - 1) + '…'
      : text;
  };

  const placeFrames = () => {
    edit.frames.forEach(({ block, frame }) => {
      const box = block.getBoundingClientRect();

      frame.style.transform = `translate(${box.left}px, ${box.top}px)`;
      frame.style.width = box.width + 'px';
      frame.style.height = box.height + 'px';
    });

    frameRequest = window.requestAnimationFrame(placeFrames);
  };

  const startDrag = (event, block) => {
    if (event.button !== 0 || mode !== 'edit') {
      return;
    }

    event.preventDefault();

    const [startX, startY] = (block.style.translate || '0px 0px')
      .split(' ')
      .map((value) => parseFloat(value) || 0);
    const originX = event.clientX;
    const originY = event.clientY;
    const target = event.currentTarget;

    target.setPointerCapture(event.pointerId);
    target.classList.add('is-grabbing');

    const move = (moveEvent) => {
      const dx = startX + moveEvent.clientX - originX;
      const dy = startY + moveEvent.clientY - originY;

      block.style.translate = `${dx}px ${dy}px`;
    };

    const end = () => {
      target.classList.remove('is-grabbing');
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
    };

    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  };

  const buildEdit = () => {
    const root = element('div', 'page-edit');

    root.setAttribute('aria-hidden', 'true');
    root.appendChild(element('div', 'page-edit-tint'));

    const bar = element('div', 'page-edit-bar');
    const note = element('p', 'page-edit-note');

    note.append(
      element('span', 'page-edit-dot'),
      document.body.dataset.editNote || ''
    );
    edit.timeLabel = element('span', 'page-edit-time');
    note.appendChild(edit.timeLabel);

    const exit = element(
      'button',
      'page-edit-exit',
      document.body.dataset.editExit || ''
    );

    exit.type = 'button';
    exit.addEventListener('click', () => leave());

    bar.append(note, exit);
    root.appendChild(bar);

    document.querySelectorAll(EDITABLE_SELECTOR).forEach((block) => {
      const frame = element('div', 'page-edit-frame');

      frame.append(
        element('span', 'page-edit-corner page-edit-corner-tl'),
        element('span', 'page-edit-corner page-edit-corner-tr'),
        element('span', 'page-edit-corner page-edit-corner-bl'),
        element('span', 'page-edit-corner page-edit-corner-br'),
        element('span', 'page-edit-label', labelFor(block))
      );
      frame.addEventListener('pointerdown', (event) => startDrag(event, block));
      root.appendChild(frame);
      edit.frames.push({ block, frame });
    });

    document.body.appendChild(root);
    edit.root = root;
  };

  const enterEdit = () => {
    if (!edit.root) {
      buildEdit();
    }

    edit.frames.forEach(({ block }) => block.classList.add('is-edit-target'));
    document.body.classList.add('is-page-editing');
    placeFrames();
    countdown(
      EDIT_SECONDS,
      (left) => {
        edit.timeLabel.textContent = formatSeconds(left);
      },
      () => leave()
    );
  };

  const leaveEdit = () => {
    document.body.classList.remove('is-page-editing');

    edit.frames.forEach(({ block }) => {
      block.classList.add('is-edit-returning');
      block.style.translate = '';
    });

    endTimer = window.setTimeout(() => {
      edit.frames.forEach(({ block }) => {
        block.classList.remove('is-edit-target', 'is-edit-returning');
      });
    }, RESTORE_MS);
  };

  // ---- Switching ---------------------------------------------------------------

  const leave = () => {
    stopTimers();

    if (mode === 'edit') {
      leaveEdit();
    }

    mode = null;
  };

  /* Dragging page blocks needs a mouse and room to move them: on a phone or
     a tablet the edit mode only scrambles a single-column page under a
     finger, so there the keycap stays a demo of the key and nothing more. */
  const EDIT_SUPPORTED = window.matchMedia(
    '(min-width: 1025px) and (hover: hover) and (pointer: fine)'
  );

  const toggleEdit = () => {
    const wasActive = mode === 'edit';

    if (!wasActive && !EDIT_SUPPORTED.matches) {
      return;
    }

    leave();

    if (wasActive) {
      return;
    }

    mode = 'edit';
    enterEdit();
  };

  // A window narrowed or turned into a tablet mid-edit leaves the mode.
  EDIT_SUPPORTED.addEventListener('change', () => {
    if (!EDIT_SUPPORTED.matches && mode === 'edit') {
      leave();
    }
  });

  document.addEventListener('mt:key', (event) => {
    if (event.detail === 'edit') {
      toggleEdit();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    if (event.key === 'F9') {
      event.preventDefault();
      toggleEdit();
    } else if (event.key === 'Escape' && mode) {
      leave();
    }
  });
})();

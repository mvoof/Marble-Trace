import { useState } from 'react';

/** A node a hot write targets: markup or SVG. */
export type LiveElement = HTMLElement | SVGElement;

/** What a part was last written, per kind of write, so a frame allocates no key. */
interface WrittenValues {
  state: Map<string, string>;
  style: Map<string, string>;
  attribute: Map<string, string>;
  classes: Map<string, boolean>;
}

/**
 * Named nodes a hot write targets, in place of `querySelector` inside a frame,
 * and each write applied only when its value changed — an unchanged tick
 * leaves the DOM, and the overlay, untouched (`docs/rendering.md`).
 *
 * Call the writers from inside `scheduleWrite` of `useReactiveDomWrite`.
 */
export interface LiveParts<PartName extends string> {
  /** Ref callback for a node: `<span ref={parts.ref('speed')} />`. Stable per name. */
  ref: (name: PartName) => (element: LiveElement | null) => void;
  text: (name: PartName, text: string) => void;
  /** A state as a `data-*` attribute; `null` removes it. Styles select on it in SCSS. */
  state: (name: PartName, key: string, value: string | null) => void;
  /** A custom property or a plain style property. */
  style: (name: PartName, property: string, value: string | null) => void;
  /** An attribute — an SVG path's `d`; `null` removes it. */
  attribute: (name: PartName, attribute: string, value: string | null) => void;
  /** The node a name holds now — for a helper that takes an element, such as a blink. */
  elementOf: (name: PartName) => LiveElement | null;
  /** Toggles one class — for a class a shared stylesheet owns. */
  toggleClass: (name: PartName, className: string, isOn: boolean) => void;
}

const ABSENT = '\u0000';

const emptyWritten = (): WrittenValues => ({
  state: new Map(),
  style: new Map(),
  attribute: new Map(),
  classes: new Map(),
});

/**
 * What each node was last written, whichever API wrote it — a part or a
 * `write*` helper — so a node written through both is checked against one
 * record. Keyed by the node: one that is replaced starts with nothing written.
 */
const writtenByElement = new WeakMap<LiveElement, WrittenValues>();

const writtenOf = (element: LiveElement): WrittenValues => {
  let written = writtenByElement.get(element);

  if (!written) {
    written = emptyWritten();
    writtenByElement.set(element, written);
  }

  return written;
};

/** Whether `value` is new for `key`; records it if so. */
const changedValue = (
  written: Map<string, string>,
  key: string,
  value: string | null
): boolean => {
  const next = value ?? ABSENT;

  if (written.get(key) === next) {
    return false;
  }

  written.set(key, next);

  return true;
};

/**
 * The text of the element a reactive write targets, written only when it
 * changed. Compared with the node itself, not a record: reading the text
 * allocates nothing, and a re-render that replaced it is seen.
 */
export const writeText = (element: LiveElement, text: string): void => {
  if (element.textContent !== text) {
    element.textContent = text;
  }
};

/**
 * A style property of the element a reactive write targets, written only when
 * it changed; `null` removes it.
 */
export const writeStyle = (
  element: LiveElement,
  property: string,
  value: string | null
): void => {
  if (!changedValue(writtenOf(element).style, property, value)) {
    return;
  }

  if (value === null) {
    element.style.removeProperty(property);
  } else {
    element.style.setProperty(property, value);
  }
};

/**
 * A `data-*` state of the element a reactive write targets, written only when
 * it changed; `null` removes it.
 */
export const writeState = (
  element: LiveElement,
  key: string,
  value: string | null
): void => {
  if (!changedValue(writtenOf(element).state, key, value)) {
    return;
  }

  if (value === null) {
    delete element.dataset[key];
  } else {
    element.dataset[key] = value;
  }
};

/** An attribute of the element, written only when it changed; `null` removes it. */
const writeAttribute = (
  element: LiveElement,
  attribute: string,
  value: string | null
): void => {
  if (!changedValue(writtenOf(element).attribute, attribute, value)) {
    return;
  }

  if (value === null) {
    element.removeAttribute(attribute);
  } else {
    element.setAttribute(attribute, value);
  }
};

/** One class of the element, toggled only when it changed. */
const toggleClassOf = (
  element: LiveElement,
  className: string,
  isOn: boolean
): void => {
  const { classes } = writtenOf(element);

  if (classes.get(className) === isOn) {
    return;
  }

  classes.set(className, isOn);
  element.classList.toggle(className, isOn);
};

export const createLiveParts = <
  PartName extends string,
>(): LiveParts<PartName> => {
  const elementsByName = new Map<PartName, LiveElement | null>();
  const refsByName = new Map<PartName, (element: LiveElement | null) => void>();

  const elementOf = (name: PartName): LiveElement | null =>
    elementsByName.get(name) ?? null;

  return {
    ref: (name) => {
      let ref = refsByName.get(name);

      if (!ref) {
        ref = (element) => {
          if (elementsByName.get(name) === element) {
            return;
          }

          elementsByName.set(name, element);

          // A node handed in afresh may have been rendered over since it was
          // last written.
          if (element) {
            writtenByElement.delete(element);
          }
        };
        refsByName.set(name, ref);
      }

      return ref;
    },
    elementOf,
    text: (name, text) => {
      const element = elementOf(name);

      if (element) {
        writeText(element, text);
      }
    },
    state: (name, key, value) => {
      const element = elementOf(name);

      if (element) {
        writeState(element, key, value);
      }
    },
    style: (name, property, value) => {
      const element = elementOf(name);

      if (element) {
        writeStyle(element, property, value);
      }
    },
    attribute: (name, attribute, value) => {
      const element = elementOf(name);

      if (element) {
        writeAttribute(element, attribute, value);
      }
    },
    toggleClass: (name, className, isOn) => {
      const element = elementOf(name);

      if (element) {
        toggleClassOf(element, className, isOn);
      }
    },
  };
};

/** One `LiveParts` for the component's lifetime. */
export const useLiveParts = <
  PartName extends string,
>(): LiveParts<PartName> => {
  const [parts] = useState(() => createLiveParts<PartName>());

  return parts;
};

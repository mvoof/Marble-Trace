import { useState } from 'react';

/** A node a hot write targets: markup or SVG. */
export type LiveElement = HTMLElement | SVGElement;

/** What a part was last written, per kind of write, so a frame allocates no key. */
interface WrittenValues {
  text: string | null;
  state: Map<string, string>;
  style: Map<string, string>;
  attribute: Map<string, string>;
  classes: Map<string, boolean>;
}

type KeyedWrite = 'state' | 'style' | 'attribute';

interface LivePart {
  element: LiveElement | null;
  written: WrittenValues;
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
  text: null,
  state: new Map(),
  style: new Map(),
  attribute: new Map(),
  classes: new Map(),
});

const forgetWritten = (written: WrittenValues): void => {
  written.text = null;
  written.state.clear();
  written.style.clear();
  written.attribute.clear();
  written.classes.clear();
};

export const createLiveParts = <
  PartName extends string,
>(): LiveParts<PartName> => {
  const partsByName = new Map<PartName, LivePart>();
  const refsByName = new Map<PartName, (element: LiveElement | null) => void>();

  const partOf = (name: PartName): LivePart => {
    let part = partsByName.get(name);

    if (!part) {
      part = { element: null, written: emptyWritten() };
      partsByName.set(name, part);
    }

    return part;
  };

  /** The node to write, or null when it is gone or already holds the value. */
  const changedElement = (
    name: PartName,
    kind: KeyedWrite,
    key: string,
    value: string
  ): LiveElement | null => {
    const part = partOf(name);
    const written = part.written[kind];

    if (!part.element || written.get(key) === value) {
      return null;
    }

    written.set(key, value);

    return part.element;
  };

  return {
    ref: (name) => {
      let ref = refsByName.get(name);

      if (!ref) {
        ref = (element) => {
          const part = partOf(name);

          if (part.element === element) {
            return;
          }

          part.element = element;
          forgetWritten(part.written);
        };
        refsByName.set(name, ref);
      }

      return ref;
    },
    elementOf: (name) => partsByName.get(name)?.element ?? null,
    text: (name, text) => {
      const part = partOf(name);

      if (!part.element || part.written.text === text) {
        return;
      }

      part.written.text = text;
      part.element.textContent = text;
    },
    state: (name, key, value) => {
      const element = changedElement(name, 'state', key, value ?? ABSENT);

      if (!element) {
        return;
      }

      if (value === null) {
        delete element.dataset[key];
      } else {
        element.dataset[key] = value;
      }
    },
    style: (name, property, value) => {
      const element = changedElement(name, 'style', property, value ?? ABSENT);

      if (!element) {
        return;
      }

      if (value === null) {
        element.style.removeProperty(property);
      } else {
        element.style.setProperty(property, value);
      }
    },
    attribute: (name, attribute, value) => {
      const element = changedElement(
        name,
        'attribute',
        attribute,
        value ?? ABSENT
      );

      if (!element) {
        return;
      }

      if (value === null) {
        element.removeAttribute(attribute);
      } else {
        element.setAttribute(attribute, value);
      }
    },
    toggleClass: (name, className, isOn) => {
      const part = partOf(name);

      if (!part.element || part.written.classes.get(className) === isOn) {
        return;
      }

      part.written.classes.set(className, isOn);
      part.element.classList.toggle(className, isOn);
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

/** The text of the element a reactive write targets, written only when it changed. */
export const writeText = (element: LiveElement, text: string): void => {
  if (element.textContent !== text) {
    element.textContent = text;
  }
};

const writtenStyles = new WeakMap<LiveElement, Map<string, string>>();

/**
 * A style property of the element a reactive write targets, written only when
 * it changed; `null` removes it.
 */
export const writeStyle = (
  element: LiveElement,
  property: string,
  value: string | null
): void => {
  let written = writtenStyles.get(element);

  if (!written) {
    written = new Map();
    writtenStyles.set(element, written);
  }

  const next = value ?? ABSENT;

  if (written.get(property) === next) {
    return;
  }

  written.set(property, next);

  if (value === null) {
    element.style.removeProperty(property);
  } else {
    element.style.setProperty(property, value);
  }
};

const writtenStates = new WeakMap<LiveElement, Map<string, string>>();

/**
 * A `data-*` state of the element a reactive write targets, written only when
 * it changed; `null` removes it.
 */
export const writeState = (
  element: LiveElement,
  key: string,
  value: string | null
): void => {
  let written = writtenStates.get(element);

  if (!written) {
    written = new Map();
    writtenStates.set(element, written);
  }

  const next = value ?? ABSENT;

  if (written.get(key) === next) {
    return;
  }

  written.set(key, next);

  if (value === null) {
    delete element.dataset[key];
  } else {
    element.dataset[key] = value;
  }
};

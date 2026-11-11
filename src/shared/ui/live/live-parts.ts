import { useState } from 'react';

/** A node a hot write targets: markup or SVG. */
export type LiveElement = HTMLElement | SVGElement;

interface LivePart {
  element: LiveElement | null;
  written: Map<string, string>;
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

const TEXT_KEY = 'text';
const ABSENT = '\u0000';

export const createLiveParts = <
  PartName extends string,
>(): LiveParts<PartName> => {
  const partsByName = new Map<PartName, LivePart>();
  const refsByName = new Map<PartName, (element: LiveElement | null) => void>();

  const partOf = (name: PartName): LivePart => {
    let part = partsByName.get(name);

    if (!part) {
      part = { element: null, written: new Map() };
      partsByName.set(name, part);
    }

    return part;
  };

  const writeOnChange = (
    name: PartName,
    key: string,
    value: string,
    write: (element: LiveElement) => void
  ) => {
    const part = partOf(name);

    if (!part.element || part.written.get(key) === value) {
      return;
    }

    part.written.set(key, value);
    write(part.element);
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
          part.written.clear();
        };
        refsByName.set(name, ref);
      }

      return ref;
    },
    elementOf: (name) => partsByName.get(name)?.element ?? null,
    text: (name, text) =>
      writeOnChange(name, TEXT_KEY, text, (element) => {
        element.textContent = text;
      }),
    state: (name, key, value) =>
      writeOnChange(name, `state:${key}`, value ?? ABSENT, (element) => {
        if (value === null) {
          delete element.dataset[key];
        } else {
          element.dataset[key] = value;
        }
      }),
    style: (name, property, value) =>
      writeOnChange(name, `style:${property}`, value ?? ABSENT, (element) => {
        if (value === null) {
          element.style.removeProperty(property);
        } else {
          element.style.setProperty(property, value);
        }
      }),
    attribute: (name, attribute, value) =>
      writeOnChange(name, `attr:${attribute}`, value ?? ABSENT, (element) => {
        if (value === null) {
          element.removeAttribute(attribute);
        } else {
          element.setAttribute(attribute, value);
        }
      }),
    toggleClass: (name, className, isOn) =>
      writeOnChange(name, `class:${className}`, isOn ? '1' : '0', (element) => {
        element.classList.toggle(className, isOn);
      }),
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

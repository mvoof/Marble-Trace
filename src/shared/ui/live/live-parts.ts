import { useState } from 'react';

interface LivePart {
  element: HTMLElement | null;
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
  ref: (name: PartName) => (element: HTMLElement | null) => void;
  text: (name: PartName, text: string) => void;
  /** A state as a `data-*` attribute; `null` removes it. Styles select on it in SCSS. */
  state: (name: PartName, key: string, value: string | null) => void;
  /** A custom property or a plain style property. */
  style: (name: PartName, property: string, value: string | null) => void;
  /** The node a name holds now — for a helper that takes an element, such as a blink. */
  elementOf: (name: PartName) => HTMLElement | null;
  /** Toggles one class — for a class a shared stylesheet owns. */
  toggleClass: (name: PartName, className: string, isOn: boolean) => void;
}

const TEXT_KEY = 'text';
const ABSENT = '\u0000';

export const createLiveParts = <
  PartName extends string,
>(): LiveParts<PartName> => {
  const partsByName = new Map<PartName, LivePart>();
  const refsByName = new Map<PartName, (element: HTMLElement | null) => void>();

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
    write: (element: HTMLElement) => void
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

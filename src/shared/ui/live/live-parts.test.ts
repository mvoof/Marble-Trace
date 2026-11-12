import { describe, expect, it } from 'vitest';

import { createLiveParts, writeState, writeStyle } from './live-parts';

// Only what the parts touch; there is no DOM in the test environment.
const fakeElement = () => {
  const writes: string[] = [];
  const properties = new Map<string, string>();
  const classes = new Set<string>();
  let text = '';

  const element = {
    dataset: {} as Record<string, string>,
    get textContent() {
      return text;
    },
    set textContent(value: string) {
      text = value;
      writes.push(`text=${value}`);
    },
    style: {
      setProperty: (property: string, value: string) => {
        properties.set(property, value);
        writes.push(`${property}=${value}`);
      },
      removeProperty: (property: string) => {
        properties.delete(property);
        writes.push(`-${property}`);
      },
    },
    classList: {
      toggle: (className: string, isOn: boolean) => {
        if (isOn) {
          classes.add(className);
        } else {
          classes.delete(className);
        }

        writes.push(`${className}:${isOn}`);
      },
    },
  };

  return {
    element: element as unknown as HTMLElement,
    writes,
    properties,
    classes,
  };
};

describe('createLiveParts', () => {
  it('writes a value only when it changed', () => {
    const parts = createLiveParts<'speed'>();
    const speed = fakeElement();
    parts.ref('speed')(speed.element);

    parts.text('speed', '120');
    parts.text('speed', '120');
    parts.text('speed', '121');

    expect(speed.writes).toEqual(['text=120', 'text=121']);
  });

  it('writes nothing before the node is attached', () => {
    const parts = createLiveParts<'speed'>();

    expect(() => parts.text('speed', '120')).not.toThrow();
  });

  it('rewrites everything onto a new node', () => {
    const parts = createLiveParts<'speed'>();
    const first = fakeElement();
    const second = fakeElement();

    parts.ref('speed')(first.element);
    parts.text('speed', '120');
    parts.ref('speed')(second.element);
    parts.text('speed', '120');

    expect(second.writes).toEqual(['text=120']);
  });

  it('keeps one ref callback per name', () => {
    const parts = createLiveParts<'speed' | 'gear'>();

    expect(parts.ref('speed')).toBe(parts.ref('speed'));
    expect(parts.ref('speed')).not.toBe(parts.ref('gear'));
  });

  it('sets and removes a state attribute', () => {
    const parts = createLiveParts<'gap'>();
    const gap = fakeElement();
    parts.ref('gap')(gap.element);

    parts.state('gap', 'sign', 'positive');
    expect(gap.element.dataset.sign).toBe('positive');

    parts.state('gap', 'sign', null);
    expect(gap.element.dataset.sign).toBeUndefined();
  });

  it('writes a style property and a class once per change', () => {
    const parts = createLiveParts<'gear'>();
    const gear = fakeElement();
    parts.ref('gear')(gear.element);

    parts.style('gear', 'color', 'red');
    parts.style('gear', 'color', 'red');
    parts.toggleClass('gear', 'blink', true);
    parts.toggleClass('gear', 'blink', true);
    parts.style('gear', 'color', null);

    expect(gear.writes).toEqual(['color=red', 'blink:true', '-color']);
  });

  it('shares one record with the write helpers for the same node', () => {
    const parts = createLiveParts<'rail'>();
    const rail = fakeElement();
    parts.ref('rail')(rail.element);

    parts.style('rail', 'color', 'red');
    writeStyle(rail.element, 'color', 'red');
    writeStyle(rail.element, 'color', 'blue');
    parts.style('rail', 'color', 'blue');

    expect(rail.writes).toEqual(['color=red', 'color=blue']);
  });
});

describe('writeState', () => {
  it('sets, skips an unchanged value and removes', () => {
    const rail = fakeElement();

    writeState(rail.element, 'urgency', 'brake');
    expect(rail.element.dataset.urgency).toBe('brake');

    // Tampered from outside: an unchanged write must not touch the node.
    rail.element.dataset.urgency = 'tampered';
    writeState(rail.element, 'urgency', 'brake');
    expect(rail.element.dataset.urgency).toBe('tampered');

    writeState(rail.element, 'urgency', null);
    expect(rail.element.dataset.urgency).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { numberMonitors } from './monitor-numbers';

const screen = (name: string, x: number, y = 0) => ({
  name,
  bounds: { x, y, width: 2560, height: 1440 },
});

describe('numberMonitors', () => {
  it('numbers the primary monitor 1, then the rest left to right', () => {
    const numbers = numberMonitors(
      [
        screen('DISPLAY3', 2560),
        screen('DISPLAY2', -2560),
        screen('DISPLAY1', 0),
      ],
      'DISPLAY1'
    );

    expect(numbers.get('DISPLAY1')).toBe(1);
    expect(numbers.get('DISPLAY2')).toBe(2);
    expect(numbers.get('DISPLAY3')).toBe(3);
  });

  it('breaks a tie on the left edge by the top edge', () => {
    const numbers = numberMonitors(
      [
        screen('LOWER', 2560, 1440),
        screen('UPPER', 2560, 0),
        screen('MAIN', 0),
      ],
      'MAIN'
    );

    expect(numbers.get('UPPER')).toBe(2);
    expect(numbers.get('LOWER')).toBe(3);
  });

  it('numbers left to right from 1 when no primary is known', () => {
    const numbers = numberMonitors(
      [screen('RIGHT', 2560), screen('LEFT', 0)],
      null
    );

    expect(numbers.get('LEFT')).toBe(1);
    expect(numbers.get('RIGHT')).toBe(2);
  });
});

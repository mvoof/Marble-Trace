import { describe, expect, it } from 'vitest';

import {
  createRemoteToken,
  cloneMonitor,
  fitScale,
  isDisplayMonitor,
  isRemoteMonitor,
  nextRemoteBounds,
  REMOTE_TOKEN_LENGTH,
  slugFromName,
  TOKEN_ALPHABET,
  uniqueSlug,
} from '@utils/remote-screen';
import type { LayoutMonitor } from '@/types/widget-settings';

const display = (
  name: string,
  x: number,
  width = 1920,
  height = 1080
): LayoutMonitor => ({ name, bounds: { x, y: 0, width, height } });

describe('remote screen identity', () => {
  it('treats a monitor with no kind as a display, so old files stay valid', () => {
    expect(isDisplayMonitor(display('DISPLAY1', 0))).toBe(true);
    expect(isRemoteMonitor(display('DISPLAY1', 0))).toBe(false);
  });

  it('carries kind and slug through a clone', () => {
    // Regression: every place that rebuilds the monitor list used to drop
    // these, which turned a remote screen back into a phantom display.
    const screen: LayoutMonitor = {
      name: 'Wheel tablet',
      bounds: { x: 0, y: 0, width: 1280, height: 800 },
      kind: 'remote',
      slug: 'wheel-tablet',
    };

    expect(cloneMonitor(screen)).toEqual(screen);
  });

  it('does not invent a kind for a plain display', () => {
    expect(cloneMonitor(display('DISPLAY1', 0))).not.toHaveProperty('kind');
  });

  it('copies bounds by value', () => {
    const source = display('DISPLAY1', 0);
    const copy = cloneMonitor(source);

    copy.bounds.x = 500;

    expect(source.bounds.x).toBe(0);
  });
});

describe('nextRemoteBounds', () => {
  it('parks a new screen clear of every existing monitor', () => {
    const monitors = [display('DISPLAY1', 0), display('DISPLAY2', 1920)];

    const bounds = nextRemoteBounds(monitors, 1280, 800);

    expect(bounds.x).toBeGreaterThanOrEqual(1920 + 1920);
  });

  it('starts at the origin when the layout has no monitors yet', () => {
    expect(nextRemoteBounds([], 1280, 800)).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 800,
    });
  });

  it('never overlaps a monitor, so widgets keep their owner', () => {
    // The centre-point test picks the first monitor containing the widget, so
    // an overlapping remote rectangle would steal widgets off the desktop.
    const existing = display('DISPLAY1', 0, 3440, 1440);
    const bounds = nextRemoteBounds([existing], 1280, 800);

    expect(bounds.x).toBeGreaterThan(
      existing.bounds.x + existing.bounds.width - 1
    );
  });
});

describe('slugs', () => {
  it('builds a URL-safe slug from a display name', () => {
    expect(slugFromName('Wheel Tablet 10"')).toBe('wheel-tablet-10');
  });

  it('transliterates a Russian name instead of collapsing it', () => {
    // Every Cyrillic name used to reduce to the fallback, so a user naming
    // screens in Russian got /r/screen and /r/screen-2.
    expect(slugFromName('Планшет на руле')).toBe('planshet-na-rule');
    expect(slugFromName('Телефон инженера')).toBe('telefon-inzhenera');
  });

  it('strips accents rather than dropping the letter', () => {
    expect(slugFromName('Café tablet')).toBe('cafe-tablet');
  });

  it('falls back rather than producing an empty slug', () => {
    expect(slugFromName('«»')).toBe('screen');
  });

  it('keeps slugs unique within a layout', () => {
    expect(uniqueSlug('tablet', [])).toBe('tablet');
    expect(uniqueSlug('tablet', ['tablet'])).toBe('tablet-2');
    expect(uniqueSlug('tablet', ['tablet', 'tablet-2'])).toBe('tablet-3');
  });
});

describe('fitScale', () => {
  const bounds = { x: 0, y: 0, width: 1280, height: 800 };

  it('scales to the limiting axis so the layout is letterboxed, not stretched', () => {
    expect(fitScale(bounds, 640, 800)).toBe(0.5);
    expect(fitScale(bounds, 1280, 400)).toBe(0.5);
  });

  it('is 1 when the viewport matches the screen', () => {
    expect(fitScale(bounds, 1280, 800)).toBe(1);
  });

  it('survives a viewport reported before layout', () => {
    expect(fitScale({ x: 0, y: 0, width: 0, height: 0 }, 800, 600)).toBe(1);
  });
});

describe('remote access token', () => {
  it('uses an alphabet that divides 256, so the modulo stays unbiased', () => {
    expect(TOKEN_ALPHABET).toHaveLength(32);
    expect(256 % TOKEN_ALPHABET.length).toBe(0);
  });

  it('leaves out the symbols most easily misread when typed', () => {
    expect(TOKEN_ALPHABET).not.toContain('i');
    expect(TOKEN_ALPHABET).not.toContain('l');
    expect(TOKEN_ALPHABET).not.toContain('0');
    expect(TOKEN_ALPHABET).not.toContain('1');
  });

  it('draws every symbol from the alphabet', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const token = createRemoteToken();

      expect(token).toHaveLength(REMOTE_TOKEN_LENGTH);
      expect(
        token.split('').every((symbol) => TOKEN_ALPHABET.includes(symbol))
      ).toBe(true);
    }
  });

  it('does not repeat itself', () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => createRemoteToken())
    );

    expect(tokens.size).toBe(200);
  });
});

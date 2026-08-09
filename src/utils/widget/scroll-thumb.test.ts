import { describe, expect, it } from 'vitest';

import { scrollThumbFor } from './scroll-thumb';

describe('scrollThumbFor', () => {
  it('returns null when the whole list is on screen', () => {
    expect(scrollThumbFor({ total: 5, windowSize: 10 }, 0)).toBeNull();
    expect(scrollThumbFor({ total: 10, windowSize: 10 }, 0)).toBeNull();
  });

  it('returns null without metrics', () => {
    expect(scrollThumbFor(undefined, 0)).toBeNull();
  });

  it('sizes the thumb by the share of the list on screen', () => {
    const thumb = scrollThumbFor({ total: 40, windowSize: 10 }, 0);

    expect(thumb).toEqual({ heightPercent: 25, topPercent: 0 });
  });

  it('keeps a long list above the size floor', () => {
    const thumb = scrollThumbFor({ total: 200, windowSize: 5 }, 0);

    expect(thumb?.heightPercent).toBe(12);
  });

  it('parks a top-anchored list at the bottom on its last offset', () => {
    const thumb = scrollThumbFor({ total: 40, windowSize: 10 }, 30);

    expect(thumb).toEqual({ heightPercent: 25, topPercent: 75 });
  });

  it('parks a bottom-anchored list at the bottom on a zero offset', () => {
    const live = scrollThumbFor({ total: 40, windowSize: 10 }, 0, 'bottom');
    const oldest = scrollThumbFor({ total: 40, windowSize: 10 }, 30, 'bottom');

    expect(live?.topPercent).toBe(75);
    expect(oldest?.topPercent).toBe(0);
  });

  it('clamps an offset past the end of the travel', () => {
    const thumb = scrollThumbFor({ total: 40, windowSize: 10 }, 999);

    expect(thumb?.topPercent).toBe(75);
  });
});

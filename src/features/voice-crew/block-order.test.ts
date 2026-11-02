import { describe, expect, it } from 'vitest';
import { movedBefore } from './block-order';

describe('block order', () => {
  const blocks = ['меняй', 'шины', '{tires}'];

  it('puts a block before another', () => {
    expect(movedBefore(blocks, 2, 1)).toEqual(['меняй', '{tires}', 'шины']);
    expect(movedBefore(blocks, 0, 2)).toEqual(['шины', 'меняй', '{tires}']);
  });

  it('puts a block last', () => {
    expect(movedBefore(blocks, 0, 3)).toEqual(['шины', '{tires}', 'меняй']);
  });

  it('leaves the blocks as they are when the block stays in place', () => {
    expect(movedBefore(blocks, 1, 1)).toBe(blocks);
    expect(movedBefore(blocks, 1, 2)).toBe(blocks);
  });
});

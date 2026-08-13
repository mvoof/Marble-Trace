import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeWithDefaults } from './deep-merge';

describe('mergeWithDefaults', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  it('performs basic shallow merge for matching keys and types', () => {
    const defaults = { a: 1, b: 'hello', c: true };
    const saved = { a: 2, b: 'world', c: false };

    const result = mergeWithDefaults(defaults, saved);

    expect(result).toEqual({ a: 2, b: 'world', c: false });
  });

  it('keeps default values when keys are missing from saved', () => {
    const defaults = { a: 1, b: 'hello', c: true };
    const saved = { a: 2 };

    const result = mergeWithDefaults(defaults, saved);

    expect(result).toEqual({ a: 2, b: 'hello', c: true });
  });

  it('removes keys that are not present in defaults', () => {
    const defaults = { a: 1, b: 'hello' };
    const saved = { a: 2, b: 'world', c: 'extra' };

    const result = mergeWithDefaults(defaults, saved);

    expect(result).toEqual({ a: 2, b: 'world' });
    expect(result).not.toHaveProperty('c');
  });

  it('resets to default value if type changes', () => {
    const defaults = { a: 1, b: 'hello', c: true };
    const saved = { a: 'not-a-number', b: 42, c: true };

    const result = mergeWithDefaults(defaults, saved);

    expect(result).toEqual({ a: 1, b: 'hello', c: true });
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('recursively merges nested objects', () => {
    const defaults = {
      nested: {
        a: 1,
        b: 'hello',
        c: {
          d: true,
          e: 100,
        },
      },
    };
    const saved = {
      nested: {
        a: 2,
        c: {
          d: false,
          extra: 'should-be-removed',
        },
        extra: 'should-be-removed',
      },
    };

    const result = mergeWithDefaults(defaults, saved);

    expect(result).toEqual({
      nested: {
        a: 2,
        b: 'hello',
        c: {
          d: false,
          e: 100,
        },
      },
    });
  });

  it('handles arrays by replacing them completely', () => {
    const defaults = { arr: [1, 2, 3] };
    const saved = { arr: [4, 5] };

    const result = mergeWithDefaults(defaults, saved);

    expect(result).toEqual({ arr: [4, 5] });
  });

  it('allows null values for nullable fields', () => {
    const defaults = { nullableField: null, nullableString: 'hello' };
    const saved = { nullableField: 42, nullableString: null };

    const result = mergeWithDefaults(defaults, saved);

    expect(result).toEqual({ nullableField: 42, nullableString: null });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('prevents array-object and object-array type bypass', () => {
    const defaults = { arr: [1, 2], obj: { a: 1 } };
    const saved = { arr: { a: 1 }, obj: [1, 2] };

    const result = mergeWithDefaults(defaults, saved);

    expect(result).toEqual({ arr: [1, 2], obj: { a: 1 } });
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('prevents mutating global defaults via shared nested object references', () => {
    const defaults = { nested: { value: 42, arr: [1, 2] } };
    const saved = {}; // nested is completely missing

    const result = mergeWithDefaults(defaults, saved);

    // Mutate the result
    result.nested.value = 99;
    result.nested.arr.push(3);

    // Verify defaults is unchanged
    expect(defaults.nested.value).toBe(42);
    expect(defaults.nested.arr).toEqual([1, 2]);
  });
});

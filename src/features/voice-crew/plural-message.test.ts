import { describe, expect, it } from 'vitest';

import { pluralForms, pluralMessage, pluralSample } from './plural-message';

describe('plural-message', () => {
  it('lists the forms each crew language has', () => {
    expect(pluralForms('ru')).toEqual(['one', 'few', 'many', 'other']);
    expect(pluralForms('en')).toEqual(['one', 'other']);
    expect(pluralForms('es')).toEqual(['one', 'other']);
    expect(pluralForms('zh')).toEqual(['other']);
  });

  it('labels a form with a number that takes it', () => {
    expect(pluralSample('ru', 'one')).toBe(1);
    expect(pluralSample('ru', 'few')).toBe(2);
    expect(pluralSample('ru', 'many')).toBe(5);
    expect(pluralSample('ru', 'other')).toBe(1.5);
    expect(pluralSample('en', 'other')).toBe(2);
  });

  it('writes the forms as the pack stores them', () => {
    expect(
      pluralMessage('liters', {
        many: 'литров',
        one: 'литр',
        few: 'литра',
        other: 'литра',
      })
    ).toBe(
      '{liters, plural, one {# литр} few {# литра} many {# литров} other {# литра}}'
    );
  });
});

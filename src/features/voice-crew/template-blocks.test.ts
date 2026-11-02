import { describe, expect, it } from 'vitest';
import { parseTemplateBlocks, templateFromBlocks } from './template-blocks';

describe('template blocks', () => {
  it('splits the top level into words, choices, optional parts and slots', () => {
    expect(
      parseTemplateBlocks('(залей|заправь) [мне] {number} литров')
    ).toEqual([
      { kind: 'choice', options: ['залей', 'заправь'] },
      { kind: 'optional', text: 'мне' },
      { kind: 'slot', slot: 'number' },
      { kind: 'words', text: 'литров' },
    ]);
  });

  it('keeps what a choice or an optional part nests as its text', () => {
    expect(parseTemplateBlocks('меняем (все [шины]|{tires})')).toEqual([
      { kind: 'words', text: 'меняем' },
      { kind: 'choice', options: ['все [шины]', '{tires}'] },
    ]);
  });

  it('reads a value the driver may leave out', () => {
    const template = 'меняй [{tires}] шины';
    const blocks = parseTemplateBlocks(template);

    expect(blocks?.[1]).toEqual({
      kind: 'slot',
      slot: 'tires',
      optional: true,
    });
    expect(blocks && templateFromBlocks(blocks)).toBe(template);
  });

  it('reads a choice the driver may leave out', () => {
    const template = 'залей {number} [(литров|литра|литр)]';
    const blocks = parseTemplateBlocks(template);

    expect(blocks?.[2]).toEqual({
      kind: 'choice',
      options: ['литров', 'литра', 'литр'],
      optional: true,
    });
    expect(blocks && templateFromBlocks(blocks)).toBe(template);
    expect(parseTemplateBlocks('[(да|нет) мне]')?.[0]).toEqual({
      kind: 'optional',
      text: '(да|нет) мне',
    });
  });

  it('makes a block of each word', () => {
    expect(parseTemplateBlocks('меняй  шины {tires}')).toEqual([
      { kind: 'words', text: 'меняй' },
      { kind: 'words', text: 'шины' },
      { kind: 'slot', slot: 'tires' },
    ]);
  });

  it('refuses brackets that do not pair up', () => {
    expect(parseTemplateBlocks('(залей|заправь')).toBeNull();
    expect(parseTemplateBlocks('топливо ]')).toBeNull();
    expect(parseTemplateBlocks('[мне)')).toBeNull();
    expect(parseTemplateBlocks('да|нет')).toBeNull();
  });

  it('writes the blocks back as the same template', () => {
    const template = '(залей|заправь) [мне] {number} литров';
    const blocks = parseTemplateBlocks(template);

    expect(blocks && templateFromBlocks(blocks)).toBe(template);
    expect(
      templateFromBlocks([
        { kind: 'words', text: '  ' },
        { kind: 'words', text: 'стоп ' },
      ])
    ).toBe('стоп');
  });
});

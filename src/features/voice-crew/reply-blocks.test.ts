import { describe, expect, it } from 'vitest';
import { movedBefore } from './block-order';
import {
  parseReplyBlocks,
  replyFromBlocks,
  spacedReplyBlocks,
} from './reply-blocks';

describe('reply blocks', () => {
  it('splits text, values and a value with its agreeing word', () => {
    expect(
      parseReplyBlocks(
        'Принято, {liters, plural, one {# литр} few {# литра} many {# литров}}, круг {lap}'
      )
    ).toEqual([
      { kind: 'text', text: 'Принято, ' },
      {
        kind: 'plural',
        value: 'liters',
        words: { one: 'литр', few: 'литра', many: 'литров' },
      },
      { kind: 'text', text: ', ' },
      { kind: 'text', text: 'круг ' },
      { kind: 'value', value: 'lap' },
    ]);
  });

  it('keeps a plural it cannot show as words whole', () => {
    const text = '{laps, plural, =0 {ни одного} other {# кругов}}';

    expect(parseReplyBlocks(text)).toEqual([{ kind: 'message', text }]);
  });

  it('reads a sim value as a value', () => {
    expect(parseReplyBlocks('{sim.Speed.kmh}')).toEqual([
      { kind: 'value', value: 'sim.Speed.kmh' },
    ]);
  });

  it('refuses marks that do not pair up', () => {
    expect(parseReplyBlocks('Топливо {liters')).toBeNull();
    expect(parseReplyBlocks('Топливо }')).toBeNull();
    expect(parseReplyBlocks('(Принято|Понял')).toBeNull();
    expect(parseReplyBlocks('Принято]')).toBeNull();
    expect(parseReplyBlocks('да|нет')).toBeNull();
  });

  it('reads the ways a part is put and a part that may be left out', () => {
    const text = '(Принято|Понял), [ставим] {liters} [(литров|литра)]';
    const blocks = parseReplyBlocks(text);

    expect(blocks).toEqual([
      { kind: 'choice', options: ['Принято', 'Понял'] },
      { kind: 'text', text: ', ' },
      { kind: 'optional', text: 'ставим' },
      { kind: 'text', text: ' ' },
      { kind: 'value', value: 'liters' },
      { kind: 'text', text: ' ' },
      { kind: 'choice', options: ['литров', 'литра'], optional: true },
    ]);
    expect(blocks && replyFromBlocks(blocks)).toBe(text);
  });

  it('keeps a value inside a choice as written', () => {
    expect(parseReplyBlocks('(Залили {liters}|Есть)')).toEqual([
      { kind: 'choice', options: ['Залили {liters}', 'Есть'] },
    ]);
  });

  it('writes the blocks back as the same text', () => {
    const text =
      'Есть {liters, plural, one {# литр} few {# литра} many {# литров}} на {laps} кругов';
    const blocks = parseReplyBlocks(text);

    expect(blocks && replyFromBlocks(blocks)).toBe(text);
  });

  it('spaces a moved word as a sentence', () => {
    const blocks = parseReplyBlocks('Меняю шины, {corners}.') ?? [];
    const valueFirst = movedBefore(blocks, 2, 1);

    expect(replyFromBlocks(spacedReplyBlocks(valueFirst, 'ru'))).toBe(
      'Меняю {corners} шины,.'
    );

    const wordLast = movedBefore(blocks, 0, blocks.length);

    expect(replyFromBlocks(spacedReplyBlocks(wordLast, 'ru'))).toBe(
      'шины, {corners}. Меняю'
    );
  });

  it('puts no spaces into a language written without them', () => {
    const blocks = parseReplyBlocks('更换{corners}轮胎') ?? [];

    expect(
      replyFromBlocks(spacedReplyBlocks(movedBefore(blocks, 1, 0), 'zh'))
    ).toBe('{corners}更换轮胎');
  });
});

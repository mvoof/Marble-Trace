import { describe, expect, it, vi } from 'vitest';

import type { VoicePackView } from '@shared/contracts/generated/bindings';
import { VoiceCrewStore } from './voice-crew.store';

vi.mock('@shared/api/voice.service', () => ({}));
vi.mock('@shared/api/external-link', () => ({}));

const SOURCE_ID = 'car';
const SOURCE_KEY = `question.${SOURCE_ID}`;
const ANSWER_KEYS = [
  SOURCE_KEY,
  `${SOURCE_KEY}.noCar`,
  `${SOURCE_KEY}.noValue`,
];

const packWithQuestion = (): VoicePackView => ({
  language: 'en',
  folder: '',
  phrases: ANSWER_KEYS.map((key) => ({
    key,
    values: ['number'],
    variants: [{ text: `${key} {number}`, status: 'missing' }],
  })),
  intents: [
    {
      id: SOURCE_KEY,
      slots: ['number'],
      templates: ['tell me about car {number}'],
      sentences: 0,
      replies: [...ANSWER_KEYS],
      whenUnsaid: null,
    },
  ],
  slots: [],
  questions: [
    {
      id: SOURCE_ID,
      name: 'Car',
      enabled: true,
      target: 'byCarNumber',
      steps: [{ action: 'chat.macro', value: '2' }],
    },
  ],
  questionFields: [
    { name: 'number', car: true },
    { name: 'fuel', car: false },
  ],
  carTargets: [
    { target: 'me', slot: null },
    { target: 'byCarNumber', slot: 'number' },
    { target: 'byPosition', slot: 'position' },
  ],
  sentenceCount: 0,
  conflicts: [],
  issues: [],
});

const storeWith = (pack: VoicePackView) => {
  const store = new VoiceCrewStore(
    {} as ConstructorParameters<typeof VoiceCrewStore>[0]
  );

  store.pack = pack;

  return store;
};

describe('voice crew questions', () => {
  it('duplicates a question whole and switches the source off', () => {
    vi.useFakeTimers();

    const store = storeWith(packWithQuestion());
    const key = store.duplicateQuestion(SOURCE_ID, 'Car (copy)');
    const copyId = key?.slice('question.'.length) ?? '';
    const copy = store.findQuestion(copyId);
    const intent = store.pack?.intents.find((entry) => entry.id === key);

    expect(copy).toMatchObject({
      name: 'Car (copy)',
      enabled: true,
      target: 'byCarNumber',
      steps: [{ action: 'chat.macro', value: '2' }],
    });
    expect(store.findQuestion(SOURCE_ID)?.enabled).toBe(false);
    expect(intent?.templates).toEqual(['tell me about car {number}']);
    expect(intent?.replies).toEqual([key, `${key}.noCar`, `${key}.noValue`]);
    expect(
      store.pack?.phrases.find((phrase) => phrase.key === `${key}.noCar`)
        ?.variants[0]?.text
    ).toBe(`${SOURCE_KEY}.noCar {number}`);
    expect(store.dirty).toBe(true);

    vi.useRealTimers();
  });

  it('removes a question with every answer list', () => {
    vi.useFakeTimers();

    const store = storeWith(packWithQuestion());

    store.removeQuestion(SOURCE_ID);

    expect(store.pack?.questions).toEqual([]);
    expect(store.pack?.intents).toEqual([]);
    expect(store.pack?.phrases).toEqual([]);

    vi.useRealTimers();
  });

  it('adds a question with every answer list', () => {
    vi.useFakeTimers();

    const store = storeWith(packWithQuestion());
    const key = store.addQuestion('Fuel');
    const intent = store.pack?.intents.find((entry) => entry.id === key);
    const lists = store.pack?.phrases.filter((phrase) =>
      intent?.replies.includes(phrase.key)
    );

    expect(intent?.replies).toEqual([key, `${key}.noCar`, `${key}.noValue`]);
    expect(lists?.map((phrase) => phrase.values)).toEqual([
      ['number', 'fuel'],
      ['number', 'fuel'],
      ['number', 'fuel'],
    ]);
    expect(lists?.map((phrase) => phrase.variants.length)).toEqual([1, 0, 0]);

    vi.useRealTimers();
  });

  it("gives a question's phrases the slot its car is picked by", () => {
    vi.useFakeTimers();

    const store = storeWith(packWithQuestion());
    const intent = () =>
      store.pack?.intents.find((entry) => entry.id === SOURCE_KEY);

    store.setQuestionTarget(SOURCE_ID, 'byPosition');

    expect(intent()?.slots).toEqual(['position']);
    expect(intent()?.templates).toEqual(['tell me about car {position}']);

    store.setQuestionTarget(SOURCE_ID, 'me');

    expect(store.findQuestion(SOURCE_ID)?.target).toBe('me');
    expect(intent()?.slots).toEqual([]);

    store.setQuestionTarget(SOURCE_ID, null);

    expect(store.findQuestion(SOURCE_ID)?.target).toBeNull();

    vi.useRealTimers();
  });

  it('splits the answer fields into the car and the session', () => {
    expect(storeWith(packWithQuestion()).questionFields).toEqual({
      car: ['number'],
      session: ['fuel'],
    });
  });
});

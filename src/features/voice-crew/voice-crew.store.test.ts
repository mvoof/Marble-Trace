import { describe, expect, it, vi } from 'vitest';

import type { VoicePackView } from '@shared/contracts/generated/bindings';
import { VoiceCrewStore } from './voice-crew.store';

vi.mock('@shared/api/voice.service', () => ({}));
vi.mock('@shared/api/external-link', () => ({}));
vi.mock('@shared/api/telemetry.service', () => ({}));

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
  questionValues: ['number'],
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
});

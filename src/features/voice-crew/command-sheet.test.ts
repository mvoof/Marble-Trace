import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import type {
  VoiceIntentView,
  VoicePackView,
} from '@shared/contracts/generated/bindings';
import enMainApp from '@/locales/en/main-app.json';
import ruMainApp from '@/locales/ru/main-app.json';
import zhMainApp from '@/locales/zh/main-app.json';
import { buildCommandSheet, escapeHtml } from './command-sheet';

const i18n = i18next.createInstance();

void i18n.init({
  resources: {
    en: { 'main-app': enMainApp },
    ru: { 'main-app': ruMainApp },
    zh: { 'main-app': zhMainApp },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});

const EXPORT_DATE = new Date(Date.UTC(2026, 10, 12));

const intent = (
  id: string,
  templates: string[],
  replies: string[] = []
): VoiceIntentView => ({
  id,
  slots: [],
  templates,
  sentences: 1,
  replies,
  whenUnsaid: null,
});

const pack = (overrides: Partial<VoicePackView>): VoicePackView => ({
  language: 'en',
  folder: '',
  phrases: [],
  intents: [],
  slots: [],
  questions: [],
  questionFields: [],
  amountValues: [],
  carTargets: [],
  sentenceCount: 0,
  conflicts: [],
  issues: [],
  ...overrides,
});

const sheet = (view: VoicePackView) =>
  buildCommandSheet(
    view,
    i18n.getFixedT(view.language, 'main-app'),
    EXPORT_DATE
  );

describe('command sheet', () => {
  it('shows a template as a readable pattern, its values named', () => {
    const html = sheet(
      pack({
        intents: [
          intent('pit.fuel', ['(fuel|add) {number} [(liters|gallons)]']),
        ],
      })
    );

    expect(html).toContain(
      '(fuel<span class="or"> / </span>add) <span class="value">‹number›</span> <span class="optional">[liters<span class="or"> / </span>gallons]</span>'
    );
    expect(html).toContain('<h2>Fuel</h2>');
  });

  it('gives a sample reply with its plural value named', () => {
    const html = sheet(
      pack({
        intents: [
          intent('query.fuel', ['how much fuel'], ['engineer.answer.fuel']),
        ],
        phrases: [
          {
            key: 'engineer.answer.fuel',
            values: [],
            variants: [
              {
                text: 'Fuel for {laps, plural, one {# lap} other {# laps}}',
                status: 'dynamic',
              },
            ],
          },
        ],
      })
    );

    expect(html).toContain(
      '<td class="reply">Fuel for <span class="value">‹laps›</span> laps</td>'
    );
  });

  it('writes everything from the pack as plain text', () => {
    const html = sheet(
      pack({
        intents: [
          intent('question.q1', ['<script>alert(1)</script>'], ['question.q1']),
        ],
        questions: [
          {
            id: 'q1',
            name: '<b>Box</b> & "go"',
            enabled: true,
            target: null,
            steps: [],
          },
        ],
        phrases: [
          {
            key: 'question.q1',
            values: [],
            variants: [
              { text: '<img src=x onerror=alert(1)>', status: 'dynamic' },
            ],
          },
        ],
      })
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Box');
    expect(html).toContain('&lt;b&gt;Box&lt;/b&gt; &amp; &quot;go&quot;');
  });

  it('leaves out questions that are switched off', () => {
    const html = sheet(
      pack({
        intents: [intent('question.off', ['secret phrase'])],
        questions: [
          { id: 'off', name: 'Off', enabled: false, target: null, steps: [] },
        ],
      })
    );

    expect(html).not.toContain('secret phrase');
  });

  it('is labelled in the pack language', () => {
    const html = sheet(
      pack({
        language: 'ru',
        intents: [intent('pit.tires', ['смени {tires}'])],
      })
    );

    expect(html).toContain('<html lang="ru">');
    expect(html).toContain('<h2>Шины</h2>');
    expect(html).toContain('Пакет: Русский');
    expect(html).toContain('<meta charset="utf-8">');
  });

  it('runs a Chinese pattern together, as it is written', () => {
    const html = sheet(
      pack({ language: 'zh', intents: [intent('query.position', ['我 第几'])] })
    );

    expect(html).toContain('<li>我第几</li>');
  });

  it('names the largest number the crew hears', () => {
    expect(sheet(pack({}))).toContain('A number from 0 to 200');
  });

  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CREW_RADIO_HOLD_MS, CrewRadioStore } from './crew-radio.store';

describe('CrewRadioStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks the driver sentence once its command is carried out', () => {
    const radio = new CrewRadioStore();

    radio.apply({ kind: 'heard', text: 'fuel forty', understood: true });
    radio.apply({ kind: 'command', ok: true, text: 'Copy, forty.' });
    radio.apply({ kind: 'speaking', text: 'Copy, forty.' });

    expect(radio.lines.map((line) => [line.speaker, line.result])).toEqual([
      ['driver', 'ok'],
      ['engineer', null],
    ]);
    expect(radio.onAirLine?.text).toBe('Copy, forty.');
  });

  it('keeps ✗ once any command in the sentence was refused', () => {
    const radio = new CrewRadioStore();

    radio.apply({ kind: 'heard', text: 'fuel and tyres', understood: true });
    radio.apply({ kind: 'command', ok: false, text: 'No.' });
    radio.apply({ kind: 'command', ok: true, text: 'Yes.' });

    expect(radio.lines[0].result).toBe('failed');
  });

  it('refuses a sentence that is not a command it knows', () => {
    const radio = new CrewRadioStore();

    radio.apply({ kind: 'heard', text: 'hello', understood: false });

    expect(radio.lines[0].result).toBe('failed');
  });

  it('stays up while a reply is spoken and a moment after it', () => {
    const radio = new CrewRadioStore();

    radio.apply({ kind: 'listening', on: true });
    expect(radio.isActive).toBe(true);

    radio.apply({ kind: 'listening', on: false });
    radio.apply({ kind: 'speaking', text: 'Copy.' });
    vi.advanceTimersByTime(CREW_RADIO_HOLD_MS * 2);
    expect(radio.isActive).toBe(true);

    radio.apply({ kind: 'finished' });
    expect(radio.onAirLine).toBeNull();
    expect(radio.isActive).toBe(true);

    vi.advanceTimersByTime(CREW_RADIO_HOLD_MS);
    expect(radio.isActive).toBe(false);
  });

  it('ignores a test press from the Crew tab', () => {
    const radio = new CrewRadioStore();

    radio.apply({ kind: 'tested', text: 'fuel', intents: [], confidence: 1 });

    expect(radio.lines).toEqual([]);
    expect(radio.isActive).toBe(false);
  });
});

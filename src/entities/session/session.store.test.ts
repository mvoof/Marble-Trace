import { autorun } from 'mobx';
import { describe, expect, it } from 'vitest';

import type {
  SessionFrame,
  SessionState,
} from '@shared/contracts/generated/bindings';

import { SessionStore } from './session.store';

const frameIn = (sessionState: SessionState): SessionFrame =>
  ({ session_state: sessionState }) as SessionFrame;

describe('SessionStore.isSessionEnded', () => {
  it('reads the cool-down as the end', () => {
    const store = new SessionStore();

    store.updateSession(frameIn('Racing'));
    expect(store.isSessionEnded).toBe(false);

    store.updateSession(frameIn('CoolDown'));
    expect(store.isSessionEnded).toBe(true);
  });

  // The frame arrives every second; a table row reads this in render.
  it('does not wake a reader for a new frame in the same state', () => {
    const store = new SessionStore();
    let runs = 0;

    store.updateSession(frameIn('Racing'));

    const dispose = autorun(() => {
      void store.isSessionEnded;
      runs++;
    });

    store.updateSession(frameIn('Racing'));
    store.updateSession(frameIn('Racing'));
    expect(runs).toBe(1);

    store.updateSession(frameIn('CoolDown'));
    expect(runs).toBe(2);

    dispose();
  });
});

import { describe, expect, it } from 'vitest';

import { HOTKEY_ACTIONS } from '@utils/hotkey-actions';
import { hasSettingsHandler } from './settings-actions';

describe('settings actions', () => {
  // The backend sends a settings action's id and nothing else; one without a
  // handler here is a key that silently does nothing.
  it('handles every settings action the backend declares', () => {
    const settingsActions = HOTKEY_ACTIONS.filter(
      (action) => action.kind === 'settings'
    );

    expect(settingsActions.length).toBeGreaterThan(0);

    for (const action of settingsActions) {
      expect(hasSettingsHandler(action.id), action.id).toBe(true);
    }
  });

  it('applies nothing the backend runs itself', () => {
    for (const action of HOTKEY_ACTIONS) {
      if (action.kind !== 'settings') {
        expect(hasSettingsHandler(action.id), action.id).toBe(false);
      }
    }
  });
});

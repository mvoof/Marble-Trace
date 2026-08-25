import { describe, expect, it } from 'vitest';

import { WIDGETS } from '@store/widget-catalog';
import { SETTINGS_PANELS } from './panel-registry';

describe('settings panel registry', () => {
  it('collects a panel component for every id a panel claims', () => {
    for (const [widgetId, panel] of Object.entries(SETTINGS_PANELS)) {
      expect(typeof panel, `${widgetId} resolved to a non-component`).toBe(
        'object'
      );
    }
  });

  it('claims no id the catalog does not ship', () => {
    const shipped = new Set(WIDGETS.map((manifest) => manifest.id));

    for (const widgetId of Object.keys(SETTINGS_PANELS)) {
      expect(shipped, `${widgetId} has a panel but no manifest`).toContain(
        widgetId
      );
    }
  });
});

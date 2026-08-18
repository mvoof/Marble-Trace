import { describe, expect, it } from 'vitest';

import { DEFAULT_WIDGETS, WIDGETS } from '@store/widget-catalog';
import { TELEMETRY_EVENT_BITS } from '@/types/telemetry-events';

// The catalog lists its manifests by hand rather than discovering them, because
// the order it produces is the order widgets are written to settings.json. This
// is the guard that makes the hand-written list safe: a manifest that exists on
// disk but was never added is a widget that silently does not ship.
describe('widget catalog completeness', () => {
  it('lists every manifest that exists on disk', () => {
    const found = import.meta.glob<{ [key: string]: unknown }>(
      '../ui/widgets/*/manifest.ts',
      { eager: true }
    );

    const onDisk = Object.values(found).flatMap((module) =>
      Object.values(module)
        .filter(
          (exported): exported is { id: string } =>
            typeof exported === 'object' &&
            exported !== null &&
            typeof (exported as { id?: unknown }).id === 'string'
        )
        .map((manifest) => manifest.id)
    );

    const registered = new Set(WIDGETS.map((manifest) => manifest.id));

    expect(onDisk.length).toBeGreaterThan(0);

    for (const id of onDisk) {
      expect(registered, `${id} is missing from WIDGETS`).toContain(id);
    }
  });
});

describe('widget catalog telemetry declarations', () => {
  it('declares only events the backend knows how to gate', () => {
    const known = Object.keys(TELEMETRY_EVENT_BITS);

    for (const manifest of WIDGETS) {
      for (const event of manifest.telemetryEvents ?? []) {
        expect(known, `${manifest.id} declares ${event}`).toContain(event);
      }
    }
  });

  it('never declares the same event twice', () => {
    for (const manifest of WIDGETS) {
      const events = manifest.telemetryEvents ?? [];

      expect(new Set(events).size, manifest.id).toBe(events.length);
    }
  });

  // The declaration describes this build's widget, not a user choice. A copy
  // written to settings.json would be read back by a later build whose widget
  // has moved on, and the mask would be composed from the stale list.
  it('keeps the declaration out of the persisted defaults', () => {
    for (const widget of DEFAULT_WIDGETS) {
      expect(widget).not.toHaveProperty('telemetryEvents');
    }
  });
});

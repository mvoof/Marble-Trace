import { describe, expect, it } from 'vitest';

import {
  compareManifests,
  DEFAULT_WIDGETS,
  WIDGETS,
} from '@store/widget-catalog';
import { TELEMETRY_EVENT_BITS } from '@/types/telemetry-events';
import type { WidgetManifest } from '@/types/widget-settings';

// The catalog collects its manifests from disk, so nothing can be missing from
// a list. What it can get wrong is the order — that is what the user sees in
// the catalog and what reaches settings.json — and what it must not leak is the
// ordering hint itself.
// Three manifests sharing one order: two branches that both picked the same
// number must still produce the same list on every machine.
const SHARED_ORDER_MANIFESTS = [
  { id: 'gamma', order: 10 },
  { id: 'alpha', order: 10 },
  { id: 'beta', order: 10 },
] as WidgetManifest[];

describe('widget catalog collection', () => {
  it('collects every manifest under a unique id', () => {
    const ids = WIDGETS.map((manifest) => manifest.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders the catalog by the order each manifest declares', () => {
    const declared = WIDGETS.map(
      (manifest) => manifest.order ?? Number.MAX_SAFE_INTEGER
    );

    expect([...declared].sort((left, right) => left - right)).toEqual(declared);
  });

  it('breaks a tie on the id, the same way everywhere', () => {
    const sorted = [...SHARED_ORDER_MANIFESTS].sort(compareManifests);

    expect(sorted.map((manifest) => manifest.id)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('keeps the ordering hint out of the persisted defaults', () => {
    for (const widget of DEFAULT_WIDGETS) {
      expect(widget).not.toHaveProperty('order');
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

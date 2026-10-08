import { describe, expect, it } from 'vitest';

import {
  compareManifests,
  DEFAULT_WIDGETS,
  WIDGETS,
} from '@entities/widget/widget-catalog';
import { TELEMETRY_EVENT_BITS } from '@shared/contracts/telemetry-events';
import type { WidgetManifest } from '@shared/contracts/widget-settings';

// The catalog collects its manifests from disk, so nothing can be missing from
// a list. What it can get wrong is the order — every list the user sees is
// alphabetical by label, and the catalog is what they are built from.
// Three manifests sharing one label: two branches that both named a widget the
// same way must still produce the same list on every machine.
const SHARED_LABEL_MANIFESTS = [
  { id: 'gamma', label: 'Gauge' },
  { id: 'alpha', label: 'Gauge' },
  { id: 'beta', label: 'Gauge' },
] as WidgetManifest[];

describe('widget catalog collection', () => {
  it('collects every manifest under a unique id', () => {
    const ids = WIDGETS.map((manifest) => manifest.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders the catalog alphabetically by label, ignoring case', () => {
    const labels = WIDGETS.map((manifest) => manifest.label.toLowerCase());

    expect([...labels].sort()).toEqual(labels);
  });

  it('breaks a tie on the id, the same way everywhere', () => {
    const sorted = [...SHARED_LABEL_MANIFESTS].sort(compareManifests);

    expect(sorted.map((manifest) => manifest.id)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
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

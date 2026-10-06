import type { RendererCore } from '@store/roots/renderer-core';
import {
  liveDriverEntryOf,
  sessionCarFieldsOf,
} from '@store/data/driver-entry-join';

import {
  mockField,
  type MockField,
  type MockFieldOptions,
} from './mocks/field';

/**
 * Puts a field of whole rows into a store the way the backend delivers it: who
 * each car is goes into the session roster, what moves goes into the two
 * per-car frames. The store joins them back, so every widget reads the rows it
 * was handed — and a fixture that states a name or a flag on a row states it
 * where the live app keeps it.
 */
export const seedField = (store: RendererCore, field: MockField) => {
  const sessionInfo = store.session.sessionInfo;

  if (sessionInfo) {
    const carFields = new Map(
      field.entries.map((row) => [row.carIdx, sessionCarFieldsOf(row)])
    );

    store.session.updateSessionInfo({
      ...sessionInfo,
      cars: sessionInfo.cars.map((car) => ({
        ...car,
        ...carFields.get(car.carIdx),
      })),
    });
  }

  store.backendComputed.updateDriverEntries({
    entries: field.entries.map(liveDriverEntryOf),
    playerCarIdx: field.playerCarIdx,
  });
  store.backendComputed.updateRelative({
    entries: field.relativeEntries.map(liveDriverEntryOf),
    playerCarIdx: field.playerCarIdx,
  });
};

/**
 * The field already in the store, closed up to a stated gap. The standings and
 * the relative draw the same field, so both are re-seeded together — a driver
 * sizing one and then the other must be looking at the same grid.
 */
export const respaceField = (
  store: RendererCore,
  options: MockFieldOptions
) => {
  const base = store.backendComputed.fieldEntries;

  if (base.length === 0) {
    return;
  }

  seedField(store, mockField(base, options));
};

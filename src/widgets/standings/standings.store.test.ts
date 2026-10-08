import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runInAction } from 'mobx';

import { PreviewCore } from '@app/roots/renderer-core';
import { standingsHotkeyTargets } from '@features/hotkey-bindings/hotkey-targets';
import { seedScenario } from '@features/preview/scenarios';
import { DEFAULT_PREVIEW_SCENARIO_ID } from '@features/preview/scenarios';
import type { WidgetStoreFactory } from '@entities/widget/widget-instances.store';
import type { WidgetCore } from '@widgets/widget-mount';
import { StandingsWidgetStore } from './standings.store';

const STANDINGS = 'standings';
const COPY_ID = 'standings-copy';

const createStandings: WidgetStoreFactory<WidgetCore> = (context) =>
  new StandingsWidgetStore(context);

// A replayed frame with the top two cars swapped. The arrows compare one frame
// with the one before, so it takes two of these to flash anything.
const swapLeaders = (core: PreviewCore) => {
  const frame = core.backendComputed.driverEntries;

  if (!frame) {
    throw new Error('the scenario seeds no standings frame');
  }

  // Found by position: the frame is in car order, and its first rows may be
  // cars without a place yet.
  const leaderIdx = frame.entries.find(
    (entry) => entry.livePosition === 1
  )?.carIdx;
  const secondIdx = frame.entries.find(
    (entry) => entry.livePosition === 2
  )?.carIdx;

  runInAction(() => {
    core.backendComputed.updateDriverEntries({
      ...frame,
      entries: frame.entries.map((entry) => {
        if (entry.carIdx === leaderIdx || entry.carIdx === secondIdx) {
          const place = entry.carIdx === leaderIdx ? 2 : 1;

          return { ...entry, position: place, livePosition: place };
        }

        return entry;
      }),
    });
  });
};

// Replaces the field with one car per row, in the order given — the backend's
// order — each holding that official position and live position.
const setField = (
  core: PreviewCore,
  places: { position: number; livePosition: number }[]
) => {
  const frame = core.backendComputed.driverEntries;

  if (!frame || frame.entries.length < places.length) {
    throw new Error('the scenario seeds too small a standings frame');
  }

  runInAction(() => {
    core.backendComputed.updateDriverEntries({
      ...frame,
      entries: places.map((place, index) => ({
        ...frame.entries[index],
        ...place,
      })),
    });
  });

  return frame.entries.slice(0, places.length).map((entry) => entry.carIdx);
};

const officialOrderOf = (table: StandingsWidgetStore) =>
  table.orderedEntries.map((entry) => table.rankOf(entry));

const openTable = (core: PreviewCore, instanceId: string) =>
  core.widgetInstances.open(
    { core, instanceId, type: STANDINGS },
    createStandings
  ) as StandingsWidgetStore;

describe('StandingsWidgetStore — per instance', () => {
  let core: PreviewCore;

  beforeEach(() => {
    core = new PreviewCore();
    seedScenario(core, DEFAULT_PREVIEW_SCENARIO_ID);

    const original = core.liveWidgets.getWidget(STANDINGS);

    if (!original) {
      throw new Error('the catalog ships no standings record');
    }

    // A second table on the same monitor, as `addWidgetCopy` would make one.
    runInAction(() => {
      core.liveWidgets.syncWidgetSet([
        ...core.liveWidgets.allWidgets,
        { ...original, id: COPY_ID },
      ]);
    });
  });

  afterEach(() => {
    core.dispose();
  });

  it('builds no table store for a core with no standings mounted', () => {
    expect(core.widgetInstances.storesOf(STANDINGS)).toEqual([]);
    expect('standingsWidget' in core).toBe(false);
  });

  it('steps only the tables marked for hotkeys', () => {
    expect(core.backendComputed.carClassCount).toBeGreaterThan(1);

    const marked = openTable(core, STANDINGS);
    const unmarked = openTable(core, COPY_ID);

    runInAction(() => core.liveWidgets.setHotkeysActOn(COPY_ID, false));

    for (const table of standingsHotkeyTargets(core)) {
      table.stepClass(1);
    }

    expect(marked.activeClassIndex).toBe(1);
    expect(unmarked.activeClassIndex).toBe(0);

    // The unmarked table still moves under its own pointer.
    unmarked.cycleNext(core.backendComputed.carClassCount);

    expect(unmarked.activeClassIndex).toBe(1);
  });

  it('stops reacting to the field once its instance unmounts', () => {
    const table = openTable(core, STANDINGS);

    core.widgetInstances.close(STANDINGS, table);
    swapLeaders(core);
    swapLeaders(core);

    expect(table.positionChanges.size).toBe(0);
    expect(core.widgetInstances.storesOf(STANDINGS)).toEqual([]);
  });

  it('flashes a swap while its instance is mounted', () => {
    const table = openTable(core, STANDINGS);

    swapLeaders(core);
    swapLeaders(core);

    expect(table.positionChanges.size).toBe(2);
  });

  describe('cars without a place', () => {
    const useOfficialOrder = () =>
      runInAction(() =>
        core.liveWidgets.updateUserSettings(STANDINGS, {
          useLivePositions: false,
        })
      );

    it('sort after every placed car in the official order', () => {
      const table = openTable(core, STANDINGS);

      useOfficialOrder();
      setField(core, [
        { position: 1, livePosition: 1 },
        { position: 0, livePosition: 3 },
        { position: 2, livePosition: 2 },
      ]);

      expect(officialOrderOf(table)).toEqual([1, 2, 0]);
    });

    it('keep the backend order among themselves', () => {
      const table = openTable(core, STANDINGS);

      useOfficialOrder();
      const carIdxs = setField(core, [
        { position: 0, livePosition: 3 },
        { position: 1, livePosition: 1 },
        { position: 0, livePosition: 2 },
      ]);

      expect(table.orderedEntries.map((entry) => entry.carIdx)).toEqual([
        carIdxs[1],
        carIdxs[0],
        carIdxs[2],
      ]);
    });

    it('take their first place on the next frame, without the settle delay', () => {
      const table = openTable(core, STANDINGS);

      useOfficialOrder();
      setField(core, [
        { position: 0, livePosition: 6 },
        { position: 1, livePosition: 1 },
        { position: 2, livePosition: 2 },
        { position: 3, livePosition: 3 },
        { position: 4, livePosition: 4 },
        { position: 6, livePosition: 5 },
      ]);
      setField(core, [
        { position: 5, livePosition: 5 },
        { position: 1, livePosition: 1 },
        { position: 2, livePosition: 2 },
        { position: 3, livePosition: 3 },
        { position: 4, livePosition: 4 },
        { position: 6, livePosition: 6 },
      ]);

      expect(officialOrderOf(table)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(table.positionChanges.size).toBe(0);
    });

    it('leave the track order alone', () => {
      const table = openTable(core, STANDINGS);

      const carIdxs = setField(core, [
        { position: 0, livePosition: 2 },
        { position: 1, livePosition: 3 },
        { position: 2, livePosition: 1 },
      ]);

      expect(table.orderedEntries.map((entry) => entry.carIdx)).toEqual([
        carIdxs[2],
        carIdxs[0],
        carIdxs[1],
      ]);
    });
  });
});

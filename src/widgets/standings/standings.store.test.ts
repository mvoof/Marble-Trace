import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  it('settles a stable pass on a frame that only changes distance', () => {
    const table = openTable(core, STANDINGS);
    const originalLeader = table.orderedEntries[0].carIdx;
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);

    try {
      swapLeaders(core);
      expect(table.orderedEntries[0].carIdx).toBe(originalLeader);

      const frame = core.backendComputed.driverEntries!;

      clock.mockReturnValue(1000);
      runInAction(() =>
        core.backendComputed.updateDriverEntries({
          ...frame,
          entries: frame.entries.map((entry) => ({
            ...entry,
            lapDistPct: entry.lapDistPct + 0.001,
          })),
        })
      );

      expect(table.orderedEntries[0].carIdx).toBe(table.overallLeader?.carIdx);
      expect(table.orderedEntries[0].carIdx).not.toBe(originalLeader);
    } finally {
      clock.mockRestore();
    }
  });

  it.each([false, true])(
    'keeps positions after filtering (live: %s)',
    (useLivePositions) => {
      const frame = core.backendComputed.driverEntries!;
      const [retired, active] = frame.entries.filter(
        (entry) => !entry.isPlayer
      );

      runInAction(() => {
        core.liveWidgets.updateUserSettings(STANDINGS, {
          useLivePositions,
          hideRetiredDrivers: true,
        });
        core.backendComputed.updateDriverEntries({
          ...frame,
          entries: [
            {
              ...retired,
              position: 1,
              classPosition: 1,
              livePosition: 1,
              liveClassPosition: 1,
              isRetired: true,
            },
            {
              ...active,
              position: 2,
              classPosition: 2,
              livePosition: 2,
              liveClassPosition: 2,
              isRetired: false,
            },
          ],
        });
      });

      const table = openTable(core, STANDINGS);

      expect(table.orderedEntries.map((entry) => entry.carIdx)).toEqual([
        active.carIdx,
      ]);
      expect(table.renderedRanks.get(active.carIdx)).toEqual({
        overall: 2,
        inClass: 2,
      });
    }
  );

  it('shows the projection only when its rank matches the displayed rank', () => {
    const frame = core.backendComputed.driverEntries!;
    const [driver] = frame.entries;
    const publish = (livePosition: number, estimatedIrDeltaLive: number) =>
      runInAction(() =>
        core.backendComputed.updateDriverEntries({
          ...frame,
          entries: [
            {
              ...driver,
              livePosition,
              liveClassPosition: livePosition,
              estimatedIrDeltaLive,
            },
          ],
        })
      );

    publish(9, 12);
    const table = openTable(core, STANDINGS);
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);

    try {
      expect(table.projectedIrDeltaOf(driver.carIdx)).toBe(12);

      publish(10, -2);
      expect(table.renderedRanks.get(driver.carIdx)?.overall).toBe(9);
      expect(table.projectedIrDeltaOf(driver.carIdx)).toBeNull();

      clock.mockReturnValue(1000);
      publish(10, -2);
      expect(table.renderedRanks.get(driver.carIdx)?.overall).toBe(10);
      expect(table.projectedIrDeltaOf(driver.carIdx)).toBe(-2);
    } finally {
      clock.mockRestore();
    }
  });

  it('replaces a lap delta with zero on an identical consecutive lap', () => {
    const frame = core.backendComputed.driverEntries!;
    const [driver] = frame.entries;
    const publishLap = (lap: number, lastLapTime: number) =>
      runInAction(() =>
        core.backendComputed.updateDriverEntries({
          ...frame,
          entries: [{ ...driver, lap, lastLapTime }],
        })
      );

    publishLap(2, 92.3);
    const table = openTable(core, STANDINGS);

    publishLap(3, 92.1);
    expect(table.lapDeltas.get(driver.carIdx)).toBeCloseTo(-0.2);

    publishLap(4, 92.1);
    expect(table.lapDeltas.get(driver.carIdx)).toBe(0);
  });

  it('clears the delta when the player serves a penalty at Daytona', () => {
    const frame = core.backendComputed.driverEntries!;
    const driver = frame.entries.find((entry) => entry.isPlayer)!;
    const publishLap = (
      lap: number,
      lastLapTime: number | null,
      onPitRoad = false
    ) =>
      runInAction(() =>
        core.backendComputed.updateDriverEntries({
          ...frame,
          entries: [{ ...driver, lap, lastLapTime, onPitRoad }],
        })
      );

    publishLap(4, 49.3985);
    const table = openTable(core, STANDINGS);

    publishLap(5, 49.3495);
    expect(table.lapDeltas.get(driver.carIdx)).toBeCloseTo(-0.049);

    publishLap(5, 49.3495, true);
    publishLap(6, 49.3495, true);
    expect(table.lapDeltas.has(driver.carIdx)).toBe(false);

    publishLap(6, null, true);
    publishLap(6, null);
    expect(table.lapDeltas.has(driver.carIdx)).toBe(false);

    publishLap(7, 143.3306);
    expect(table.lapDeltas.has(driver.carIdx)).toBe(false);

    publishLap(8, 50);
    expect(table.lapDeltas.get(driver.carIdx)).toBeCloseTo(-93.3306);
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

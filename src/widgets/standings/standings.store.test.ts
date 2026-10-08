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
});

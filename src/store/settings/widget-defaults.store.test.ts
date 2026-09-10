import { describe, it, expect, beforeEach } from 'vitest';
import { runInAction } from 'mobx';
import { RootStore } from '../root-store';
import { DEFAULT_WIDGETS } from '../widget-catalog';
import type { CapabilitiesPayload } from '@/types/bindings';

const FULL_CAPABILITIES: CapabilitiesPayload = {
  playerDynamics: true,
  inputs: true,
  chassis: true,
  fuel: true,
  weatherCurrent: true,
  weatherForecast: true,
  standings: true,
  relative: true,
  radar: true,
  sectors: true,
};

describe('WidgetDefaultsStore catalog', () => {
  let rootStore: RootStore;

  beforeEach(() => {
    rootStore = new RootStore({ skipInit: true });
    rootStore.liveWidgets.setLayouts(
      [
        {
          id: 'layout-race',
          name: 'layout-race',
          createdAt: Date.now(),
          monitors: [
            {
              name: 'DISPLAY1',
              bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            },
          ],
          widgets: [],
        },
      ],
      'layout-race'
    );
  });

  it('lists one entry per shipped widget', () => {
    expect(rootStore.widgetDefaults.catalogWidgets.map((w) => w.id)).toEqual(
      DEFAULT_WIDGETS.map((widget) => widget.id)
    );
  });

  it('stays one entry per widget when the active layout holds a copy', () => {
    const copyId = runInAction(() =>
      rootStore.liveWidgets.duplicateWidget('fuel')
    );

    expect(copyId).not.toBeNull();
    expect(
      rootStore.liveWidgets.allWidgets.filter(
        (widget) => (widget.type ?? widget.id) === 'fuel'
      )
    ).toHaveLength(2);

    const catalogIds = rootStore.widgetDefaults.catalogWidgets.map((w) => w.id);
    expect(catalogIds.filter((id) => id === 'fuel')).toHaveLength(1);
    expect(catalogIds).not.toContain(copyId);
  });

  it('gates catalog entries on the sim capabilities', () => {
    runInAction(() => {
      rootStore.sim.capabilities = { ...FULL_CAPABILITIES, fuel: false };
    });

    const available = rootStore.widgetDefaults.availableWidgetIds;
    expect(available).not.toContain('fuel');
    expect(available).toContain('race-dash');
  });
});

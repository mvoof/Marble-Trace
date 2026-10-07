import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runInAction } from 'mobx';
import { MainRoot } from '@store/roots/main-root';
import { registerPitServiceMainReactions } from '@platform/sync/pit-service-sync';
import type { SavedLayout } from '@/types/widget-settings';

// setWidgets pushes a few settings to the backend through the service layer,
// which has no Tauri runtime to talk to under vitest.
vi.mock('@shared/api/settings.service', () => ({
  setPitWarningLapsSilent: vi.fn(),
  setFuelAvgWindowSilent: vi.fn(),
  setFuelCountYellowLapsSilent: vi.fn(),
  setCarLengthSilent: vi.fn(),
}));
const setPitStrategySilentMock = vi.hoisted(() => vi.fn());

vi.mock('@shared/api/pit.service', () => ({
  sendPitOrder: vi.fn().mockResolvedValue(undefined),
  togglePitAuto: vi.fn().mockResolvedValue(undefined),
  setPitStrategySilent: setPitStrategySilentMock,
}));
vi.mock('@shared/api/events.service', () => ({
  listenTo: vi.fn().mockResolvedValue(() => {}),
  emitPitServiceReveal: vi.fn().mockResolvedValue(undefined),
  emitToApp: vi.fn().mockResolvedValue(undefined),
  emitToWindow: vi.fn().mockResolvedValue(undefined),
  emitToOverlays: vi.fn().mockResolvedValue(undefined),
}));

const MONITOR = {
  name: 'DISPLAY1',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

/** A layout holding exactly the given widgets, everything else switched off. */
const layoutWith = (
  root: MainRoot,
  id: string,
  enabledIds: string[]
): SavedLayout => ({
  id,
  name: id,
  createdAt: 0,
  monitors: [MONITOR],
  backgroundImages: {},
  widgets: root.liveWidgets.allWidgets.map((widget) => ({
    ...widget,
    userSettings: {
      ...widget.userSettings,
      enabled: enabledIds.includes(widget.id),
    },
  })),
});

describe('isWidgetOnScreen', () => {
  let root: MainRoot;

  beforeEach(() => {
    root = new MainRoot({ skipInit: true });

    runInAction(() => {
      root.liveWidgets.setLayouts(
        [
          layoutWith(root, 'race', ['pit-service', 'standings']),
          layoutWith(root, 'quali', ['standings']),
        ],
        'race'
      );
    });
  });

  it('follows the layout the session auto-switch loaded', () => {
    expect(root.liveWidgets.isWidgetOnScreen('pit-service')).toBe(true);

    runInAction(() => root.liveWidgets.loadLayout('quali'));

    expect(root.liveWidgets.isWidgetOnScreen('pit-service')).toBe(false);
    expect(root.liveWidgets.isWidgetOnScreen('standings')).toBe(true);
  });

  // Auto mode decides on the telemetry thread, which learns the gate from
  // what main pushes with the strategy.
  it('takes pit-service auto mode down with the layout switch', () => {
    runInAction(() => {
      root.appSettings.setPitAutoFuel(true);
      root.appSettings.setPitAutoTires(false);
    });

    const disposers = registerPitServiceMainReactions(root);

    expect(setPitStrategySilentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoFuel: true, widgetOnScreen: true })
    );

    runInAction(() => root.liveWidgets.loadLayout('quali'));

    expect(setPitStrategySilentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ autoFuel: true, widgetOnScreen: false })
    );

    disposers.forEach((dispose) => dispose());
  });

  // Previewing a layout in the editor leaves the overlay on the previous one,
  // so runtime gating must not follow the preview.
  it('keeps following the overlay while the editor previews another layout', () => {
    runInAction(() => root.layoutEditor.switchLayout('quali'));

    expect(root.liveWidgets.isWidgetOnScreen('pit-service')).toBe(true);
  });

  it('follows the preview once it is actually activated', () => {
    runInAction(() => {
      root.layoutEditor.switchLayout('quali');
      root.layoutEditor.activateLayout();
    });

    expect(root.liveWidgets.isWidgetOnScreen('pit-service')).toBe(false);
  });

  it('does not lose the overlay state when previewing twice in a row', () => {
    runInAction(() => {
      root.layoutEditor.switchLayout('quali');
      root.layoutEditor.switchLayout('race');
      root.layoutEditor.switchLayout('quali');
    });

    expect(root.liveWidgets.isWidgetOnScreen('pit-service')).toBe(true);
  });
});

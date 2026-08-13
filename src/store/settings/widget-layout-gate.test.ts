import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runInAction } from 'mobx';
import { RootStore } from '@store/root-store';
import type { SavedLayout } from '@/types/widget-settings';

// setWidgets pushes a few settings to the backend through the service layer,
// which has no Tauri runtime to talk to under vitest.
vi.mock('@platform/services/settings.service', () => ({
  setPitWarningLapsSilent: vi.fn(),
  setFuelAvgWindowSilent: vi.fn(),
  setCarLengthSilent: vi.fn(),
}));
vi.mock('@platform/services/events.service', () => ({
  listenTo: vi.fn().mockResolvedValue(() => {}),
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
  root: RootStore,
  id: string,
  enabledIds: string[]
): SavedLayout => ({
  id,
  name: id,
  createdAt: 0,
  monitors: [MONITOR],
  backgroundImages: {},
  widgets: root.widgetSettings.allWidgets.map((widget) => ({
    ...widget,
    userSettings: {
      ...widget.userSettings,
      enabled: enabledIds.includes(widget.id),
    },
  })),
});

describe('isWidgetInActiveLayout', () => {
  let root: RootStore;

  beforeEach(() => {
    root = new RootStore({ skipInit: true });

    runInAction(() => {
      root.widgetSettings.setLayouts(
        [
          layoutWith(root, 'race', ['pit-service', 'standings']),
          layoutWith(root, 'quali', ['standings']),
        ],
        'race'
      );
    });
  });

  it('follows the layout the session auto-switch loaded', () => {
    expect(root.widgetSettings.isWidgetInActiveLayout('pit-service')).toBe(
      true
    );

    runInAction(() => root.widgetSettings.loadLayout('quali'));

    expect(root.widgetSettings.isWidgetInActiveLayout('pit-service')).toBe(
      false
    );
    expect(root.widgetSettings.isWidgetInActiveLayout('standings')).toBe(true);
  });

  it('takes pit-service auto mode down with the layout switch', () => {
    runInAction(() => {
      root.widgetSettings.updateUserSettings('pit-service', {
        autoFuel: true,
        autoTires: false,
      });
    });

    expect(root.pitServiceWidget.isAutoEnabled).toBe(true);

    runInAction(() => root.widgetSettings.loadLayout('quali'));

    expect(root.pitServiceWidget.isAutoEnabled).toBe(false);
  });

  // Previewing a layout in the editor leaves the overlay on the previous one,
  // so runtime gating must not follow the preview.
  it('keeps following the overlay while the editor previews another layout', () => {
    runInAction(() => root.widgetSettings.switchEditorLayout('quali'));

    expect(root.widgetSettings.isWidgetInActiveLayout('pit-service')).toBe(
      true
    );
  });

  it('follows the preview once it is actually activated', () => {
    runInAction(() => {
      root.widgetSettings.switchEditorLayout('quali');
      root.widgetSettings.activateEditorLayout();
    });

    expect(root.widgetSettings.isWidgetInActiveLayout('pit-service')).toBe(
      false
    );
  });

  it('does not lose the overlay state when previewing twice in a row', () => {
    runInAction(() => {
      root.widgetSettings.switchEditorLayout('quali');
      root.widgetSettings.switchEditorLayout('race');
      root.widgetSettings.switchEditorLayout('quali');
    });

    expect(root.widgetSettings.isWidgetInActiveLayout('pit-service')).toBe(
      true
    );
  });
});

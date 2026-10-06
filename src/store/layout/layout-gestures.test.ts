import { describe, expect, it, vi, beforeEach } from 'vitest';

import { PreviewCore } from '@store/roots/renderer-core';
import { layoutGestureStores } from '@store/roots/main-root-context';

import { alignMonitorsToHardware, removeMonitor } from './layout-gestures';

vi.mock('@platform/services/events.service', () => ({
  emitLayoutActivated: vi.fn(),
  emitSessionLayoutsChanged: vi.fn(),
  emitToOverlays: vi.fn(),
  emitToOverlaysAndRemote: vi.fn(),
  listenTo: vi.fn(),
}));

vi.mock('@platform/services/settings.service', () => ({
  setFuelAvgWindowSilent: vi.fn(),
  setFuelCountYellowLapsSilent: vi.fn(),
  setPitWarningLapsSilent: vi.fn(),
  setActiveEventsSilent: vi.fn(),
}));

const LEFT = {
  name: 'DISPLAY1',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

const RIGHT = {
  name: 'DISPLAY2',
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
};

// Far enough onto the second screen that the centre-point test can only
// answer DISPLAY2 — a widget the gesture has to carry back when it goes.
const ON_RIGHT_X = 2400;

/**
 * The half of a gesture no record test can see: the record rebuilt a widget
 * *list*, and the live map has to be given the rebuilt one. The projection
 * carries a widget that merely moved; a list is installed, which is what
 * normalizes it.
 */
describe('gestures that rebuild a widget list', () => {
  let root: PreviewCore;

  beforeEach(() => {
    root = new PreviewCore();

    root.liveWidgets.setLayouts(
      [
        {
          id: 'layout-race',
          name: 'Race',
          createdAt: 0,
          monitors: [LEFT, RIGHT],
          widgets: [],
        },
      ],
      'layout-race'
    );

    root.liveWidgets.moveWidgetToMonitor('fuel', 'DISPLAY2');
    root.liveWidgets.updatePosition('fuel', ON_RIGHT_X, 0);
  });

  // A screen's widgets are its own set: moving them onto the screen that
  // remains would silently double what that one shows. What comes back is the
  // switched-off instance every layout keeps of every widget.
  it('removes the widgets of a removed screen with it', () => {
    removeMonitor(layoutGestureStores(root), 'layout-race', 'DISPLAY2');

    const fuel = root.liveWidgets.widgetsOfType('fuel');

    expect(root.layouts.byId('layout-race')?.monitors).toEqual([LEFT]);
    expect(fuel).toHaveLength(1);
    expect(fuel[0]).toMatchObject({
      monitor: 'DISPLAY1',
      userSettings: { enabled: false },
    });
  });

  it('installs the active layout after the screens are realigned', () => {
    alignMonitorsToHardware(layoutGestureStores(root), [
      LEFT,
      { ...RIGHT, bounds: { ...RIGHT.bounds, x: 3840 } },
    ]);

    expect(root.liveWidgets.getWidget('fuel')!.userSettings.x).toBe(
      ON_RIGHT_X + 1920
    );
  });
});

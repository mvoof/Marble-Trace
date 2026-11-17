import { describe, expect, it } from 'vitest';

import type {
  LayoutMonitor,
  SavedLayout,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';
import { nowSummary } from './now-summary';

const BOUNDS = { x: 0, y: 0, width: 1920, height: 1080 };

const display = (name: string): LayoutMonitor => ({ name, bounds: BOUNDS });

const remote = (name: string): LayoutMonitor => ({
  name,
  bounds: BOUNDS,
  kind: 'remote',
  slug: name,
});

const widget = (enabled: boolean) =>
  ({ userSettings: { enabled } }) as unknown as WidgetDefaultConfig;

describe('nowSummary', () => {
  it('counts the displays, the widgets on and the browser screens apart', () => {
    const layout = {
      id: 'race',
      name: 'Race',
      createdAt: 0,
      monitors: [display('DISPLAY1'), display('DISPLAY2'), remote('tablet')],
      widgets: [widget(true), widget(false), widget(true)],
    } as SavedLayout;

    expect(nowSummary(layout)).toEqual({
      layoutName: 'Race',
      monitors: 2,
      widgetsOn: 2,
      browserScreens: 1,
    });
  });

  it('has nothing on without a layout', () => {
    expect(nowSummary(undefined)).toEqual({
      layoutName: null,
      monitors: 0,
      widgetsOn: 0,
      browserScreens: 0,
    });
  });
});

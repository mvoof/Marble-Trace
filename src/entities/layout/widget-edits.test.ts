import { describe, expect, it } from 'vitest';

import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

import {
  applySettingsEdit,
  markForHotkeys,
  moveWidgetTo,
  resizeWidgetTo,
} from './widget-edits';

const record = (): WidgetDefaultConfig =>
  ({
    id: 'plain',
    type: 'plain-test-widget',
    userSettings: {
      enabled: true,
      x: 10,
      y: 20,
      currentWidth: 300,
      currentHeight: 200,
    },
  }) as WidgetDefaultConfig;

describe('moveWidgetTo', () => {
  it('moves and reports a change', () => {
    const widget = record();

    expect(moveWidgetTo(widget, { x: 50, y: 60 })).toBe(true);
    expect(widget.userSettings).toMatchObject({ x: 50, y: 60 });
  });

  it('reports nothing when it already stands there', () => {
    expect(moveWidgetTo(record(), { x: 10, y: 20 })).toBe(false);
  });
});

describe('resizeWidgetTo', () => {
  it('resizes and reports a change, or none for the same size', () => {
    const widget = record();

    expect(resizeWidgetTo(widget, 300, 200)).toBe(false);
    expect(resizeWidgetTo(widget, 400, 250)).toBe(true);
    expect(widget.userSettings).toMatchObject({
      currentWidth: 400,
      currentHeight: 250,
    });
  });
});

describe('markForHotkeys', () => {
  it('stores the mark only while it departs from the default', () => {
    const widget = record();

    markForHotkeys(widget, false);
    expect(widget.hotkeys).toBe(false);

    markForHotkeys(widget, true);
    expect('hotkeys' in widget).toBe(false);
  });
});

describe('applySettingsEdit', () => {
  it('writes into the record’s own settings object', () => {
    const widget = record();
    const settings = widget.userSettings;

    applySettingsEdit(widget, { enabled: false });

    expect(widget.userSettings).toBe(settings);
    expect(widget.userSettings.enabled).toBe(false);
  });
});

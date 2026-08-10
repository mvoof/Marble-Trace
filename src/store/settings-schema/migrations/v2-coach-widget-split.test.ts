import { describe, expect, it } from 'vitest';

import { v2CoachWidgetSplit } from './v2-coach-widget-split';

const raceDash = (overrides: Record<string, unknown> = {}) => ({
  id: 'race-dash',
  userSettings: {
    enabled: true,
    x: 400,
    y: 100,
    currentWidth: 430,
    currentHeight: 104,
    showReferenceSpeed: true,
    brakeColor: '#ff0000',
    gasColor: '#00ff00',
    rpmColorLow: '#10b981',
    ...overrides,
  },
});

const findWidget = (widgets: unknown, id: string) =>
  (widgets as { id?: string; userSettings?: Record<string, unknown> }[]).find(
    (widget) => widget.id === id
  );

describe('v2CoachWidgetSplit', () => {
  it('drops the coach keys from race dash', () => {
    const result = v2CoachWidgetSplit.migrate({ widgets: [raceDash()] });
    const settings = findWidget(result['widgets'], 'race-dash')?.userSettings;

    expect(settings).not.toHaveProperty('showReferenceSpeed');
    expect(settings).not.toHaveProperty('brakeColor');
    expect(settings).not.toHaveProperty('gasColor');
    // Unrelated settings must survive untouched.
    expect(settings?.['rpmColorLow']).toBe('#10b981');
  });

  it('narrows the plate by the width the coach tab occupied', () => {
    const result = v2CoachWidgetSplit.migrate({ widgets: [raceDash()] });

    expect(
      findWidget(result['widgets'], 'race-dash')?.userSettings?.['currentWidth']
    ).toBe(334);
  });

  it('keeps the scale the user resized the plate to', () => {
    const result = v2CoachWidgetSplit.migrate({
      widgets: [raceDash({ currentWidth: 860, currentHeight: 208 })],
    });

    expect(
      findWidget(result['widgets'], 'race-dash')?.userSettings?.['currentWidth']
    ).toBe(668);
  });

  it('seeds a coach widget carrying the accent colors when the tab was on', () => {
    const result = v2CoachWidgetSplit.migrate({ widgets: [raceDash()] });
    const coach = findWidget(result['widgets'], 'coach')?.userSettings;

    expect(coach?.['enabled']).toBe(true);
    expect(coach?.['brakeColor']).toBe('#ff0000');
    expect(coach?.['gasColor']).toBe('#00ff00');
    expect(coach?.['lossColor']).toBe('#ff0000');
    expect(coach?.['gainColor']).toBe('#00ff00');
    // Parked directly under the dash it came out of.
    expect(coach?.['y']).toBe(204);
  });

  it('adds no coach widget when the tab was off', () => {
    const result = v2CoachWidgetSplit.migrate({
      widgets: [raceDash({ showReferenceSpeed: false })],
    });

    expect(findWidget(result['widgets'], 'coach')).toBeUndefined();
  });

  it('adds no coach widget when race dash itself was disabled', () => {
    const result = v2CoachWidgetSplit.migrate({
      widgets: [raceDash({ enabled: false })],
    });

    expect(findWidget(result['widgets'], 'coach')).toBeUndefined();
  });

  it('never adds a second coach widget', () => {
    const result = v2CoachWidgetSplit.migrate({
      widgets: [raceDash(), { id: 'coach', userSettings: { enabled: false } }],
    });

    const coaches = (result['widgets'] as { id?: string }[]).filter(
      (widget) => widget.id === 'coach'
    );

    expect(coaches).toHaveLength(1);
  });

  it('converts layout copies too', () => {
    const result = v2CoachWidgetSplit.migrate({
      widgets: [],
      layouts: [{ id: 'a', name: 'Race', widgets: [raceDash()] }],
    });

    const layout = (result['layouts'] as { widgets?: unknown }[])[0];

    expect(
      findWidget(layout?.widgets, 'race-dash')?.userSettings
    ).not.toHaveProperty('showReferenceSpeed');
    expect(findWidget(layout?.widgets, 'coach')).toBeDefined();
  });

  it('survives a blob with nothing in it', () => {
    expect(v2CoachWidgetSplit.migrate({})).toEqual({
      widgets: [],
      layouts: [],
    });
  });
});

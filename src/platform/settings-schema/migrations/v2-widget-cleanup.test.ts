import { describe, expect, it } from 'vitest';
import { v2WidgetCleanup } from './v2-widget-cleanup';

describe('v2 — drop the example widget, seed the chat placeholder', () => {
  it('removes the widget from both copies', () => {
    const migrated = v2WidgetCleanup.migrate({
      widgets: [{ id: 'example' }, { id: 'fuel' }],
      layouts: [
        { id: 'race', widgets: [{ id: 'example' }, { id: 'fuel' }] },
        { id: 'quali', widgets: [{ id: 'example' }] },
      ],
    });

    expect(migrated['widgets']).toEqual([{ id: 'fuel' }]);
    expect(migrated['layouts']).toEqual([
      { id: 'race', widgets: [{ id: 'fuel' }] },
      { id: 'quali', widgets: [] },
    ]);
  });

  it('leaves a file that never had the widget alone', () => {
    const blob = { widgets: [{ id: 'fuel' }], layouts: [] };

    expect(v2WidgetCleanup.migrate(blob)).toEqual(blob);
  });

  it('seeds the chat placeholder in both copies', () => {
    const migrated = v2WidgetCleanup.migrate({
      widgets: [{ id: 'stream-chat', userSettings: { showBanner: true } }],
      layouts: [
        { id: 'race', widgets: [{ id: 'stream-chat', userSettings: {} }] },
      ],
    });

    expect(migrated['widgets']).toEqual([
      {
        id: 'stream-chat',
        userSettings: { showBanner: true, showPlaceholder: true },
      },
    ]);
    expect(migrated['layouts']).toEqual([
      {
        id: 'race',
        widgets: [
          { id: 'stream-chat', userSettings: { showPlaceholder: true } },
        ],
      },
    ]);
  });

  it('keeps a placeholder choice the user already made', () => {
    const migrated = v2WidgetCleanup.migrate({
      widgets: [
        { id: 'stream-chat', userSettings: { showPlaceholder: false } },
      ],
    });

    expect(migrated['widgets']).toEqual([
      { id: 'stream-chat', userSettings: { showPlaceholder: false } },
    ]);
  });
});

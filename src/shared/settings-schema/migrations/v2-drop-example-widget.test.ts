import { describe, expect, it } from 'vitest';
import { v2DropExampleWidget } from './v2-drop-example-widget';

describe('v2 — drop the example widget', () => {
  it('removes the widget from both copies', () => {
    const migrated = v2DropExampleWidget.migrate({
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

    expect(v2DropExampleWidget.migrate(blob)).toEqual(blob);
  });
});

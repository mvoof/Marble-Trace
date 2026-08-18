import { describe, expect, it } from 'vitest';

import { WIDGETS } from '@store/widget-catalog';
import { WIDGET_COMPONENTS } from '@ui/widgets/registry';

// A manifest without a component is a widget the user can enable, place and
// configure — and then look at an empty rectangle.
describe('widget registry', () => {
  it('has a component for every shipped manifest', () => {
    for (const manifest of WIDGETS) {
      expect(
        WIDGET_COMPONENTS[manifest.id],
        `${manifest.id} has no component in registry.ts`
      ).toBeDefined();
    }
  });

  it('maps no component the catalog does not ship', () => {
    const shipped = new Set(WIDGETS.map((manifest) => manifest.id));

    for (const id of Object.keys(WIDGET_COMPONENTS)) {
      expect(shipped, `${id} has a component but no manifest`).toContain(id);
    }
  });
});

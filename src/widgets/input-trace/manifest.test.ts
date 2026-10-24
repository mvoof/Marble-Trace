import { describe, expect, it } from 'vitest';
import type { WidgetUserSettings } from '@shared/contracts/widget-settings';
import { INPUT_TRACE_MANIFEST } from './manifest';

const DEFAULTS = INPUT_TRACE_MANIFEST.userSettings;
const DESIGN_HEIGHT = 120;
// Three bars, the wheel, one gap and the edge inset.
const WITHOUT_TRACE_WIDTH = 68 + 120 + 8 + 4;

const resolve = (
  next: Partial<WidgetUserSettings>,
  current: { designWidth: number; currentWidth: number; currentHeight: number }
) =>
  INPUT_TRACE_MANIFEST.resolveLayoutChange!(
    DEFAULTS,
    { ...DEFAULTS, ...next },
    { ...current, designHeight: DESIGN_HEIGHT }
  );

describe('input trace layout', () => {
  it('shrinks to its content when the trace is hidden, whatever width was stored', () => {
    const result = resolve(
      { showTrace: false },
      { designWidth: 600, currentWidth: 600, currentHeight: DESIGN_HEIGHT }
    );

    expect(result).toEqual({
      designWidth: WITHOUT_TRACE_WIDTH,
      currentWidth: WITHOUT_TRACE_WIDTH,
    });
  });

  it('drops the stretch the side handles gave the trace along with it', () => {
    const designWidth = INPUT_TRACE_MANIFEST.designWidth;

    const result = resolve(
      { showTrace: false },
      {
        designWidth,
        currentWidth: designWidth * 2 + 300,
        currentHeight: DESIGN_HEIGHT * 2,
      }
    );

    expect(result?.currentWidth).toBe(WITHOUT_TRACE_WIDTH * 2);
  });

  it('keeps the trace stretch while the trace stays', () => {
    const designWidth = INPUT_TRACE_MANIFEST.designWidth;

    const result = resolve(
      { showClutch: false },
      {
        designWidth,
        currentWidth: designWidth + 300,
        currentHeight: DESIGN_HEIGHT,
      }
    );

    // One bar (20px) and its gap (4px) fewer.
    expect(result?.currentWidth).toBe(designWidth - 24 + 300);
  });

  it('keeps the width when only the speed block changes sides', () => {
    const result = resolve(
      { speedBlockSide: 'left' },
      { designWidth: 526, currentWidth: 526, currentHeight: DESIGN_HEIGHT }
    );

    expect(result).toBeNull();
  });
});

import type { ResolveLayoutChange } from '@/types/widget-settings';

/**
 * The pieces every widget manifest is built from.
 *
 * A manifest declares what a widget is — id, label, design size, shipped
 * settings — and never imports its own React component: the catalog the stores
 * read is plain data, and the id → component map lives in `registry.ts`, on the
 * UI side of the layer line.
 */

// Shared across every widget's userSettings; spread first so per-widget
// entries can still override a value if a future widget needs to.
export const COMMON_WIDGET_DEFAULTS = {
  opacity: 1,
  fontScale: 1,
};

// Most widgets render on an opaque panel; a few (radar, track map, delta,
// flag widgets) draw directly over the overlay with no panel behind them.
export const PANEL_APPEARANCE_DEFAULTS = {
  backgroundColor: 'rgba(21, 22, 26, 0.8)',
  borderColor: 'rgba(255, 255, 255, 0.1)',
};

export const TRANSPARENT_APPEARANCE_DEFAULTS = {
  backgroundColor: 'transparent',
  borderColor: 'transparent',
};

// Default highlight color for the player's own row in the standings/relative
// tables (#f5c518 yellow). Stored as a setting so users can recolor it.
export const DEFAULT_PLAYER_ROW_COLOR = 'rgba(245, 197, 24, 0.32)';

// Default color of the player's position/car number (solid gold #f5c518).
export const DEFAULT_PLAYER_ACCENT_COLOR = '#f5c518';

// Widgets with toggleable columns/sections have a natural width that changes as
// elements are shown/hidden. This builds a resolveLayoutChange that, when any of
// the given toggle keys flips, recomputes designWidth from the visible content AND
// scales currentWidth by the same factor — keeping --wfs (and thus font/row size)
// constant while the widget grows/shrinks to fit. Only WIDTH-changing toggles need
// this; height-changing toggles don't affect --wfs (width-only).
export const makeColumnLayoutResolver = <Settings>(
  toggleKeys: (keyof Settings)[],
  computeDesignWidth: (settings: Settings) => number
): ResolveLayoutChange => {
  return (prev, next, current) => {
    const prevSettings = prev as unknown as Settings;
    const nextSettings = next as unknown as Settings;

    const changed = toggleKeys.some(
      (key) => prevSettings[key] !== nextSettings[key]
    );

    if (!changed) {
      return null;
    }

    const newDesignWidth = computeDesignWidth(nextSettings);
    const scale = current.designWidth
      ? current.currentWidth / current.designWidth
      : 1;

    return {
      designWidth: newDesignWidth,
      currentWidth: Math.round(newDesignWidth * scale),
    };
  };
};

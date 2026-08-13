import type { WidgetManifest } from '@/types/widget-settings';
import type {
  FlagDisplaySettings,
  ResolveLayoutChange,
} from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

const resolveLedFlagsLayout: ResolveLayoutChange = (prev, next, current) => {
  if (!('split' in next)) return null;

  const prevSettings = prev as unknown as FlagDisplaySettings;
  const nextSettings = next as unknown as FlagDisplaySettings;

  const prevSplit = !!prevSettings.split;
  const nextSplit = !!nextSettings.split;

  if (prevSplit === nextSplit) return null;

  const prevMode = prevSplit ? 'split' : 'single';
  const nextMode = nextSplit ? 'split' : 'single';

  const prevModeWidths =
    'modeWidths' in prev
      ? ((prev.modeWidths as Record<string, number>) ?? {})
      : {};

  const savedModeWidths: Record<string, number> = {
    ...prevModeWidths,
    [prevMode]: current.currentWidth,
  };

  const defaultNextWidth = nextSplit ? 696 : 232;
  const nextWidth = savedModeWidths[nextMode] ?? defaultNextWidth;

  return {
    designWidth: nextSplit ? 696 : 232,
    currentWidth: nextWidth,
    userSettingsPatch: { modeWidths: savedModeWidths },
  };
};

export const LED_FLAGS_MANIFEST: WidgetManifest = {
  id: 'led-flags',
  label: 'LED Flags',
  description: 'LED matrix display of track flags.',
  resolveLayoutChange: resolveLedFlagsLayout,
  designWidth: 232,
  designHeight: 232,
  userSettings: {
    enabled: false,
    x: 760,
    y: 0,
    currentWidth: 232,
    currentHeight: 232,
    ...COMMON_WIDGET_DEFAULTS,
    ...TRANSPARENT_APPEARANCE_DEFAULTS,
    alwaysShow: true,
    holdDuration: 3,
    split: false,
    animate: true,
    forceSingleLed: false,
  },
};

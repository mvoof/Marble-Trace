import type {
  ResolveLayoutChange,
  WidgetManifest,
} from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import {
  LED_FLAGS_SETTINGS,
  type LedFlagsSettings,
} from '@entities/flags/flag-display.settings-schema';

const resolveLedFlagsLayout: ResolveLayoutChange = (prev, next, current) => {
  if (!('split' in next)) return null;

  const prevSettings = prev as unknown as LedFlagsSettings;
  const nextSettings = next as unknown as LedFlagsSettings;

  const prevSplit = prevSettings.split;
  const nextSplit = nextSettings.split;

  if (prevSplit === nextSplit) return null;

  const prevMode = prevSplit ? 'split' : 'single';
  const nextMode = nextSplit ? 'split' : 'single';

  const prevModeWidths = prevSettings.modeWidths;

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
  previewScenarios: [
    'yellow-flag',
    'safety-car',
    'blue-flag',
    'black-flag',
    'dq-flag',
    'green-flag',
    'white-flag',
    'checkered-flag',
    'red-flag',
    'meatball-flag',
    'debris-flag',
  ],
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
    ...LED_FLAGS_SETTINGS.defaults,
  },
  settingsSchema: LED_FLAGS_SETTINGS,
};

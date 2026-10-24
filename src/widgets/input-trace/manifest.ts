import type {
  ResolveLayoutChange,
  WidgetManifest,
} from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import {
  INPUT_TRACE_SETTINGS,
  type InputTraceSettings,
} from './settings-schema';

// Layout constants matching JSX/SCSS values in InputTraceWidget.
// Bar width = rem(20) @ 16px base = 20px; bar gap = $space-sm = rem(4) = 4px.
// WidgetPanel gap={8} raw px; edgeInset padding: 2px × 2 = 4px total.
// Wheel natural width = designHeight (aspect-ratio 1:1, height: 100%).
// INPUT_TRACE_CHART_DESIGN_PX gives the trace its share; all-visible defaults
// sum to 534px; the corner speeds and the speed and gear, off by default, add
// their own widths.
const INPUT_TRACE_BAR_PX = 20;
const INPUT_TRACE_BAR_GAP_PX = 4;
const INPUT_TRACE_WHEEL_PX = 120;
const INPUT_TRACE_PANEL_GAP_PX = 8;
const INPUT_TRACE_EDGE_PX = 4;
const INPUT_TRACE_CHART_DESIGN_PX = 318;
// The corner speeds column and the speed and gear block — widths from
// SpeedBlock/*.module.scss.
const INPUT_TRACE_CORNER_SPEEDS_PX = 36;
const INPUT_TRACE_SPEED_GEAR_PX = 116;

const computeInputTraceDesignWidth = (settings: InputTraceSettings): number => {
  const barCount = [
    settings.showThrottle,
    settings.showBrake,
    settings.showClutch,
  ].filter(Boolean).length;
  const hasBars = settings.showBars && barCount > 0;
  const barsWidth = hasBars
    ? barCount * INPUT_TRACE_BAR_PX +
      Math.max(0, barCount - 1) * INPUT_TRACE_BAR_GAP_PX
    : 0;

  const sections: number[] = [];

  if (settings.showTrace) {
    sections.push(INPUT_TRACE_CHART_DESIGN_PX);
  }

  if (hasBars) {
    sections.push(barsWidth);
  }

  if (settings.showCornerSpeeds) {
    sections.push(INPUT_TRACE_CORNER_SPEEDS_PX);
  }

  if (settings.showSpeedGear) {
    sections.push(INPUT_TRACE_SPEED_GEAR_PX);
  }

  if (settings.showSteering) {
    sections.push(INPUT_TRACE_WHEEL_PX);
  }

  if (sections.length === 0) {
    return 520;
  }

  const gaps = Math.max(0, sections.length - 1) * INPUT_TRACE_PANEL_GAP_PX;

  return Math.round(
    sections.reduce((sum, width) => sum + width, 0) + gaps + INPUT_TRACE_EDGE_PX
  );
};

const INPUT_TRACE_LAYOUT_KEYS: (keyof InputTraceSettings)[] = [
  'showTrace',
  'showSteering',
  'showThrottle',
  'showBrake',
  'showClutch',
  'showCornerSpeeds',
  'showSpeedGear',
  'showBars',
];

/**
 * The widget scales from its height, and the side handles widen only the
 * graph. So the width it takes is its design width at the height scale, plus
 * whatever the graph was stretched by — and that stretch goes with the graph:
 * without it nothing can fill the extra width.
 *
 * Both design widths are computed from the settings rather than read from the
 * stored one, so a width an older build left behind cannot survive a toggle.
 */
const resolveInputTraceLayout: ResolveLayoutChange = (prev, next, current) => {
  const prevSettings = prev as unknown as InputTraceSettings;
  const nextSettings = next as unknown as InputTraceSettings;

  const changed = INPUT_TRACE_LAYOUT_KEYS.some(
    (key) => prevSettings[key] !== nextSettings[key]
  );

  if (!changed) {
    return null;
  }

  const heightScale = current.designHeight
    ? current.currentHeight / current.designHeight
    : 1;
  const prevDesignWidth = computeInputTraceDesignWidth(prevSettings);
  const nextDesignWidth = computeInputTraceDesignWidth(nextSettings);

  const keepsTrace = prevSettings.showTrace && nextSettings.showTrace;
  const traceStretch = keepsTrace
    ? Math.max(0, current.currentWidth - prevDesignWidth * heightScale)
    : 0;

  return {
    designWidth: nextDesignWidth,
    currentWidth: Math.round(nextDesignWidth * heightScale + traceStretch),
  };
};

const INPUT_TRACE_DESIGN_WIDTH = computeInputTraceDesignWidth(
  INPUT_TRACE_SETTINGS.defaults
);

export const INPUT_TRACE_MANIFEST: WidgetManifest = {
  id: 'input-trace',
  telemetryEvents: ['carDynamics', 'carInputs', 'inputSamples', 'cornerSpeeds'],
  label: 'Input Trace',
  description: 'Live throttle, brake, and clutch inputs.',
  resolveLayoutChange: resolveInputTraceLayout,
  deriveDesignWidth: (settings) =>
    computeInputTraceDesignWidth(settings as unknown as InputTraceSettings),
  requiredCapabilities: ['inputs'],
  designWidth: INPUT_TRACE_DESIGN_WIDTH,
  designHeight: 120,
  // Dragging the side handles only widens the trace chart; the corners scale
  // the whole widget (bars, wheel and chart) proportionally.
  scaleFromHeight: true,
  userSettings: {
    enabled: false,
    x: 400,
    y: 300,
    currentWidth: INPUT_TRACE_DESIGN_WIDTH,
    currentHeight: 120,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...INPUT_TRACE_SETTINGS.defaults,
  },
  settingsSchema: INPUT_TRACE_SETTINGS,
};

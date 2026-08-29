import type { WidgetManifest } from '@/types/widget-settings';
import type { InputTraceSettings } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
  makeColumnLayoutResolver,
} from '@ui/widgets/widget-manifest';

// Layout constants matching JSX/SCSS values in InputTraceWidget.
// Bar width = rem(20) @ 16px base = 20px; bar gap = $space-sm = rem(4) = 4px.
// WidgetPanel gap={8} raw px; edgeInset padding: 2px × 2 = 4px total.
// Wheel natural width = designHeight (aspect-ratio 1:1, height: 100%).
// INPUT_TRACE_CHART_DESIGN_PX gives the trace its share; all-visible defaults
// sum to 534px.
const INPUT_TRACE_BAR_PX = 20;
const INPUT_TRACE_BAR_GAP_PX = 4;
const INPUT_TRACE_WHEEL_PX = 120;
const INPUT_TRACE_PANEL_GAP_PX = 8;
const INPUT_TRACE_EDGE_PX = 4;
const INPUT_TRACE_CHART_DESIGN_PX = 318;

const computeInputTraceDesignWidth = (settings: InputTraceSettings): number => {
  const barCount = [
    settings.showThrottle,
    settings.showBrake,
    settings.showClutch,
  ].filter(Boolean).length;
  const hasBars = barCount > 0;
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

const resolveInputTraceLayout = makeColumnLayoutResolver<InputTraceSettings>(
  ['showTrace', 'showSteering', 'showThrottle', 'showBrake', 'showClutch'],
  computeInputTraceDesignWidth
);

const INPUT_TRACE_VISIBILITY_DEFAULTS = {
  showTrace: true,
  showSteering: true,
  showThrottle: true,
  showBrake: true,
  showClutch: true,
  showInputValues: false,
};
const INPUT_TRACE_DESIGN_WIDTH = computeInputTraceDesignWidth(
  INPUT_TRACE_VISIBILITY_DEFAULTS as unknown as InputTraceSettings
);

export const INPUT_TRACE_MANIFEST: WidgetManifest = {
  id: 'input-trace',
  order: 10,
  telemetryEvents: ['carDynamics', 'carInputs'],
  label: 'Input Trace',
  description: 'Live throttle, brake, and clutch inputs.',
  resolveLayoutChange: resolveInputTraceLayout,
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
    ...INPUT_TRACE_VISIBILITY_DEFAULTS,
    currentHeight: 120,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    steeringCenterDisplay: 'logo',
    throttleColor: '#10b981',
    brakeColor: '#ef4444',
    clutchColor: '#3b82f6',
    absColor: '#eab308',
    historySeconds: 5,
    lineWidth: 3.5,
    smoothing: 0,
    steeringZoom: 1,
  },
};

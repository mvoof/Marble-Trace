import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const INVISIBLE_DASH_MANIFEST: WidgetManifest = {
  id: 'invisible-dash',
  order: 230,
  telemetryEvents: ['carDynamics', 'driverEntries'],
  label: 'Invisible Dash',
  description:
    'Windscreen projection: engine column and gear on the left, position and lap on the right, empty in the middle.',
  requiredCapabilities: ['playerDynamics'],
  designWidth: 900,
  designHeight: 200,
  transparentContainer: true,
  // Width is the spread between the two clusters, not a scale: narrowing the
  // dash has to eat the empty middle and leave the digits the size they were.
  // That leaves the height as what the readout is sized from.
  scaleFromHeight: true,
  userSettings: {
    enabled: false,
    x: 300,
    y: 500,
    currentWidth: 900,
    currentHeight: 200,
    ...COMMON_WIDGET_DEFAULTS,
    ...TRANSPARENT_APPEARANCE_DEFAULTS,
    showSpeed: true,
    showRpm: true,
    showGear: true,
    showPosition: true,
    showLap: true,
    showShiftBar: true,
    renderMode: 'projection',
    bloomIntensity: 60,
    projectionTint: '#bfe3ff',
    textColor: '#ffffff',
    backdropColor: 'rgba(0, 0, 0, 0)',
    backdropScope: 'clusters',
    rpmColorLow: '#10b981',
    rpmColorMid: '#eab308',
    rpmColorHigh: '#ef4444',
    rpmColorShift: '#a855f7',
    rpmColorLimit: '#f97316',
    colorizeRpmByZone: true,
    colorizeGearByZone: false,
    depth: 45,
    curvature: 30,
    rpmFormat: 'absolute',
    useLivePositions: true,
    classPositionInMulticlass: true,
  },
};

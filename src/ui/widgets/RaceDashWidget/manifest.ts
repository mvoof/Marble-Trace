import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const RACE_DASH_MANIFEST: WidgetManifest = {
  id: 'race-dash',
  order: 220,
  telemetryEvents: ['carDynamics', 'driverEntries'],
  label: 'Race Dash',
  description:
    'Cockpit cluster: gear ring, speed readout with lap/position/RPM, and pit-lane mode.',
  requiredCapabilities: ['playerDynamics'],
  // The plate measures 418×104: ring 104 + three cells split by hairlines
  // (12 + speed 70 + 12 + 1 + 12 + a 5-digit RPM block 78 + 12 + 1 + 12 +
  // position/lap column 74 + 30) + border 2. The right padding is wider than
  // the left: that column's numbers sit flush against its own edge, and the
  // plate's right cap is a half-circle that cuts into the content box there.
  designWidth: 418,
  designHeight: 104,
  transparentContainer: true,
  // The pit banner hangs over the plate's top edge like in the prototype —
  // the container must not clip it.
  overflowVisible: true,
  // The ring badge's diameter is tied to the widget's height (RING_SIZE ==
  // designHeight) — resizing width alone without height in lockstep makes
  // the ring's ws() size diverge from the actual box height, breaking both
  // the ring and the plate's circular left cap.
  lockAspectRatio: true,
  userSettings: {
    enabled: false,
    x: 400,
    y: 100,
    currentWidth: 418,
    currentHeight: 104,
    ...COMMON_WIDGET_DEFAULTS,
    // Container stays transparent (transparentContainer); these colors are
    // applied to the plate itself instead, see RaceDashWidget.module.scss.
    ...PANEL_APPEARANCE_DEFAULTS,
    pitSpeedLimitOverride: null,
    showPitAssist: true,
    boxCueDistM: 50,
    nearLimitDelta: 5,
    rpmColorLow: '#10b981',
    rpmColorMid: '#eab308',
    rpmColorHigh: '#ef4444',
    rpmColorShift: '#a855f7',
    rpmColorLimit: '#f97316',
    colorizeByRpmZone: true,
    rpmIndicatorMode: 'fill',
    useLivePositions: true,
    classPositionInMulticlass: true,
    colorizePosition: true,
    positionColorP1: '#fbbf24',
    positionColorTop3: '#10b981',
    positionColorTop5: '#38bdf8',
    positionColorTop10: '#cbd5e1',
    positionColorRest: '#7c8794',
    showSteeringMarker: false,
    steeringTrailColor: '#f59e0b',
  },
};

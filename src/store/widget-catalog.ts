import type {
  WidgetManifest,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

import { INPUT_TRACE_MANIFEST } from '@ui/widgets/InputTraceWidget/manifest';
import { PROXIMITY_RADAR_MANIFEST } from '@ui/widgets/ProximityRadarWidget/manifest';
import { RADAR_BAR_MANIFEST } from '@ui/widgets/RadarBarWidget/manifest';
import { STANDINGS_MANIFEST } from '@ui/widgets/StandingsWidget/manifest';
import { RELATIVE_MANIFEST } from '@ui/widgets/RelativeWidget/manifest';
import { TRACK_MAP_MANIFEST } from '@ui/widgets/TrackMapWidget/manifest';
import { RELATIVE_MAP_MANIFEST } from '@ui/widgets/RelativeMapWidget/manifest';
import { LED_FLAGS_MANIFEST } from '@ui/widgets/LedFlagWidget/manifest';
import { FLAT_FLAGS_MANIFEST } from '@ui/widgets/FlatFlagsWidget/manifest';
import { PIT_SERVICE_MANIFEST } from '@ui/widgets/PitServiceWidget/manifest';
import { EXAMPLE_MANIFEST } from '@ui/widgets/TelemetryDebugWidget/manifest';
import { DELTA_MANIFEST } from '@ui/widgets/DeltaWidget/manifest';
import { TIMER_MANIFEST } from '@ui/widgets/TimerWidget/manifest';
import { STREAM_CHAT_MANIFEST } from '@ui/widgets/StreamChatWidget/manifest';
import { WEATHER_MANIFEST } from '@ui/widgets/WeatherWidget/manifest';
import { FUEL_MANIFEST } from '@ui/widgets/FuelWidget/manifest';
import { G_METER_MANIFEST } from '@ui/widgets/GMeterWidget/manifest';
import { SECTOR_MATRIX_MANIFEST } from '@ui/widgets/SectorMatrixWidget/manifest';
import { LAP_LOG_MANIFEST } from '@ui/widgets/LapLogWidget/manifest';
import { ENGINE_PANEL_MANIFEST } from '@ui/widgets/EnginePanelWidget/manifest';
import { RPM_LIGHTS_MANIFEST } from '@ui/widgets/RpmLightsWidget/manifest';
import { RACE_DASH_MANIFEST } from '@ui/widgets/RaceDashWidget/manifest';
import { COACH_MANIFEST } from '@ui/widgets/CoachWidget/manifest';
import { INVISIBLE_DASH_MANIFEST } from '@ui/widgets/InvisibleDashWidget/manifest';

/**
 * Every widget the app ships, assembled from the per-widget manifests.
 *
 * This is the one file in the store layer that reads from `ui/` — the manifests
 * live next to the widgets they describe, which is where they are edited. They
 * carry no React: the id → component map is `ui/widgets/registry.ts`, and
 * nothing here imports it.
 */
export const WIDGETS: WidgetManifest[] = [
  INPUT_TRACE_MANIFEST,
  PROXIMITY_RADAR_MANIFEST,
  RADAR_BAR_MANIFEST,
  STANDINGS_MANIFEST,
  RELATIVE_MANIFEST,
  TRACK_MAP_MANIFEST,
  RELATIVE_MAP_MANIFEST,
  LED_FLAGS_MANIFEST,
  FLAT_FLAGS_MANIFEST,
  PIT_SERVICE_MANIFEST,
  EXAMPLE_MANIFEST,
  DELTA_MANIFEST,
  TIMER_MANIFEST,
  STREAM_CHAT_MANIFEST,
  WEATHER_MANIFEST,
  FUEL_MANIFEST,
  G_METER_MANIFEST,
  SECTOR_MATRIX_MANIFEST,
  LAP_LOG_MANIFEST,
  ENGINE_PANEL_MANIFEST,
  RPM_LIGHTS_MANIFEST,
  RACE_DASH_MANIFEST,
  INVISIBLE_DASH_MANIFEST,
  COACH_MANIFEST,
];

export const WIDGET_BY_ID = new Map(
  WIDGETS.map((manifest) => [manifest.id, manifest])
);

// Keys the saved copy must not carry. `resolveLayoutChange` is a function and
// could not survive the round trip through settings.json anyway;
// `telemetryEvents` could, and that is exactly the problem — it is what this
// build's widget reads, not a user choice, and a stale copy on disk would
// outlive the widget that declared it.
const NON_SERIALIZABLE_WIDGET_KEYS = new Set([
  'resolveLayoutChange',
  'telemetryEvents',
]);

export const DEFAULT_WIDGETS: WidgetDefaultConfig[] = WIDGETS.map(
  (manifest) => {
    const allowedEntries = Object.entries(manifest).filter(([key]) => {
      return !NON_SERIALIZABLE_WIDGET_KEYS.has(key);
    });

    return Object.fromEntries(allowedEntries) as WidgetDefaultConfig;
  }
);

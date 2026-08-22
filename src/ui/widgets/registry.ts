import type { ComponentType } from 'react';

import { InputTraceWidget } from '@ui/widgets/InputTraceWidget/InputTraceWidget';
import { ProximityRadarWidget } from '@ui/widgets/ProximityRadarWidget/ProximityRadarWidget';
import { RadarBarWidget } from '@ui/widgets/RadarBarWidget/RadarBarWidget';
import { DuelBarWidget } from '@ui/widgets/DuelBarWidget/DuelBarWidget';
import { StandingsWidget } from '@ui/widgets/StandingsWidget/StandingsWidget';
import { RelativeWidget } from '@ui/widgets/RelativeWidget/RelativeWidget';
import { TrackMapWidget } from '@ui/widgets/TrackMapWidget/TrackMapWidget';
import { RelativeMapWidget } from '@ui/widgets/RelativeMapWidget/RelativeMapWidget';
import { LedFlagWidget } from '@ui/widgets/LedFlagWidget/LedFlagWidget';
import { FlatFlagsWidget } from '@ui/widgets/FlatFlagsWidget/FlatFlagsWidget';
import { PitServiceWidget } from '@ui/widgets/PitServiceWidget/PitServiceWidget';
import { DeltaWidget } from '@ui/widgets/DeltaWidget/DeltaWidget';
import { TimerWidget } from '@ui/widgets/TimerWidget/TimerWidget';
import { StreamChatWidget } from '@ui/widgets/StreamChatWidget/StreamChatWidget';
import { WeatherWidget } from '@ui/widgets/WeatherWidget/WeatherWidget';
import { FuelWidget } from '@ui/widgets/FuelWidget/FuelWidget';
import { GMeterWidget } from '@ui/widgets/GMeterWidget/GMeterWidget';
import { SectorMatrixWidget } from '@ui/widgets/SectorMatrixWidget/SectorMatrixWidget';
import { LapLogWidget } from '@ui/widgets/LapLogWidget/LapLogWidget';
import { EnginePanelWidget } from '@ui/widgets/EnginePanelWidget/EnginePanelWidget';
import { RpmLightsWidget } from '@ui/widgets/RpmLightsWidget/RpmLightsWidget';
import { RaceDashWidget } from '@ui/widgets/RaceDashWidget/RaceDashWidget';
import { CoachWidget } from '@ui/widgets/CoachWidget/CoachWidget';
import { InvisibleDashWidget } from '@ui/widgets/InvisibleDashWidget/InvisibleDashWidget';

/**
 * Which React component renders each widget id.
 *
 * Kept apart from the manifests so the catalog the stores read stays plain
 * data — a store must not reach into the UI, and a manifest that imported its
 * own component would drag every widget's React tree into the settings layer.
 * Read only by the three components that actually mount widgets: OverlayCanvas,
 * WidgetPreview and the layout editor's canvas.
 */
export const WIDGET_COMPONENTS: Record<string, ComponentType> = {
  'input-trace': InputTraceWidget,
  'proximity-radar': ProximityRadarWidget,
  'radar-bar': RadarBarWidget,
  'duel-bar': DuelBarWidget,
  standings: StandingsWidget,
  relative: RelativeWidget,
  'track-map': TrackMapWidget,
  'relative-map': RelativeMapWidget,
  'led-flags': LedFlagWidget,
  'flat-flags': FlatFlagsWidget,
  'pit-service': PitServiceWidget,
  delta: DeltaWidget,
  timer: TimerWidget,
  'stream-chat': StreamChatWidget,
  weather: WeatherWidget,
  fuel: FuelWidget,
  'g-meter': GMeterWidget,
  'sector-matrix': SectorMatrixWidget,
  'lap-log': LapLogWidget,
  'engine-panel': EnginePanelWidget,
  'rpm-lights': RpmLightsWidget,
  'race-dash': RaceDashWidget,
  'invisible-dash': InvisibleDashWidget,
  coach: CoachWidget,
};

export const componentForWidget = (id: string): ComponentType | undefined =>
  WIDGET_COMPONENTS[id];

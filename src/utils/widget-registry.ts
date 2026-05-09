import { TelemetryDebugWidgetContainer } from '../components/widgets/TelemetryDebugWidget/TelemetryDebugWidgetContainer';
import { SpeedWidgetContainer } from '../components/widgets/SpeedWidget/SpeedWidgetContainer';
import { InputTraceWidgetContainer } from '../components/widgets/InputTraceWidget/InputTraceWidgetContainer';
import { ProximityRadarWidgetContainer } from '../components/widgets/ProximityRadarWidget/ProximityRadarWidgetContainer';
import { RadarBarWidgetContainer } from '../components/widgets/RadarBarWidget/RadarBarWidgetContainer';
import { StandingsWidgetContainer } from '../components/widgets/StandingsWidget/StandingsWidgetContainer';
import { RelativeWidgetContainer } from '../components/widgets/RelativeWidget/RelativeWidgetContainer';
import { TrackMapWidgetContainer } from '../components/widgets/TrackMapWidget/TrackMapWidgetContainer';
import { RelativeMapWidgetContainer } from '../components/widgets/RelativeMapWidget/RelativeMapWidgetContainer';
import { LedFlagWidgetContainer } from '../components/widgets/LedFlagWidget/LedFlagWidgetContainer';
import { ChassisWidgetContainer } from '../components/widgets/ChassisWidget/ChassisWidgetContainer';
import { LapDeltaWidgetContainer } from '../components/widgets/LapDeltaWidget/LapDeltaWidgetContainer';
import { LapTimesWidgetContainer } from '../components/widgets/LapTimesWidget/LapTimesWidgetContainer';
import { TimerWidgetContainer } from '../components/widgets/TimerWidget/TimerWidgetContainer';
import { WeatherWidgetContainer } from '../components/widgets/WeatherWidget/WeatherWidgetContainer';
import { FuelWidgetContainer } from '../components/widgets/FuelWidget/FuelWidgetContainer';
import { FlatFlagsWidgetContainer } from '../components/widgets/FlatFlagsWidget/FlatFlagsWidgetContainer';
import type React from 'react';

export interface WidgetEntry {
  component: React.ComponentType<{
    onVisibilityChange?: (visible: boolean) => void;
  }>;
  autoHeight?: boolean;
}

export const WIDGET_REGISTRY: Record<string, WidgetEntry> = {
  example: { component: TelemetryDebugWidgetContainer },
  speed: { component: SpeedWidgetContainer },
  'input-trace': { component: InputTraceWidgetContainer },
  'proximity-radar': { component: ProximityRadarWidgetContainer },
  'radar-bar': { component: RadarBarWidgetContainer },
  standings: { component: StandingsWidgetContainer },
  relative: { component: RelativeWidgetContainer },
  'track-map': { component: TrackMapWidgetContainer },
  'relative-map': { component: RelativeMapWidgetContainer },
  'led-flags': { component: LedFlagWidgetContainer },
  chassis: { component: ChassisWidgetContainer },
  'lap-delta': { component: LapDeltaWidgetContainer, autoHeight: true },
  'lap-times': { component: LapTimesWidgetContainer, autoHeight: true },
  timer: { component: TimerWidgetContainer },
  weather: { component: WeatherWidgetContainer },
  fuel: { component: FuelWidgetContainer, autoHeight: true },
  'flat-flags': { component: FlatFlagsWidgetContainer, autoHeight: true },
};

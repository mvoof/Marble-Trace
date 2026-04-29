import { TelemetryDebugWidgetContainer } from '../components/widgets/TelemetryDebugWidget/TelemetryDebugWidgetContainer';
import { SpeedWidgetContainer } from '../components/widgets/SpeedWidget/SpeedWidgetContainer';
import { InputTraceWidgetContainer } from '../components/widgets/InputTraceWidget/InputTraceWidgetContainer';
import { ProximityRadarWidgetContainer } from '../components/widgets/ProximityRadarWidget/ProximityRadarWidgetContainer';
import { RadarBarWidgetContainer } from '../components/widgets/RadarBarWidget/RadarBarWidgetContainer';
import { StandingsWidgetContainer } from '../components/widgets/StandingsWidget/StandingsWidgetContainer';
import { RelativeWidgetContainer } from '../components/widgets/RelativeWidget/RelativeWidgetContainer';
import { TrackMapWidgetContainer } from '../components/widgets/TrackMapWidget/TrackMapWidgetContainer';
import { LinearMapWidgetContainer } from '../components/widgets/LinearMapWidget/LinearMapWidgetContainer';
import { FlagsWidgetContainer } from '../components/widgets/FlagsWidget/FlagsWidgetContainer';
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
  'linear-map': { component: LinearMapWidgetContainer },
  flags: { component: FlagsWidgetContainer },
  chassis: { component: ChassisWidgetContainer },
  'lap-delta': { component: LapDeltaWidgetContainer },
  'lap-times': { component: LapTimesWidgetContainer },
  timer: { component: TimerWidgetContainer },
  weather: { component: WeatherWidgetContainer },
  fuel: { component: FuelWidgetContainer, autoHeight: true },
  'flat-flags': { component: FlatFlagsWidgetContainer },
};

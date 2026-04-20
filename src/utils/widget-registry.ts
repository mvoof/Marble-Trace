import React from 'react';
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
import { SessionWidgetContainer } from '../components/widgets/SessionWidget/SessionWidgetContainer';
import { TimerWidgetContainer } from '../components/widgets/TimerWidget/TimerWidgetContainer';
import { WeatherWidgetContainer } from '../components/widgets/WeatherWidget/WeatherWidgetContainer';
import { widgetSettingsStore } from '../store/widget-settings.store';

export interface WidgetVariant {
  component: React.ComponentType<{
    onVisibilityChange?: (visible: boolean) => void;
  }>;
  designWidth: number;
  designHeight: number;
  /** Use adaptive font-size scaling instead of transform: scale() */
  adaptive?: boolean;
}

export interface WidgetEntry {
  variants: Record<string, WidgetVariant>;
  defaultVariant: string;
}

export const WIDGET_REGISTRY: Record<string, WidgetEntry> = {
  example: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: TelemetryDebugWidgetContainer,
        designWidth: 400,
        designHeight: 700,
      },
    },
  },

  speed: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: SpeedWidgetContainer,
        designWidth: 360,
        designHeight: 110,
      },
    },
  },

  'input-trace': {
    defaultVariant: 'horizontal',
    variants: {
      horizontal: {
        component: InputTraceWidgetContainer,
        designWidth: 400,
        designHeight: 220,
      },
      vertical: {
        component: InputTraceWidgetContainer,
        designWidth: 400,
        designHeight: 110,
      },
    },
  },

  'proximity-radar': {
    defaultVariant: 'default',
    variants: {
      default: {
        component: ProximityRadarWidgetContainer,
        designWidth: 200,
        designHeight: 300,
      },
    },
  },

  'radar-bar': {
    defaultVariant: 'default',
    variants: {
      default: {
        component: RadarBarWidgetContainer,
        designWidth: 800,
        designHeight: 380,
      },
    },
  },

  standings: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: StandingsWidgetContainer,
        designWidth: 750,
        designHeight: 400,
        adaptive: true,
      },
    },
  },

  relative: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: RelativeWidgetContainer,
        designWidth: 420,
        designHeight: 400,
        adaptive: true,
      },
    },
  },

  'track-map': {
    defaultVariant: 'default',
    variants: {
      default: {
        component: TrackMapWidgetContainer,
        designWidth: 400,
        designHeight: 400,
      },
    },
  },

  'linear-map': {
    defaultVariant: 'horizontal',
    variants: {
      horizontal: {
        component: LinearMapWidgetContainer,
        designWidth: 400,
        designHeight: 40,
        adaptive: true,
      },
      vertical: {
        component: LinearMapWidgetContainer,
        designWidth: 40,
        designHeight: 400,
        adaptive: true,
      },
    },
  },

  flags: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: FlagsWidgetContainer,
        designWidth: 630,
        designHeight: 189,
      },
    },
  },

  chassis: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: ChassisWidgetContainer,
        designWidth: 460,
        designHeight: 320,
      },
    },
  },

  'lap-delta': {
    defaultVariant: 'default',
    variants: {
      default: {
        component: LapDeltaWidgetContainer,
        designWidth: 320,
        designHeight: 90,
      },
    },
  },

  'lap-times': {
    defaultVariant: 'default',
    variants: {
      default: {
        component: LapTimesWidgetContainer,
        designWidth: 300,
        designHeight: 120,
      },
    },
  },

  session: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: SessionWidgetContainer,
        designWidth: 300,
        designHeight: 100,
      },
    },
  },

  timer: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: TimerWidgetContainer,
        designWidth: 280,
        designHeight: 80,
      },
    },
  },

  weather: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: WeatherWidgetContainer,
        designWidth: 300,
        designHeight: 200,
      },
    },
  },
};

export const resolveWidgetVariant = (
  id: string,
  entry: WidgetEntry
): WidgetVariant => {
  let variantKey = entry.defaultVariant;

  if (id === 'input-trace') {
    const settings = widgetSettingsStore.getInputTraceSettings();
    variantKey = settings.barMode === 'vertical' ? 'vertical' : 'horizontal';
  }

  if (id === 'linear-map') {
    const settings = widgetSettingsStore.getLinearMapSettings();
    variantKey =
      settings.orientation === 'vertical' ? 'vertical' : 'horizontal';
  }

  return entry.variants[variantKey] ?? entry.variants[entry.defaultVariant];
};

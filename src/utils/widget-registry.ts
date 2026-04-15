import React from 'react';
import { TelemetryDebugWidget } from '../components/widgets/TelemetryDebugWidget';
import { SpeedWidget } from '../components/widgets/SpeedWidget';
import { InputTraceWidget } from '../components/widgets/InputTraceWidget';
import { ProximityRadarWidget } from '../components/widgets/ProximityRadarWidget';
import { RadarBarWidget } from '../components/widgets/RadarBarWidget';
import { StandingsWidget } from '../components/widgets/StandingsWidget';
import { RelativeWidget } from '../components/widgets/RelativeWidget';
import { TrackMapWidget } from '../components/widgets/TrackMapWidget';
import { widgetSettingsStore } from '../store/widget-settings.store';

export interface WidgetVariant {
  component: React.ComponentType<{
    onVisibilityChange?: (visible: boolean) => void;
  }>;
  designWidth: number;
  designHeight: number;
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
        component: TelemetryDebugWidget,
        designWidth: 400,
        designHeight: 700,
      },
    },
  },

  speed: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: SpeedWidget,
        designWidth: 290,
        designHeight: 80,
      },
    },
  },

  'input-trace': {
    defaultVariant: 'horizontal',
    variants: {
      horizontal: {
        component: InputTraceWidget,
        designWidth: 400,
        designHeight: 220,
      },
      vertical: {
        component: InputTraceWidget,
        designWidth: 400,
        designHeight: 110,
      },
    },
  },

  'proximity-radar': {
    defaultVariant: 'default',
    variants: {
      default: {
        component: ProximityRadarWidget,
        designWidth: 200,
        designHeight: 300,
      },
    },
  },

  'radar-bar': {
    defaultVariant: 'default',
    variants: {
      default: {
        component: RadarBarWidget,
        designWidth: 800,
        designHeight: 380,
      },
    },
  },

  standings: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: StandingsWidget,
        designWidth: 750,
        designHeight: 400,
      },
    },
  },

  relative: {
    defaultVariant: 'default',
    variants: {
      default: {
        component: RelativeWidget,
        designWidth: 350,
        designHeight: 400,
      },
    },
  },

  'track-map': {
    defaultVariant: 'default',
    variants: {
      default: {
        component: TrackMapWidget,
        designWidth: 400,
        designHeight: 400,
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

  return entry.variants[variantKey] ?? entry.variants[entry.defaultVariant];
};

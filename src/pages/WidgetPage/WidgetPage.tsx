import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useParams } from 'react-router-dom';
import { useWidgetTelemetry } from '../../hooks/useWidgetTelemetry';
import { appSettingsStore } from '../../store/app-settings.store';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import { unitsStore } from '../../store/units.store';
import { TelemetryDebugWidget } from '../../components/widgets/TelemetryDebugWidget';

import { SpeedWidget } from '../../components/widgets/SpeedWidget';
import { InputTraceWidget } from '../../components/widgets/InputTraceWidget';
import { ProximityRadarWidget } from '../../components/widgets/ProximityRadarWidget';
import { RadarBarWidget } from '../../components/widgets/RadarBarWidget';
import { StandingsWidget } from '../../components/widgets/StandingsWidget';
import { RelativeWidget } from '../../components/widgets/RelativeWidget';
import { TrackMapWidget } from '../../components/widgets/TrackMapWidget';
import { WidgetWrapper } from '../../components/widgets/WidgetWrapper';
import styles from './WidgetPage.module.scss';

interface WidgetVariant {
  component: React.ComponentType;
  designWidth: number;
  designHeight: number;
}

interface WidgetEntry {
  variants: Record<string, WidgetVariant>;
  defaultVariant: string;
}

const WIDGET_MAP: Record<string, WidgetEntry> = {
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
        designWidth: 700,
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

const getWidgetVariant = (id: string, entry: WidgetEntry): string => {
  if (id === 'input-trace') {
    const settings = widgetSettingsStore.getInputTraceSettings();
    return settings.barMode === 'vertical' ? 'vertical' : 'horizontal';
  }

  return entry.defaultVariant;
};

interface BaseWidgetProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const WidgetPage = observer(() => {
  const { id } = useParams<{ id: string }>();
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  useWidgetTelemetry();

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';

    const init = async () => {
      await widgetSettingsStore.loadSettings();
      await unitsStore.loadSettings();
      await unitsStore.initWidgetListener();
      await widgetSettingsStore.initWidgetListener();
      await appSettingsStore.initWidgetListener();
      setReady(true);
    };

    init();

    return () => {
      widgetSettingsStore.dispose();
      unitsStore.dispose();
      appSettingsStore.disposeWidgetListener();
    };
  }, []);

  const widgetEntry = id ? WIDGET_MAP[id] : null;

  if (!ready) return null;

  if (!widgetEntry || !id) {
    return <pre className={styles.widgetPage}>Unknown widget: {id}</pre>;
  }

  const variantKey = getWidgetVariant(id, widgetEntry);
  const variant =
    widgetEntry.variants[variantKey] ??
    widgetEntry.variants[widgetEntry.defaultVariant];
  const { component: WidgetComponent, designWidth, designHeight } = variant;
  const Component = WidgetComponent as React.ComponentType<BaseWidgetProps>;

  return (
    <section className={styles.widgetPage}>
      <WidgetWrapper
        widgetId={id}
        designWidth={designWidth}
        designHeight={designHeight}
        visible={visible}
      >
        <Component onVisibilityChange={setVisible} />
      </WidgetWrapper>
    </section>
  );
});

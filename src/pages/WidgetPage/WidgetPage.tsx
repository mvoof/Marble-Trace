import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useParams } from 'react-router-dom';
import { useWidgetTelemetry } from '../../hooks/useWidgetTelemetry';
import { appSettingsStore } from '../../store/app-settings.store';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import { unitsStore } from '../../store/units.store';
import { ExampleWidget } from '../../components/widgets/ExampleWidget';
import { SpeedWidget } from '../../components/widgets/SpeedWidget';
import { InputTraceWidget } from '../../components/widgets/InputTraceWidget';
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
        component: ExampleWidget,
        designWidth: 400,
        designHeight: 600,
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
};

const getWidgetVariant = (id: string, entry: WidgetEntry): string => {
  if (id === 'input-trace') {
    const settings = widgetSettingsStore.getInputTraceSettings();
    return settings.barMode === 'vertical' ? 'vertical' : 'horizontal';
  }

  return entry.defaultVariant;
};

export const WidgetPage = observer(() => {
  const { id } = useParams<{ id: string }>();
  const [ready, setReady] = useState(false);

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

  return (
    <section className={styles.widgetPage}>
      <WidgetWrapper
        widgetId={id}
        designWidth={designWidth}
        designHeight={designHeight}
      >
        <WidgetComponent />
      </WidgetWrapper>
    </section>
  );
});

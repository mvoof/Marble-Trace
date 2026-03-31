import React, { useEffect, useState } from 'react';
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

interface WidgetEntry {
  component: React.ComponentType;
  designWidth: number;
  designHeight: number;
}

const WIDGET_MAP: Record<string, WidgetEntry> = {
  example: { component: ExampleWidget, designWidth: 400, designHeight: 600 },
  speed: { component: SpeedWidget, designWidth: 400, designHeight: 145 },
  'input-trace': {
    component: InputTraceWidget,
    designWidth: 260,
    designHeight: 260,
  },
};

export const WidgetPage = () => {
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

  const { component: WidgetComponent, designWidth, designHeight } = widgetEntry;

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
};

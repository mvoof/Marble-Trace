import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWidgetTelemetry } from '../../hooks/useWidgetTelemetry';
import { appSettingsStore } from '../../store/app-settings.store';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import { ExampleWidget } from '../../components/widgets/ExampleWidget';
import { WidgetWrapper } from '../../components/widgets/WidgetWrapper';
import styles from './WidgetPage.module.scss';

const WIDGET_MAP: Record<string, React.ComponentType> = {
  example: ExampleWidget,
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
      await widgetSettingsStore.initWidgetListener();
      await appSettingsStore.initWidgetListener();
      setReady(true);
    };
    init();

    return () => {
      widgetSettingsStore.dispose();
      appSettingsStore.disposeWidgetListener();
    };
  }, []);

  const WidgetComponent = id ? WIDGET_MAP[id] : null;

  if (!ready) return null;

  if (!WidgetComponent || !id) {
    return <pre className={styles.widgetPage}>Unknown widget: {id}</pre>;
  }

  return (
    <section className={styles.widgetPage}>
      <WidgetWrapper widgetId={id}>
        <WidgetComponent />
      </WidgetWrapper>
    </section>
  );
};

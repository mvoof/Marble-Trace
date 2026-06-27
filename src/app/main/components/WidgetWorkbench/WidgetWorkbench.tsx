import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Select } from 'antd';
import {
  Gauge,
  Activity,
  Radio,
  BarChart2,
  ListOrdered,
  Users,
  Map,
  Compass,
  Flag,
  Wrench,
  Timer,
  Clock,
  CloudRain,
  Fuel,
  Orbit,
  Grid3x3,
  FileText,
  Layers,
} from 'lucide-react';
import { useWidgetSettingsStore } from '@store/root-store-context';
import { WidgetPreview } from '../WidgetPreview/WidgetPreview';
import { WidgetSettings } from '../WidgetSettings/WidgetSettings';
import { DefaultsEditorProvider } from '../WidgetSettings/WidgetEditorContext';
import {
  PREVIEW_SCENARIOS,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';
import styles from './WidgetWorkbench.module.scss';

const SCENARIO_OPTIONS = PREVIEW_SCENARIOS.map((scenario) => ({
  value: scenario.id,
  label: scenario.label,
}));

const getWidgetIcon = (id: string) => {
  if (id === 'speed') {
    return <Gauge size={24} />;
  }

  if (id === 'input-trace') {
    return <Activity size={24} />;
  }

  if (id === 'proximity-radar') {
    return <Radio size={24} />;
  }

  if (id === 'radar-bar') {
    return <BarChart2 size={24} />;
  }

  if (id === 'standings') {
    return <ListOrdered size={24} />;
  }

  if (id === 'relative') {
    return <Users size={24} />;
  }

  if (id === 'track-map') {
    return <Map size={24} />;
  }

  if (id === 'relative-map') {
    return <Compass size={24} />;
  }

  if (id === 'led-flags' || id === 'flat-flags') {
    return <Flag size={24} />;
  }

  if (id === 'chassis') {
    return <Wrench size={24} />;
  }

  if (id === 'delta') {
    return <Timer size={24} />;
  }

  if (id === 'timer') {
    return <Clock size={24} />;
  }

  if (id === 'weather') {
    return <CloudRain size={24} />;
  }

  if (id === 'fuel') {
    return <Fuel size={24} />;
  }

  if (id === 'g-meter') {
    return <Orbit size={24} />;
  }

  if (id === 'sector-matrix') {
    return <Grid3x3 size={24} />;
  }

  if (id === 'lap-log') {
    return <FileText size={24} />;
  }

  return <Layers size={24} />;
};

// Two-pane widget catalog: a live preview on a backdrop on the left, the widget
// settings panel on the right. Editing the panel updates the preview in place.
// When no widget is selected, displays a rich visual catalog of all available
// widget modules as cards with status indicator badges.
export const WidgetWorkbench = observer(
  ({
    widgetId,
    onSelectWidget,
  }: {
    widgetId: string | null;
    onSelectWidget?: (id: string) => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();
    const [scenarioId, setScenarioId] = useState(DEFAULT_PREVIEW_SCENARIO_ID);

    if (!widgetId) {
      return (
        <div className={styles.catalogContainer}>
          <header className={styles.catalogHeader}>
            <h3 className={styles.catalogTitle}>Widget Catalog</h3>
            <p className={styles.catalogSubtitle}>
              Select a module from the catalog below to configure its settings.
            </p>
          </header>

          <div className={styles.catalogGrid}>
            {widgetSettings.allWidgets.map((widget) => {
              const isAvailable = widgetSettings.availableWidgetIds.includes(
                widget.id
              );
              const isEnabled = widgetSettings.enabledWidgetIds.includes(
                widget.id
              );

              return (
                <button
                  key={widget.id}
                  type="button"
                  className={`${styles.catalogCard} ${
                    !isAvailable ? styles.cardDisabled : ''
                  }`}
                  onClick={() => {
                    if (isAvailable && onSelectWidget) {
                      onSelectWidget(widget.id);
                    }
                  }}
                  disabled={!isAvailable}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.cardIcon}>
                      {getWidgetIcon(widget.id)}
                    </span>
                    <span
                      className={`${styles.cardStatusBadge} ${
                        !isAvailable
                          ? styles.badgeUnavailable
                          : isEnabled
                            ? styles.badgeActive
                            : styles.badgeDisabled
                      }`}
                    >
                      {!isAvailable
                        ? 'Unavailable'
                        : isEnabled
                          ? 'Active'
                          : 'Inactive'}
                    </span>
                  </div>

                  <span className={styles.cardTitle}>{widget.label}</span>
                  <p className={styles.cardDesc}>
                    {widget.description ||
                      'Configure widget options and preview telemetry output.'}
                  </p>
                  <span className={styles.cardMeta}>
                    Design Size: {widget.designWidth}×{widget.designHeight}px
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <DefaultsEditorProvider>
        <div className={styles.root}>
          <div className={styles.previewColumn}>
            <div className={styles.scenarioBar}>
              <span className={styles.scenarioLabel}>Scenario</span>
              <Select
                size="small"
                value={scenarioId}
                onChange={setScenarioId}
                options={SCENARIO_OPTIONS}
                style={{ minWidth: 160 }}
              />
            </div>

            <div className={styles.previewPane}>
              <WidgetPreview
                key={widgetId}
                widgetId={widgetId}
                scenarioId={scenarioId}
              />
            </div>
          </div>

          <div className={styles.settingsPane}>
            <WidgetSettings widgetId={widgetId} />
          </div>
        </div>
      </DefaultsEditorProvider>
    );
  }
);

import { observer } from 'mobx-react-lite';

import { StatCell } from './StatCell';

import styles from './StatsGrid.module.scss';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const StatsGrid = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const { showAirTemp, showTrackTemp, showWind, showHumidity } =
    widgetSettings.getSettings<WeatherWidgetSettings>('weather');

  const hasStats = showAirTemp || showTrackTemp || showWind || showHumidity;

  if (!hasStats) {
    return null;
  }

  return (
    <div className={styles.statsGrid}>
      <StatCell type="airTemp" />
      <StatCell type="trackTemp" />
      <StatCell type="wind" />
      <StatCell type="humidity" />
    </div>
  );
});

import { observer } from 'mobx-react-lite';

import { StatCell } from './StatCell';

import styles from './StatsGrid.module.scss';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const StatsGrid = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const { showWind, showHumidity, showTrackWetness, showTrackTemp } =
    widgetSettings.getSettings<WeatherWidgetSettings>('weather');

  const hasStats =
    showWind || showHumidity || showTrackWetness || showTrackTemp;

  if (!hasStats) {
    return null;
  }

  return (
    <div className={styles.statsGrid}>
      <StatCell type="trackTemp" />
      <StatCell type="wind" />
      <StatCell type="trackWetness" />
      <StatCell type="humidity" />
    </div>
  );
});

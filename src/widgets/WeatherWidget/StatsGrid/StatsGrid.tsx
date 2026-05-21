import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import { StatCell } from './StatCell';

import styles from './StatsGrid.module.scss';

export const StatsGrid = observer(() => {
  const { showAirTemp, showTrackTemp, showWind, showHumidity } =
    widgetSettingsStore.getWeatherSettings();

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

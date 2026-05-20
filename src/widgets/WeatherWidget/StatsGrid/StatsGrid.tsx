import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import { StatCell } from './StatCell';

import styles from './StatsGrid.module.scss';

export const StatsGrid = observer(() => {
  const { showAirTemp, showTrackTemp, showWind, showHumidity } =
    widgetSettingsStore.getWeatherSettings();

  return (
    <div className={styles.statsGrid}>
      {showAirTemp && <StatCell type="airTemp" />}
      {showTrackTemp && <StatCell type="trackTemp" />}
      {showWind && <StatCell type="wind" />}
      {showHumidity && <StatCell type="humidity" />}
    </div>
  );
});

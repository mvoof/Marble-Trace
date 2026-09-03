import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { StatCell } from './StatCell';

import styles from './StatsGrid.module.scss';
import type { WeatherWidgetSettings } from '@/types/widget-settings';

export const StatsGrid = observer(() => {
  const { showWind, showHumidity, showTrackWetness, showTrackTemp } =
    useWidgetSettings<WeatherWidgetSettings>('weather');

  const hasStats =
    showWind || showHumidity || showTrackWetness || showTrackTemp;

  if (!hasStats) {
    return null;
  }

  return (
    <div className={styles.statsGrid}>
      <StatCell type="trackTemp" />
      <StatCell type="humidity" />
      <StatCell type="trackWetness" />
      <StatCell type="wind" />
    </div>
  );
});

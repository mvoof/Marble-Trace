import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { WindCompass } from './WindCompass/WindCompass';
import { StatsGrid } from './StatsGrid/StatsGrid';
import { ForecastBlock } from './ForecastBlock/ForecastBlock';

import styles from './WeatherWidget.module.scss';

export const WeatherWidget = observer(() => {
  const {
    showCompass,
    showAirTemp,
    showTrackTemp,
    showWind,
    showHumidity,
    showForecast,
  } = widgetSettingsStore.getWeatherSettings();

  const hasStats = showAirTemp || showTrackTemp || showWind || showHumidity;

  return (
    <WidgetPanel direction="column" gap={0} minWidth={80}>
      {showCompass && (
        <div className={styles.compassBlock}>
          <WindCompass />
        </div>
      )}

      {hasStats && <StatsGrid />}

      {showForecast && <ForecastBlock />}
    </WidgetPanel>
  );
});

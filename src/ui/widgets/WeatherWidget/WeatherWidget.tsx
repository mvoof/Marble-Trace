import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import type { WeatherWidgetSettings } from '@/types/widget-settings';

import { WindCompass } from './WindCompass/WindCompass';
import { WeatherHeader } from './WeatherHeader/WeatherHeader';
import { HorizontalCondition } from './HorizontalCondition/HorizontalCondition';
import { StatsGrid } from './StatsGrid/StatsGrid';
import { ForecastBlock } from './ForecastBlock/ForecastBlock';
import { ForecastStrip } from './ForecastStrip/ForecastStrip';

import styles from './WeatherWidget.module.scss';

// Matches the stacking rule in StatsGrid: two cells or fewer become one column.
const MAX_CELLS_IN_ONE_COLUMN = 2;

const HORIZONTAL_MIN_WIDTH = 320;
const TALL_MIN_WIDTH = 80;

export const WeatherWidget = observer(() => {
  const {
    horizontal,
    showCompass,
    showForecast,
    showTrackTemp,
    showHumidity,
    showTrackWetness,
    showWind,
  } = useWidgetSettings<WeatherWidgetSettings>('weather');

  // With every cell switched off there is no second column, and the conditions
  // have the row to themselves — the empty wrapper would hold a share of it.
  const statsCount = [
    showTrackTemp,
    showHumidity,
    showTrackWetness,
    showWind,
  ].filter(Boolean).length;
  const hasStats = statsCount > 0;
  const hasNarrowStats = statsCount <= MAX_CELLS_IN_ONE_COLUMN;

  if (horizontal) {
    return (
      <WidgetPanel direction="column" gap={0} minWidth={HORIZONTAL_MIN_WIDTH}>
        {/*
          With the compass off, the column it held is free: the cells move up
          beside the conditions instead of keeping a row of their own, which
          takes the widget's whole lower band away.
        */}
        <div
          className={[
            styles.horizontalTop,
            showCompass ? '' : styles.horizontalTopFlush,
            // Nothing below it to divide from: no cells row, no forecast.
            !showCompass && !showForecast ? styles.horizontalTopLast : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {showCompass && (
            <div className={styles.compassSlot}>
              <WindCompass horizontal />
            </div>
          )}

          <HorizontalCondition />

          {!showCompass && hasStats && (
            <div
              className={`${styles.inlineStats} ${
                hasNarrowStats ? styles.inlineStatsNarrow : ''
              }`}
            >
              <StatsGrid beside />
            </div>
          )}
        </div>

        {showCompass && <StatsGrid horizontal />}

        <ForecastStrip />
      </WidgetPanel>
    );
  }

  return (
    <WidgetPanel direction="column" gap={0} minWidth={TALL_MIN_WIDTH}>
      {/* The slot carries the dial's inset, so with no dial it must go too. */}
      {showCompass && (
        <div className={styles.tallCompassSlot}>
          <WindCompass />
        </div>
      )}

      <WeatherHeader />

      <StatsGrid />

      <ForecastBlock />
    </WidgetPanel>
  );
});

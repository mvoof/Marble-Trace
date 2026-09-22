import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { StatCell } from './StatCell';

import styles from './StatsGrid.module.scss';
import type { WeatherWidgetSettings } from '@/types/widget-settings';

// Beside the conditions the plate is a narrow column, so two cells read better
// stacked than squeezed into two columns of half its width.
const MAX_CELLS_IN_ONE_COLUMN = 2;

interface StatsGridProps {
  /** The horizontal layout lays the same cells out as one row of four. */
  horizontal?: boolean;
  /**
   * Beside the conditions, with the compass off: the column count then follows
   * how many cells are left rather than always being two.
   */
  beside?: boolean;
}

export const StatsGrid = observer(
  ({ horizontal = false, beside = false }: StatsGridProps) => {
    const { showWind, showHumidity, showTrackWetness, showTrackTemp } =
      useWidgetSettings<WeatherWidgetSettings>('weather');

    const visibleCount = [
      showTrackTemp,
      showHumidity,
      showTrackWetness,
      showWind,
    ].filter(Boolean).length;

    if (visibleCount === 0) {
      return null;
    }

    const isSingleColumn = beside && visibleCount <= MAX_CELLS_IN_ONE_COLUMN;

    return (
      <div
        className={[
          styles.statsGrid,
          horizontal ? styles.statsRow : '',
          isSingleColumn ? styles.singleColumn : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <StatCell type="trackTemp" horizontal={horizontal} />
        <StatCell type="humidity" horizontal={horizontal} />
        <StatCell type="trackWetness" horizontal={horizontal} />
        <StatCell type="wind" horizontal={horizontal} />
      </div>
    );
  }
);

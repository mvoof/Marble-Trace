import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import {
  G_CONSTANT,
  SMOOTHING,
  computeColor,
} from '@utils/widget/g-meter-utils';

import type { GMeterWidgetSettings } from '@/types/widget-settings';
import styles from './GAxisColumn.module.scss';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { UnitLabelText } from '@/components/shared/UnitLabelText/UnitLabelText';
import { UnitValueText } from '@/components/shared/UnitValueText/UnitValueText';

interface GAxisColumnProps {
  axis: 'lat' | 'lon';
  hasDivider?: boolean;
}

export const GAxisColumn = observer(
  ({ axis, hasDivider }: GAxisColumnProps) => {
    const { carDynamics } = useTelemetryStore();

    const widgetSettings = useWidgetSettingsStore();

    const { scale, colorMode } =
      widgetSettings.getSettings<GMeterWidgetSettings>('g-meter');

    const stateRef = useRef({
      smoothedLatG: 0,
      smoothedLonG: 0,
      peakG: 0,
    });

    useEffect(() => {
      const state = stateRef.current;

      state.smoothedLatG = 0;
      state.smoothedLonG = 0;
      state.peakG = 0;
    }, [scale]);

    const rawLat = (carDynamics?.lat_accel ?? 0) / G_CONSTANT;
    const rawLon = (carDynamics?.long_accel ?? 0) / G_CONSTANT;

    const state = stateRef.current;
    state.smoothedLatG += (rawLat - state.smoothedLatG) * SMOOTHING;
    state.smoothedLonG += (rawLon - state.smoothedLonG) * SMOOTHING;

    const axisValue = axis === 'lat' ? state.smoothedLatG : state.smoothedLonG;

    if (Math.abs(axisValue) > state.peakG) {
      state.peakG = Math.abs(axisValue);
    }

    const dist = Math.sqrt(state.smoothedLatG ** 2 + state.smoothedLonG ** 2);
    const color = computeColor(
      colorMode,
      state.smoothedLatG,
      state.smoothedLonG,
      dist
    );

    const label = axis === 'lat' ? 'LAT' : 'LON';
    const displayValue = Math.abs(axisValue).toFixed(2);
    const displayPeak = state.peakG.toFixed(2);

    return (
      <div
        className={`${styles.axisColumn} ${hasDivider ? styles.axisColumnDivider : ''}`}
      >
        <div className={styles.axisHeader}>
          <UnitLabelText className={styles.axisLabel}>{label}</UnitLabelText>

          <UnitValueText
            className={styles.val}
            color={color}
            value={displayValue}
          />
        </div>

        <div className={styles.peakRow}>
          <UnitLabelText className={styles.peakLabel}>PEAK</UnitLabelText>

          <UnitValueText className={styles.peakVal} value={displayPeak} />
        </div>
      </div>
    );
  }
);

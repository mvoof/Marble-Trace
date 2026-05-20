import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import {
  G_CONSTANT,
  SMOOTHING,
  computeColor,
} from '../../../../utils/widget/g-meter-utils';

import styles from './GAxisColumn.module.scss';

interface GAxisColumnProps {
  axis: 'lat' | 'lon';
  hasDivider?: boolean;
}

export const GAxisColumn = observer(
  ({ axis, hasDivider }: GAxisColumnProps) => {
    const { scale, colorMode } = widgetSettingsStore.getGMeterSettings();
    const dynamics = telemetryStore.carDynamics;

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

    const rawLat = (dynamics?.lat_accel ?? 0) / G_CONSTANT;
    const rawLon = (dynamics?.long_accel ?? 0) / G_CONSTANT;

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
          <span className={styles.axisLabel}>{label}</span>

          <span className={styles.val} style={{ color }}>
            {displayValue}
          </span>
        </div>

        <div className={styles.peakRow}>
          <span className={styles.peakLabel}>PEAK</span>

          <span className={styles.peakVal}>{displayPeak}</span>
        </div>
      </div>
    );
  }
);

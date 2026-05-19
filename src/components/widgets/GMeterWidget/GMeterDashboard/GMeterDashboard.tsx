import { useEffect, useLayoutEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { G_CONSTANT, SMOOTHING, computeColor } from '../g-meter-utils';

import styles from './GMeterDashboard.module.scss';

export const GMeterDashboard = observer(() => {
  const { scale, colorMode } = widgetSettingsStore.getGMeterSettings();
  const dynamics = telemetryStore.carDynamics;

  const latSpanRef = useRef<HTMLSpanElement>(null);
  const lonSpanRef = useRef<HTMLSpanElement>(null);
  const peakLatSpanRef = useRef<HTMLSpanElement>(null);
  const peakLonSpanRef = useRef<HTMLSpanElement>(null);

  const stateRef = useRef({
    smoothedLatG: 0,
    smoothedLonG: 0,
    peakLatG: 0,
    peakLonG: 0,
  });

  const colorModeRef = useRef(colorMode);
  const latAccelRef = useRef(dynamics?.lat_accel ?? 0);
  const lonAccelRef = useRef(dynamics?.long_accel ?? 0);

  colorModeRef.current = colorMode;
  latAccelRef.current = dynamics?.lat_accel ?? 0;
  lonAccelRef.current = dynamics?.long_accel ?? 0;

  useEffect(() => {
    const state = stateRef.current;

    state.smoothedLatG = 0;
    state.smoothedLonG = 0;
    state.peakLatG = 0;
    state.peakLonG = 0;

    if (peakLatSpanRef.current) {
      peakLatSpanRef.current.textContent = '0.00';
    }

    if (peakLonSpanRef.current) {
      peakLonSpanRef.current.textContent = '0.00';
    }
  }, [scale]);

  useLayoutEffect(() => {
    const rawLat = latAccelRef.current / G_CONSTANT;
    const rawLon = lonAccelRef.current / G_CONSTANT;

    const state = stateRef.current;
    state.smoothedLatG += (rawLat - state.smoothedLatG) * SMOOTHING;
    state.smoothedLonG += (rawLon - state.smoothedLonG) * SMOOTHING;

    const dist = Math.sqrt(state.smoothedLatG ** 2 + state.smoothedLonG ** 2);

    const color = computeColor(
      colorModeRef.current,
      state.smoothedLatG,
      state.smoothedLonG,
      dist
    );

    if (Math.abs(state.smoothedLatG) > state.peakLatG) {
      state.peakLatG = Math.abs(state.smoothedLatG);
    }

    if (Math.abs(state.smoothedLonG) > state.peakLonG) {
      state.peakLonG = Math.abs(state.smoothedLonG);
    }

    if (latSpanRef.current) {
      latSpanRef.current.textContent = Math.abs(state.smoothedLatG).toFixed(2);
      latSpanRef.current.style.color = color;
    }

    if (lonSpanRef.current) {
      lonSpanRef.current.textContent = Math.abs(state.smoothedLonG).toFixed(2);
      lonSpanRef.current.style.color = color;
    }

    if (peakLatSpanRef.current) {
      peakLatSpanRef.current.textContent = state.peakLatG.toFixed(2);
    }

    if (peakLonSpanRef.current) {
      peakLonSpanRef.current.textContent = state.peakLonG.toFixed(2);
    }
  });

  return (
    <div className={styles.dashboard}>
      <div className={styles.currentValues}>
        <div className={styles.valueGroup}>
          <span className={styles.axisLabel}>LAT</span>

          <span ref={latSpanRef} className={styles.val}>
            0.00
          </span>
        </div>

        <span className={styles.divider}>|</span>

        <div className={styles.valueGroup}>
          <span className={styles.axisLabel}>LON</span>

          <span ref={lonSpanRef} className={styles.val}>
            0.00
          </span>
        </div>
      </div>

      <div className={styles.peakValues}>
        <span className={styles.peakLabel}>PEAK</span>

        <span ref={peakLatSpanRef} className={styles.peakVal}>
          0.00
        </span>

        <span className={styles.divider}>•</span>

        <span ref={peakLonSpanRef} className={styles.peakVal}>
          0.00
        </span>
      </div>
    </div>
  );
});

import { forwardRef, useImperativeHandle, useRef } from 'react';
import styles from './GMeterDashboard.module.scss';

export interface GMeterDashboardHandle {
  update: (
    lat: number,
    lon: number,
    peakLat: number,
    peakLon: number,
    color: string
  ) => void;
  reset: () => void;
}

export const GMeterDashboard = forwardRef<GMeterDashboardHandle>((_, ref) => {
  const latRef = useRef<HTMLSpanElement>(null);
  const lonRef = useRef<HTMLSpanElement>(null);

  const peakLatRef = useRef<HTMLSpanElement>(null);
  const peakLonRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    update: (lat, lon, peakLat, peakLon, color) => {
      if (latRef.current) {
        latRef.current.textContent = Math.abs(lat).toFixed(2);
        latRef.current.style.color = color;
      }

      if (lonRef.current) {
        lonRef.current.textContent = Math.abs(lon).toFixed(2);
        lonRef.current.style.color = color;
      }

      if (peakLatRef.current) {
        peakLatRef.current.textContent = peakLat.toFixed(2);
      }

      if (peakLonRef.current) {
        peakLonRef.current.textContent = peakLon.toFixed(2);
      }
    },
    reset: () => {
      if (peakLatRef.current) peakLatRef.current.textContent = '0.00';
      if (peakLonRef.current) peakLonRef.current.textContent = '0.00';
    },
  }));

  return (
    <div className={styles.dashboard}>
      <div className={styles.currentValues}>
        <div className={styles.valueGroup}>
          <span className={styles.axisLabel}>LAT</span>

          <span ref={latRef} className={styles.val}>
            0.00
          </span>
        </div>

        <span className={styles.divider}>|</span>

        <div className={styles.valueGroup}>
          <span className={styles.axisLabel}>LON</span>

          <span ref={lonRef} className={styles.val}>
            0.00
          </span>
        </div>
      </div>

      <div className={styles.peakValues}>
        <span className={styles.peakLabel}>PEAK</span>

        <span ref={peakLatRef} className={styles.peakVal}>
          0.00
        </span>

        <span className={styles.divider}>•</span>

        <span ref={peakLonRef} className={styles.peakVal}>
          0.00
        </span>
      </div>
    </div>
  );
});

GMeterDashboard.displayName = 'GMeterDashboard';

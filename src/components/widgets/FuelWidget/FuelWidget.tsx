import { useEffect, useRef } from 'react';

import { WidgetPanel } from '../primitives/WidgetPanel';
import {
  formatFuelLiters,
  formatLaps,
  type FuelCalculations,
} from './fuel-utils';

import styles from './FuelWidget.module.scss';

interface FuelWidgetProps {
  fuelLevel: number | null;
  fuelMax: number | null;
  avgPerLap: FuelCalculations['avgPerLap'];
  lapsRemaining: FuelCalculations['lapsRemaining'];
  lapsToFinish: FuelCalculations['lapsToFinish'];
  shortage: FuelCalculations['shortage'];
  fuelToAddWithBuffer: FuelCalculations['fuelToAddWithBuffer'];
  fuelSavePerLap: FuelCalculations['fuelSavePerLap'];
  pitWarning: FuelCalculations['pitWarning'];
  pitWindowStart: FuelCalculations['pitWindowStart'];
  pitWindowEnd: FuelCalculations['pitWindowEnd'];
  showChart: boolean;
  lapFuelHistory: number[];
}

const statusClass = (shortage: number | null): string => {
  if (shortage === null || shortage >= 0) return styles.statusSafe;
  return styles.statusShort;
};

const statusText = (shortage: number | null): string => {
  if (shortage === null) return 'SAFE';
  if (shortage < 0) return 'SHORT';
  return `SAFE +${shortage.toFixed(1)}L`;
};

const valueClass = (shortage: number | null): string => {
  if (shortage === null) return '';
  return shortage >= 0 ? styles.rowValueSafe : styles.rowValueShort;
};

const FuelChart = ({ history }: { history: number[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...history) * 0.95;
    const max = Math.max(...history) * 1.05;
    const range = max - min || 1;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.strokeStyle = '#3399ff';
    ctx.lineWidth = 1.5;

    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const last = history[history.length - 1];
    const ly = h - ((last - min) / range) * h;
    ctx.beginPath();
    ctx.arc(w, ly, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#3399ff';
    ctx.fill();
  }, [history]);

  return <canvas ref={canvasRef} className={styles.chartCanvas} />;
};

export const FuelWidget = ({
  fuelLevel,
  fuelMax,
  avgPerLap,
  lapsRemaining,
  lapsToFinish,
  shortage,
  fuelToAddWithBuffer,
  fuelSavePerLap,
  pitWarning,
  pitWindowStart,
  pitWindowEnd,
  showChart,
  lapFuelHistory,
}: FuelWidgetProps) => {
  const pct =
    fuelLevel !== null && fuelMax !== null && fuelMax > 0
      ? Math.min(fuelLevel / fuelMax, 1)
      : null;

  const isShort = shortage !== null && shortage < 0;
  const windowText =
    pitWindowStart !== null && pitWindowEnd !== null
      ? `LAP ${pitWindowStart}–${pitWindowEnd}`
      : '—';

  const lapsDisplay =
    lapsRemaining !== null && lapsToFinish !== null
      ? `${formatLaps(lapsRemaining)} / ${formatLaps(lapsToFinish)}`
      : formatLaps(lapsRemaining);

  return (
    <WidgetPanel direction="column" gap={0} minWidth={200}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>FUEL</span>
        <span className={`${styles.statusBadge} ${statusClass(shortage)}`}>
          {statusText(shortage)}
        </span>
      </div>

      <div className={styles.progressWrap}>
        {pct !== null && (
          <div
            className={styles.progressBar}
            style={{ width: `${pct * 100}%` }}
          />
        )}
        <div className={styles.progressLabels}>
          <span>
            {fuelLevel !== null ? `${fuelLevel.toFixed(1)} L` : '— L'}
          </span>
          <span className={styles.progressLabelMuted}>
            {fuelMax !== null ? `${fuelMax.toFixed(0)} L` : ''}
          </span>
        </div>
      </div>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>PER LAP</span>
          <span className={styles.rowValue}>{formatFuelLiters(avgPerLap)}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>LEFT / FINISH</span>
          <span className={`${styles.rowValue} ${valueClass(shortage)}`}>
            {lapsDisplay}
          </span>
        </div>

        {fuelSavePerLap !== null ? (
          <div className={styles.row}>
            <span className={styles.rowLabel}>SAVE/LAP</span>
            <span className={`${styles.rowValue} ${styles.rowValueWarn}`}>
              {fuelSavePerLap.toFixed(2)} L
            </span>
          </div>
        ) : (
          !isShort &&
          fuelToAddWithBuffer !== null &&
          fuelToAddWithBuffer > 0 && (
            <div className={styles.row}>
              <span className={styles.rowLabel}>FILL +1 LAP</span>
              <span className={`${styles.rowValue} ${styles.rowValueMuted}`}>
                {formatFuelLiters(fuelToAddWithBuffer)}
              </span>
            </div>
          )
        )}
      </div>

      {pitWarning && (
        <div
          className={`${styles.pitWarning} ${isShort ? styles.pitWarningUrgent : ''}`}
        >
          <div className={styles.pitWarningHeader}>
            <span className={styles.pitWarningHeaderLabel}>PIT WINDOW</span>
            <span className={styles.pitWarningWindow}>{windowText}</span>
          </div>

          <div className={styles.pitWarningSeparator} />

          <div className={styles.pitWarningBody}>
            <div className={styles.pitWarningBodyLeft}>
              <span className={styles.pitWarningBodyLabel}>TO REFUEL</span>
              <span className={styles.pitWarningBodySub}>
                incl. +1 lap buffer
              </span>
            </div>
            <span
              className={`${styles.pitWarningAmount} ${isShort ? styles.pitWarningAmountDanger : ''}`}
            >
              {fuelToAddWithBuffer !== null
                ? fuelToAddWithBuffer.toFixed(1)
                : '—'}
              <span className={styles.pitWarningAmountUnit}> L</span>
            </span>
          </div>
        </div>
      )}

      {showChart && lapFuelHistory.length >= 2 && (
        <div className={styles.chart}>
          <span className={styles.chartLabel}>USE/LAP HISTORY</span>
          <FuelChart history={lapFuelHistory} />
        </div>
      )}
    </WidgetPanel>
  );
};

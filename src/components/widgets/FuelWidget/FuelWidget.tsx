import React from 'react';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { formatFuelLiters, type FuelCalculations } from './fuel-utils';
import { FUEL_THRESHOLDS } from './fuel-constants';
import { FuelChart } from './FuelChart/FuelChart';

import styles from './FuelWidget.module.scss';

interface FuelWidgetProps {
  fuelLevel: number | null;
  fuelMax: number | null;
  avgPerLap: FuelCalculations['avgPerLap'];
  currentUsePerLap: number | null;
  lapsRemaining: FuelCalculations['lapsRemaining'];
  shortage: FuelCalculations['shortage'];
  fuelToAddWithBuffer: FuelCalculations['fuelToAddWithBuffer'];
  pitWarning: FuelCalculations['pitWarning'];
  pitWindowStart: FuelCalculations['pitWindowStart'];
  pitWindowEnd: FuelCalculations['pitWindowEnd'];
  tankTooSmall: boolean;
  showChart: boolean;
  chartType: 'line' | 'bar';
  lapFuelHistory: number[];
  pitWarningLaps: number;
}

const statusClass = (shortage: number | null): string => {
  if (shortage === null || shortage >= 0) return styles.statusSafe;
  return styles.statusShort;
};

const statusText = (shortage: number | null): string => {
  if (shortage === null) return '—';
  const sign = shortage >= 0 ? '+' : '';
  return `FINISH ${sign}${shortage.toFixed(1)} L`;
};

const lapsLeftClass = (
  lapsRemaining: number | null,
  pitWarningLaps: number
): string => {
  if (lapsRemaining === null) return '';

  if (lapsRemaining > pitWarningLaps + FUEL_THRESHOLDS.LAPS_LEFT_GREEN_BUFFER)
    return styles.rowValueSafe;
  if (lapsRemaining <= pitWarningLaps) return styles.rowValueShort;

  return styles.rowValueWarn;
};

export const FuelWidget = ({
  fuelLevel,
  fuelMax,
  avgPerLap,
  currentUsePerLap,
  lapsRemaining,
  shortage,
  fuelToAddWithBuffer,
  pitWarning,
  pitWindowStart,
  pitWindowEnd,
  tankTooSmall,
  showChart,
  chartType,
  lapFuelHistory,
  pitWarningLaps,
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

  const lapsRemainingText =
    lapsRemaining !== null ? `${lapsRemaining.toFixed(1)} LAP` : '—';

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
            style={{ '--progress': pct } as React.CSSProperties}
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
          <span className={styles.rowLabel}>AVG/LAP</span>
          <span className={styles.rowValue}>{formatFuelLiters(avgPerLap)}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>NOW/LAP</span>
          <span className={`${styles.rowValue} ${styles.rowValueMuted}`}>
            {formatFuelLiters(currentUsePerLap)}
          </span>
        </div>

        <div className={styles.row}>
          <span className={styles.rowLabel}>LAPS LEFT</span>
          <span
            className={`${styles.rowValue} ${lapsLeftClass(lapsRemaining, pitWarningLaps)}`}
          >
            {lapsRemainingText}
          </span>
        </div>
      </div>

      {showChart && lapFuelHistory.length >= 2 && (
        <div className={styles.chart}>
          <span className={styles.chartLabel}>USE/LAP HISTORY</span>
          <FuelChart history={lapFuelHistory} chartType={chartType} />
        </div>
      )}

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
              <span className={styles.pitWarningBodyLabel}>
                TO REFUEL FOR FINISH
              </span>
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

          {tankTooSmall && (
            <div className={styles.pitWarningSplitPit}>
              TANK TOO SMALL — SPLIT PIT REQUIRED
            </div>
          )}
        </div>
      )}
    </WidgetPanel>
  );
};

import React from 'react';
import { WidgetPanel } from '../primitives/WidgetPanel/WidgetPanel';
import { formatFuelLiters, type FuelCalculations } from './fuel-utils';
import { FUEL_THRESHOLDS } from './fuel-constants';
import { FuelChart } from './FuelChart/FuelChart';

import styles from './FuelWidget.module.scss';

interface FuelWidgetProps {
  fuelLevel: number | null;
  fuelMax: number | null;
  avgPerLap: FuelCalculations['avgPerLap'];
  lapsRemaining: FuelCalculations['lapsRemaining'];
  shortage: FuelCalculations['shortage'];
  fuelToAddWithBuffer: FuelCalculations['fuelToAddWithBuffer'];
  pitWarning: FuelCalculations['pitWarning'];
  pitWindowStart: FuelCalculations['pitWindowStart'];
  pitWindowEnd: FuelCalculations['pitWindowEnd'];
  tankTooSmall: boolean;
  showChart: boolean;
  chartType: 'line' | 'bar';
  barWidth: number;
  lapFuelHistory: number[];
  pitWarningLaps: number;
}

const statusClass = (
  shortage: number | null,
  lapsRemaining: number | null,
  pitWarningLaps: number
): string => {
  if (shortage === null || lapsRemaining === null) {
    return '';
  }

  // If we don't have enough fuel to finish or we are below the warning threshold
  if (shortage < 0 || lapsRemaining <= pitWarningLaps) {
    return styles.finishDanger;
  }

  return styles.finishSafe;
};

const shortageClass = (shortage: number | null): string => {
  if (shortage === null) return '';
  return shortage >= 0 ? styles.valueSafe : styles.valueDanger;
};

const lapsRemainingClass = (
  lapsRemaining: number | null,
  pitWarningLaps: number
): string => {
  if (lapsRemaining === null) return '';
  if (lapsRemaining > pitWarningLaps + FUEL_THRESHOLDS.LAPS_LEFT_GREEN_BUFFER) {
    return styles.valueSafe;
  }
  if (lapsRemaining <= pitWarningLaps) {
    return styles.valueDanger;
  }
  return styles.valueWarning;
};

export const FuelWidget = ({
  fuelLevel,
  fuelMax,
  avgPerLap,
  lapsRemaining,
  shortage,
  fuelToAddWithBuffer,
  pitWarning,
  pitWindowStart,
  pitWindowEnd,
  tankTooSmall,
  showChart,
  chartType,
  barWidth,
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
      ? `LAP ${pitWindowStart}-${pitWindowEnd}`
      : 'LAP -----';

  return (
    <WidgetPanel direction="column" gap={0} minWidth={220}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>FUEL</span>
        <span className={styles.headerAmount}>
          {fuelLevel !== null ? fuelLevel.toFixed(1) : '--.-'}
          <span className={styles.headerUnit}> L</span>
        </span>
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressWrap}>
          {pct !== null && (
            <div
              className={styles.progressBar}
              style={{ '--progress': pct } as React.CSSProperties}
            />
          )}
          <span className={styles.progressLabelMax}>
            {fuelMax !== null ? `${fuelMax.toFixed(0)}L MAX` : ''}
          </span>
        </div>
      </div>

      <div className={styles.dataGrid}>
        <div className={styles.gridCell}>
          <span className={styles.cellLabel}>AVG / LAP</span>
          <span className={styles.cellValue}>
            {formatFuelLiters(avgPerLap)}
          </span>
        </div>
        <div className={styles.gridCell}>
          <span className={styles.cellLabel}>EST. FINISH</span>
          <span className={`${styles.cellValue} ${shortageClass(shortage)}`}>
            {shortage !== null
              ? `${shortage >= 0 ? '+' : ''}${shortage.toFixed(1)}L`
              : '--.-L'}
          </span>
        </div>
      </div>

      <div
        className={`${styles.finishCard} ${statusClass(shortage, lapsRemaining, pitWarningLaps)}`}
      >
        <span className={styles.finishLabel}>LAPS LEFT</span>
        <span
          className={`${styles.finishValue} ${lapsRemainingClass(lapsRemaining, pitWarningLaps)}`}
        >
          {lapsRemaining !== null ? lapsRemaining.toFixed(1) : '--.-'}
        </span>
      </div>

      {showChart && lapFuelHistory.length >= 2 && (
        <div className={styles.chartSection}>
          <FuelChart
            history={lapFuelHistory}
            chartType={chartType}
            barWidth={barWidth}
          />
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
                : '--.-'}
              <span className={styles.pitWarningAmountUnit}> L</span>
            </span>
          </div>

          {tankTooSmall && (
            <div className={styles.pitWarningSplitPit}>
              TANK TOO SMALL - SPLIT PIT REQUIRED
            </div>
          )}
        </div>
      )}
    </WidgetPanel>
  );
};

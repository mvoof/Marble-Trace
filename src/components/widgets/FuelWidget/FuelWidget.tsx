import React from 'react';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
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

  // If we are below the warning threshold, it's critical
  if (lapsRemaining <= pitWarningLaps) {
    return styles.finishDanger;
  }

  // If we already have enough fuel to finish the race, show safe color
  if (shortage >= 0) {
    return styles.finishSafe;
  }

  // Otherwise, it's a normal state (neutral) even if we still need to pit later
  return '';
};

const shortageClass = (shortage: number | null): string => {
  if (shortage === null) {
    return '';
  }

  // Only show positive surplus as safe (green).
  // Deficit is now neutral (white) to avoid constant red noise in long races.
  return shortage >= 0 ? styles.valueSafe : '';
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
            {/* Main Info Row: Swapped positions */}
            <div className={styles.pitWarningMainRow}>
              {/* Strategy Slot (Now Left) */}
              <div className={styles.pitWarningStrategySlot}>
                {fuelMax !== null &&
                  fuelToAddWithBuffer !== null &&
                  fuelToAddWithBuffer > fuelMax && (
                    <div className={styles.pitWarningStrategy}>
                      <div className={styles.strategyRow}>
                        <span className={styles.strategyLabel}>STOPS</span>
                        <span className={styles.strategyValue}>
                          {Math.ceil(fuelToAddWithBuffer / fuelMax)}
                        </span>
                      </div>

                      <div className={styles.strategyDivider} />

                      <div className={styles.strategyRow}>
                        <span className={styles.strategyLabel}>REC. FILL</span>
                        <span className={styles.strategyValue}>
                          {(
                            fuelToAddWithBuffer /
                            Math.ceil(fuelToAddWithBuffer / fuelMax)
                          ).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )}
              </div>

              {/* Main Amount Slot (Now Right) */}
              <div className={styles.pitWarningRight}>
                <span className={styles.pitWarningBodyLabel}>
                  {fuelMax !== null &&
                  fuelToAddWithBuffer !== null &&
                  fuelToAddWithBuffer > fuelMax
                    ? 'TOTAL TO ADD'
                    : 'TO REFUEL'}
                </span>
                <div className={styles.pitWarningAmountWrap}>
                  <span
                    className={`${styles.pitWarningAmount} ${isShort ? styles.pitWarningAmountDanger : ''}`}
                  >
                    {fuelToAddWithBuffer !== null
                      ? fuelToAddWithBuffer.toFixed(1)
                      : '--.-'}
                    <span className={styles.pitWarningAmountUnit}> L</span>
                  </span>
                </div>

                {/* Buffer Notice directly under amount */}
                <div className={styles.pitWarningBuffer}>
                  <span className={styles.pitWarningBodySub}>
                    incl. +1 lap buffer
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetPanel>
  );
};

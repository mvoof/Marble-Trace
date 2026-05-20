import React from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { formatFuelLiters } from '@utils/widget/fuel-utils';
import { FuelChart } from '@widgets/FuelWidget/FuelChart/FuelChart';
import {
  statusClass,
  shortageClass,
  lapsRemainingClass,
} from './fuel-display-utils';

import styles from './FuelDisplay.module.scss';

export const FuelDisplay = observer(() => {
  const fuel = computedStore.fuel;
  const carStatus = telemetryStore.carStatus;
  const driverInfo = telemetryStore.driverInfo;
  const settings = widgetSettingsStore.getFuelSettings();

  const fuelLevel = carStatus?.fuel_level ?? null;
  const fuelMax = driverInfo?.DriverCarFuelMaxLtr ?? null;
  const lapsRemaining = fuel?.lapsRemaining ?? null;
  const fuelToAddWithBuffer = fuel?.fuelToAddWithBuffer ?? null;
  const shortage = fuel?.shortage ?? null;
  const pitWarning =
    lapsRemaining !== null && lapsRemaining <= settings.pitWarningLaps;
  const isShort = shortage !== null && shortage < 0;

  const pct =
    fuelLevel !== null && fuelMax !== null && fuelMax > 0
      ? Math.min(fuelLevel / fuelMax, 1)
      : null;

  const windowText =
    fuel?.pitWindowStart !== null &&
    fuel?.pitWindowStart !== undefined &&
    fuel?.pitWindowEnd !== null &&
    fuel?.pitWindowEnd !== undefined
      ? `LAP ${fuel.pitWindowStart}-${fuel.pitWindowEnd}`
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
            {formatFuelLiters(fuel?.avgPerLap ?? null)}
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
        className={`${styles.finishCard} ${statusClass(shortage, lapsRemaining, settings.pitWarningLaps)}`}
      >
        <span className={styles.finishLabel}>LAPS LEFT</span>
        <span
          className={`${styles.finishValue} ${lapsRemainingClass(lapsRemaining, settings.pitWarningLaps)}`}
        >
          {lapsRemaining !== null ? lapsRemaining.toFixed(1) : '--.-'}
        </span>
      </div>

      <FuelChart />

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
            <div className={styles.pitWarningMainRow}>
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
});

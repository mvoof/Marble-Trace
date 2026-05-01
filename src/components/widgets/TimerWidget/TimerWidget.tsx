import { forwardRef } from 'react';

import { WidgetPanel } from '../primitives/WidgetPanel';

import styles from './TimerWidget.module.scss';

export type FlagState = 'green' | 'final' | 'checkered';

const FLAG_LABEL: Record<FlagState, string> = {
  green: 'GREEN',
  final: 'FINAL 5 MIN',
  checkered: 'CHECKERED',
};

const FLAG_CLASS: Record<FlagState, string> = {
  green: styles.flagGreen,
  final: styles.flagFinal,
  checkered: styles.flagCheckered,
};

interface TimerWidgetProps {
  sessionTypeLabel: string;
  flagState: FlagState;
  timeMain: string;
  timeSeconds: string;
  currentLap: number | null;
  totalLaps: string | null;
  position: number | null;
  totalDrivers: number | null;
  sessionEnded: boolean;
  showFlag: boolean;
  showLaps: boolean;
  showPosition: boolean;
  showWallClock: boolean;
  showSimTime: boolean;
  showPcDate: boolean;
  showSimDate: boolean;
  wallClockTime: string;
  simTime: string | null;
  pcDate: string;
  simDate: string | null;
}

const formatLapCount = (
  current: number | null,
  total: string | null
): string => {
  const cur = current !== null ? current : '—';
  const tot = total && total.toLowerCase() !== 'unlimited' ? total : '∞';
  return `LAP ${cur}/${tot}`;
};

const formatPosition = (pos: number | null, total: number | null): string => {
  if (pos === null) return 'POS —';
  const totStr = total !== null ? `/${total}` : '';
  return `POS P${pos}${totStr}`;
};

export const TimerWidget = forwardRef<HTMLElement, TimerWidgetProps>(
  (
    {
      sessionTypeLabel,
      flagState,
      timeMain,
      timeSeconds,
      currentLap,
      totalLaps,
      position,
      totalDrivers,
      sessionEnded,
      showFlag,
      showLaps,
      showPosition,
      showWallClock,
      showSimTime,
      showPcDate,
      showSimDate,
      wallClockTime,
      simTime,
      pcDate,
      simDate,
    },
    ref
  ) => {
    const showFooter = showLaps || showPosition;
    const showClockRow = showWallClock || showSimTime;
    const showDateRow = showPcDate || showSimDate;

    if (sessionEnded) {
      return (
        <WidgetPanel
          ref={ref}
          fitContent
          direction="column"
          gap={0}
          minWidth={180}
        >
          <div className={styles.header}>
            <span className={styles.sessionLabel}>{sessionTypeLabel}</span>
          </div>

          <div className={styles.timeDisplay}>
            <span className={styles.sessionEndedLabel}>END</span>
          </div>

          {showClockRow && (
            <div className={styles.clockRow}>
              {showWallClock && (
                <span className={styles.clockItem}>
                  <span className={styles.clockLabel}>PC</span>
                  {wallClockTime}
                </span>
              )}
              {showSimTime && simTime !== null && (
                <span className={styles.clockItem}>
                  <span className={styles.clockLabel}>SIM</span>
                  {simTime}
                </span>
              )}
            </div>
          )}

          {showDateRow && (
            <div className={styles.clockRow}>
              {showPcDate && (
                <span className={styles.clockItem}>
                  <span className={styles.clockLabel}>DATE</span>
                  {pcDate}
                </span>
              )}
              {showSimDate && simDate !== null && (
                <span className={styles.clockItem}>
                  <span className={styles.clockLabel}>SIM</span>
                  {simDate}
                </span>
              )}
            </div>
          )}
        </WidgetPanel>
      );
    }

    return (
      <WidgetPanel
        ref={ref}
        fitContent
        direction="column"
        gap={0}
        minWidth={180}
      >
        <div className={styles.header}>
          <span className={styles.sessionLabel}>{sessionTypeLabel}</span>
          {showFlag && (
            <span className={`${styles.flagLabel} ${FLAG_CLASS[flagState]}`}>
              ● {FLAG_LABEL[flagState]}
            </span>
          )}
        </div>

        <div className={styles.timeDisplay}>
          <span className={styles.timeMain}>{timeMain}</span>
          <span className={styles.timeSeconds}>{timeSeconds}</span>
        </div>

        {showClockRow && (
          <div className={styles.clockRow}>
            {showWallClock && (
              <span className={styles.clockItem}>
                <span className={styles.clockLabel}>PC</span>
                {wallClockTime}
              </span>
            )}
            {showSimTime && simTime !== null && (
              <span className={styles.clockItem}>
                <span className={styles.clockLabel}>SIM</span>
                {simTime}
              </span>
            )}
          </div>
        )}

        {showDateRow && (
          <div className={styles.clockRow}>
            {showPcDate && (
              <span className={styles.clockItem}>
                <span className={styles.clockLabel}>DATE</span>
                {pcDate}
              </span>
            )}
            {showSimDate && simDate !== null && (
              <span className={styles.clockItem}>
                <span className={styles.clockLabel}>SIM</span>
                {simDate}
              </span>
            )}
          </div>
        )}

        {showFooter && (
          <div className={styles.footer}>
            {showLaps && (
              <span className={styles.footerItem}>
                {formatLapCount(currentLap, totalLaps)}
              </span>
            )}
            {showPosition && (
              <span className={styles.footerItem}>
                {formatPosition(position, totalDrivers)}
              </span>
            )}
          </div>
        )}
      </WidgetPanel>
    );
  }
);

TimerWidget.displayName = 'TimerWidget';

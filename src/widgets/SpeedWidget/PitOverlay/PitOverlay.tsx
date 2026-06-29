import { observer } from 'mobx-react-lite';

import { usePitState } from '../hooks/usePitState';
import type { PitState } from '../hooks/usePitState';

import styles from './PitOverlay.module.scss';

const STATE_CLASS: Record<PitState, string> = {
  normal: '',
  'pit-lane': styles.statePitLane,
  'limiter-active': styles.stateLimiter,
  'over-limit': styles.stateOverLimit,
};

const PIT_EXIT_READY_M = 50;

export const PitOverlay = observer(() => {
  const {
    pitState,
    speedKmhOrMph,
    limitKmhOrMph,
    system,
    distMode,
    distM,
    pitLaneProgressPct,
    isPitLaneRecording,
    showPitAssist,
  } = usePitState();

  if (pitState === 'normal' || !showPitAssist) {
    return null;
  }

  const headline = (() => {
    if (pitState === 'pit-lane') return 'LIMITER OFF';
    if (pitState === 'limiter-active') return 'PIT LIMITER';

    return 'SLOW DOWN!';
  })();

  const unit = system === 'metric' ? 'KM/H' : 'MPH';
  const distUnit = system === 'metric' ? 'm' : 'ft';

  const showLimit = limitKmhOrMph > 0;
  const speedDelta = showLimit ? speedKmhOrMph - limitKmhOrMph : 0;
  const showDeltaOver = showLimit && speedDelta > 0;
  const showDeltaUnder =
    showLimit && speedDelta <= 0 && pitState === 'pit-lane';

  const showBar =
    pitLaneProgressPct !== null && distM !== null && distMode !== null;
  const showCalibrating = isPitLaneRecording && pitLaneProgressPct === null;

  const isNearExit =
    distMode === 'pitexit' &&
    distM !== null &&
    distM <= PIT_EXIT_READY_M &&
    distM >= 0;

  const distValue = (() => {
    if (!showBar || distM === null || distM < 0 || distMode === null)
      return null;
    if (isNearExit) return 'GO!';

    const value =
      system === 'metric' ? Math.round(distM) : Math.round(distM * 3.28084);

    const prefix = distMode === 'pitbox' ? 'BOX ' : 'EXIT ';
    return `${prefix}${value} ${distUnit}`;
  })();

  return (
    <div className={`${styles.overlay} ${STATE_CLASS[pitState]}`}>
      <div className={styles.headlineRow}>
        <span className={styles.headlineText}>{headline}</span>
      </div>

      <div className={styles.speedRow}>
        <div className={styles.limitSide}>
          {showLimit && (
            <div className={styles.limitTag}>
              <span className={styles.limitTagLabel}>LIM</span>
              <span className={styles.limitTagNum}>{limitKmhOrMph}</span>
            </div>
          )}
        </div>

        <div className={styles.speedCenter}>
          <span className={styles.speedNum}>{speedKmhOrMph}</span>
          <span className={styles.speedUnit}>{unit}</span>
        </div>

        <div className={styles.deltaSide}>
          {showDeltaOver && (
            <span className={styles.limitDeltaOver}>+{speedDelta}</span>
          )}
          {showDeltaUnder && (
            <span className={styles.limitDeltaUnder}>
              -{Math.abs(speedDelta)}
            </span>
          )}
        </div>
      </div>

      <div
        className={`${styles.barSection} ${isNearExit ? styles.barSectionReady : ''}`}
      >
        {showBar && (
          <>
            <span className={styles.distLabel}>{distValue ?? ''}</span>
            <div className={styles.laneBarTrack}>
              <div
                className={styles.laneBarFill}
                style={{
                  width: `${Math.min((pitLaneProgressPct ?? 0) * 100, 100)}%`,
                }}
              />
            </div>
          </>
        )}
        {showCalibrating && (
          <span className={styles.calibratingLabel}>● RECORDING PIT LANE</span>
        )}
      </div>
    </div>
  );
});

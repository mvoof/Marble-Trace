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
    system,
    distToExitM,
    pitLaneProgressPct,
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

  const showBar = pitLaneProgressPct !== null && pitState === 'pit-lane';
  const showCalibrating =
    pitLaneProgressPct === null && pitState === 'pit-lane';

  const isNearExit =
    distToExitM !== null && distToExitM <= PIT_EXIT_READY_M && distToExitM >= 0;

  const distValue = (() => {
    if (!showBar || distToExitM === null || distToExitM <= 0) return null;
    if (isNearExit) return 'GO!';

    const value =
      system === 'metric'
        ? Math.round(distToExitM)
        : Math.round(distToExitM * 3.28084);

    return `${value} ${distUnit}`;
  })();

  return (
    <div className={`${styles.overlay} ${STATE_CLASS[pitState]}`}>
      <div className={styles.headlineRow}>
        <span className={styles.stripeLeft} aria-hidden="true" />
        <span className={styles.headlineText}>{headline}</span>
        <span className={styles.stripeRight} aria-hidden="true" />
      </div>

      <div className={styles.speedRow}>
        <span className={styles.speedNum}>{speedKmhOrMph}</span>
        <span className={styles.speedUnit}>{unit}</span>
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

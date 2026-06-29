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
    throttle,
    brake,
  } = usePitState();

  if (pitState === 'normal' || !showPitAssist) {
    return null;
  }

  const headline = (() => {
    if (pitState === 'pit-lane') return 'LIM OFF';
    if (pitState === 'limiter-active') return 'PIT LIMITER';
    return 'SLOW DOWN';
  })();

  const unit = system === 'metric' ? 'KM/H' : 'MPH';

  // Assist bar shown only when limiter is off — driver manages speed manually
  const showAssist = pitLaneProgressPct !== null && pitState === 'pit-lane';

  const isNearExit =
    distToExitM !== null && distToExitM <= PIT_EXIT_READY_M && distToExitM >= 0;

  const distLabel = (() => {
    if (!showAssist || distToExitM === null || distToExitM <= 0) return null;
    if (isNearExit) return 'GO';
    return `EXIT  ${Math.round(distToExitM)} m`;
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

      {/* Always reserve height for assist section to prevent layout shift */}
      <div
        className={`${styles.assistSection} ${isNearExit ? styles.assistSectionReady : ''}`}
      >
        {showAssist && (
          <>
            <div className={styles.inputRow}>
              <div className={styles.inputBar}>
                <div
                  className={styles.inputBarFillThrottle}
                  style={{ width: `${throttle * 100}%` }}
                />
                <span className={styles.inputLabel}>T</span>
              </div>
              <div className={styles.inputBar}>
                <div
                  className={styles.inputBarFillBrake}
                  style={{ width: `${brake * 100}%` }}
                />
                <span className={styles.inputLabel}>B</span>
              </div>
            </div>

            {distLabel && <span className={styles.exitLabel}>{distLabel}</span>}
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
      </div>
    </div>
  );
});

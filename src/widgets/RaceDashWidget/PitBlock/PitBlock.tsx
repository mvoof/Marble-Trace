import { CornerUpLeft, CornerUpRight } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { usePitState } from '@widgets/SpeedWidget/hooks/usePitState';
import type { PitState } from '@widgets/SpeedWidget/hooks/usePitState';

import styles from './PitBlock.module.scss';

const STATE_CLASS: Record<PitState, string> = {
  normal: '',
  'pit-lane': styles.stateLane,
  'limiter-active': styles.stateLimiter,
  'limiter-near-exit': styles.stateLimiter,
  'limiter-exit': styles.stateLimiter,
  'over-limit': styles.stateOverLimit,
};

const PITBOX_ZONE_M = 5;

export const PitBlock = observer(() => {
  const {
    pitState,
    speedKmhOrMph,
    limitKmhOrMph,
    system,
    distMode,
    distM,
    pitLaneProgressPct,
    pitLaneLengthM,
    pitboxLanePct,
    isPitLaneRecording,
    pitBoxSide,
    boxCueDistM,
    nearLimitDelta,
  } = usePitState('race-dash');

  const showBoxCue =
    distMode === 'pitbox' && distM !== null && distM <= boxCueDistM;
  const BoxArrowIcon = pitBoxSide === 'left' ? CornerUpLeft : CornerUpRight;

  if (pitState === 'normal') {
    return null;
  }

  const headline = (() => {
    if (pitState === 'pit-lane') return 'LIMITER OFF';
    if (pitState === 'limiter-active') return 'PIT LIMITER';
    if (pitState === 'limiter-near-exit') return 'NEAR EXIT';
    if (pitState === 'limiter-exit') return 'LIM ON TRACK';

    return 'SLOW DOWN!';
  })();

  const unit = system === 'metric' ? 'KM/H' : 'MPH';
  const distUnit = system === 'metric' ? 'm' : 'ft';

  const showLimit = limitKmhOrMph > 0;
  const isOverLimit = showLimit && speedKmhOrMph > limitKmhOrMph;
  const isNearLimit =
    showLimit &&
    !isOverLimit &&
    pitState === 'pit-lane' &&
    limitKmhOrMph - speedKmhOrMph <= nearLimitDelta;

  const speedNumClass = isOverLimit
    ? styles.speedNumOver
    : isNearLimit
      ? styles.speedNumNearLimit
      : '';

  const showBar = pitLaneProgressPct !== null && pitState !== 'limiter-exit';
  const showCalibrating = isPitLaneRecording && pitLaneProgressPct === null;

  const pitLaneLabel = (() => {
    if (!showBar || pitLaneLengthM === null || pitLaneProgressPct === null)
      return 'PIT LANE';

    const remainingM = Math.max(0, (1 - pitLaneProgressPct) * pitLaneLengthM);
    const value =
      system === 'metric'
        ? Math.round(remainingM)
        : Math.round(remainingM * 3.28084);

    return `PIT LANE ${value} ${distUnit}`;
  })();

  return (
    <div className={`${styles.root} ${STATE_CLASS[pitState]}`}>
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
          <span className={`${styles.speedNum} ${speedNumClass}`}>
            {speedKmhOrMph}
          </span>
          <span className={styles.speedUnit}>{unit}</span>
        </div>

        <div className={styles.boxSideSlot}>
          {showBoxCue && (
            <div className={styles.boxSide}>
              <span className={styles.boxLabel}>BOX</span>
              <div className={styles.boxBottom}>
                <span className={styles.boxDist}>
                  {system === 'metric'
                    ? `${Math.round(distM ?? 0)} m`
                    : `${Math.round((distM ?? 0) * 3.28084)} ft`}
                </span>
                <BoxArrowIcon className={styles.boxArrow} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.barSection}>
        {showBar && (
          <>
            <span className={styles.distLabel}>{pitLaneLabel}</span>
            <div className={styles.laneBarTrack}>
              <div
                className={styles.laneBarFill}
                style={{
                  width: `${Math.min((pitLaneProgressPct ?? 0) * 100, 100)}%`,
                }}
              />
              {pitboxLanePct !== null &&
                pitLaneLengthM !== null &&
                pitLaneLengthM > 0 && (
                  <div
                    className={styles.pitboxZone}
                    style={{
                      left: `${Math.max(0, pitboxLanePct - PITBOX_ZONE_M / 2 / pitLaneLengthM) * 100}%`,
                      width: `${(PITBOX_ZONE_M / pitLaneLengthM) * 100}%`,
                    }}
                  />
                )}
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

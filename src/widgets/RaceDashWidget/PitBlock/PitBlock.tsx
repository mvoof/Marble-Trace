import { observer } from 'mobx-react-lite';

import { usePitState } from '@hooks/usePitState';
import type { PitState } from '@hooks/usePitState';
import { usePlayerStore } from '@store/root-store-context';

import styles from './PitBlock.module.scss';

// Final stretch to the box turns the countdown green — "almost there".
const BOX_NEAR_M = 50;

const isLimiterSafe = (pitState: PitState): boolean =>
  pitState === 'limiter-active' ||
  pitState === 'limiter-near-exit' ||
  pitState === 'limiter-exit';

export const PitBlock = observer(() => {
  const { lapTiming } = usePlayerStore();
  const {
    pitState,
    speedKmhOrMph,
    limitKmhOrMph,
    system,
    distMode,
    distM,
    nearLimitDelta,
  } = usePitState();

  const isSafe = isLimiterSafe(pitState);
  // Speed color tracks the actual overage, not the limiter state — with the
  // limiter off but rolling under the cap the number stays neutral while the
  // banner and border carry the warning.
  const showLimit = limitKmhOrMph > 0;
  const isOverLimit = showLimit && speedKmhOrMph > limitKmhOrMph;
  const isNearLimit =
    showLimit &&
    !isOverLimit &&
    limitKmhOrMph - speedKmhOrMph <= nearLimitDelta;

  const speedValueClass = isOverLimit
    ? styles.speedOver
    : isNearLimit
      ? styles.speedNear
      : '';

  const showBoxCue = distMode === 'pitbox' && distM !== null;
  const isNearBox = distM !== null && distM <= BOX_NEAR_M;

  const unit = system === 'metric' ? 'KM/H' : 'MPH';
  const distUnit = system === 'metric' ? 'm' : 'ft';
  const position = lapTiming?.player_car_position;

  const bannerClass = isSafe
    ? styles.bannerSafe
    : pitState === 'over-limit'
      ? styles.bannerDanger
      : styles.bannerWarning;

  const bannerText = isSafe
    ? 'PIT · LIMITER ON'
    : pitState === 'over-limit'
      ? 'LIMITER OFF · SLOW DOWN'
      : 'PIT · LIMITER OFF';

  return (
    <>
      <span className={`${styles.banner} ${bannerClass}`}>{bannerText}</span>

      <div className={styles.stats}>
        <div className={styles.speedBlock}>
          <span className={`${styles.speedValue} ${speedValueClass}`}>
            {speedKmhOrMph}
          </span>
          <span className={styles.unit}>{unit}</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.column}>
          {showLimit && (
            <div className={styles.row}>
              <span className={styles.label}>Limit</span>
              <span
                className={`${styles.value} ${pitState === 'over-limit' ? styles.limitDanger : styles.limitSafe}`}
              >
                {limitKmhOrMph}
              </span>
            </div>
          )}

          <div className={styles.row}>
            <span className={styles.label}>Pos</span>
            <span className={styles.value}>
              {position != null ? `P${position}` : '—'}
            </span>
          </div>
        </div>

        {showBoxCue && (
          <>
            <div className={styles.divider} />

            <div
              className={`${styles.boxCue} ${isNearBox ? styles.boxCueNear : ''}`}
            >
              <span className={styles.boxLabel}>Box</span>
              <span className={styles.boxValue}>
                {Math.round(distM ?? 0)} <small>{distUnit}</small>
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
});

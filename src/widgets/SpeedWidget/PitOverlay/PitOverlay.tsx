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

export const PitOverlay = observer(() => {
  const { pitState, pitLimitMs, speedKmhOrMph, limitKmhOrMph, system } =
    usePitState();

  if (pitState === 'normal') {
    return null;
  }

  const showBar = pitState === 'pit-lane' || pitState === 'limiter-active';
  const fillPct =
    pitLimitMs > 0 ? Math.min((speedKmhOrMph / limitKmhOrMph) * 100, 105) : 0;

  const headline = (() => {
    if (pitState === 'pit-lane') return 'LIM OFF';
    if (pitState === 'limiter-active') return 'PIT LIMITER';
    return 'SLOW DOWN';
  })();

  const unit = system === 'metric' ? 'KM/H' : 'MPH';

  return (
    <div className={`${styles.overlay} ${STATE_CLASS[pitState]}`}>
      <div className={styles.headline}>{headline}</div>

      <div className={styles.speedRow}>
        <span className={styles.speedNum}>{speedKmhOrMph}</span>
        <span className={styles.speedUnit}>{unit}</span>
      </div>

      {showBar && pitLimitMs > 0 && (
        <div className={styles.barTrack}>
          <div
            className={`${styles.barFill} ${fillPct > 100 ? styles.barFillOver : fillPct > 85 ? styles.barFillClose : ''}`}
            style={{ width: `${Math.min(fillPct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
});

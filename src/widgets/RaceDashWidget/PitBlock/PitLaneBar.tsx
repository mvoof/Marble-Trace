import { observer } from 'mobx-react-lite';

import { usePitState } from '@hooks/usePitState';

import styles from './PitLaneBar.module.scss';

// The box is a stretch of lane, not a line: this many meters around the stall
// are painted so the marker reads as a place to stop in.
const BOX_ZONE_M = 5;
// On a long pit lane 5 m would collapse to a hairline, so the patch never
// renders thinner than this share of the track.
const BOX_ZONE_MIN_PCT = 0.02;
const BOX_ZONE_MAX_PCT = 0.12;

const clampPct = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const PitLaneBar = observer(() => {
  const {
    pitState,
    distMode,
    pitLaneProgressPct,
    pitLaneLengthM,
    pitboxLanePct,
  } = usePitState();

  const showBar = pitLaneProgressPct !== null && pitState !== 'limiter-exit';

  if (!showBar) {
    return null;
  }

  const fillPct = Math.min(Math.max(pitLaneProgressPct ?? 0, 0), 1) * 100;
  const fillClass =
    distMode === 'pitExit' ? `${styles.fill} ${styles.fillExit}` : styles.fill;

  const boxZonePct =
    pitLaneLengthM !== null && pitLaneLengthM > 0
      ? clampPct(
          BOX_ZONE_M / pitLaneLengthM,
          BOX_ZONE_MIN_PCT,
          BOX_ZONE_MAX_PCT
        )
      : BOX_ZONE_MIN_PCT;

  return (
    <div className={styles.row}>
      <div className={styles.track}>
        <div className={fillClass} style={{ width: `${fillPct}%` }} />

        {pitboxLanePct !== null && (
          <div
            className={styles.pitboxZone}
            style={{
              left: `${clampPct(pitboxLanePct - boxZonePct / 2, 0, 1 - boxZonePct) * 100}%`,
              width: `${boxZonePct * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  );
});

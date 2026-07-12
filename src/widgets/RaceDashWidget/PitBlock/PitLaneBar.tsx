import { observer } from 'mobx-react-lite';

import { usePitState } from '@hooks/usePitState';

import styles from './PitLaneBar.module.scss';

export const PitLaneBar = observer(() => {
  const { pitState, distMode, pitLaneProgressPct, pitboxLanePct } =
    usePitState();

  const showBar = pitLaneProgressPct !== null && pitState !== 'limiter-exit';

  if (!showBar) {
    return null;
  }

  const fillPct = Math.min(Math.max(pitLaneProgressPct ?? 0, 0), 1) * 100;
  const fillClass =
    distMode === 'pitExit' ? `${styles.fill} ${styles.fillExit}` : styles.fill;

  return (
    <div className={styles.row}>
      <div className={styles.track}>
        <div className={fillClass} style={{ width: `${fillPct}%` }} />

        {pitboxLanePct !== null && (
          <div
            className={styles.pitboxZone}
            style={{ left: `${pitboxLanePct * 100}%` }}
          />
        )}
      </div>
    </div>
  );
});

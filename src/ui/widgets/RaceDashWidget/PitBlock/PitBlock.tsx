import { observer } from 'mobx-react-lite';

import { usePitState } from '@ui/hooks/usePitState';
import type { PitState } from '@ui/hooks/usePitState';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import {
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import { pitLimitEmphasis } from '../race-dash-utils';
import { PitLaneBar } from './PitLaneBar';

import styles from './PitBlock.module.scss';

// Final stretch to the box turns the countdown green — "almost there".
const BOX_NEAR_M = 50;

const isLimiterSafe = (pitState: PitState): boolean =>
  pitState === 'limiter-active' ||
  pitState === 'limiter-near-exit' ||
  pitState === 'limiter-exit';

export const PitBlock = observer(() => {
  const standingsWidget = useStandingsWidgetStore();
  const widgetSettings = useWidgetSettingsStore();
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

  const limitEmphasis = pitLimitEmphasis(
    speedKmhOrMph,
    limitKmhOrMph,
    nearLimitDelta
  );

  const showBoxCue = distMode !== null && distM !== null;
  const isNearBox = distM !== null && distM <= BOX_NEAR_M;
  const boxCueLabel = distMode === 'pitExit' ? 'Exit' : 'Box';

  const unit = system === 'metric' ? 'KM/H' : 'MPH';
  const distUnit = system === 'metric' ? 'm' : 'ft';
  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');
  const { position } = standingsWidget.playerPositionInfo(
    settings.useLivePositions,
    settings.classPositionInMulticlass
  );

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
        <div className={styles.statsRow}>
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
                  className={`${styles.value} ${styles.limitValue}`}
                  style={{
                    color: limitEmphasis.color,
                    transform: `scale(${limitEmphasis.scale.toFixed(3)})`,
                  }}
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
                <span className={styles.boxLabel}>{boxCueLabel}</span>
                <span className={styles.boxValue}>
                  {Math.round(distM ?? 0)} <small>{distUnit}</small>
                </span>
              </div>
            </>
          )}
        </div>

        <PitLaneBar />
      </div>
    </>
  );
});

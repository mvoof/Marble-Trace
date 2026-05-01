import styles from './PitPanel.module.scss';

type PitState = 'pit-lane' | 'limiter-active' | 'over-limit';

interface PitPanelProps {
  pitState: PitState;
  limitSpeed: string;
  speedUnit: string;
  speedDelta: number | null;
}

const PIT_STATE_LABEL: Record<PitState, string> = {
  'pit-lane': 'PIT LANE',
  'limiter-active': 'PIT LIMITER',
  'over-limit': 'REDUCE SPEED',
};

const PIT_STATE_CLASS: Record<PitState, string> = {
  'pit-lane': styles.stateYellow,
  'limiter-active': styles.stateSafe,
  'over-limit': styles.stateWarn,
};

const getDeltaClass = (delta: number): string => {
  if (delta > 0) return styles.deltaOver;
  if (delta >= -5) return styles.deltaClose;
  return styles.deltaOk;
};

const formatDelta = (delta: number): string => {
  if (delta > 0) return `+${delta}`;
  if (delta === 0) return '±0';
  return `${delta}`;
};

export const PitPanel = ({
  pitState,
  limitSpeed,
  speedUnit,
  speedDelta,
}: PitPanelProps) => (
  <div className={`${styles.panel} ${PIT_STATE_CLASS[pitState]}`}>
    <span className={styles.label}>{PIT_STATE_LABEL[pitState]}</span>

    <div className={styles.right}>
      <span className={styles.limit}>{limitSpeed}</span>
      <span className={styles.unit}>{speedUnit}</span>

      {speedDelta !== null && (
        <span className={`${styles.delta} ${getDeltaClass(speedDelta)}`}>
          {formatDelta(speedDelta)}
        </span>
      )}
    </div>
  </div>
);

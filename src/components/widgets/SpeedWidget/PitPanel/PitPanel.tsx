import styles from './PitPanel.module.scss';

type PitState = 'pit-lane' | 'limiter-active' | 'over-limit';

interface PitPanelProps {
  pitState: PitState;
  limitSpeed: string;
  speedUnit: string;
}

const PIT_STATE_LABEL: Record<PitState, string> = {
  'pit-lane': 'PIT LANE',
  'limiter-active': 'PIT LIMITER',
  'over-limit': 'REDUCE SPEED!',
};

const PIT_STATE_CLASS: Record<PitState, string> = {
  'pit-lane': styles.panelNeutral,
  'limiter-active': styles.panelSafe,
  'over-limit': styles.panelWarn,
};

export const PitPanel = ({
  pitState,
  limitSpeed,
  speedUnit,
}: PitPanelProps) => (
  <div className={`${styles.panel} ${PIT_STATE_CLASS[pitState]}`}>
    <span className={styles.label}>{PIT_STATE_LABEL[pitState]}</span>
    <span className={styles.badge}>
      LIMIT {limitSpeed} {speedUnit}
    </span>
  </div>
);

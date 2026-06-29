import { observer } from 'mobx-react-lite';

import type { SpeedWidgetSettings } from '@/types/widget-settings';
import { formatGear } from '@utils/formatters/telemetry-format';

import styles from './PitPanel.module.scss';
import {
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { usePitState } from '../hooks/usePitState';
import type { PitState } from '../hooks/usePitState';

const PIT_STATE_CLASS: Record<PitState, string> = {
  normal: '',
  'pit-lane': styles.statePitLane,
  'limiter-active': styles.stateLimiter,
  'over-limit': styles.stateOverLimit,
};

export const PitPanel = observer(() => {
  const player = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const { gearColor, gearPanelBg } =
    widgetSettings.getSettings<SpeedWidgetSettings>('speed');

  const { pitState, showPitAssist } = usePitState();

  const gear = player.carDynamics?.gear ?? 0;

  const effectivePitState: PitState = showPitAssist ? pitState : 'normal';

  const panelStyle =
    effectivePitState === 'normal' ? { background: gearPanelBg } : undefined;
  const gearStyle =
    effectivePitState === 'normal' ? { color: gearColor } : undefined;

  return (
    <div
      className={`${styles.panel} ${PIT_STATE_CLASS[effectivePitState]}`}
      style={panelStyle}
    >
      <span className={styles.gearDigit} style={gearStyle}>
        {formatGear(gear)}
      </span>

      <span className={`${styles.pitSub} ${styles.pitSubNormal}`}>GEAR</span>
    </div>
  );
});

import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import {
  formatSpeed,
  MPS_TO_KMH,
  MPS_TO_MPH,
} from '@utils/formatters/telemetry-format';
import { COACH_DELTA_DEADZONE } from '../race-dash-utils';
import {
  useDrivingCoachWidgetStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './CoachLine.module.scss';

const ADVISORY_LABEL = {
  brake: 'BRAKE',
  gas: 'GAS',
} as const;

export const CoachLine = observer(() => {
  const coach = useDrivingCoachWidgetStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const referenceSpeedMps = coach.referenceSpeedMps;

  if (referenceSpeedMps === null) {
    return <span className={styles.idle}>NO REFERENCE LAP</span>;
  }

  const advisory = coach.displayedAdvisory;
  const factor = units.unitSystem === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;
  const deltaMps = coach.speedDeltaMps;
  const deltaDisplay = deltaMps === null ? 0 : Math.round(deltaMps * factor);
  const isFlat = Math.abs(deltaDisplay) < COACH_DELTA_DEADZONE;

  const referenceText = settings.showReferenceSpeed
    ? ` · REF ${formatSpeed(referenceSpeedMps, units.unitSystem)}`
    : '';

  if (advisory === 'neutral') {
    return (
      <span className={styles.idle}>
        ON PACE
        {referenceText}
      </span>
    );
  }

  const accentColor =
    advisory === 'brake' ? settings.brakeColor : settings.gasColor;
  const deltaText = isFlat
    ? ''
    : ` ${deltaDisplay > 0 ? '+' : ''}${deltaDisplay}`;

  return (
    <span className={styles.active} style={{ color: accentColor }}>
      {ADVISORY_LABEL[advisory]}
      {deltaText}
    </span>
  );
});

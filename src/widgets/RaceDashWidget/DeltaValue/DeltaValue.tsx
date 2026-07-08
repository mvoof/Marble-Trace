import { observer } from 'mobx-react-lite';

import { MPS_TO_KMH, MPS_TO_MPH } from '@utils/formatters/telemetry-format';
import { COACH_DELTA_DEADZONE } from '../race-dash-utils';
import {
  useDrivingCoachWidgetStore,
  useUnitsStore,
} from '@store/root-store-context';

import styles from './DeltaValue.module.scss';

export const DeltaValue = observer(() => {
  const coach = useDrivingCoachWidgetStore();
  const units = useUnitsStore();

  const factor = units.unitSystem === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;
  const deltaMps = coach.speedDeltaMps;
  const deltaDisplay = deltaMps === null ? null : Math.round(deltaMps * factor);
  const isFlat =
    deltaDisplay === null || Math.abs(deltaDisplay) < COACH_DELTA_DEADZONE;
  const isFaster = deltaDisplay !== null && deltaDisplay > 0;

  const deltaClass = isFlat
    ? styles.flat
    : isFaster
      ? styles.faster
      : styles.slower;

  const deltaText =
    deltaDisplay === null
      ? '—'
      : `${deltaDisplay > 0 ? '+' : ''}${deltaDisplay}`;

  return <span className={`${styles.value} ${deltaClass}`}>{deltaText}</span>;
});

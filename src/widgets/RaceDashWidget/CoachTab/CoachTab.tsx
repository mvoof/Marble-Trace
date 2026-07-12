import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { formatSpeed } from '@utils/formatters/telemetry-format';
import {
  useDrivingCoachWidgetStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './CoachTab.module.scss';

const ADVISORY_LABEL = {
  brake: 'BRAKE',
  gas: 'GAS',
} as const;

export const CoachTab = observer(() => {
  const coach = useDrivingCoachWidgetStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const referenceSpeedMps = coach.referenceSpeedMps;
  const hasReference = referenceSpeedMps !== null;
  const hasReferenceLap = coach.hasReferenceLap;

  const advisory = coach.displayedAdvisory;
  const accentColor =
    hasReferenceLap && advisory === 'brake'
      ? settings.brakeColor
      : hasReferenceLap && advisory === 'gas'
        ? settings.gasColor
        : null;

  const stateClass =
    hasReferenceLap && advisory === 'brake'
      ? styles.brakeCall
      : hasReferenceLap && advisory === 'gas'
        ? styles.gasCall
        : styles.idle;

  const callText = !hasReferenceLap
    ? 'NO LAP'
    : advisory === 'neutral'
      ? hasReference
        ? 'PACE'
        : '—'
      : ADVISORY_LABEL[advisory];

  return (
    <div className={`${styles.root} ${stateClass}`}>
      <span
        className={styles.call}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {callText}
      </span>

      <span className={styles.ref}>
        {hasReference
          ? formatSpeed(referenceSpeedMps ?? 0, units.unitSystem)
          : '—'}
      </span>
    </div>
  );
});

import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { formatSpeed } from '@utils/formatters/telemetry-format';
import { DeltaValue } from '../DeltaValue/DeltaValue';
import {
  useDrivingCoachWidgetStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './RightPanel.module.scss';

const ADVISORY_LABEL = {
  brake: 'BRAKE',
  gas: 'GAS',
} as const;

export const RightPanel = observer(() => {
  const coach = useDrivingCoachWidgetStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const referenceSpeedMps = coach.referenceSpeedMps;
  const hasReference = referenceSpeedMps !== null;
  const showReference = settings.showReferenceSpeed && hasReference;

  const advisory = coach.displayedAdvisory;
  const accentColor =
    advisory === 'brake'
      ? settings.brakeColor
      : advisory === 'gas'
        ? settings.gasColor
        : null;

  return (
    <div className={styles.rows}>
      <div className={styles.row}>
        <span className={styles.label}>REF</span>
        <span className={styles.value}>
          {showReference
            ? formatSpeed(referenceSpeedMps ?? 0, units.unitSystem)
            : '—'}
        </span>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>DELTA</span>
        {hasReference ? (
          <DeltaValue />
        ) : (
          <span className={styles.value}>—</span>
        )}
      </div>

      <div className={styles.row}>
        <span className={styles.label}>COACH</span>
        {advisory === 'neutral' ? (
          <span className={styles.coachIdle}>
            {hasReference ? 'ON PACE' : 'NO REF LAP'}
          </span>
        ) : (
          <span
            className={styles.coachActive}
            style={accentColor ? { color: accentColor } : undefined}
          >
            {ADVISORY_LABEL[advisory]}
          </span>
        )}
      </div>
    </div>
  );
});

import { observer } from 'mobx-react-lite';
import { formatSpeed, speedUnit } from '@utils/formatters/telemetry-format';
import styles from './SpeedDisplay.module.scss';
import {
  usePlayerStore,
  useReferenceLapStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { SpeedWidgetSettings } from '@/types/widget-settings';

const REFERENCE_DELTA_DEADZONE_MPS = 0.3;

export const SpeedDisplay = observer(() => {
  const telemetry = usePlayerStore();
  const units = useUnitsStore();
  const referenceLap = useReferenceLapStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<SpeedWidgetSettings>('speed');
  const speed = telemetry.carDynamics?.speed ?? 0;
  const sys = units.unitSystem;

  const lapDistPct = telemetry.lapTiming?.lap_dist_pct ?? null;
  const referenceSample =
    settings.showReferenceLap && lapDistPct !== null
      ? referenceLap.getSampleAtDistPct(lapDistPct)
      : null;

  const deltaMps = referenceSample ? speed - referenceSample.speed : 0;
  const deltaClass =
    deltaMps > REFERENCE_DELTA_DEADZONE_MPS
      ? styles.faster
      : deltaMps < -REFERENCE_DELTA_DEADZONE_MPS
        ? styles.slower
        : '';

  return (
    <div className={styles.group}>
      <span className={`${styles.value} ${deltaClass}`}>
        {formatSpeed(speed, sys)}
      </span>
      <span className={styles.label}>{speedUnit(sys)}</span>
      {referenceSample && (
        <span className={styles.reference}>
          {formatSpeed(referenceSample.speed, sys)}
        </span>
      )}
    </div>
  );
});

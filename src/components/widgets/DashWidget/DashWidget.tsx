import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/telemetry.store';
import { useUnits } from '../../../hooks/useUnits';
import {
  formatGear,
  formatRpm,
  clampNormalized,
} from '../../../utils/telemetry-format';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { DataValue } from '../primitives/DataValue';
import { ProgressBar } from '../primitives/ProgressBar';
import styles from './DashWidget.module.scss';

export const DashWidget = observer(() => {
  const { frame } = telemetryStore;
  const { formatSpeed, speedUnit } = useUnits();

  const speed = frame ? formatSpeed(frame.speed) : '0';
  const rpm = frame ? Math.round(frame.rpm) : 0;
  const gear = formatGear(frame?.gear ?? 0);

  return (
    <WidgetPanel minWidth={240}>
      <span className={styles.topRow}>
        <DataValue
          label="GEAR"
          value={gear}
          size="3xl"
          align="center"
          color="#00ff00"
        />

        <DataValue
          label=""
          value={speed}
          unit={speedUnit}
          size="2xl"
          align="right"
        />
      </span>

      <ProgressBar value={clampNormalized(rpm / 10000)} gradient height="md" />

      <span className={styles.rpmRow}>
        <span className={styles.rpmLabel}>RPM</span>
        <span className={styles.rpmValue}>{formatRpm(rpm)}</span>
      </span>
    </WidgetPanel>
  );
});

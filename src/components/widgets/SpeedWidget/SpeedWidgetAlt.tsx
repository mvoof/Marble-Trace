import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useUnits } from '../../../hooks/useUnits';
import { formatGear } from '../../../utils/telemetry-format';
import { WidgetPanel } from '../primitives/WidgetPanel';
import styles from './SpeedWidgetAlt.module.scss';

const CIRCLE_R = 90;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

function getRpmZoneColor(
  rpm: number,
  shiftRpm: number,
  maxRpm: number,
  colors: { low: string; mid: string; high: string; limit: string }
): { color: string; isLimit: boolean } {
  if (rpm >= shiftRpm) {
    return { color: colors.limit, isLimit: true };
  }

  const pct = rpm / maxRpm;

  if (pct >= 0.7) {
    return { color: colors.high, isLimit: false };
  }

  if (pct >= 0.35) {
    return { color: colors.mid, isLimit: false };
  }

  return { color: colors.low, isLimit: false };
}

export const SpeedWidgetAlt = observer(() => {
  const { frame } = telemetryStore;
  const { formatSpeed, speedUnit } = useUnits();
  const settings = widgetSettingsStore.getSpeedSettings();

  const speed = frame ? formatSpeed(frame.speed) : '0';
  const rpm = frame ? Math.round(frame.rpm) : 0;
  const gear = frame?.gear ?? 0;
  const gearDisplay = formatGear(gear);

  const maxRpm = frame?.driver_car_red_line ?? 10000;
  const shiftRpm = frame?.driver_car_sl_shift_rpm ?? maxRpm * 0.92;

  const rpmColors = {
    low: settings.rpmColorLow,
    mid: settings.rpmColorMid,
    high: settings.rpmColorHigh,
    limit: settings.rpmColorLimit,
  };

  const percent = Math.min(Math.max(rpm / maxRpm, 0), 1);
  const offset = CIRCUMFERENCE - percent * CIRCUMFERENCE;
  const { color: zoneColor, isLimit } = getRpmZoneColor(
    rpm,
    shiftRpm,
    maxRpm,
    rpmColors
  );

  return (
    <WidgetPanel
      minWidth={400}
      direction="row"
      gap={32}
      className={styles.altPanel}
    >
      <span className={styles.statBlock}>
        <span className={styles.value}>{rpm}</span>
        <span className={styles.label} style={{ color: rpmColors.limit }}>
          RPM
        </span>
      </span>

      <span
        className={`${styles.gearContainer} ${isLimit ? styles.blinkAlert : ''}`}
      >
        <svg className={styles.gearSvg} viewBox="0 0 200 200">
          <circle className={styles.circleBg} cx="100" cy="100" r={CIRCLE_R} />

          <circle
            className={styles.circleProgress}
            cx="100"
            cy="100"
            r={CIRCLE_R}
            style={{
              stroke: zoneColor,
              strokeDashoffset: offset,
              filter: isLimit
                ? `drop-shadow(0 0 15px ${rpmColors.limit})`
                : 'none',
            }}
          />
        </svg>

        <span className={styles.gearValue} style={{ color: zoneColor }}>
          {gearDisplay}
        </span>
      </span>

      <span className={styles.statBlock}>
        <span className={styles.value}>{speed}</span>
        <span className={styles.label} style={{ color: rpmColors.limit }}>
          {speedUnit}
        </span>
      </span>
    </WidgetPanel>
  );
});

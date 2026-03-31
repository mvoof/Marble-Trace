import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useUnits } from '../../../hooks/useUnits';
import { formatGear } from '../../../utils/telemetry-format';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { RpmBar } from '../primitives/RpmBar';
import { GearStrip } from '../primitives/GearStrip';
import styles from './SpeedWidget.module.scss';

export const SpeedWidget = observer(() => {
  const { frame } = telemetryStore;
  const { formatSpeed, speedUnit } = useUnits();
  const settings = widgetSettingsStore.getSpeedSettings();

  const speed = frame ? formatSpeed(frame.speed) : '0';
  const rpm = frame ? Math.round(frame.rpm) : 0;
  const gear = frame?.gear ?? 0;
  const gearDisplay = formatGear(gear);

  const maxRpm = frame?.driver_car_red_line ?? 10000;
  const shiftRpm = frame?.driver_car_sl_shift_rpm ?? undefined;

  const isGearFocused = settings.focusMode === 'gear';

  const rpmColors = {
    low: settings.rpmColorLow,
    mid: settings.rpmColorMid,
    high: settings.rpmColorHigh,
    limit: settings.rpmColorLimit,
  };

  return (
    <WidgetPanel minWidth={320} gap={4} className={styles.speedPanel}>
      <RpmBar
        rpm={rpm}
        maxRpm={maxRpm}
        shiftRpm={shiftRpm}
        colors={rpmColors}
        colorTheme={settings.rpmColorTheme}
      />

      <span
        className={`${styles.centerDisplay} ${isGearFocused ? styles.focusGear : styles.focusSpeed}`}
      >
        <span className={styles.mainVal}>
          {isGearFocused ? gearDisplay : speed}
        </span>

        <span
          className={styles.subVal}
          style={
            isGearFocused
              ? { color: settings.rpmColorLimit, letterSpacing: '1px' }
              : undefined
          }
        >
          {isGearFocused ? `${speed} ${speedUnit}` : speedUnit}
        </span>
      </span>

      <span
        className={styles.bottomSection}
        style={{ opacity: isGearFocused ? 0 : 1 }}
      >
        <GearStrip gear={gear} accentColor={settings.rpmColorLimit} />
      </span>
    </WidgetPanel>
  );
});

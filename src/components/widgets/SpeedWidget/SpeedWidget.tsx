import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import { SpeedDisplay } from './SpeedDisplay/SpeedDisplay';
import { EnginePanel } from './EnginePanel/EnginePanel';
import { RpmPanel } from './RpmPanel/RpmPanel';
import { RpmBar } from './RpmBar/RpmBar';
import { PitPanel } from './PitPanel/PitPanel';
import { parsePitSpeedLimitMs } from './speed-utils';

import styles from './SpeedWidget.module.scss';

export const SpeedWidget = observer(() => {
  const { formatSpeed, speedUnit, formatTemp, tempUnit, speedFactor } =
    unitsStore;

  const {
    pitSpeedLimitOverride,
    rpmColorLow,
    rpmColorMid,
    rpmColorHigh,
    rpmColorShift,
    rpmColorLimit,
    showPitPanel,
    displayMode,
    showTemps,
    showRpmBar,
  } = widgetSettingsStore.getSpeedSettings();

  const { driverInfo, weekendInfo } = telemetryStore;

  const pitLimitMs =
    pitSpeedLimitOverride !== null
      ? pitSpeedLimitOverride / speedFactor
      : parsePitSpeedLimitMs(weekendInfo?.TrackPitSpeedLimit);

  const pitLimitFormatted = pitLimitMs > 0 ? formatSpeed(pitLimitMs) : '—';

  const redLine = driverInfo?.DriverCarRedLine || 10000;
  const shiftRpm = driverInfo?.DriverCarSLShiftRPM || redLine * 0.9;

  const rawBlinkRpm = driverInfo?.DriverCarSLBlinkRPM || redLine;
  const blinkRpm = rawBlinkRpm <= redLine ? rawBlinkRpm : shiftRpm;

  const rpmColors = useMemo(
    () => ({
      low: rpmColorLow,
      mid: rpmColorMid,
      high: rpmColorHigh,
      shift: rpmColorShift,
      limit: rpmColorLimit,
    }),
    [rpmColorLow, rpmColorMid, rpmColorHigh, rpmColorShift, rpmColorLimit]
  );

  return (
    <div className={styles.root}>
      <PitPanel
        showPitPanel={showPitPanel}
        pitLimitMs={pitLimitMs}
        pitLimitFormatted={pitLimitFormatted}
        speedFactor={speedFactor}
        speedUnit={speedUnit}
      />

      <div className={styles.mainDisplay}>
        <div className={styles.leftBlock}>
          <div className={styles.leftInner}>
            <SpeedDisplay
              variant="secondary"
              displayMode={displayMode}
              speedUnit={speedUnit}
              formatSpeed={formatSpeed}
            />
          </div>
        </div>

        <div className={styles.rightBlock}>
          <div className={styles.rightInner}>
            <SpeedDisplay
              variant="primary"
              displayMode={displayMode}
              speedUnit={speedUnit}
              formatSpeed={formatSpeed}
            />

            {showTemps && (
              <EnginePanel formatTemp={formatTemp} tempUnit={tempUnit} />
            )}

            <RpmPanel />
          </div>
        </div>
      </div>

      {showRpmBar && (
        <RpmBar shiftRpm={shiftRpm} blinkRpm={blinkRpm} colors={rpmColors} />
      )}
    </div>
  );
});

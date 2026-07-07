import { observer } from 'mobx-react-lite';

import { useWidgetAutoHide } from '@hooks/common/useWidgetAutoHide';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import {
  formatSpeed,
  MPS_TO_KMH,
  MPS_TO_MPH,
  speedUnit,
} from '@utils/formatters/telemetry-format';
import {
  useAppSettingsStore,
  useDrivingCoachWidgetStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { DrivingCoachWidgetSettings } from '@/types/widget-settings';

import styles from './DrivingCoachWidget.module.scss';

const ADVISORY_LABEL = {
  brake: 'BRAKE',
  gas: 'GAS',
  neutral: 'COACH',
} as const;

/** Below this |delta| (km/h or mph) the player is treated as on-pace with the reference. */
const DELTA_DEADZONE = 1;

export const DrivingCoachWidget = observer(() => {
  const coach = useDrivingCoachWidgetStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();
  const { dragMode } = useAppSettingsStore();

  const settings =
    widgetSettings.getSettings<DrivingCoachWidgetSettings>('driving-coach');

  const advisory = coach.displayedAdvisory;
  const isIdle = advisory === 'neutral';

  const referenceSpeedMps = coach.referenceSpeedMps;
  const showReference =
    settings.showReferenceSpeed && referenceSpeedMps !== null;

  // In the real overlay, show while an advisory is active or a reference speed
  // is available; hide entirely otherwise so the widget never clutters the
  // screen. In drag mode always render so it can be positioned/resized.
  const hasContent = !isIdle || showReference || dragMode;

  useWidgetAutoHide(hasContent);

  if (!hasContent) {
    return null;
  }

  const accentColor = isIdle
    ? undefined
    : advisory === 'brake'
      ? settings.brakeColor
      : settings.gasColor;

  const factor = units.unitSystem === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;
  const deltaMps = coach.speedDeltaMps;
  const deltaDisplay = deltaMps === null ? null : Math.round(deltaMps * factor);

  const deltaClass =
    deltaDisplay === null || Math.abs(deltaDisplay) < DELTA_DEADZONE
      ? styles.deltaFlat
      : deltaDisplay > 0
        ? styles.deltaFaster
        : styles.deltaSlower;

  const deltaText =
    deltaDisplay === null
      ? '—'
      : `${deltaDisplay > 0 ? '+' : ''}${deltaDisplay}`;

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      className={`${styles.panel} ${accentColor ? styles.hasAccent : ''}`}
      style={accentColor ? { background: accentColor } : undefined}
    >
      <span
        className={`${styles.advisory} ${isIdle ? styles.advisoryIdle : ''}`}
      >
        {ADVISORY_LABEL[advisory]}
      </span>

      {showReference ? (
        <div className={styles.refBlock}>
          <div className={styles.refRow}>
            <span className={styles.refLabel}>REF</span>
            <span className={styles.refValue}>
              {formatSpeed(referenceSpeedMps ?? 0, units.unitSystem)}
            </span>
            <span className={styles.refUnit}>
              {speedUnit(units.unitSystem)}
            </span>
          </div>

          <span className={`${styles.delta} ${deltaClass}`}>{deltaText}</span>
        </div>
      ) : (
        <span className={styles.refPlaceholder}>NO REFERENCE LAP</span>
      )}
    </WidgetPanel>
  );
});

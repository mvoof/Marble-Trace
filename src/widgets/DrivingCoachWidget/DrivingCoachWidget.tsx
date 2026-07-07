import { observer } from 'mobx-react-lite';
import { ChevronDown, ChevronUp, Minus } from 'lucide-react';

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
  neutral: 'ON PACE',
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

  // Show while an advisory is active or a reference speed is available; hide
  // otherwise so the widget never clutters the screen. Drag mode always renders
  // so the widget can be positioned/resized.
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
  const isFlat =
    deltaDisplay === null || Math.abs(deltaDisplay) < DELTA_DEADZONE;
  const isFaster = deltaDisplay !== null && deltaDisplay > 0;

  const deltaClass = isFlat
    ? styles.deltaFlat
    : isFaster
      ? styles.deltaFaster
      : styles.deltaSlower;

  const DeltaIcon = isFlat ? Minus : isFaster ? ChevronUp : ChevronDown;
  const deltaText =
    deltaDisplay === null
      ? '—'
      : `${deltaDisplay > 0 ? '+' : ''}${deltaDisplay}`;

  return (
    <WidgetPanel direction="column" gap={0} className={styles.panel}>
      {isIdle ? (
        <div className={styles.header}>
          <span className={styles.title}>REF SPEED</span>
          <span className={styles.chipIdle}>{ADVISORY_LABEL.neutral}</span>
        </div>
      ) : (
        <div className={styles.banner} style={{ background: accentColor }}>
          <span className={styles.bannerText}>{ADVISORY_LABEL[advisory]}</span>
        </div>
      )}

      {showReference ? (
        <div className={styles.body}>
          <div className={styles.speedGroup}>
            <span className={styles.speedValue}>
              {formatSpeed(referenceSpeedMps ?? 0, units.unitSystem)}
            </span>
            <span className={styles.speedUnit}>
              {speedUnit(units.unitSystem)}
            </span>
          </div>

          <div className={`${styles.deltaGroup} ${deltaClass}`}>
            <DeltaIcon className={styles.deltaIcon} strokeWidth={3} />
            <span className={styles.deltaValue}>{deltaText}</span>
          </div>
        </div>
      ) : (
        <div className={styles.body}>
          <span className={styles.placeholder}>NO REFERENCE LAP</span>
        </div>
      )}
    </WidgetPanel>
  );
});

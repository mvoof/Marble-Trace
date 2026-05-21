import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import {
  FLAG_LABEL,
  resolveFlagState,
  type FlagState,
} from '@utils/widget/timer-utils';

import styles from './TimerFlagBadge.module.scss';

const FLAG_CLASS: Record<FlagState, string> = {
  green: styles.flagGreen,
  final: styles.flagFinal,
  checkered: styles.flagCheckered,
};

export const TimerFlagBadge = observer(() => {
  const { showFlag } = widgetSettingsStore.getTimerSettings();

  if (!showFlag) {
    return null;
  }

  const session = telemetryStore.session;
  const remain = session?.session_time_remain ?? null;
  const flagState = resolveFlagState(session?.session_flags ?? null, remain);

  return (
    <span className={`${styles.flagLabel} ${FLAG_CLASS[flagState]}`}>
      ● {FLAG_LABEL[flagState]}
    </span>
  );
});

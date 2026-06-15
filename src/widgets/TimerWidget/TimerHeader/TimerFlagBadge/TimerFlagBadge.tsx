import { observer } from 'mobx-react-lite';

import {
  FLAG_LABEL,
  resolveFlagState,
  type FlagState,
} from '@utils/widget/timer-utils';

import styles from './TimerFlagBadge.module.scss';
import type { TimerWidgetSettings } from '@/types/widget-settings';
import {
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const FLAG_CLASS: Record<FlagState, string> = {
  green: styles.flagGreen,
  final: styles.flagFinal,
  checkered: styles.flagCheckered,
};

export const TimerFlagBadge = observer(() => {
  const sessionData = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showFlag } = widgetSettings.getSettings<TimerWidgetSettings>('timer');

  if (!showFlag) {
    return null;
  }

  const session = sessionData.session;
  const remain = session?.session_time_remain ?? null;
  const flagState = resolveFlagState(session?.session_flags ?? null, remain);

  return (
    <span className={`${styles.flagLabel} ${FLAG_CLASS[flagState]}`}>
      ● {FLAG_LABEL[flagState]}
    </span>
  );
});

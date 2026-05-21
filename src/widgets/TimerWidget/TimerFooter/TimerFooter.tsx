import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { isSessionEnded } from '@utils/widget/timer-utils';

import { LapsItem } from './LapsItem/LapsItem';
import { PositionItem } from './PositionItem/PositionItem';
import styles from './TimerFooter.module.scss';

export const TimerFooter = observer(() => {
  const session = telemetryStore.session;
  const { showLaps, showPosition } = widgetSettingsStore.getTimerSettings();

  if (!showLaps && !showPosition) {
    return null;
  }

  if (isSessionEnded(session?.session_state ?? null)) {
    return null;
  }

  return (
    <div className={styles.footer}>
      <LapsItem />

      <PositionItem />
    </div>
  );
});

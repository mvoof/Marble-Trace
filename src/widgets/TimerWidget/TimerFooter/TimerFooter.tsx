import { observer } from 'mobx-react-lite';

import { isSessionEnded } from '@utils/widget/timer-utils';

import { LapsItem } from './LapsItem/LapsItem';
import { PositionItem } from './PositionItem/PositionItem';
import styles from './TimerFooter.module.scss';
import type { TimerWidgetSettings } from '@/types/widget-settings';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const TimerFooter = observer(() => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const session = telemetry.session;
  const { showLaps, showPosition } =
    widgetSettings.getSettings<TimerWidgetSettings>('timer');

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

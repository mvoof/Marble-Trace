import { observer } from 'mobx-react-lite';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  formatDelta,
  getDeltaState,
  getGameDelta,
} from '@utils/widget/delta-utils';
import type { LapTimesWidgetSettings } from '@/types/widget-settings';
import { ReferenceBadge } from '@/components/shared/ReferenceBadge/ReferenceBadge';
import styles from './DeltaColumn.module.scss';

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const DeltaColumn = observer(() => {
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference } =
    widgetSettings.getSettings<LapTimesWidgetSettings>('lap-times');

  const delta = getGameDelta(lapTiming, reference);

  return (
    <div className={styles.root}>
      <div className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}>
        {formatDelta(delta)}
      </div>

      <ReferenceBadge reference={reference} className={styles.badge} />
    </div>
  );
});

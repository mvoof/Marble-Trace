import { observer } from 'mobx-react-lite';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  formatDelta,
  getDeltaState,
  getGameDelta,
  isGameDeltaOk,
} from '@utils/widget/delta-utils';
import type { DeltaWidgetSettings } from '@/types/widget-settings';
import { ReferenceBadge } from '@/components/shared/ReferenceBadge/ReferenceBadge';
import styles from './DeltaLive.module.scss';

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const DeltaLive = observer(() => {
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();
  const { reference, hideWhenNoReference } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const delta = getGameDelta(lapTiming, reference);
  const deltaOk = isGameDeltaOk(lapTiming, reference);

  if (hideWhenNoReference && !deltaOk) {
    return null;
  }

  return (
    <div className={styles.root}>
      <div className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}>
        {formatDelta(delta)}
      </div>
      <ReferenceBadge reference={reference} className={styles.badge} />
    </div>
  );
});

import { observer } from 'mobx-react-lite';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { formatDelta, getDeltaState } from '@utils/widget/lap-delta-utils';
import type { LapDeltaWidgetSettings } from '@/types/widget-settings';
import { ReferenceBadge } from '@/components/shared/ReferenceBadge/ReferenceBadge';
import styles from './DeltaLive.module.scss';

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const DeltaLive = observer(() => {
  const { lapDelta } = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();
  const { reference } =
    widgetSettings.getSettings<LapDeltaWidgetSettings>('lap-delta');

  const delta =
    reference === 'session_best'
      ? (lapDelta?.sessionBestTotal ?? 0)
      : (lapDelta?.personalBestTotal ?? 0);

  return (
    <div className={styles.root}>
      <div className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}>
        {formatDelta(delta)}
      </div>
      <ReferenceBadge reference={reference} className={styles.badge} />
    </div>
  );
});

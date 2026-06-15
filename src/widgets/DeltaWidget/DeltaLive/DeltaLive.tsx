import { observer } from 'mobx-react-lite';
import {
  usePlayerStore,
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
  const { lapTiming } = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();
  const { reference, hideWhenNoReference } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const delta = getGameDelta(lapTiming, reference);
  const deltaOk = isGameDeltaOk(lapTiming, reference);

  if (hideWhenNoReference && !deltaOk) {
    return null;
  }

  const deltaStr = formatDelta(delta);
  let fontSizeStyle = {};

  if (deltaStr.length >= 12) {
    fontSizeStyle = { fontSize: 'calc(18px * var(--wfs, 1))' };
  } else if (deltaStr.length >= 9) {
    fontSizeStyle = { fontSize: 'calc(24px * var(--wfs, 1))' };
  }

  return (
    <div className={styles.root}>
      <div
        className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}
        style={fontSizeStyle}
      >
        {deltaStr}
      </div>
      <ReferenceBadge reference={reference} className={styles.badge} />
    </div>
  );
});

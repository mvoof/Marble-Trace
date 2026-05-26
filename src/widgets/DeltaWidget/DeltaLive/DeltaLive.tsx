import React from 'react';
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
import type { DeltaWidgetSettings } from '@/types/widget-settings';
import { ReferenceBadge } from '@/components/shared/ReferenceBadge/ReferenceBadge';
import styles from './DeltaLive.module.scss';

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

// Base design assumes 7 chars (e.g. "+ 1.234"). Scale down for longer strings (minutes/hours).
const BASE_CHARS = 7;
const BASE_FONT_SIZE = 64;

const getDeltaFontSize = (formatted: string): number => {
  const len = formatted.replace(/\s/g, '').length + 1;

  return len > BASE_CHARS
    ? Math.floor((BASE_FONT_SIZE * BASE_CHARS) / len)
    : BASE_FONT_SIZE;
};

export const DeltaLive = observer(() => {
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();
  const { reference } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const delta = getGameDelta(lapTiming, reference);
  const formatted = formatDelta(delta);
  const fontSize = getDeltaFontSize(formatted);

  return (
    <div className={styles.root}>
      <div
        className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}
        style={{ '--delta-fs': fontSize } as React.CSSProperties}
      >
        {formatted}
      </div>
      <ReferenceBadge reference={reference} className={styles.badge} />
    </div>
  );
});

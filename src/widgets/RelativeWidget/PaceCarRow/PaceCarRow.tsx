import { observer } from 'mobx-react-lite';

import {
  computeRelativeGap,
  buildRelativeGridTemplate,
} from '@ui/widgets/RelativeWidget/relative-utils';
import type { PaceCarRowEntry } from '@ui/widgets/RelativeWidget/relative-utils';
import { formatCarNumber } from '@utils/driver';
import type { RelativeWidgetSettings } from '@/types/widget-settings';

import styles from './PaceCarRow.module.scss';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface PaceCarRowProps {
  driver: PaceCarRowEntry;
  index: number;
}

export const PaceCarRow = observer(({ driver, index }: PaceCarRowProps) => {
  const { relativeEntries } = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RelativeWidgetSettings>('relative');

  const player = relativeEntries.find((entry) => entry.isPlayer) ?? null;
  const relativeGap = player ? computeRelativeGap(driver, player) : 0;

  const gapStr =
    relativeGap > 0
      ? `+${relativeGap.toFixed(1)}`
      : relativeGap < 0
        ? relativeGap.toFixed(1)
        : '0.0';

  const gridTemplate = buildRelativeGridTemplate(settings);
  const formattedCarNumber = formatCarNumber(driver.carNumber);

  const rowClass = [
    styles.paceCarRow,
    settings.rowPadding === 'narrow' ? styles.rowPaddingNarrow : '',
    settings.rowPadding === 'medium' ? styles.rowPaddingMedium : '',
    settings.rowPadding === 'wide' ? styles.rowPaddingWide : '',
    index % 2 !== 0 ? styles.rowOdd : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rowClass}
      style={{ gridTemplateColumns: gridTemplate }}
      data-relative-row
    >
      <div
        className={styles.posBlock}
        style={{ borderLeft: `3px solid ${driver.carClassColor}` }}
      />

      <div className={styles.carNumberCell}>
        <span className={styles.carNumber}>#{formattedCarNumber}</span>
      </div>

      <span className={styles.centerLabel}>{driver.userName}</span>

      <div className={styles.gapBlock}>
        <span className={styles.gap}>{gapStr}</span>
      </div>
    </div>
  );
});

PaceCarRow.displayName = 'PaceCarRow';

import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import {
  computeRelativeGap,
  buildRelativeGridTemplate,
} from '@ui/widgets/RelativeWidget/relative-utils';
import { formatCarNumber } from '@utils/driver';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import type { RelativeWidgetSettings } from '@/types/widget-settings';

import styles from './PaceCarRow.module.scss';
import {
  useBackendComputedStore,
  useRelativeWidgetStore,
} from '@store/root-store-context';

interface PaceCarRowProps {
  carIdx: number;
  index: number;
}

/**
 * The pace car's own row. Its gap moves every tick and is written straight to
 * its span; the rest of the row is the roster entry, which does not move.
 */
export const PaceCarRow = observer(({ carIdx, index }: PaceCarRowProps) => {
  const computed = useBackendComputedStore();
  const relativeWidget = useRelativeWidgetStore();

  const settings = useWidgetSettings<RelativeWidgetSettings>('relative');

  const driver = relativeWidget.paceCarRowOf(carIdx);

  const gapRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const paceCar = relativeWidget.paceCarRowOf(carIdx);
      const livePlayer =
        computed.relativeEntries.find((entry) => entry.isPlayer) ?? null;

      if (!paceCar) {
        return;
      }

      const relativeGap = livePlayer
        ? computeRelativeGap(paceCar, livePlayer)
        : 0;

      const gapText =
        relativeGap > 0
          ? `+${relativeGap.toFixed(1)}`
          : relativeGap < 0
            ? relativeGap.toFixed(1)
            : '0.0';

      scheduleWrite(() => {
        element.textContent = gapText;
      });
    },
    [computed, relativeWidget, carIdx]
  );

  if (!driver) {
    return null;
  }

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

      {settings.showCarNumber && (
        <div className={styles.carNumberCell}>
          <span className={styles.carNumber}>#{formattedCarNumber}</span>
        </div>
      )}

      {settings.showCountryFlag && <div className={styles.flagCell} />}

      <span
        className={[
          styles.centerLabel,
          settings.showCountryFlag ? styles.centerLabelWithFlag : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {driver.userName}
      </span>

      <div className={styles.gapBlock}>
        <span ref={gapRef} className={styles.gap} />
      </div>
    </div>
  );
});

PaceCarRow.displayName = 'PaceCarRow';

import { Fragment, type ReactNode } from 'react';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import {
  buildRelativeGridTemplate,
  visibleRelativeColumns,
} from '@widgets/relative/relative-utils';
import type { RelativeColumn } from '@widgets/relative/relative-columns';
import { computeRelativeGap, formatCarNumber } from '@shared/lib/driver';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { writeText } from '@shared/ui/live/live-parts';

import styles from './PaceCarRow.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useRelativeWidgetStore } from '@widgets/relative/relative.store';
import type { RelativeWidgetSettings } from '../settings-schema';
import { TrackDistance } from '../TrackDistance/TrackDistance';
import { cx } from '@shared/lib/class-names';

const RATING_COLUMNS: ReadonlySet<RelativeColumn> = new Set(['sr', 'ir']);

/**
 * The label takes the name's column and the rating columns right after it —
 * the safety car has no ratings, so its name centres across their room.
 * `covers` tells the rating cells the label already fills.
 */
const labelSpanOf = (columns: readonly RelativeColumn[]) => {
  const nameIndex = columns.indexOf('name');
  let length = 1;

  while (RATING_COLUMNS.has(columns[nameIndex + length])) {
    length += 1;
  }

  return {
    length,
    covers: (index: number) => index > nameIndex && index < nameIndex + length,
  };
};

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
      const livePlayer = computed.relativePlayerEntry;

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
        writeText(element, gapText);
      });
    },
    [computed, relativeWidget, carIdx]
  );

  if (!driver) {
    return null;
  }

  const gridTemplate = buildRelativeGridTemplate(settings);
  const formattedCarNumber = formatCarNumber(driver.carNumber);
  const columns = visibleRelativeColumns(settings);
  const labelSpan = labelSpanOf(columns);

  const renderCell = (column: RelativeColumn): ReactNode => {
    switch (column) {
      case 'pos':
        return (
          <div
            className={styles.posBlock}
            style={{ borderLeft: `3px solid ${driver.carClassColor}` }}
          />
        );
      case 'carNumber':
        return (
          <div className={styles.carNumberCell}>
            <span className={styles.carNumber}>{formattedCarNumber}</span>
          </div>
        );
      case 'name':
        return (
          <span
            className={styles.centerLabel}
            style={{ gridColumn: `span ${labelSpan.length}` }}
          >
            {driver.userName}
          </span>
        );
      case 'gap':
        return (
          <div className={styles.gapBlock}>
            <span ref={gapRef} className={styles.gap} />
          </div>
        );
      case 'distance':
        return <TrackDistance carIdx={driver.carIdx} isPaceCar />;
      // No flag and no ratings for the safety car: the column stays empty.
      case 'countryFlag':
      case 'sr':
      case 'ir':
        return <div />;
    }
  };

  const rowClass = cx(
    styles.paceCarRow,
    settings.rowPadding === 'narrow' ? styles.rowPaddingNarrow : '',
    settings.rowPadding === 'medium' ? styles.rowPaddingMedium : '',
    settings.rowPadding === 'wide' ? styles.rowPaddingWide : '',
    index % 2 !== 0 ? styles.rowOdd : ''
  );

  return (
    <div
      className={rowClass}
      style={{ gridTemplateColumns: gridTemplate }}
      data-relative-row
    >
      {columns.map((column, columnIndex) => {
        if (labelSpan.covers(columnIndex)) {
          return null;
        }

        return <Fragment key={column}>{renderCell(column)}</Fragment>;
      })}
    </div>
  );
});

PaceCarRow.displayName = 'PaceCarRow';

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch } from 'antd';
import { GripVertical } from 'lucide-react';

import { usePointerReorder } from '@shared/hooks/usePointerReorder';
import { cx } from '@shared/lib/class-names';
import { movedBefore } from '@shared/lib/moved-before';
import styles from './ColumnList.module.scss';

const GRIP_SIZE_PX = 14;

export interface ColumnListItem<Column extends string> {
  column: Column;
  label: string;
  /** What the column shows, on hover over its name. */
  hint?: string;
  /** Whether the column is drawn; absent for a column the table always has. */
  shown?: boolean;
}

interface ColumnListProps<Column extends string> {
  /** The table's columns in its current order. */
  items: readonly ColumnListItem<Column>[];
  onReorder: (order: Column[]) => void;
  onToggle: (column: Column, shown: boolean) => void;
}

/**
 * A table's columns as a flat list — grip, switch, name — whose order is the
 * table's column order. A column's own options live in their own blocks, not
 * under its row.
 */
export const ColumnList = observer(
  <Column extends string>({
    items,
    onReorder,
    onToggle,
  }: ColumnListProps<Column>) => {
    const { t } = useTranslation('main-app');
    const drag = usePointerReorder(items.length, 'y', (from, before) =>
      onReorder(
        movedBefore([...items], from, before).map(({ column }) => column)
      )
    );

    return (
      <div className={styles.list} ref={drag.listRef}>
        {items.map(({ column, label, hint, shown }, index) => {
          const item = drag.item(index);

          return (
            <div
              key={column}
              className={cx(
                styles.item,
                item.dragging && styles.itemDragged,
                item.drop === 'before' && styles.itemDropBefore,
                item.drop === 'after' && styles.itemDropAfter
              )}
              {...item.attributes}
            >
              <span
                className={styles.grip}
                title={t('widgetSettings.columns.move')}
                {...item.handle}
              >
                <GripVertical size={GRIP_SIZE_PX} />
              </span>

              <span className={styles.switchSlot}>
                {shown === undefined ? (
                  // A column the table always has: its switch says so,
                  // on and locked, so every row reads the same.
                  <Switch
                    size="small"
                    checked
                    disabled
                    aria-label={label}
                    title={t('widgetSettings.columns.alwaysShown')}
                  />
                ) : (
                  <Switch
                    size="small"
                    checked={shown}
                    aria-label={label}
                    onChange={(next) => onToggle(column, next)}
                  />
                )}
              </span>

              <span
                className={cx(styles.label, shown === false && styles.labelOff)}
                title={hint}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
);

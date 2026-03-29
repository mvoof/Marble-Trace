import type { ReactNode } from 'react';

import styles from './DataGrid.module.scss';

export interface DataGridColumn<T> {
  key: string;
  header?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => ReactNode;
}

interface DataGridProps<T> {
  columns: DataGridColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  highlightRow?: (row: T) => boolean;
  compact?: boolean;
  maxRows?: number;
  headerVisible?: boolean;
}

export function DataGrid<T>({
  columns,
  data,
  rowKey,
  highlightRow,
  compact = false,
  maxRows,
  headerVisible = true,
}: DataGridProps<T>) {
  const rows = maxRows ? data.slice(0, maxRows) : data;

  return (
    <span
      className={`${styles.grid} ${compact ? styles.compact : ''}`}
      role="table"
    >
      {headerVisible && (
        <span className={styles.headerRow} role="row">
          {columns.map((col) => (
            <span
              key={col.key}
              className={styles.headerCell}
              style={{ width: col.width, textAlign: col.align ?? 'left' }}
              role="columnheader"
            >
              {col.header ?? ''}
            </span>
          ))}
        </span>
      )}

      {rows.map((row, i) => (
        <span
          key={rowKey(row)}
          className={`${styles.row} ${highlightRow?.(row) ? styles.highlighted : ''}`}
          role="row"
        >
          {columns.map((col) => (
            <span
              key={col.key}
              className={styles.cell}
              style={{ width: col.width, textAlign: col.align ?? 'left' }}
              role="cell"
            >
              {col.render
                ? col.render(row, i)
                : ((row as Record<string, unknown>)[col.key]?.toString() ?? '')}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

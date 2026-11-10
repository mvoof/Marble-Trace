import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import type { CellGroup, CellId, PlannedStrip } from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';

export interface EngineStripProps {
  strip: PlannedStrip;
  nodes: Partial<Record<CellId, ReactNode>>;
}

const STRIP_CLASS: Record<CellGroup, string> = {
  brake: styles.stripBrake,
  traction: styles.stripTraction,
  trim: styles.stripTrim,
  diff: styles.stripDiff,
  chassis: styles.stripChassis,
  engine: styles.stripEngine,
};

/**
 * One strip of the panel: a system's cells side by side, ruled apart as a
 * table's columns are, a marker in the system's tone down its left edge. Its
 * height is fixed per strip in the stylesheet, as `STRIP_HEIGHTS` measures it.
 */
export const EngineStrip = observer(({ strip, nodes }: EngineStripProps) => {
  return (
    <div className={`${styles.strip} ${STRIP_CLASS[strip.group]}`}>
      {strip.cells.map((cell) => (
        <div
          className={styles.slot}
          // Data-driven: each cell takes the strip's width in proportion to
          // the columns it takes.
          style={{ flexGrow: cell.columns }}
          key={cell.id}
        >
          {nodes[cell.id]}
        </div>
      ))}
    </div>
  );
});

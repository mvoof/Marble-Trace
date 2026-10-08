import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import type { CellId, PlannedGroup } from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';

export interface GroupPlateProps {
  group: PlannedGroup;
  nodes: Partial<Record<CellId, ReactNode>>;
}

const GROUP_CLASS: Record<PlannedGroup['group'], string> = {
  brake: styles.plateBrake,
  traction: styles.plateTraction,
  diff: styles.plateDiff,
  chassis: styles.plateChassis,
  engine: styles.plateEngine,
};

/**
 * One system's cells on one plate.
 *
 * The plate is the whole grouping mechanism: a gap around it, a hairline
 * between the cells inside it, and a two-pixel coloured edge that only confirms
 * what the gap already said.
 */
export const GroupPlate = observer(({ group, nodes }: GroupPlateProps) => {
  return (
    <div
      className={`${styles.plate} ${GROUP_CLASS[group.group]}`}
      // Data-driven: the plate takes width in proportion to what it holds, so a
      // five-cell traction plate is not squeezed to the width of a three-cell
      // one beside it.
      style={{ flexGrow: group.units }}
    >
      <div className={styles.plateBar} />

      <div className={styles.plateCells}>
        {group.slots.map((slot, slotIndex) => {
          if (slot.kind === 'stack') {
            return (
              <div className={styles.stack} key={slotIndex}>
                {slot.ids.map((id) => (
                  <div className={styles.stackItem} key={id}>
                    {nodes[id]}
                  </div>
                ))}
              </div>
            );
          }

          return (
            <div
              className={`${styles.slot} ${slot.kind === 'lead' ? styles.slotLead : ''}`}
              key={slotIndex}
            >
              {nodes[slot.ids[0]]}
            </div>
          );
        })}
      </div>
    </div>
  );
});

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
 * One system's cells, ruled apart as a table's columns are.
 *
 * The system's tone is a marker on the plate's edge and the color a cell lights
 * in when its knob moves — never the values', which stay white.
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
      {group.slots.map((slot, slotIndex) => {
        if (slot.kind === 'stack') {
          return (
            <div
              className={styles.stack}
              style={{ flexGrow: slot.units }}
              key={slotIndex}
            >
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
            className={styles.slot}
            style={{ flexGrow: slot.units }}
            key={slotIndex}
          >
            {nodes[slot.ids[0]]}
          </div>
        );
      })}
    </div>
  );
});

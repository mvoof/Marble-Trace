import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import type { CellId, PlannedGroup } from './engine-panel-utils';
import styles from './EnginePanelWidget.module.scss';

export interface GroupPlateProps {
  group: PlannedGroup;
  nodes: Partial<Record<CellId, ReactNode>>;
  /**
   * The widest row's units, in the horizontal layout: the plate takes its
   * share of that, so a short row ends early instead of stretching its cells
   * out of line with the row below. Absent, the plate fills its tier.
   */
  widestUnits?: number;
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
export const GroupPlate = observer(
  ({ group, nodes, widestUnits }: GroupPlateProps) => {
    return (
      <div
        className={`${styles.plate} ${GROUP_CLASS[group.group]}`}
        // Data-driven: the plate's width is its share of the widest row, or, in
        // a tier, all of it.
        style={
          widestUnits
            ? { flex: `0 0 ${(group.units / widestUnits) * 100}%` }
            : { flexGrow: group.units }
        }
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
  }
);

import { observer } from 'mobx-react-lite';
import type { CSSProperties } from 'react';

import styles from './ReservedSlot.module.scss';
import { useAppSettingsStore } from '@store/root-store-context';

interface ReservedSlotProps {
  /**
   * The block's own height at design scale, in px. It is scaled by `--wfs` the
   * same way the block would be, so the reservation matches whatever size the
   * driver has stretched the widget to.
   */
  height: number;
  /** What will appear here, named for the driver placing the widget. */
  label: string;
}

/**
 * The room a block that comes and goes with the session will need, shown while
 * the widget is being placed.
 *
 * An `autoHeight` widget is only as tall as what it currently draws, so a block
 * that appears on track — the pit warning, the approach rail — makes the widget
 * grow downwards. The layout editor never sees that block at all, so a widget
 * placed flush against the bottom edge there hangs off the screen in the race.
 *
 * Returning this instead of `null` closes that gap where it matters: in the
 * editor and in drag mode the widget stands at its full height, the selection
 * frame is drawn around that height, and the dashed area says which part of it
 * is not filled yet. On track it renders nothing at all — the driver gets the
 * compact widget back, having placed it against the size it can actually reach.
 *
 * Only for blocks that hide themselves on **telemetry**. A block switched off in
 * the settings is off in the editor too — there is nothing to reconcile.
 */
export const ReservedSlot = observer(({ height, label }: ReservedSlotProps) => {
  const appSettings = useAppSettingsStore();

  const isPlacing = appSettings.dragMode;

  // On track the block is simply absent, exactly as it was before it had a
  // slot: reserving the space there would leave a permanent hole in the plate
  // for the sake of a size only the editor needs to show.
  if (!isPlacing) {
    return null;
  }

  return (
    <div
      className={styles.slot}
      style={{ ['--reserved-height']: height } as CSSProperties}
    >
      <span className={styles.label}>{label}</span>
    </div>
  );
});

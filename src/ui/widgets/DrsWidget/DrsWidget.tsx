import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { usePlayerStore } from '@store/root-store-context';
import type { DrsState } from '@/types/bindings';
import type { DrsWidgetSettings } from '@/types/widget-settings';
import styles from './DrsWidget.module.scss';

const STATE_LABEL: Record<DrsState, string> = {
  Unavailable: 'CLOSED',
  Armed: 'ARMED',
  Ready: 'READY',
  Open: 'OPEN',
};

const STATE_CLASS: Record<DrsState, string> = {
  Unavailable: styles.rootUnavailable,
  Armed: styles.rootArmed,
  Ready: styles.rootReady,
  Open: styles.rootOpen,
};

/**
 * The drag reduction system, in the four states the sim actually publishes.
 *
 * `Armed` is the one worth having and the one a two-state indicator loses: the
 * car is past the detection point with the zone still ahead, so the button does
 * nothing yet. Drawing it as READY would train the driver to press early.
 *
 * Nothing renders on a car without DRS — the adapter clears the field when the
 * car does not declare it, so null means "no DRS", not "closed".
 */
export const DrsWidget = observer(() => {
  const { carStatus } = usePlayerStore();
  const settings = useWidgetSettings<DrsWidgetSettings>('drs');

  const drs = carStatus?.drs ?? null;

  if (drs === null) {
    return null;
  }

  if (drs === 'Unavailable' && settings.hideWhenUnavailable) {
    return null;
  }

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={0}
      className={`${styles.root} ${STATE_CLASS[drs]}`}
    >
      <div className={styles.label}>DRS</div>
      <div className={styles.state}>{STATE_LABEL[drs]}</div>
    </WidgetPanel>
  );
});

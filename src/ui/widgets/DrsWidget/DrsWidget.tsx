import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { usePlayerStore } from '@store/root-store-context';
import type { DrsState } from '@/types/bindings';
import type { DrsWidgetSettings } from '@/types/widget-settings';
// The wing itself — three slats stepping down and to the left, each cut on the
// slant. It paints in `currentColor`, which the root sets per state.
import DrsWing from '@assets/drs-wing.svg?react';
import styles from './DrsWidget.module.scss';

// `OFF` rather than `CLOSED` for the unavailable state: the flap is closed in
// `Ready` too, so a label about the flap describes the wrong thing. What this
// state says is that the rules do not allow DRS here.
const STATE_LABEL: Record<DrsState, string> = {
  Unavailable: 'OFF',
  Armed: 'ARMED',
  Ready: 'READY',
  Open: 'ACTIVE',
};

const STATE_CLASS: Record<DrsState, string> = {
  Unavailable: styles.rootUnavailable,
  Armed: styles.rootArmed,
  Ready: styles.rootReady,
  Open: styles.rootOpen,
};

/** What the plate says on a car that has no DRS, when it is kept on screen. */
const NO_DRS_LABEL = 'N/A';

/**
 * The drag reduction system, in the four states the sim actually publishes.
 *
 * `Armed` is the one worth having and the one a two-state indicator loses: the
 * car is past the detection point with the zone still ahead, so the button does
 * nothing yet. Drawing it as READY would train the driver to press early.
 *
 * On a car without DRS the adapter clears the field, so null means "no DRS",
 * not "closed". Whether the widget leaves the screen for it is
 * `hideWhenCarHasNoDrs`, answered by WidgetAutoHideStore — the container draws
 * its plate around a body that renders nothing, so hiding has to happen a level
 * up. What is left here is the other half of that setting: kept on screen, the
 * plate says `N/A` rather than sitting empty.
 */
export const DrsWidget = observer(() => {
  const { carStatus } = usePlayerStore();
  const settings = useWidgetSettings<DrsWidgetSettings>('drs');

  const drs = carStatus?.drs ?? null;

  if (drs === null && settings.hideWhenCarHasNoDrs !== false) {
    return null;
  }

  if (drs === 'Unavailable' && settings.hideWhenUnavailable) {
    return null;
  }

  return (
    <WidgetPanel
      direction="row"
      gap={0}
      minWidth={0}
      className={`${styles.root} ${STATE_CLASS[drs ?? 'Unavailable']}`}
    >
      <DrsWing className={styles.mark} aria-hidden="true" focusable="false" />

      <div className={styles.divider} />

      <div className={styles.label}>DRS</div>

      <div className={styles.state}>
        {drs === null ? NO_DRS_LABEL : STATE_LABEL[drs]}
      </div>
    </WidgetPanel>
  );
});

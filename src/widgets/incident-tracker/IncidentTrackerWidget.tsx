import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import type { IncidentTrackerWidgetSettings } from './settings-schema';
import { useIncidentTrackerStore } from './incident-tracker-context';
import { SafetyRatingCell } from './SafetyRatingCell';
import { IncidentsCell } from './IncidentsCell';
import { PenaltiesCell } from './PenaltiesCell';
import { CleanCornersCell } from './CleanCornersCell';
import styles from './IncidentTrackerWidget.module.scss';

/**
 * Two tiers: the rating the session is heading for on top, the counters under
 * it. Everything rides the 4 Hz `safetyRating` frame and the session YAML, so
 * nothing here is on a hot tier.
 */
export const IncidentTrackerWidget = observer(() => {
  const settings =
    useWidgetSettings<IncidentTrackerWidgetSettings>('incident-tracker');
  const { hasPenalties } = useIncidentTrackerStore();

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={0}
      fitContent
      className={styles.root}
    >
      {settings.showProjectedSr ? (
        <>
          <SafetyRatingCell />
          <span className={styles.divider} />
        </>
      ) : null}

      <div className={styles.counters}>
        <IncidentsCell />
        {settings.showPenalties && hasPenalties ? <PenaltiesCell /> : null}
        {settings.showCleanCorners ? <CleanCornersCell /> : null}
      </div>
    </WidgetPanel>
  );
});

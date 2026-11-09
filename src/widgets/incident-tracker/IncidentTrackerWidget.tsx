import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import type { IncidentTrackerWidgetSettings } from './settings-schema';
import { useIncidentTrackerStore } from './incident-tracker-context';
import { SafetyRatingCell } from './SafetyRatingCell';
import { IncidentLimitBar } from './IncidentLimitBar';
import { IncidentsCell } from './IncidentsCell';
import { PenaltiesCell } from './PenaltiesCell';
import { CleanCornersCell } from './CleanCornersCell';
import styles from './IncidentTrackerWidget.module.scss';

/**
 * The plate is never narrower than the redesign's card; a column that leaves
 * gives its share to the rest rather than narrowing it.
 */
const MOCKUP_CARD_WIDTH_PX = 248;

/**
 * Two tiers: the rating the session is heading for on top, the counters under
 * it, and between them how much of the incident limit is used. Everything
 * rides the 4 Hz `safetyRating` frame and the session YAML, so nothing here is
 * on a hot tier.
 */
export const IncidentTrackerWidget = observer(() => {
  const settings =
    useWidgetSettings<IncidentTrackerWidgetSettings>('incident-tracker');
  const store = useIncidentTrackerStore();

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={MOCKUP_CARD_WIDTH_PX}
      fitContent
      className={`${styles.root} ${store.isLimitAlarm ? styles.rootAlarm : ''}`}
    >
      {settings.showProjectedSr ? <SafetyRatingCell /> : null}

      <IncidentLimitBar />

      <div className={styles.counters}>
        <IncidentsCell />
        {settings.showPenalties && store.hasPenalties ? (
          <PenaltiesCell />
        ) : null}
        {settings.showCleanCorners ? <CleanCornersCell /> : null}
      </div>
    </WidgetPanel>
  );
});

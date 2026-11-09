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

// The redesign's card and the twelfths its three columns take of it — the same
// 4 · 5 · 3 the cells grow by (`MetricCell.module.scss`).
const MOCKUP_CARD_WIDTH_PX = 248;
const MOCKUP_GRID_COLUMNS = 12;
const INCIDENTS_SPAN = 4;
const PENALTIES_SPAN = 5;
const CLEAN_CORNERS_SPAN = 3;

/**
 * The plate is never narrower than the share of the card its shown columns
 * take, so a session without penalties narrows it by PEN's share. What it
 * holds can still widen it — the rating tier above is often the wider.
 */
const plateMinWidthPx = (
  showsPenalties: boolean,
  showsCleanCorners: boolean
) => {
  const span =
    INCIDENTS_SPAN +
    (showsPenalties ? PENALTIES_SPAN : 0) +
    (showsCleanCorners ? CLEAN_CORNERS_SPAN : 0);

  return Math.round((MOCKUP_CARD_WIDTH_PX * span) / MOCKUP_GRID_COLUMNS);
};

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
  const showsPenalties = settings.showPenalties && store.hasPenalties;

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={plateMinWidthPx(showsPenalties, settings.showCleanCorners)}
      fitContent
      className={`${styles.root} ${store.isLimitAlarm ? styles.rootAlarm : ''}`}
    >
      {settings.showProjectedSr ? <SafetyRatingCell /> : null}

      <IncidentLimitBar />

      <div className={styles.counters}>
        <IncidentsCell />
        {showsPenalties ? <PenaltiesCell /> : null}
        {settings.showCleanCorners ? <CleanCornersCell /> : null}
      </div>
    </WidgetPanel>
  );
});

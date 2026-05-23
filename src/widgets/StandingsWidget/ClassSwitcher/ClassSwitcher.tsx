import { observer } from 'mobx-react-lite';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { formatIRating } from '@/utils/widget/widget-utils';
import type { StandingsWidgetSettings } from '@/types/widget-settings';

import styles from './ClassSwitcher.module.scss';
import {
  useAppSettingsStore,
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const ClassSwitcher = observer(() => {
  const appSettings = useAppSettingsStore();
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');
  const allClassGroups = computed.allClassGroups;
  const activeIndex = widgetSettings.standingsActiveClassIndex;
  const dragMode = appSettings.dragMode;

  const group = allClassGroups[activeIndex];
  const total = allClassGroups.length;

  if (!settings.enableClassCycling || allClassGroups.length === 0 || !group) {
    return null;
  }

  const handlePrev = () => {
    widgetSettings.cycleStandingsPrev(total);
  };

  const handleNext = () => {
    widgetSettings.cycleStandingsNext(total);
  };

  return (
    <div className={styles.switcher}>
      {dragMode && (
        <button
          className={styles.navBtn}
          onClick={handlePrev}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={total <= 1}
          aria-label="Previous class"
        >
          <ChevronLeft size={14} />
        </button>
      )}

      <div className={styles.classInfo}>
        <span
          className={styles.className}
          style={{ color: group.classColor || 'inherit' }}
        >
          {group.classShortName || group.className}
        </span>

        <span className={styles.meta}>
          {total > 1 && (
            <span className={styles.pagination}>
              {activeIndex + 1}/{total}
            </span>
          )}
          <span className={styles.stat}>
            SOF {formatIRating(group.classSof)}
          </span>
          <span className={styles.stat}>{group.totalDrivers} drivers</span>
        </span>
      </div>

      {dragMode && (
        <button
          className={styles.navBtn}
          onClick={handleNext}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={total <= 1}
          aria-label="Next class"
        >
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
});

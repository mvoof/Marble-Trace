import { observer } from 'mobx-react-lite';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { computedStore } from '../../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import { appSettingsStore } from '../../../../store/app-settings.store';
import { formatIRating } from '@/components/widgets/widget-utils';

import styles from './ClassSwitcher.module.scss';

export const ClassSwitcher = observer(() => {
  const allClassGroups = computedStore.allClassGroups;
  const activeIndex = widgetSettingsStore.standingsActiveClassIndex;
  const dragMode = appSettingsStore.dragMode;

  const group = allClassGroups[activeIndex];
  const total = allClassGroups.length;

  if (!group) {
    return null;
  }

  const handlePrev = () => {
    widgetSettingsStore.cycleStandingsPrev(total);
  };

  const handleNext = () => {
    widgetSettingsStore.cycleStandingsNext(total);
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

import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { ClassGroupHeader } from '@widgets/StandingsWidget/ClassGroupHeader/ClassGroupHeader';

import styles from './ClassSwitcher.module.scss';
import {
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const FLASH_DURATION_MS = 300;

export const ClassSwitcher = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const standingsWidget = useStandingsWidgetStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');
  const { allClassGroups } = standingsWidget;
  const activeIndex = standingsWidget.activeClassIndex;

  const group = allClassGroups[activeIndex];
  const total = allClassGroups.length;

  const [flashDir, setFlashDir] = useState<'prev' | 'next' | null>(null);
  const prevIndexRef = useRef(activeIndex);

  useEffect(() => {
    const prev = prevIndexRef.current;
    prevIndexRef.current = activeIndex;

    if (prev === activeIndex || total <= 1) {
      return;
    }

    let dir: 'prev' | 'next';

    if (activeIndex === (prev + 1) % total) {
      dir = 'next';
    } else if (activeIndex === (prev - 1 + total) % total) {
      dir = 'prev';
    } else {
      return;
    }

    setFlashDir(dir);
    const timerId = setTimeout(() => setFlashDir(null), FLASH_DURATION_MS);

    return () => clearTimeout(timerId);
  }, [activeIndex, total]);

  if (
    settings.viewMode !== 'cycling' ||
    allClassGroups.length === 0 ||
    !group
  ) {
    return null;
  }

  const handlePrev = () => {
    standingsWidget.cyclePrev(total);
  };

  const handleNext = () => {
    standingsWidget.cycleNext(total);
  };

  const paginationLabel = total > 1 ? `${activeIndex + 1}/${total}` : undefined;

  return (
    <div className={styles.switcher}>
      <button
        className={`${styles.navBtn} ${flashDir === 'prev' ? styles.navBtnFlash : ''}`}
        onClick={handlePrev}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={total <= 1}
        aria-label="Previous class"
      >
        <ChevronLeft size={14} />
      </button>

      <ClassGroupHeader
        className={group.className}
        classShortName={group.classShortName}
        classColor={group.classColor}
        classSof={group.classSof}
        totalDrivers={group.totalDrivers}
        paginationLabel={paginationLabel}
      />

      <button
        className={`${styles.navBtn} ${flashDir === 'next' ? styles.navBtnFlash : ''}`}
        onClick={handleNext}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={total <= 1}
        aria-label="Next class"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
});

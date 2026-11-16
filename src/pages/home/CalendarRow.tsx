import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Car, Map as MapIcon } from 'lucide-react';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import { DaysDrivenCard } from './DaysDrivenCard';
import { TopList } from './TopList';
import styles from './CalendarRow.module.scss';

const ICON_SIZE = 14;

/** The days driven, then the cars and the tracks driven longest beside it. */
export const CalendarRow = observer(() => {
  const { t } = useTranslation('main-app');
  const { topCars, topTracks } = useStatisticsStore();

  return (
    <div className={styles.row}>
      <DaysDrivenCard />

      <TopList
        icon={<Car size={ICON_SIZE} />}
        title={t('homePage.tops.cars')}
        entries={topCars}
      />

      <TopList
        icon={<MapIcon size={ICON_SIZE} />}
        title={t('homePage.tops.tracks')}
        entries={topTracks}
      />
    </div>
  );
});

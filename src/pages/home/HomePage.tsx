import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { FolderSearch } from 'lucide-react';

import { ImportNote } from '@features/statistics/ImportNote/ImportNote';
import { useStatisticsStore } from '@features/statistics/statistics-context';
import { PageTitle } from '@shared/ui/PageTitle/PageTitle';
import { AutologHint } from './AutologHint';
import { DaysDrivenCard } from './DaysDrivenCard';
import { HomeKpis } from './HomeKpis';
import { IratingChart } from './IratingChart';
import { LastRaceCard } from './LastRaceCard';
import { NowColumn } from './NowColumn';
import { RecentSessionsTable } from './RecentSessionsTable';
import { TopByTime } from './TopByTime';
import styles from './HomePage.module.scss';

const EMPTY_ICON_SIZE = 28;

/** The driver's statistics; until there are any, what will fill this page. */
export const HomePage = observer(() => {
  const { t } = useTranslation('main-app');
  const statistics = useStatisticsStore();

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <PageTitle title={t('homePage.title')} actions={<ImportNote />} />

        <AutologHint />

        {statistics.hasSessions ? (
          <>
            <HomeKpis />

            <DaysDrivenCard />

            <div className={styles.chartRow}>
              <IratingChart />

              <LastRaceCard />
            </div>

            <RecentSessionsTable />

            <TopByTime />
          </>
        ) : (
          <div className={styles.empty}>
            <FolderSearch size={EMPTY_ICON_SIZE} className={styles.emptyIcon} />

            <p className={styles.emptyTitle}>{t('homePage.emptyTitle')}</p>

            <p className={styles.emptyText}>{t('homePage.emptyText')}</p>

            <p className={styles.emptyText}>{t('homePage.emptyKept')}</p>
          </div>
        )}
      </div>

      <NowColumn />
    </div>
  );
});

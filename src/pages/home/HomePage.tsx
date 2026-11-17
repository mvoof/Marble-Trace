import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { FolderSearch } from 'lucide-react';

import { ImportNote } from '@features/statistics/ImportNote/ImportNote';
import { useStatisticsStore } from '@features/statistics/statistics-context';
import { SessionsTable } from '@features/statistics/SessionsTable/SessionsTable';
import { useLapAnalysisStore } from '@features/lap-analysis/lap-analysis-context';
import { SessionLapsModal } from '@features/lap-analysis/SessionLapsModal/SessionLapsModal';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import { PageTitle } from '@shared/ui/PageTitle/PageTitle';
import { AutologHint } from './AutologHint';
import { CalendarRow } from './CalendarRow';
import { HomeKpis } from './HomeKpis';
import { NowStrip } from './NowStrip';
import styles from './HomePage.module.scss';

const EMPTY_ICON_SIZE = 28;

/** The driver's statistics; until there are any, what will fill this page. */
export const HomePage = observer(() => {
  const { t } = useTranslation('main-app');
  const statistics = useStatisticsStore();
  const analysis = useLapAnalysisStore();
  const navigation = useMainNavigationStore();

  return (
    <div className={styles.page}>
      <PageTitle
        title={
          statistics.driverFirstName === null
            ? t('homePage.greetingNoName')
            : t('homePage.greeting', { name: statistics.driverFirstName })
        }
        actions={<ImportNote />}
      />

      <NowStrip />

      <AutologHint />

      {statistics.hasSessions ? (
        <>
          <HomeKpis />

          <CalendarRow />

          <SessionsTable
            onOpenSession={(key) => void analysis.openSession(key)}
          />

          <SessionLapsModal
            onOpenAnalysis={() => navigation.open('analysis')}
            onSessionDeleted={() => void statistics.loadSessions()}
          />
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
  );
});

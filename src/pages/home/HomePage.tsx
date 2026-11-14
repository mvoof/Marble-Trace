import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { FolderSearch } from 'lucide-react';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import { PageTitle } from '@shared/ui/PageTitle/PageTitle';
import { ImportNote } from './ImportNote';
import { RecentSessionsTable } from './RecentSessionsTable';
import styles from './HomePage.module.scss';

const EMPTY_ICON_SIZE = 28;

/** The driver's statistics; until there are any, what will fill this page. */
export const HomePage = observer(() => {
  const { t } = useTranslation('main-app');
  const statistics = useStatisticsStore();

  return (
    <div className={styles.page}>
      <PageTitle title={t('homePage.title')} actions={<ImportNote />} />

      {statistics.hasSessions ? (
        <RecentSessionsTable />
      ) : (
        <div className={styles.empty}>
          <FolderSearch size={EMPTY_ICON_SIZE} className={styles.emptyIcon} />

          <p className={styles.emptyTitle}>{t('homePage.emptyTitle')}</p>

          <p className={styles.emptyText}>{t('homePage.emptyText')}</p>
        </div>
      )}
    </div>
  );
});

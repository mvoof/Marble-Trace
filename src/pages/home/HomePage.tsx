import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { FolderSearch } from 'lucide-react';
import styles from './HomePage.module.scss';

const EMPTY_ICON_SIZE = 28;

/** The driver's statistics; until there are any, what will fill this page. */
export const HomePage = observer(() => {
  const { t } = useTranslation('main-app');

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('homePage.title')}</h1>

      <div className={styles.empty}>
        <FolderSearch size={EMPTY_ICON_SIZE} className={styles.emptyIcon} />

        <p className={styles.emptyTitle}>{t('homePage.emptyTitle')}</p>

        <p className={styles.emptyText}>{t('homePage.emptyText')}</p>
      </div>
    </div>
  );
});

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { FolderX, LoaderCircle, Pause } from 'lucide-react';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import styles from './ImportNote.module.scss';

const NOTE_ICON_SIZE = 14;

/** What the stats import is doing, beside the page title; nothing once idle. */
export const ImportNote = observer(() => {
  const { t } = useTranslation('main-app');
  const { importStatus } = useStatisticsStore();

  if (importStatus.phase === 'reading') {
    return (
      <span className={styles.note}>
        <LoaderCircle size={NOTE_ICON_SIZE} className={styles.spinner} />
        {t('homePage.import.reading')}

        <span className={styles.count}>
          {importStatus.done} / {importStatus.total}
        </span>
      </span>
    );
  }

  if (importStatus.phase === 'paused') {
    return (
      <span className={styles.note}>
        <Pause size={NOTE_ICON_SIZE} />
        {t('homePage.import.paused')}
      </span>
    );
  }

  if (importStatus.phase === 'noFolder') {
    return (
      <span className={styles.note}>
        <FolderX size={NOTE_ICON_SIZE} />
        {t('homePage.import.noFolder')}
      </span>
    );
  }

  return null;
});

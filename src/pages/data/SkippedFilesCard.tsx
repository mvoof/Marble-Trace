import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import { fileName } from './file-name';
import dataStyles from './DataPage.module.scss';
import styles from './StatisticsSection.module.scss';

/** The files the import could not read, and what the reader said of each. */
export const SkippedFilesCard = observer(() => {
  const { t } = useTranslation('main-app');
  const { skippedFiles } = useStatisticsStore();

  const title = (
    <>
      {t('dataPage.statistics.skippedTitle')}

      <span className={styles.count}> · {skippedFiles.length}</span>
    </>
  );

  if (skippedFiles.length === 0) {
    return (
      <SettingsCard title={title}>
        <div className={dataStyles.fieldDesc}>
          {t('dataPage.statistics.skippedNone')}
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title={title}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('dataPage.statistics.skippedFile')}</th>

              <th>{t('dataPage.statistics.skippedReason')}</th>
            </tr>
          </thead>

          <tbody>
            {skippedFiles.map((file) => (
              <tr key={file.path}>
                <td className={styles.path} title={file.path}>
                  {fileName(file.path)}
                </td>

                <td className={styles.reason}>{file.error ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsCard>
  );
});

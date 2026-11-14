import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Flex } from 'antd';
import { FolderOpen, RefreshCw } from 'lucide-react';

import { useSimStore } from '@entities/sim/sim-context';
import { ImportNote } from '@features/statistics/ImportNote/ImportNote';
import { useStatisticsStore } from '@features/statistics/statistics-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import { SkippedFilesCard } from './SkippedFilesCard';
import dataStyles from './DataPage.module.scss';
import styles from './StatisticsSection.module.scss';

const BUTTON_ICON_SIZE = 14;

/** Where statistics come from: the `.ibt` folder, the import, skipped files. */
export const StatisticsSection = observer(() => {
  const { t } = useTranslation('main-app');
  const { message } = App.useApp();
  const statistics = useStatisticsStore();
  const sim = useSimStore();

  const { folder, autolog, importStatus } = statistics;

  const folderNote = () => {
    if (folder?.path == null) {
      return t('dataPage.statistics.folderMissing');
    }

    if (folder.isDefault) {
      return t('dataPage.statistics.folderDefault');
    }

    return t('dataPage.statistics.folderChosen');
  };

  const changeFolder = async (change: () => Promise<void>) => {
    try {
      await change();
    } catch (error) {
      message.error(
        t('dataPage.statistics.folderRefused', { reason: String(error) })
      );
    }
  };

  const handleReimport = async () => {
    try {
      await statistics.reimport();

      // The import never reads while the game runs: it waits for it to close.
      if (sim.status === 'connected') {
        message.info(t('dataPage.statistics.reimportQueued'));
      } else {
        message.success(t('dataPage.statistics.reimportStarted'));
      }
    } catch (error) {
      message.error(String(error));
    }
  };

  return (
    <>
      <SettingsCard title={t('dataPage.statistics.folderTitle')}>
        <div className={dataStyles.fieldGroup}>
          <div className={dataStyles.fieldRow}>
            <div className={dataStyles.fieldTexts}>
              <div className={`${dataStyles.fieldTitle} ${styles.path}`}>
                {folder?.path ?? '—'}
              </div>

              <div className={dataStyles.fieldDesc}>{folderNote()}</div>
            </div>

            <Flex gap={8}>
              {folder !== null && !folder.isDefault && (
                <Button
                  size="small"
                  onClick={() =>
                    void changeFolder(() => statistics.useDefaultFolder())
                  }
                >
                  {t('dataPage.statistics.useDefault')}
                </Button>
              )}

              <Button
                size="small"
                icon={<FolderOpen size={BUTTON_ICON_SIZE} />}
                onClick={() =>
                  void changeFolder(() => statistics.chooseFolder())
                }
              >
                {t('dataPage.statistics.change')}
              </Button>
            </Flex>
          </div>
        </div>

        <div className={dataStyles.fieldGroup}>
          <div className={dataStyles.fieldRow}>
            <div className={dataStyles.fieldTexts}>
              <div className={dataStyles.fieldTitle}>
                {t('dataPage.statistics.loggingTitle')}
              </div>
            </div>

            <span className={styles.state}>
              <span
                className={`${styles.dot} ${autolog === 'on' ? styles.dotOn : ''}`}
              />
              {t(`dataPage.statistics.logging.${autolog ?? 'unknown'}`)}
            </span>
          </div>
        </div>

        <div className={dataStyles.fieldGroup}>
          <div className={dataStyles.fieldRow}>
            <div className={dataStyles.fieldTexts}>
              <div className={dataStyles.fieldTitle}>
                {t('dataPage.statistics.importTitle')}
              </div>

              <div className={dataStyles.fieldDesc}>
                {t('dataPage.statistics.reimportDesc')}
              </div>
            </div>

            <Flex gap={8} align="center">
              {importStatus.phase === 'idle' ? (
                <span className={styles.state}>
                  {t('dataPage.statistics.importIdle')}
                </span>
              ) : (
                <ImportNote />
              )}

              <Button
                size="small"
                icon={<RefreshCw size={BUTTON_ICON_SIZE} />}
                disabled={importStatus.phase === 'reading'}
                onClick={() => void handleReimport()}
              >
                {t('dataPage.statistics.reimport')}
              </Button>
            </Flex>
          </div>
        </div>
      </SettingsCard>

      <SkippedFilesCard />
    </>
  );
});

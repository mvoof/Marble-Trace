import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { Download, FolderOpen, Upload } from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './CrewPage.module.scss';

/** The user's pack on disk: open it, share it, take one in. */
export const CrewPackFiles = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const folder = crew.pack?.folder;

  return (
    <SettingsCard title={t('crewPage.pack.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>{t('crewPage.pack.folder')}</div>

            <div className={`${styles.fieldDesc} ${styles.mono}`}>{folder}</div>

            <div className={styles.fieldHint}>
              {t('crewPage.pack.folderDesc')}
            </div>
          </div>

          <Button
            icon={<FolderOpen size={14} />}
            disabled={!folder}
            onClick={() => folder && crew.revealFolder(folder)}
          >
            {t('crewPage.openFolder')}
          </Button>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>{t('crewPage.pack.share')}</div>

            <div className={styles.fieldDesc}>
              {t('crewPage.pack.shareDesc')}
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              icon={<Upload size={14} />}
              onClick={() => void crew.exportPack()}
            >
              {t('crewPage.pack.export')}
            </Button>

            <Button
              icon={<Download size={14} />}
              onClick={() => void crew.importPack()}
            >
              {t('crewPage.pack.import')}
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>{t('crewPage.pack.reload')}</div>

            <div className={styles.fieldDesc}>
              {t('crewPage.pack.reloadDesc')}
            </div>
          </div>

          <Button onClick={() => void crew.loadPack()}>
            {t('crewPage.pack.reloadButton')}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
});

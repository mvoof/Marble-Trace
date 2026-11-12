import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Alert, App, Button, Tooltip } from 'antd';
import { Download, FileText, FolderOpen, Upload } from 'lucide-react';
import type { PackFileFailure } from '@features/voice-crew/voice-crew.store';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './CrewPage.module.scss';
import { useMistakeText } from './useMistakeText';

/** The user's pack on disk: open it, share it, take one in. */
export const CrewPackFiles = observer(() => {
  const crew = useVoiceCrewStore();
  const { t, i18n } = useTranslation('main-app');
  const { message } = App.useApp();
  const { mistakeText } = useMistakeText();
  const folder = crew.pack?.folder;
  const failure = crew.packFileFailure;

  const failureText = ({ action, error }: PackFileFailure): string => {
    if (error.code === 'notAnArchive') {
      return t('crewPage.pack.errors.notAnArchive');
    }

    if (error.code === 'noPack') {
      return action === 'export'
        ? t('crewPage.pack.errors.noPackExport')
        : t('crewPage.pack.errors.noPackImport');
    }

    if (error.code === 'brokenFile') {
      return t('crewPage.pack.errors.brokenFile', {
        file: error.file,
        mistake: mistakeText(error.mistake),
      });
    }

    return error.detail;
  };

  const exportPack = async () => {
    const done = await crew.exportPack();

    if (done?.action === 'exported') {
      void message.success(t('crewPage.pack.exported', { path: done.path }));
    }
  };

  const exportSheet = async () => {
    const done = await crew.exportSheet((language) =>
      i18n.getFixedT(language, 'main-app')
    );

    if (done?.action === 'sheetExported') {
      void message.success(
        t('crewPage.pack.sheetExported', { path: done.path })
      );
    }
  };

  const failureTitle = (action: PackFileFailure['action']): string => {
    if (action === 'sheet') {
      return t('crewPage.pack.sheetFailed');
    }

    return action === 'export'
      ? t('crewPage.pack.exportFailed')
      : t('crewPage.pack.importFailed');
  };

  const importPack = async () => {
    const done = await crew.importPack();

    if (done) {
      void message.success(t('crewPage.pack.imported'));
    }
  };

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
              disabled={crew.busy}
              onClick={() => void exportPack()}
            >
              {t('crewPage.pack.export')}
            </Button>

            <Button
              icon={<Download size={14} />}
              disabled={crew.busy}
              onClick={() => void importPack()}
            >
              {t('crewPage.pack.import')}
            </Button>
          </div>
        </div>

        {failure && (
          <Alert
            type="error"
            showIcon
            closable={{ onClose: () => crew.dismissPackFileFailure() }}
            title={failureTitle(failure.action)}
            description={failureText(failure)}
          />
        )}

        {crew.importedSwitchedOff.length > 0 && (
          <Alert
            type="warning"
            showIcon
            closable={{ onClose: () => crew.dismissImportedSwitchedOff() }}
            title={t('crewPage.pack.switchedOff')}
            description={crew.importedSwitchedOff.join(', ')}
          />
        )}
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>{t('crewPage.pack.sheet')}</div>

            <div className={styles.fieldDesc}>
              {t('crewPage.pack.sheetDesc')}
            </div>
          </div>

          <Tooltip
            title={crew.dirty ? t('crewPage.pack.sheetSaveFirst') : null}
          >
            <Button
              icon={<FileText size={14} />}
              disabled={crew.busy || crew.dirty || !crew.pack}
              onClick={() => void exportSheet()}
            >
              {t('crewPage.pack.sheetButton')}
            </Button>
          </Tooltip>
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

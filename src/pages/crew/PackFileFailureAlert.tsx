import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Alert } from 'antd';
import type { PackFileFailure } from '@features/voice-crew/voice-crew.store';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import styles from './CrewPage.module.scss';
import { useMistakeText } from './useMistakeText';

interface PackFileFailureAlertProps {
  /** The ways this section starts; a failure of another shows elsewhere. */
  actions: readonly PackFileFailure['action'][];
}

/** The last pack export, import or sheet that failed, until dismissed. */
export const PackFileFailureAlert = observer(
  ({ actions }: PackFileFailureAlertProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const { mistakeText } = useMistakeText();
    const failure = crew.packFileFailure;

    if (!failure || !actions.includes(failure.action)) {
      return null;
    }

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

    const failureTitle = (action: PackFileFailure['action']): string => {
      if (action === 'sheet') {
        return t('crewPage.pack.sheetFailed');
      }

      return action === 'export'
        ? t('crewPage.pack.exportFailed')
        : t('crewPage.pack.importFailed');
    };

    return (
      <Alert
        className={styles.fileAlert}
        type="error"
        showIcon
        closable={{ onClose: () => crew.dismissPackFileFailure() }}
        title={failureTitle(failure.action)}
        description={failureText(failure)}
      />
    );
  }
);

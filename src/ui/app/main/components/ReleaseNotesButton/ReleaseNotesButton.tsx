import { useState } from 'react';
import { Button, Modal } from 'antd';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useAppSettingsStore } from '@store/root-store-context';
import styles from './ReleaseNotesButton.module.scss';

export const ReleaseNotesButton = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const [isOpen, setIsOpen] = useState(false);
  const { releaseNotes, availableVersion } = appSettings;

  if (!releaseNotes) return null;

  return (
    <>
      <Button size="small" type="text" onClick={() => setIsOpen(true)}>
        {t('releaseNotes.whatsNew')}
      </Button>

      <Modal
        title={
          availableVersion
            ? t('releaseNotes.titleWithVersion', { version: availableVersion })
            : t('releaseNotes.title')
        }
        open={isOpen}
        onCancel={() => setIsOpen(false)}
        footer={null}
        width={520}
      >
        <pre className={styles.notes}>{releaseNotes}</pre>
      </Modal>
    </>
  );
});

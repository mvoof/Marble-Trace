import { useState } from 'react';
import { Button, Modal } from 'antd';
import { observer } from 'mobx-react-lite';
import { appSettingsStore } from '@/store/app-settings.store';
import styles from './ReleaseNotesButton.module.scss';

export const ReleaseNotesButton = observer(() => {
  const [isOpen, setIsOpen] = useState(false);
  const { releaseNotes, availableVersion } = appSettingsStore;

  if (!releaseNotes) return null;

  return (
    <>
      <Button size="small" type="text" onClick={() => setIsOpen(true)}>
        What&apos;s new
      </Button>

      <Modal
        title={`What's new in v${availableVersion}`}
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

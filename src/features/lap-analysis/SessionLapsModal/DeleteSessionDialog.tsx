import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Checkbox, Modal } from 'antd';

import { useLapAnalysisStore } from '../lap-analysis-context';
import styles from './SessionLapsModal.module.scss';

interface DeleteSessionDialogProps {
  open: boolean;
  onClose: () => void;
  /** The session is gone: whatever lists sessions loads them again. */
  onDeleted?: () => void;
}

/** Asks before the modal's session leaves the database; its files stay unless ticked. */
export const DeleteSessionDialog = observer(
  ({ open, onClose, onDeleted }: DeleteSessionDialogProps) => {
    const { t } = useTranslation('main-app');
    const { message } = App.useApp();
    const analysis = useLapAnalysisStore();
    const [deleteFiles, setDeleteFiles] = useState(false);
    const [isDeleting, setDeleting] = useState(false);

    const handleClose = () => {
      setDeleteFiles(false);
      onClose();
    };

    const handleDelete = async () => {
      setDeleting(true);
      const deleted = await analysis.deleteSession(deleteFiles);
      setDeleting(false);

      if (!deleted) {
        void message.error(t('homePage.sessionLaps.deleteFailed'));

        return;
      }

      handleClose();
      onDeleted?.();
    };

    return (
      <Modal
        open={open}
        title={t('homePage.sessionLaps.deleteTitle')}
        okText={t('homePage.sessionLaps.delete')}
        okButtonProps={{ danger: true, loading: isDeleting }}
        onOk={() => void handleDelete()}
        onCancel={handleClose}
      >
        <p className={styles.deleteText}>
          {t('homePage.sessionLaps.deleteText')}
        </p>

        <Checkbox
          checked={deleteFiles}
          onChange={(event) => setDeleteFiles(event.target.checked)}
        >
          {t('homePage.sessionLaps.deleteFiles')}
        </Checkbox>
      </Modal>
    );
  }
);

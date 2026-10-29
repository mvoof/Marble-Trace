import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from 'antd';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';

interface CrewLeaveDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

/**
 * Asked on leaving the crew with unsaved edits: save them, drop them, or
 * stay. Edits left behind would outlive a change of language and be checked
 * against the wrong one.
 */
export const CrewLeaveDialog = observer(
  ({ open, onStay, onLeave }: CrewLeaveDialogProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const saveAndLeave = async () => {
      await crew.savePack();

      if (!crew.dirty) {
        onLeave();
      }
    };
    const discardAndLeave = () => {
      crew.discardEdits();
      onLeave();
    };

    return (
      <Modal
        open={open}
        title={t('crewPage.leave.title')}
        onCancel={onStay}
        footer={[
          <Button key="stay" onClick={onStay}>
            {t('crewPage.leave.stay')}
          </Button>,
          <Button key="discard" danger onClick={discardAndLeave}>
            {t('crewPage.leave.discard')}
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={crew.busy}
            onClick={() => void saveAndLeave()}
          >
            {t('crewPage.save')}
          </Button>,
        ]}
      >
        {t('crewPage.leave.desc')}
      </Modal>
    );
  }
);

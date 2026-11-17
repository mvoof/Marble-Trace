import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal } from 'antd';
import { Plus } from 'lucide-react';

import { useLayoutGestureStores } from '@features/layout-editor/layout-editor-context';
import { createLayout } from '@features/layout-editor/layout-gestures';

/**
 * "New layout" and the dialog that names it. The name being typed lives here —
 * it lasts one gesture.
 */
export const CreateLayoutButton = observer(() => {
  const gestureStores = useLayoutGestureStores();
  const { t } = useTranslation('main-app');

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = () => {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    void createLayout(gestureStores, trimmed);
    setName('');
    setIsOpen(false);
  };

  return (
    <>
      <Button
        type="primary"
        icon={<Plus size={16} />}
        onClick={() => {
          setName('');
          setIsOpen(true);
        }}
      >
        {t('layoutList.newLayout')}
      </Button>

      <Modal
        title={t('layoutList.createNewLayout')}
        open={isOpen}
        onOk={handleCreate}
        onCancel={() => setIsOpen(false)}
        okText={t('layoutEditor.create')}
        cancelText={t('layoutEditor.cancel')}
      >
        <Input
          placeholder={t('layoutList.enterLayoutName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onPressEnter={handleCreate}
          style={{ marginTop: '12px' }}
        />
      </Modal>
    </>
  );
});

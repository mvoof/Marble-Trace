import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button } from 'antd';
import { Upload } from 'lucide-react';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useLayoutFilesStore } from '@features/layout-files/layout-files-context';

/** "Import": adds a layout from a file another Marble Trace exported. */
export const ImportLayoutButton = observer(() => {
  const layouts = useLayoutsStore();
  const layoutFiles = useLayoutFilesStore();
  const { t } = useTranslation('main-app');
  const { message } = App.useApp();
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);

    try {
      const id = await layoutFiles.importLayout();
      const name = id === null ? undefined : layouts.byId(id)?.name;

      if (name !== undefined) {
        void message.success(t('layoutList.imported', { name }));
      }
    } catch {
      void message.error(t('layoutList.importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Button
      icon={<Upload size={16} />}
      loading={isImporting}
      onClick={() => void handleImport()}
    >
      {t('layoutList.import')}
    </Button>
  );
});

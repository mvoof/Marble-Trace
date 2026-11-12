import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from 'antd';
import { Redo2, Undo2 } from 'lucide-react';

import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';

/** Undo and redo of the editor's geometry edits. */
export const HistoryButtons = observer(() => {
  const liveWidgets = useMainLiveWidgetsStore();
  const { t } = useTranslation('main-app');

  return (
    <>
      <Tooltip title={t('layoutEditor.undoTooltip')}>
        <Button
          size="small"
          type="text"
          icon={<Undo2 size={14} />}
          disabled={!liveWidgets.history.canUndo}
          onClick={() => liveWidgets.undo()}
        />
      </Tooltip>

      <Tooltip title={t('layoutEditor.redoTooltip')}>
        <Button
          size="small"
          type="text"
          icon={<Redo2 size={14} />}
          disabled={!liveWidgets.history.canRedo}
          onClick={() => liveWidgets.redo()}
        />
      </Tooltip>
    </>
  );
});

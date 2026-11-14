import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Redo2, Undo2 } from 'lucide-react';

import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';

import { ToolbarButton } from './ToolbarButton';
import { ToolbarCluster } from './ToolbarCluster';

/** Undo and redo of the editor's edits. */
export const HistoryButtons = observer(() => {
  const liveWidgets = useMainLiveWidgetsStore();
  const { t } = useTranslation('main-app');

  return (
    <ToolbarCluster>
      <ToolbarButton
        icon={Undo2}
        title={t('layoutEditor.undoTooltip')}
        isDisabled={!liveWidgets.history.canUndo}
        onClick={() => liveWidgets.undo()}
      />

      <ToolbarButton
        icon={Redo2}
        title={t('layoutEditor.redoTooltip')}
        isDisabled={!liveWidgets.history.canRedo}
        onClick={() => liveWidgets.redo()}
      />
    </ToolbarCluster>
  );
});

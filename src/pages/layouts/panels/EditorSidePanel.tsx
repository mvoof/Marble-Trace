import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from 'antd';
import { PanelLeftClose, PanelRightClose } from 'lucide-react';

import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import { cx } from '@shared/lib/class-names';

import styles from './EditorSidePanel.module.scss';

type PanelSide = 'left' | 'right';

const PANEL_CLASSES: Record<
  PanelSide,
  { docked: string; drawer: string; drawerOpen: string }
> = {
  left: {
    docked: styles.panel,
    drawer: styles.panelDrawer,
    drawerOpen: styles.panelDrawerOpen,
  },
  right: {
    docked: styles.inspector,
    drawer: styles.inspectorDrawer,
    drawerOpen: styles.inspectorDrawerOpen,
  },
};

interface EditorSidePanelProps {
  side: PanelSide;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A column beside the canvas — the widget list on the left, the inspector on
 * the right. While the canvas fills the view it becomes a drawer over the
 * canvas, with a header to close it, so opening it never rescales the canvas.
 */
export const EditorSidePanel = observer(
  ({ side, title, isOpen, onClose, children }: EditorSidePanelProps) => {
    const editorUi = useLayoutEditorUiStore();
    const { t } = useTranslation('main-app');
    const isCanvasOnly = editorUi.isCanvasOnly;
    const classes = PANEL_CLASSES[side];
    const CloseIcon = side === 'left' ? PanelLeftClose : PanelRightClose;

    return (
      <aside
        className={cx(
          isCanvasOnly ? classes.drawer : classes.docked,
          isCanvasOnly && isOpen && classes.drawerOpen
        )}
      >
        {isCanvasOnly && (
          <div className={styles.panelDrawerHeader}>
            <span className={styles.panelDrawerTitle}>{title}</span>
            <Tooltip title={t('layoutEditor.hidePanel')}>
              <Button
                size="small"
                type="text"
                icon={<CloseIcon size={16} />}
                onClick={onClose}
              />
            </Tooltip>
          </div>
        )}

        {children}
      </aside>
    );
  }
);

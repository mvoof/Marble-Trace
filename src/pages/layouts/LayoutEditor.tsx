import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ConfigProvider } from 'antd';

import { useLayoutEditorStore } from '@features/layout-editor/layout-editor-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import { cx } from '@shared/lib/class-names';

import { LayoutCanvas } from './canvas/LayoutCanvas';
import { LayoutList } from './list/LayoutList';
import { MonitorMap, MonitorMapFolded } from './monitor-map/MonitorMap';
import { EditorSidePanel } from './panels/EditorSidePanel';
import { LayoutWidgetPanel } from './panels/LayoutWidgetPanel';
import { WidgetInspector } from './panels/WidgetInspector';
import { EditorToolbar } from './toolbar/EditorToolbar';
import { useToolbarBottom } from './use-toolbar-bottom';
import styles from './LayoutEditor.module.scss';

type EditorMode = 'list' | 'editor';

/**
 * The Layouts tab: the list of layouts, or the editor of one. The editor's
 * view state is `LayoutEditorUiStore`'s; this component lays the toolbar, the
 * widget panel, the canvas and the inspector out around it.
 */
export const LayoutEditor = observer(
  ({
    mode = 'list',
    onModeChange,
  }: {
    mode?: EditorMode;
    onModeChange?: (mode: EditorMode) => void;
  }) => {
    const layoutEditor = useLayoutEditorStore();
    const editorUi = useLayoutEditorUiStore();
    const { t } = useTranslation('main-app');

    const [localMode, setLocalMode] = useState<EditorMode>('list');
    const rootRef = useRef<HTMLDivElement | null>(null);
    const toolbarRef = useToolbarBottom(rootRef);

    const activeMode = onModeChange ? mode : localMode;

    const handleModeChange = (nextMode: EditorMode) => {
      if (onModeChange) {
        onModeChange(nextMode);
      } else {
        setLocalMode(nextMode);
      }
    };

    // Which layout is on screen is the store's to remember, not this
    // component's: opening the editor pins it, and everything the user does in
    // here moves the edited layout only until they put it on screen.
    const handleOpenEditorWithId = (id: string) => {
      layoutEditor.setOpen(true);
      layoutEditor.switchLayout(id);

      handleModeChange('editor');
    };

    // Closing hands the screen's layout back as the one being edited; the
    // session auto-switch never stands down, so the overlay has been following
    // the session the whole time the editor was open.
    //
    // The cleanup is registered only on the branch that opened the session,
    // and that is what makes this safe to re-read. React tears the previous
    // effect down before running the new one, so a cleanup that closed
    // unconditionally would close the session the click handler had just
    // opened — handing the editor back the layout that was live instead of the
    // one that was clicked.
    useEffect(() => {
      if (activeMode !== 'editor') {
        layoutEditor.setOpen(false);
        // The next layout opened starts on the overview, not on a screen
        // this one had in focus.
        editorUi.showOverview();

        return;
      }

      layoutEditor.setOpen(true);

      return () => {
        layoutEditor.setOpen(false);
      };
    }, [activeMode, layoutEditor, editorUi]);

    useEffect(() => {
      const onFullscreenChange = () =>
        editorUi.setFullscreen(!!document.fullscreenElement);

      document.addEventListener('fullscreenchange', onFullscreenChange);

      return () =>
        document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, [editorUi]);

    const isCanvasOnly = editorUi.isCanvasOnly;
    const dialogContainer = () => rootRef.current ?? document.body;

    if (activeMode === 'list') {
      return <LayoutList onOpenEditor={handleOpenEditorWithId} />;
    }

    return (
      <ConfigProvider getPopupContainer={dialogContainer}>
        <div
          className={cx(styles.root, isCanvasOnly && styles.rootFullscreen)}
          ref={rootRef}
        >
          <EditorToolbar
            rootRef={rootRef}
            toolbarRef={toolbarRef}
            dialogContainer={dialogContainer}
            onBack={() => handleModeChange('list')}
          />

          <div
            className={cx(
              styles.workspace,
              isCanvasOnly && styles.workspaceFullscreen
            )}
          >
            {!isCanvasOnly &&
              (editorUi.isArrangementShown ? (
                <MonitorMap />
              ) : (
                <MonitorMapFolded />
              ))}

            <div
              className={cx(styles.body, isCanvasOnly && styles.bodyFullscreen)}
            >
              <EditorSidePanel
                side="left"
                title={t('layoutEditor.widgetsPanelTitle')}
                isOpen={editorUi.isPanelOpen}
                onClose={() => editorUi.setPanelOpen(false)}
              >
                <LayoutWidgetPanel />
              </EditorSidePanel>

              <main
                className={cx(
                  styles.canvas,
                  isCanvasOnly && styles.canvasFullscreen
                )}
              >
                <LayoutCanvas />
              </main>

              <EditorSidePanel
                side="right"
                title={t('layoutEditor.inspectorTitle')}
                isOpen={editorUi.isInspectorOpen}
                onClose={() => editorUi.setInspectorOpen(false)}
              >
                <WidgetInspector />
              </EditorSidePanel>
            </div>
          </div>
        </div>
      </ConfigProvider>
    );
  }
);

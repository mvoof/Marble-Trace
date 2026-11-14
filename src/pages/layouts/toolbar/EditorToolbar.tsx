import type { CSSProperties, RefObject } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LayoutDashboard,
  Maximize2,
  Monitor,
  PanelLeft,
  PanelRight,
  Play,
  type LucideIcon,
} from 'lucide-react';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useLayoutEditorStore } from '@features/layout-editor/layout-editor-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import type { EditorViewMode } from '@features/layout-editor/layout-editor-ui.store';
import { cx } from '@shared/lib/class-names';

import { AddWidgetMenu } from './AddWidgetMenu';
import { HistoryButtons } from './HistoryButtons';
import { MonitorPicker } from './MonitorPicker';
import { MoreMenu } from './MoreMenu';
import { ScenarioPicker } from './ScenarioPicker';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarCluster, ToolbarSeparator } from './ToolbarCluster';
import { ToolbarCompactContext } from './toolbar-compact-context';
import { useDockDrag } from './use-dock-drag';
import styles from './EditorToolbar.module.scss';

const GRIP_ICON_SIZE = 14;

const VIEW_MODES: {
  mode: EditorViewMode;
  icon: LucideIcon;
  labelKey: string;
  tooltipKey: string;
}[] = [
  {
    mode: 'overview',
    icon: LayoutDashboard,
    labelKey: 'layoutEditor.viewOverview',
    tooltipKey: 'layoutEditor.viewOverviewTooltip',
  },
  {
    mode: 'fullSize',
    icon: Maximize2,
    labelKey: 'layoutEditor.viewFullSize',
    tooltipKey: 'layoutEditor.viewFullSizeTooltip',
  },
  {
    mode: 'fullscreen',
    icon: Monitor,
    labelKey: 'layoutEditor.viewFullscreen',
    tooltipKey: 'layoutEditor.viewFullscreenTooltip',
  },
];

interface EditorToolbarProps {
  /** The editor's root: what goes fullscreen. */
  rootRef: RefObject<HTMLDivElement | null>;
  /**
   * Measured by the editor rather than here: `useToolbarBottom` needs the
   * root attached, which a child's layout effect runs too early to see.
   */
  toolbarRef: RefObject<HTMLElement | null>;
  dialogContainer: () => HTMLElement;
  onBack: () => void;
}

/**
 * The editor's bar, one row, the same groups in every view:
 * `[← / panel] [name · active] | [monitor · + Widget] | [undo · redo] …
 * [scenario · mode · …] [inspector]`. In the overview it is a band above the
 * map; while the canvas fills the view it is a pill of icons floating over
 * the canvas, dragged by its grip.
 */
export const EditorToolbar = observer(
  ({ rootRef, toolbarRef, dialogContainer, onBack }: EditorToolbarProps) => {
    const layouts = useLayoutsStore();
    const layoutEditor = useLayoutEditorStore();
    const editorUi = useLayoutEditorUiStore();
    const { t } = useTranslation('main-app');
    const isCanvasOnly = editorUi.isCanvasOnly;
    const { offset, handleGripPointerDown } = useDockDrag(editorUi.viewMode);

    // Fullscreen belongs to the browser: the store learns of it from the
    // document's event, so the other two views only have to leave it.
    const handleViewModeChange = (viewMode: EditorViewMode) => {
      if (viewMode === 'fullscreen') {
        void rootRef.current?.requestFullscreen();

        return;
      }

      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }

      if (viewMode === 'overview') {
        editorUi.showOverview();
      } else {
        editorUi.showFullSize();
      }
    };

    const dockStyle = {
      '--dock-x': `${offset.x}px`,
      '--dock-y': `${offset.y}px`,
    } as CSSProperties;

    return (
      <ToolbarCompactContext.Provider value={isCanvasOnly}>
        <header
          ref={toolbarRef}
          className={cx(styles.toolbar, isCanvasOnly && styles.toolbarFloating)}
          style={isCanvasOnly ? dockStyle : undefined}
        >
          {isCanvasOnly && (
            <span
              className={styles.grip}
              title={t('layoutEditor.dragToolbar')}
              onPointerDown={handleGripPointerDown}
            >
              <GripVertical size={GRIP_ICON_SIZE} />
            </span>
          )}

          {isCanvasOnly ? (
            <ToolbarButton
              icon={PanelLeft}
              title={t('layoutEditor.toggleWidgetPanel')}
              isOn={editorUi.isPanelOpen}
              onClick={() => editorUi.setPanelOpen(!editorUi.isPanelOpen)}
            />
          ) : (
            <ToolbarButton
              icon={ArrowLeft}
              label={t('layoutEditor.layouts')}
              isLabelCollapsible
              title={t('layoutEditor.backToLayouts')}
              onClick={onBack}
            />
          )}

          <ToolbarCluster>
            <span className={styles.name}>{layouts.editingLayout?.name}</span>

            {layoutEditor.previewMode ? (
              <ToolbarButton
                icon={Play}
                label={t('layoutEditor.makeActive')}
                isLabelCollapsible
                title={t('layoutEditor.applyLayoutTooltip')}
                onClick={() => layoutEditor.activateLayout()}
              />
            ) : (
              <span className={styles.activeChip}>
                <span className={styles.activeDot} />
                {t('layoutEditor.active')}
              </span>
            )}
          </ToolbarCluster>

          <ToolbarSeparator />

          <ToolbarCluster>
            <MonitorPicker dialogContainer={dialogContainer} />

            {!isCanvasOnly && (
              <ToolbarButton
                icon={editorUi.isArrangementShown ? ChevronUp : ChevronDown}
                title={
                  editorUi.isArrangementShown
                    ? t('layoutEditor.hideArrangement')
                    : t('layoutEditor.showArrangement')
                }
                onClick={() =>
                  editorUi.setArrangementShown(!editorUi.isArrangementShown)
                }
              />
            )}
          </ToolbarCluster>

          <AddWidgetMenu />

          <ToolbarSeparator />

          <HistoryButtons />

          <div className={styles.spacer} />

          <ScenarioPicker />

          <ToolbarCluster>
            {VIEW_MODES.map(({ mode, icon, labelKey, tooltipKey }) => (
              <ToolbarButton
                key={mode}
                icon={icon}
                title={`${t(labelKey)} — ${t(tooltipKey)}`}
                isOn={editorUi.viewMode === mode}
                onClick={() => handleViewModeChange(mode)}
              />
            ))}
          </ToolbarCluster>

          <MoreMenu />

          {/* Last on the bar, above the panel it opens: the toggle sits on
              the side the drawer comes from. */}
          {isCanvasOnly && (
            <ToolbarButton
              icon={PanelRight}
              title={t('layoutEditor.toggleInspector')}
              isOn={editorUi.isInspectorOpen}
              onClick={() =>
                editorUi.setInspectorOpen(!editorUi.isInspectorOpen)
              }
            />
          )}
        </header>
      </ToolbarCompactContext.Provider>
    );
  }
);

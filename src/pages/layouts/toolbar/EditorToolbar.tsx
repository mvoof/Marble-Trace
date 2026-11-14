import type { RefObject } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Segmented, Select, Tooltip } from 'antd';
import {
  ArrowLeft,
  Hash,
  LayoutDashboard,
  Maximize2,
  Monitor,
  PanelLeft,
  PanelRight,
  Play,
  Rows3,
} from 'lucide-react';

import { useDisplaysStore } from '@entities/layout/displays-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useLayoutEditorStore } from '@features/layout-editor/layout-editor-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import type { EditorViewMode } from '@features/layout-editor/layout-editor-ui.store';
import { SESSION_PREVIEW_SCENARIOS } from '@features/preview/scenarios';
import { cx } from '@shared/lib/class-names';
import { isRemoteMonitor } from '@shared/lib/remote-screen';

import { AddRemoteScreenButton } from './AddRemoteScreenButton';
import { BackgroundControls } from './BackgroundControls';
import { GridControls } from './GridControls';
import { HistoryButtons } from './HistoryButtons';
import { LayoutNameField } from './LayoutNameField';
import { MonitorPicker } from './MonitorPicker';
import styles from './EditorToolbar.module.scss';

// The canvas is seeded as a whole, so the bar offers the session-wide moments
// only — a widget's own domain scenarios belong to that widget's picker.
const SCENARIO_OPTIONS = SESSION_PREVIEW_SCENARIOS.map((scenario) => ({
  value: scenario.id,
  label: scenario.label,
}));

const SCENARIO_SELECT_MIN_WIDTH_PX = 150;

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
 * The bar above the canvas: the layout and its screens on the left, the view
 * and editing tools on the right. While the canvas fills the view — full size
 * or fullscreen — it floats over the canvas and carries the toggles of the two
 * drawers.
 */
export const EditorToolbar = observer(
  ({ rootRef, toolbarRef, dialogContainer, onBack }: EditorToolbarProps) => {
    const layouts = useLayoutsStore();
    const displays = useDisplaysStore();
    const layoutEditor = useLayoutEditorStore();
    const editorUi = useLayoutEditorUiStore();
    const { t } = useTranslation('main-app');
    const isCanvasOnly = editorUi.isCanvasOnly;

    const hasRemoteScreens = (layouts.editingLayout?.monitors ?? []).some(
      isRemoteMonitor
    );

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

    return (
      <header
        ref={toolbarRef}
        className={cx(styles.toolbar, isCanvasOnly && styles.toolbarFullscreen)}
      >
        {isCanvasOnly ? (
          <Tooltip title={t('layoutEditor.toggleWidgetPanel')}>
            <Button
              size="small"
              type={editorUi.isPanelOpen ? 'primary' : 'text'}
              icon={<PanelLeft size={14} />}
              onClick={() => editorUi.setPanelOpen(!editorUi.isPanelOpen)}
            />
          </Tooltip>
        ) : (
          <Button size="small" icon={<ArrowLeft size={14} />} onClick={onBack}>
            {t('layoutEditor.backToLayouts')}
          </Button>
        )}

        <LayoutNameField />

        {layoutEditor.previewMode ? (
          <Tooltip title={t('layoutEditor.applyLayoutTooltip')}>
            <Button
              size="small"
              type="primary"
              icon={<Play size={14} />}
              onClick={() => layoutEditor.activateLayout()}
            >
              {t('layoutEditor.makeActive')}
            </Button>
          </Tooltip>
        ) : (
          <span className={styles.activeChip}>{t('layoutEditor.active')}</span>
        )}

        {/* Beside the monitor map otherwise; the map is not drawn here. */}
        {isCanvasOnly && <AddRemoteScreenButton />}

        {hasRemoteScreens && (
          <Tooltip title={t('layoutEditor.arrangeRemoteScreensTooltip')}>
            <Button
              size="small"
              type="text"
              icon={<Rows3 size={14} />}
              onClick={() => layouts.arrangeRemoteScreens()}
            >
              {t('layoutEditor.arrangeRemoteScreens')}
            </Button>
          </Tooltip>
        )}

        <MonitorPicker dialogContainer={dialogContainer} />

        <Tooltip title={t('monitorMap.identifyTooltip')}>
          <Button
            size="small"
            icon={<Hash size={14} />}
            onClick={() => displays.identify()}
          >
            {t('monitorMap.identify')}
          </Button>
        </Tooltip>

        <div className={styles.previewControls}>
          <HistoryButtons />

          <GridControls />

          <Segmented<EditorViewMode>
            size="small"
            value={editorUi.viewMode}
            onChange={handleViewModeChange}
            options={[
              {
                value: 'overview',
                icon: <LayoutDashboard size={14} />,
                label: t('layoutEditor.viewOverview'),
                title: t('layoutEditor.viewOverviewTooltip'),
              },
              {
                value: 'fullSize',
                icon: <Maximize2 size={14} />,
                label: t('layoutEditor.viewFullSize'),
                title: t('layoutEditor.viewFullSizeTooltip'),
              },
              {
                value: 'fullscreen',
                icon: <Monitor size={14} />,
                label: t('layoutEditor.viewFullscreen'),
                title: t('layoutEditor.viewFullscreenTooltip'),
              },
            ]}
          />

          <BackgroundControls />

          <Select
            size="small"
            value={editorUi.scenarioId}
            onChange={(id) => editorUi.setScenario(id)}
            options={SCENARIO_OPTIONS}
            style={{ minWidth: SCENARIO_SELECT_MIN_WIDTH_PX }}
            popupMatchSelectWidth={false}
          />

          {/* Last on the bar, above the panel it opens: the toggle sits on
              the side the drawer comes from. */}
          {isCanvasOnly && (
            <Tooltip title={t('layoutEditor.toggleInspector')}>
              <Button
                size="small"
                type={editorUi.isInspectorOpen ? 'primary' : 'text'}
                icon={<PanelRight size={14} />}
                onClick={() =>
                  editorUi.setInspectorOpen(!editorUi.isInspectorOpen)
                }
              />
            </Tooltip>
          )}
        </div>
      </header>
    );
  }
);

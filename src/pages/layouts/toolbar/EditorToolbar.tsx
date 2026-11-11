import type { RefObject } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Select, Tooltip } from 'antd';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  PanelLeft,
  PanelRight,
  Play,
  Rows3,
} from 'lucide-react';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useLayoutEditorStore } from '@features/layout-editor/layout-editor-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
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
 * and editing tools on the right. In fullscreen it floats over the canvas and
 * carries the toggles of the two drawers.
 */
export const EditorToolbar = observer(
  ({ rootRef, toolbarRef, dialogContainer, onBack }: EditorToolbarProps) => {
    const layouts = useLayoutsStore();
    const layoutEditor = useLayoutEditorStore();
    const editorUi = useLayoutEditorUiStore();
    const { t } = useTranslation('main-app');
    const isFullscreen = editorUi.isFullscreen;

    const hasRemoteScreens = (layouts.editingLayout?.monitors ?? []).some(
      isRemoteMonitor
    );

    const toggleFullscreen = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void rootRef.current?.requestFullscreen();
      }
    };

    return (
      <header
        ref={toolbarRef}
        className={cx(styles.toolbar, isFullscreen && styles.toolbarFullscreen)}
      >
        {isFullscreen ? (
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

        <AddRemoteScreenButton />

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

        <div className={styles.previewControls}>
          <HistoryButtons />

          <GridControls />

          <Tooltip
            title={
              isFullscreen
                ? t('layoutEditor.exitFullscreen')
                : t('layoutEditor.fullscreenPreview')
            }
          >
            <Button
              size="small"
              type="text"
              icon={
                isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />
              }
              onClick={toggleFullscreen}
            />
          </Tooltip>

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
          {isFullscreen && (
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

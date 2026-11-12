import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Select, Tooltip } from 'antd';
import { Monitor, X } from 'lucide-react';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { useLayoutGestureStores } from '@features/layout-editor/layout-editor-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import { removeMonitor } from '@features/layout-editor/layout-gestures';
import { isRemoteMonitor } from '@shared/lib/remote-screen';

import styles from './MonitorPicker.module.scss';

const ALL_MONITORS = '__all__';
const PICKER_WIDTH_PX = 240;
const PICKER_MIN_WIDTH_PX = 180;

interface MonitorPickerProps {
  /** Where a dialog is mounted: in fullscreen only the editor is drawn. */
  dialogContainer: () => HTMLElement;
}

/**
 * The screen picker. It does double duty: it zooms the canvas to one screen,
 * and it is how a screen joins the layout in the first place — attached
 * monitors not in the layout yet are offered with an "add" hint. Each screen
 * of the layout carries its own remove button.
 */
export const MonitorPicker = observer(
  ({ dialogContainer }: MonitorPickerProps) => {
    const liveWidgets = useMainLiveWidgetsStore();
    const layouts = useLayoutsStore();
    const gestureStores = useLayoutGestureStores();
    const editorUi = useLayoutEditorUiStore();
    const { modal } = App.useApp();
    const { t } = useTranslation('main-app');

    const activeId = layouts.editingLayoutId;
    const editingLayout = layouts.editingLayout;
    const attached = liveWidgets.attachedMonitors;
    const layoutMonitorNames = new Set(
      (editingLayout?.monitors ?? []).map((monitor) => monitor.name)
    );

    const options = [
      {
        value: ALL_MONITORS,
        label: t('layoutEditor.allMonitors'),
        inLayout: false,
      },
      ...attached.map((monitor) => ({
        value: monitor.name,
        inLayout: layoutMonitorNames.has(monitor.name),
        label: layoutMonitorNames.has(monitor.name)
          ? `${monitor.name} · ${monitor.bounds.width}×${monitor.bounds.height}`
          : `${monitor.name} · ${t('layoutEditor.monitorAdd')}`,
      })),
      // Remote screens live in the layout only — the machine has no display to
      // offer them from, so they are listed straight from the layout itself.
      ...(editingLayout?.monitors ?? [])
        .filter(isRemoteMonitor)
        .map((monitor) => ({
          value: monitor.name,
          inLayout: true,
          label: `${monitor.name} · ${monitor.bounds.width}×${monitor.bounds.height} · ${t('layoutEditor.remoteScreenTag')}`,
        })),
    ];

    const handleSelect = (name: string) => {
      if (name === ALL_MONITORS) {
        editorUi.focusMonitor(null);

        return;
      }

      const monitor = attached.find((candidate) => candidate.name === name);

      // A remote screen is already part of the layout, so selecting one only
      // ever means focusing it.
      if (!monitor) {
        if (layoutMonitorNames.has(name)) {
          editorUi.focusMonitor(name);
        }

        return;
      }

      if (!layoutMonitorNames.has(name)) {
        layouts.addMonitor({ name: monitor.name, bounds: monitor.bounds });
      }

      editorUi.focusMonitor(name);
    };

    // A screen's widgets go with it — they are its own set — so a mis-click
    // here must not remove it without asking.
    const handleRemove = (monitorName: string) => {
      if (!activeId) {
        return;
      }

      void modal.confirm({
        title: t('layoutList.removeMonitorWithWidgets', {
          count: liveWidgets.widgetsOnMonitorNamed(monitorName).length,
        }),
        okText: t('layoutEditor.delete'),
        okButtonProps: { danger: true },
        cancelText: t('layoutEditor.cancel'),
        onOk: () => {
          removeMonitor(gestureStores, activeId, monitorName);

          if (editorUi.focusedMonitorName === monitorName) {
            editorUi.focusMonitor(null);
          }
        },
        getContainer: dialogContainer,
      });
    };

    return (
      <Tooltip title={t('layoutEditor.monitorTooltip')}>
        <Select
          size="small"
          placeholder={
            <>
              <Monitor size={12} /> {t('layoutEditor.monitorPlaceholder')}
            </>
          }
          value={editorUi.focusedMonitorName ?? ALL_MONITORS}
          onChange={handleSelect}
          options={options}
          optionRender={(option) => (
            <div className={styles.monitorOption}>
              <span className={styles.monitorOptionLabel}>{option.label}</span>

              {option.data.inLayout && (
                <button
                  type="button"
                  className={styles.monitorOptionRemove}
                  tabIndex={-1}
                  title={t('layoutEditor.removeMonitor')}
                  // The click must not reach the option itself, or removing a
                  // screen would also focus it.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleRemove(String(option.value));
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          disabled={!editingLayout}
          popupMatchSelectWidth={PICKER_WIDTH_PX}
          style={{ minWidth: PICKER_MIN_WIDTH_PX }}
        />
      </Tooltip>
    );
  }
);

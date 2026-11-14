import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App } from 'antd';
import { LayoutDashboard, Monitor, Tablet, X } from 'lucide-react';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { useLayoutGestureStores } from '@features/layout-editor/layout-editor-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import { removeMonitor } from '@features/layout-editor/layout-gestures';
import { isRemoteMonitor } from '@shared/lib/remote-screen';

import { ToolbarButton } from './ToolbarButton';
import { ToolbarMenuItem } from './ToolbarMenuItem';
import { ToolbarPopover } from './ToolbarPopover';
import styles from './MonitorPicker.module.scss';

interface MonitorPickerProps {
  /** Where a dialog is mounted: in fullscreen only the editor is drawn. */
  dialogContainer: () => HTMLElement;
}

interface MonitorOption {
  name: string;
  note: string;
  isInLayout: boolean;
  isRemote: boolean;
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

    const options: MonitorOption[] = [
      ...attached.map((monitor) => ({
        name: monitor.name,
        isInLayout: layoutMonitorNames.has(monitor.name),
        isRemote: false,
        note: layoutMonitorNames.has(monitor.name)
          ? `${monitor.bounds.width}×${monitor.bounds.height}`
          : t('layoutEditor.monitorAdd'),
      })),
      // Remote screens live in the layout only — the machine has no display
      // to offer them from, so they are listed straight from the layout.
      ...(editingLayout?.monitors ?? [])
        .filter(isRemoteMonitor)
        .map((monitor) => ({
          name: monitor.name,
          isInLayout: true,
          isRemote: true,
          note: `${monitor.bounds.width}×${monitor.bounds.height}`,
        })),
    ];

    const handleSelect = (option: MonitorOption) => {
      const monitor = attached.find(
        (candidate) => candidate.name === option.name
      );

      if (monitor && !option.isInLayout) {
        layouts.addMonitor({ name: monitor.name, bounds: monitor.bounds });
      }

      editorUi.focusMonitor(option.name);
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
      <ToolbarPopover
        trigger={({ isOpen, toggle }) => (
          <ToolbarButton
            icon={Monitor}
            label={editorUi.focusedMonitorName ?? t('layoutEditor.allMonitors')}
            title={t('layoutEditor.monitorTooltip')}
            isSelect
            isExpanded={isOpen}
            isDisabled={!editingLayout}
            onClick={toggle}
          />
        )}
      >
        {({ close }) => (
          <>
            <ToolbarMenuItem
              icon={LayoutDashboard}
              label={t('layoutEditor.allMonitors')}
              isChecked={editorUi.focusedMonitorName === null}
              onClick={() => {
                editorUi.focusMonitor(null);
                close();
              }}
            />

            {options.map((option) => (
              <ToolbarMenuItem
                key={option.name}
                icon={option.isRemote ? Tablet : Monitor}
                label={option.name}
                note={option.note}
                isChecked={editorUi.focusedMonitorName === option.name}
                onClick={() => {
                  handleSelect(option);
                  close();
                }}
                action={
                  option.isInLayout && (
                    <button
                      type="button"
                      className={styles.remove}
                      title={t('layoutEditor.removeMonitor')}
                      aria-label={t('layoutEditor.removeMonitor')}
                      onClick={() => {
                        close();
                        handleRemove(option.name);
                      }}
                    >
                      <X size={12} />
                    </button>
                  )
                }
              />
            ))}
          </>
        )}
      </ToolbarPopover>
    );
  }
);

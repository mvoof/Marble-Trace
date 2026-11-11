import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm } from 'antd';
import { X } from 'lucide-react';

import {
  useLayoutEditorStore,
  useLayoutGestureStores,
} from '@features/layout-editor/layout-editor-context';
import { removeMonitor } from '@features/layout-editor/layout-gestures';
import { useRemoteDevicesStore } from '@features/remote-screens/remote-devices-context';
import type { LayoutMonitor } from '@shared/contracts/widget-settings';
import { isRemoteMonitor } from '@shared/lib/remote-screen';

import styles from './LayoutMonitorRow.module.scss';

interface LayoutMonitorRowProps {
  layoutId: string;
  monitor: LayoutMonitor;
  widgetCount: number;
}

/** One screen of the selected layout: whether it is there, and removing it. */
export const LayoutMonitorRow = observer(
  ({ layoutId, monitor, widgetCount }: LayoutMonitorRowProps) => {
    const layoutEditor = useLayoutEditorStore();
    const gestureStores = useLayoutGestureStores();
    const remoteDevices = useRemoteDevicesStore();
    const { t } = useTranslation('main-app');
    const { name: monitorName, bounds } = monitor;

    // A remote screen has no display behind it, so "attached" means nothing
    // for it: what it can be is a device that has the page open. Its size is
    // chosen rather than detected, so it is always known and always shown.
    const isRemote = isRemoteMonitor(monitor);

    const device = isRemote
      ? remoteDevices.bySlug(monitor.slug ?? '')
      : undefined;

    const isOnline = isRemote
      ? device?.connected === true
      : layoutEditor.onlineMonitorNames.has(monitorName);

    const meta = isRemote
      ? `${bounds.width}×${bounds.height}${
          isOnline ? '' : ` · ${t('layoutList.remoteNoDevice')}`
        }`
      : isOnline
        ? `${bounds.width}×${bounds.height}`
        : t('layoutList.monitorOffline');

    return (
      <div
        className={`${styles.monitorRow} ${
          isOnline ? '' : styles.monitorRowOffline
        }`}
      >
        <span
          className={`${styles.monitorDot} ${
            isOnline ? '' : styles.monitorDotOffline
          }`}
        />
        <span className={styles.monitorName}>{monitorName}</span>
        <span className={styles.monitorMeta}>
          {meta}
          {` · ${widgetCount}`}
        </span>
        <Popconfirm
          title={t('layoutList.removeMonitorWithWidgets', {
            count: widgetCount,
          })}
          okText={t('layoutEditor.delete')}
          okButtonProps={{ danger: true }}
          cancelText={t('layoutEditor.cancel')}
          onConfirm={() => removeMonitor(gestureStores, layoutId, monitorName)}
        >
          <Button
            size="small"
            type="text"
            icon={<X size={12} />}
            title={t('layoutList.removeMonitor')}
          />
        </Popconfirm>
      </div>
    );
  }
);

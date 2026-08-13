import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Tag } from 'antd';
import { useDeviceInputStore } from '@store/root-store-context';
import styles from './BindingsSettings.module.scss';

export const DeviceList = observer(() => {
  const deviceInput = useDeviceInputStore();
  const { t } = useTranslation('main-app');

  if (deviceInput.devices.length === 0) {
    return <div className={styles.empty}>{t('bindings.noDevices')}</div>;
  }

  return (
    <>
      {deviceInput.devices.map((device) => (
        <div key={device.id} className={styles.deviceRow}>
          <div>
            <div className={styles.deviceName}>{device.productName}</div>

            <div className={styles.deviceMeta}>
              {t('bindings.deviceMeta', {
                vendor: device.vendorId.toString(16).padStart(4, '0'),
                product: device.productId.toString(16).padStart(4, '0'),
                buttons: device.buttonCount,
              })}
            </div>
          </div>

          <Tag color={device.connected ? 'success' : 'default'}>
            {device.connected
              ? t('bindings.deviceConnected')
              : t('bindings.deviceOfflineTag')}
          </Tag>
        </div>
      ))}
    </>
  );
});

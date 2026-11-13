import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { DeviceList } from './DeviceList';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './BindingsSettings.module.scss';

export const DevicesSettings = observer(() => {
  const { t } = useTranslation('main-app');

  return (
    <SettingsCard title={t('bindings.devicesTitle')}>
      <div className={styles.intro}>{t('bindings.devicesIntro')}</div>

      <DeviceList />
    </SettingsCard>
  );
});

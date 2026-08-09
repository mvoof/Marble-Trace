import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { DeviceList } from './DeviceList';
import styles from './BindingsSettings.module.scss';

export const DevicesSettings = observer(() => {
  const { t } = useTranslation('main-app');

  return (
    <div className={styles.card}>
      <div className={styles.cardContent}>
        <div className={styles.intro}>{t('bindings.devicesIntro')}</div>

        <DeviceList />
      </div>
    </div>
  );
});

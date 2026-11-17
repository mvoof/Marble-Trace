import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch } from 'antd';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';

import styles from './AutoSwitchBlock.module.scss';

/**
 * The switch for putting layouts on screen by the situation in the sim. Each
 * layout's own card says which situations it is put on screen in.
 */
export const AutoSwitchBlock = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const isEnabled = appSettings.appSettings.autoSwitchLayouts;

  return (
    <SettingsCard
      title={t('layoutList.autoSwitch.title')}
      extra={
        <label className={styles.masterSwitch}>
          <span>{t('layoutList.autoSwitch.enabled')}</span>
          <Switch
            size="small"
            checked={isEnabled}
            onChange={(checked) =>
              appSettings.update({ autoSwitchLayouts: checked })
            }
          />
        </label>
      }
    >
      <p className={styles.description}>
        {t('layoutList.autoSwitch.description')}
      </p>
    </SettingsCard>
  );
});

import { Alert, Button, Popconfirm } from 'antd';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useAppSettingsStore } from '@store/root-store-context';

/**
 * Shown when `settings.json` could not be brought to the current schema. The
 * app is running on defaults and refuses to write, so this banner is the only
 * thing telling the user why their layouts are missing — and the only way out
 * short of editing the file by hand.
 */
export const SettingsLockBanner = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');

  const { settingsLockReason } = appSettings;

  if (!settingsLockReason) return null;

  const handleReset = () => {
    void appSettings.resetSettings();
  };

  return (
    <Alert
      title={t(`settingsLock.${settingsLockReason}.title`)}
      description={t(`settingsLock.${settingsLockReason}.description`)}
      type="error"
      showIcon
      action={
        <Popconfirm
          title={t('settingsLock.resetConfirm')}
          okText={t('settingsLock.resetOk')}
          cancelText={t('settingsLock.resetCancel')}
          onConfirm={handleReset}
        >
          <Button size="small" danger>
            {t('settingsLock.reset')}
          </Button>
        </Popconfirm>
      }
    />
  );
});

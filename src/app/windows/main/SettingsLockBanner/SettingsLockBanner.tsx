import { Alert, Button, Popconfirm, Space } from 'antd';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';

/**
 * Shown when `settings.json` could not be brought to the current schema. The
 * app is running on defaults and refuses to write, so this banner is the only
 * thing telling the user why their layouts are missing — and the only way out
 * short of editing the file by hand.
 *
 * A corrupt file with a last-good copy beside it can be restored in one click.
 */
export const SettingsLockBanner = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t, i18n } = useTranslation('main-app');

  const { settingsLockReason, lastGoodSettingsSavedAt } = appSettings;

  if (!settingsLockReason) return null;

  const handleReset = () => {
    void appSettings.resetSettings();
  };

  const handleRestore = () => {
    void appSettings.restoreLastGoodSettings();
  };

  const canRestore =
    settingsLockReason === 'corrupt' && lastGoodSettingsSavedAt !== null;

  const description = t(`settingsLock.${settingsLockReason}.description`);

  return (
    <Alert
      title={t(`settingsLock.${settingsLockReason}.title`)}
      description={
        canRestore ? (
          <>
            {description}{' '}
            {t('settingsLock.lastGoodAvailable', {
              date: new Date(lastGoodSettingsSavedAt).toLocaleString(
                i18n.language
              ),
            })}
          </>
        ) : (
          description
        )
      }
      type="error"
      showIcon
      action={
        <Space orientation="vertical">
          {canRestore && (
            <Popconfirm
              title={t('settingsLock.restoreConfirm')}
              okText={t('settingsLock.restoreOk')}
              cancelText={t('settingsLock.resetCancel')}
              onConfirm={handleRestore}
            >
              <Button size="small" type="primary">
                {t('settingsLock.restore')}
              </Button>
            </Popconfirm>
          )}
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
        </Space>
      }
    />
  );
});

import { Alert } from 'antd';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useAppSettingsStore } from '@store/root-store-context';

/**
 * Shown when the running executable sits outside the installation Windows has
 * on record — a second copy left behind by an install into another folder.
 *
 * Temporary: this is the `.msi` migration's user-facing half, and goes when
 * the check behind it does — see the module doc of
 * `src-tauri/src/commands/install.rs` for the full list and the deadline.
 *
 * It sits above `SettingsLockBanner` on purpose: when both appear, this one is
 * the cause and the lock is the symptom, and a user who reads only the first
 * banner should be reading the one that says which shortcut to fix.
 */
export const InstallMismatchBanner = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');

  const { installMismatch } = appSettings;

  if (!installMismatch) return null;

  return (
    <Alert
      title={t('installMismatch.title')}
      description={t('installMismatch.description', {
        runningDir: installMismatch.runningDir,
        runningVersion: installMismatch.runningVersion,
        registeredDir: installMismatch.registeredDir,
        registeredVersion:
          installMismatch.registeredVersion ??
          t('installMismatch.unknownVersion'),
      })}
      type="warning"
      showIcon
    />
  );
});

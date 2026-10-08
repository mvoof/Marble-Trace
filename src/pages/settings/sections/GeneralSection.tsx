import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Select, Switch } from 'antd';
import type { UnitSystem } from '@shared/contracts/domain';
import type { AppLanguage } from '@shared/contracts/domain';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from '../SettingsPage.module.scss';

export const GeneralSection = observer(() => {
  const appSettings = useAppSettingsStore();
  const units = useUnitsStore();
  const { t } = useTranslation('main-app');

  const languageOptions: { value: AppLanguage; label: string }[] = [
    { value: 'system', label: t('settingsPage.language.system') },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'ru', label: 'Русский' },
    { value: 'zh', label: '中文' },
  ];

  return (
    <>
      <SettingsCard title={t('settingsPage.language.title')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPage.language.fieldLabel')}
          </span>

          <Select
            className={styles.selectWidth}
            value={appSettings.appSettings.language}
            onChange={(value: AppLanguage) => appSettings.setLanguage(value)}
            options={languageOptions}
          />
        </div>
      </SettingsCard>

      <SettingsCard title={t('settingsPage.systemUnits.title')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPage.systemUnits.fieldLabel')}
          </span>

          <Segmented
            block
            options={[
              { label: t('settingsPage.systemUnits.metric'), value: 'metric' },
              {
                label: t('settingsPage.systemUnits.imperial'),
                value: 'imperial',
              },
            ]}
            value={units.unitSystem}
            onChange={(value) => units.setSystem(value as UnitSystem)}
          />
        </div>
      </SettingsCard>

      <SettingsCard title={t('settingsPage.startupBehavior.title')}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.startupBehavior.launchMinimizedTitle')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.startupBehavior.launchMinimizedDesc')}
              </div>
            </div>

            <Switch
              checked={appSettings.appSettings.startMinimized}
              onChange={(v) => appSettings.setStartMinimized(v)}
            />
          </div>
        </div>
      </SettingsCard>
    </>
  );
});

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Switch } from 'antd';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import {
  FUEL_PIT_WARNING_LAPS_MAX,
  FUEL_PIT_WARNING_LAPS_MIN,
} from '@shared/contracts/fuel-strategy';
import {
  FUEL_AVG_WINDOW_ALL_LAPS,
  FUEL_AVG_WINDOW_MAX,
} from '@shared/contracts/generated/backend-constants';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from '../SettingsPage.module.scss';

/**
 * How the fuel figures are worked out. The car's, not a screen's: the backend
 * computes fuel once and every Fuel widget shows the same frame — which is why
 * these left the widget panel, where only one copy's values ever counted.
 */
export const FuelStrategyCard = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const settings = appSettings.appSettings;

  return (
    <SettingsCard title={t('settingsPage.fuelStrategy.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldDesc}>
          {t('settingsPage.fuelStrategy.desc')}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.fuelStrategy.pitWarningLaps')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.fuelStrategy.pitWarningLapsDesc')}
            </div>
          </div>

          <InputNumber
            min={FUEL_PIT_WARNING_LAPS_MIN}
            max={FUEL_PIT_WARNING_LAPS_MAX}
            step={1}
            precision={0}
            value={settings.fuelPitWarningLaps}
            onChange={(value) => {
              if (value !== null) {
                appSettings.update({ fuelPitWarningLaps: Math.round(value) });
              }
            }}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.fuelStrategy.fuelAvgWindow')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.fuelStrategy.fuelAvgWindowDesc')}
            </div>
          </div>

          <InputNumber
            min={FUEL_AVG_WINDOW_ALL_LAPS}
            max={FUEL_AVG_WINDOW_MAX}
            step={1}
            precision={0}
            value={settings.fuelAvgWindow}
            onChange={(value) => {
              if (value !== null) {
                appSettings.update({ fuelAvgWindow: Math.round(value) });
              }
            }}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.fuelStrategy.countYellowFlagLaps')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.fuelStrategy.countYellowFlagLapsDesc')}
            </div>
          </div>

          <Switch
            checked={settings.fuelCountYellowFlagLaps}
            onChange={(checked) =>
              appSettings.update({ fuelCountYellowFlagLaps: checked })
            }
          />
        </div>
      </div>
    </SettingsCard>
  );
});

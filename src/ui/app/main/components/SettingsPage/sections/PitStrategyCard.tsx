import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider, Switch } from 'antd';
import { useAppSettingsStore } from '@store/roots/root-store-context';
import { FUEL_ADJUST_STEPS, type FuelAdjustStep } from '@/types/pit-strategy';
import { SettingsCard } from '../SettingsCard';
import styles from '../SettingsPage.module.scss';

// Remaining tread, in percent. Above 90 every fresh set would be ordered and
// below 10 the tires are already gone, so neither end is worth offering.
const WEAR_THRESHOLD_MIN_PCT = 10;
const WEAR_THRESHOLD_MAX_PCT = 90;
const WEAR_THRESHOLD_STEP_PCT = 5;

/**
 * The rules the pit order is built by. The car's, not a screen's: the sim has
 * one tank, so a pit box on the stream and one on the driver's monitor cannot
 * hold different auto-fuel rules — which is why these left the widget panel.
 */
export const PitStrategyCard = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const settings = appSettings.appSettings;

  return (
    <SettingsCard title={t('settingsPage.pitStrategy.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldDesc}>
          {t('settingsPage.pitStrategy.desc')}
        </div>
      </div>

      {/*
        Auto mode has no master switch: it is on exactly when it has something
        to order, so these two toggles are the whole of it.
      */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.pitStrategy.autoFuel')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.pitStrategy.autoFuelDesc')}
            </div>
          </div>

          <Switch
            checked={settings.pitAutoFuel}
            onChange={(checked) => appSettings.setPitAutoFuel(checked)}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.pitStrategy.autoTires')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.pitStrategy.autoTiresDesc')}
            </div>
          </div>

          <Switch
            checked={settings.pitAutoTires}
            onChange={(checked) => appSettings.setPitAutoTires(checked)}
          />
        </div>
      </div>

      {settings.pitAutoTires ? (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.pitStrategy.autoTireWearThreshold', {
                  percent: settings.pitAutoTireWearThreshold,
                })}
              </div>
            </div>

            <Slider
              min={WEAR_THRESHOLD_MIN_PCT}
              max={WEAR_THRESHOLD_MAX_PCT}
              step={WEAR_THRESHOLD_STEP_PCT}
              value={settings.pitAutoTireWearThreshold}
              onChange={(value) =>
                appSettings.setPitAutoTireWearThreshold(value)
              }
              className={styles.sliderWidth}
            />
          </div>
        </div>
      ) : null}

      {/*
        Not gated on auto mode: the step belongs to the fuel up / down keys,
        which are the driver's own hands and work whether auto mode is on or
        not.
      */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.pitStrategy.fuelAdjustStep')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.pitStrategy.fuelAdjustStepDesc')}
            </div>
          </div>

          <Segmented
            value={settings.pitFuelAdjustStep}
            options={FUEL_ADJUST_STEPS.map((step) => ({
              label: String(step),
              value: step,
            }))}
            onChange={(value) =>
              appSettings.setPitFuelAdjustStep(value as FuelAdjustStep)
            }
          />
        </div>
      </div>
    </SettingsCard>
  );
});

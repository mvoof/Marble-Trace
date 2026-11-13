import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider, Switch } from 'antd';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import {
  FUEL_ADJUST_STEPS,
  KPA_PER_PSI,
  PRESSURE_ADJUST_STEPS_KPA,
  PRESSURE_ADJUST_STEPS_PSI,
  type FuelAdjustStep,
} from '@shared/contracts/pit-strategy';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './DataPage.module.scss';

// Remaining tread, in percent. Above 90 every fresh set would be ordered and
// below 10 the tires are already gone, so neither end is worth offering.
const WEAR_THRESHOLD_MIN_PCT = 10;
const WEAR_THRESHOLD_MAX_PCT = 90;
const WEAR_THRESHOLD_STEP_PCT = 5;

interface PressureStepOption {
  label: string;
  kpa: number;
}

const PRESSURE_STEP_OPTIONS = {
  metric: PRESSURE_ADJUST_STEPS_KPA.map((kpa) => ({
    label: `${kpa} kPa`,
    kpa,
  })),
  imperial: PRESSURE_ADJUST_STEPS_PSI.map((psi) => ({
    label: `${psi} psi`,
    kpa: psi * KPA_PER_PSI,
  })),
} satisfies Record<string, PressureStepOption[]>;

// The step is kept in kPa, so one picked in the other unit shows as the
// option nearest to it.
const nearestPressureStep = (
  options: PressureStepOption[],
  kpa: number
): number =>
  options.reduce((best, option) =>
    Math.abs(option.kpa - kpa) < Math.abs(best.kpa - kpa) ? option : best
  ).kpa;

/**
 * The rules the pit order is built by. The car's, not a screen's: the sim has
 * one tank, so a pit box on the stream and one on the driver's monitor cannot
 * hold different auto-fuel rules — which is why these left the widget panel.
 */
export const PitStrategyCard = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const settings = appSettings.appSettings;
  const units = useUnitsStore();
  const pressureOptions = PRESSURE_STEP_OPTIONS[units.unitSystem];

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
            onChange={(checked) => appSettings.update({ pitAutoFuel: checked })}
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
            onChange={(checked) =>
              appSettings.update({ pitAutoTires: checked })
            }
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
                appSettings.update({ pitAutoTireWearThreshold: value })
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
              appSettings.update({ pitFuelAdjustStep: value as FuelAdjustStep })
            }
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.pitStrategy.pressureAdjustStep')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.pitStrategy.pressureAdjustStepDesc')}
            </div>
          </div>

          <Segmented
            value={nearestPressureStep(
              pressureOptions,
              settings.pitPressureAdjustStep
            )}
            options={pressureOptions.map((option) => ({
              label: option.label,
              value: option.kpa,
            }))}
            onChange={(value) =>
              appSettings.update({ pitPressureAdjustStep: Number(value) })
            }
          />
        </div>
      </div>
    </SettingsCard>
  );
});

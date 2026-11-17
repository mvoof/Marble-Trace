import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Slider } from 'antd';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import { FuelStrategyCard } from './FuelStrategyCard';
import { PitStrategyCard } from './PitStrategyCard';
import styles from './DataPage.module.scss';

/**
 * Values several widgets read and none of them owns.
 *
 * A number that means the same thing to two widgets has to live in one place,
 * or they end up disagreeing about the same car: the car length used to sit in
 * the radar's own settings and was copied to the second radar by hand on every
 * change. Anything with that shape belongs here rather than in a panel.
 */
const CAR_LENGTH_MIN_M = 1;
const CAR_LENGTH_MAX_M = 10;
const CAR_LENGTH_STEP_M = 0.1;
const STEERING_LOCK_MIN_DEG = 180;
const STEERING_LOCK_MAX_DEG = 1080;
const STEERING_LOCK_STEP_DEG = 90;

export const SharedValuesSection = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');

  return (
    <>
      <SettingsCard title={t('settingsPage.carLength.title')}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.carLength.valueTitle')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.carLength.valueDesc')}
              </div>
            </div>

            <InputNumber
              min={CAR_LENGTH_MIN_M}
              max={CAR_LENGTH_MAX_M}
              step={CAR_LENGTH_STEP_M}
              value={appSettings.appSettings.carLength}
              onChange={(value) => {
                if (value !== null) {
                  appSettings.update({ carLength: value });
                }
              }}
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title={t('settingsPage.steeringLock.title')}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.steeringLock.rangeTitle')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.steeringLock.rangeDesc', {
                  full: appSettings.appSettings.steeringLock,
                  half: appSettings.appSettings.steeringLock / 2,
                })}
              </div>
            </div>

            <Slider
              min={STEERING_LOCK_MIN_DEG}
              max={STEERING_LOCK_MAX_DEG}
              step={STEERING_LOCK_STEP_DEG}
              value={appSettings.appSettings.steeringLock}
              onChange={(lockDeg) =>
                appSettings.update({ steeringLock: lockDeg })
              }
              className={styles.sliderWidth}
            />
          </div>
        </div>
      </SettingsCard>

      <PitStrategyCard />

      <FuelStrategyCard />
    </>
  );
});

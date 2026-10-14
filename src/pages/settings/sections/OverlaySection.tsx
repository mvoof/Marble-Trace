import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider, Switch } from 'antd';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from '../SettingsPage.module.scss';

const STEERING_LOCK_MIN_DEG = 180;
const STEERING_LOCK_MAX_DEG = 1080;
const STEERING_LOCK_STEP_DEG = 90;
// Divisors of the source's 60 Hz tick: each one moves every widget on the same
// frames, which is what keeps the overlay from changing more often than this.
const OVERLAY_UPDATE_HZ_OPTIONS = [60, 30, 20, 15];

export const OverlaySection = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');

  return (
    <>
      <SettingsCard title={t('settingsPage.widgetDisplayOverride.title')}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.widgetDisplayOverride.hideAllTitle')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.widgetDisplayOverride.hideAllDesc')}
              </div>
            </div>

            <Switch
              checked={appSettings.appSettings.hideAllWidgets}
              onChange={(v) => appSettings.setHideAllWidgets(v)}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.gameIntegration.autoHideTitle')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.gameIntegration.autoHideDesc')}
              </div>
            </div>

            <Switch
              checked={appSettings.appSettings.hideWidgetsWhenGameClosed}
              onChange={(v) => appSettings.setHideWidgetsWhenGameClosed(v)}
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title={t('settingsPage.overlayPerformance.title')}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.overlayPerformance.updateRateTitle')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.overlayPerformance.updateRateDesc')}
              </div>
            </div>

            <Segmented<number>
              value={appSettings.appSettings.overlayUpdateHz}
              onChange={(rateHz) => appSettings.setOverlayUpdateHz(rateHz)}
              options={OVERLAY_UPDATE_HZ_OPTIONS.map((rateHz) => ({
                label: `${rateHz} Hz`,
                value: rateHz,
              }))}
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
              onChange={(v) => appSettings.setSteeringLock(v)}
              className={styles.sliderWidth}
            />
          </div>
        </div>
      </SettingsCard>
    </>
  );
});

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Slider, Switch } from 'antd';
import { useAppSettingsStore } from '@store/root-store-context';
import { SettingsCard } from '../SettingsCard';
import styles from '../SettingsPage.module.scss';

const STEERING_LOCK_MIN_DEG = 180;
const STEERING_LOCK_MAX_DEG = 1080;
const STEERING_LOCK_STEP_DEG = 90;

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

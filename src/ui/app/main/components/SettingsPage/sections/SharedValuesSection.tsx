import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber } from 'antd';
import { useAppSettingsStore } from '@store/root-store-context';
import { SettingsCard } from '../SettingsCard';
import styles from '../SettingsPage.module.scss';

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

export const SharedValuesSection = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');

  return (
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
                appSettings.setCarLength(value);
              }
            }}
          />
        </div>
      </div>
    </SettingsCard>
  );
});

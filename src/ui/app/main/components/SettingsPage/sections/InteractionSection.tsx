import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Switch } from 'antd';
import type { InteractHotkeyMode } from '@store/settings/app-settings.store';
import {
  useAppSettingsStore,
  useBindingsStore,
} from '@store/root-store-context';
import { SettingsCard } from '../SettingsCard';
import styles from '../SettingsPage.module.scss';

const INTERACT_AUTO_OFF_OPTIONS = [0, 10, 15, 30, 60];

export const InteractionSection = observer(() => {
  const appSettings = useAppSettingsStore();
  const bindings = useBindingsStore();
  const { t } = useTranslation('main-app');

  const dragKey = bindings.primaryAccelerator('app:toggle-drag-mode');
  const interactKey = bindings.primaryAccelerator('app:toggle-interact-mode');

  // The keys themselves are assigned in the Bindings section; naming them here
  // saves a trip back and forth just to remember which one does what.
  const boundKeyHint = (accelerator: string | null) =>
    accelerator
      ? t('settingsPage.interactionMode.boundTo', { accelerator })
      : null;

  return (
    <SettingsCard title={t('settingsPage.interactionMode.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.interactionMode.dragModeTitle')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.interactionMode.dragModeDesc')}
            </div>

            {dragKey && (
              <div className={styles.fieldHint}>{boundKeyHint(dragKey)}</div>
            )}
          </div>

          <Switch
            checked={appSettings.dragMode}
            onChange={() => appSettings.toggleDragMode()}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.interactionMode.interactModeTitle')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.interactionMode.interactModeDesc')}
            </div>

            {interactKey && (
              <div className={styles.fieldHint}>
                {boundKeyHint(interactKey)}
              </div>
            )}
          </div>

          <Switch
            checked={appSettings.interactMode}
            onChange={() => appSettings.toggleInteractMode()}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.interactionMode.interactHotkeyModeTitle')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.interactionMode.interactHotkeyModeDesc')}
            </div>
          </div>

          <Segmented<InteractHotkeyMode>
            value={appSettings.appSettings.interactHotkeyMode}
            onChange={(v) => appSettings.setInteractHotkeyMode(v)}
            options={[
              {
                label: t('settingsPage.interactionMode.interactToggle'),
                value: 'toggle',
              },
              {
                label: t('settingsPage.interactionMode.interactHold'),
                value: 'hold',
              },
            ]}
          />
        </div>
      </div>

      {appSettings.appSettings.interactHotkeyMode === 'toggle' ? (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.interactionMode.interactAutoOffTitle')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.interactionMode.interactAutoOffDesc')}
              </div>
            </div>

            <Segmented<number>
              value={appSettings.appSettings.interactAutoOffSeconds}
              onChange={(v) => appSettings.setInteractAutoOffSeconds(v)}
              options={INTERACT_AUTO_OFF_OPTIONS.map((seconds) => ({
                label:
                  seconds === 0
                    ? t('settingsPage.interactionMode.interactAutoOffNever')
                    : `${seconds}s`,
                value: seconds,
              }))}
            />
          </div>
        </div>
      ) : null}
    </SettingsCard>
  );
});

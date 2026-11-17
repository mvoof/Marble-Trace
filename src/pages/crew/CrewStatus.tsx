import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Tag } from 'antd';
import { Keyboard } from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { useBindingsStore } from '@features/hotkey-bindings/bindings-context';
import { useDeviceInputStore } from '@features/hotkey-bindings/device-input-context';
import { bindingLabel } from '@features/hotkey-bindings/binding-labels';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { APP_OWNER } from '@shared/contracts/input-bindings';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './CrewPage.module.scss';

const PUSH_TO_TALK = 'app:push-to-talk';

/** Whether the engineer can talk now, and the key held to talk to them. */
export const CrewStatus = observer(() => {
  const crew = useVoiceCrewStore();
  const appSettings = useAppSettingsStore();
  const bindings = useBindingsStore();
  const deviceInput = useDeviceInputStore();
  const navigation = useMainNavigationStore();
  const { t } = useTranslation('main-app');

  const keys = bindings
    .bindingsFor(PUSH_TO_TALK)
    .map((binding) =>
      bindingLabel(
        binding,
        binding.kind === 'device'
          ? deviceInput.deviceById(binding.deviceId)
          : undefined,
        t
      )
    );

  const renderStatusTag = () => {
    if (!crew.ready) {
      return <Tag color="orange">{t('crewPage.status.notReady')}</Tag>;
    }

    if (!appSettings.appSettings.voiceEnabled) {
      return <Tag>{t('crewPage.status.off')}</Tag>;
    }

    return <Tag color="green">{t('crewPage.status.ready')}</Tag>;
  };

  return (
    <SettingsCard title={t('crewPage.status.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTitle}>
            {t('crewPage.status.engineer')}
          </div>

          {renderStatusTag()}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('crewPage.status.pushToTalk')}
            </div>

            <div className={styles.fieldDesc}>
              {keys.length > 0
                ? keys.join(', ')
                : t('crewPage.status.pushToTalkUnbound')}
            </div>
          </div>

          <Button
            icon={<Keyboard size={14} />}
            onClick={() => navigation.openHotkeys(APP_OWNER)}
          >
            {t('crewPage.status.change')}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
});

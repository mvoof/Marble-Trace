import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Select, Slider, Switch } from 'antd';
import { Mic } from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import type { VoiceLanguage } from '@entities/app-settings/app-settings.store';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './CrewPage.module.scss';

const VOLUME_STEP = 0.05;
const SPEED_MIN = 0.7;
const SPEED_MAX = 1.5;
const SPEED_STEP = 0.05;
const CONFIDENCE_STEP = 0.05;
const PERCENT = 100;
const LANGUAGES: VoiceLanguage[] = ['app', 'ru', 'en', 'es', 'zh'];
/** Packs nobody who speaks the language has tried with a microphone yet. */
const EXPERIMENTAL_LANGUAGES: VoiceLanguage[] = ['zh'];

/** On or off, which language and voice, which devices, how loud. */
export const CrewVoice = observer(() => {
  const crew = useVoiceCrewStore();
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const settings = appSettings.appSettings;
  const defaultDevice = { value: '', label: t('crewPage.voice.systemDefault') };
  const inputs = [
    defaultDevice,
    ...(crew.status?.inputs ?? []).map((device) => ({
      value: device.id,
      label: device.name,
    })),
  ];
  const outputs = [
    defaultDevice,
    ...(crew.status?.outputs ?? []).map((device) => ({
      value: device.id,
      label: device.name,
    })),
  ];
  const voices = [
    { value: '', label: t('crewPage.voice.recommendedVoice') },
    ...crew.voiceOptions,
  ];

  return (
    <SettingsCard title={t('crewPage.voice.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('crewPage.voice.enabled')}
            </div>

            <div className={styles.fieldDesc}>
              {t('crewPage.voice.enabledDesc')}
            </div>
          </div>

          <Switch
            checked={settings.voiceEnabled}
            disabled={!crew.ready}
            onChange={(checked) =>
              appSettings.setVoiceSettings({ voiceEnabled: checked })
            }
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTitle}>
            {t('crewPage.voice.language')}
          </div>

          <Select
            className={styles.control}
            value={settings.voiceLanguage}
            options={LANGUAGES.map((language) => ({
              value: language,
              label: EXPERIMENTAL_LANGUAGES.includes(language)
                ? `${t(`crewPage.voice.languages.${language}`)} · ${t('crewPage.voice.experimental')}`
                : t(`crewPage.voice.languages.${language}`),
            }))}
            onChange={(language) => {
              appSettings.setVoiceSettings({
                voiceLanguage: language,
                voiceName: '',
              });
              void crew.loadPack();
            }}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTitle}>{t('crewPage.voice.voice')}</div>

          <Select
            className={styles.control}
            value={settings.voiceName}
            options={voices}
            onChange={(voiceName) =>
              appSettings.setVoiceSettings({ voiceName })
            }
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTitle}>{t('crewPage.voice.output')}</div>

          <Select
            className={styles.control}
            value={settings.voiceOutputDevice}
            options={outputs}
            onChange={(voiceOutputDevice) =>
              appSettings.setVoiceSettings({ voiceOutputDevice })
            }
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTitle}>{t('crewPage.voice.input')}</div>

          <Select
            className={styles.control}
            value={settings.voiceInputDevice}
            options={inputs}
            onChange={(voiceInputDevice) =>
              appSettings.setVoiceSettings({ voiceInputDevice })
            }
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTitle}>
            {t('crewPage.voice.volume', {
              percent: Math.round(settings.voiceVolume * PERCENT),
            })}
          </div>

          <Slider
            className={styles.control}
            min={0}
            max={1}
            step={VOLUME_STEP}
            value={settings.voiceVolume}
            onChange={(voiceVolume) =>
              appSettings.setVoiceSettings({ voiceVolume })
            }
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTitle}>
            {t('crewPage.voice.speed', { speed: settings.voiceSpeed })}
          </div>

          <Slider
            className={styles.control}
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={SPEED_STEP}
            value={settings.voiceSpeed}
            onChange={(voiceSpeed) =>
              appSettings.setVoiceSettings({ voiceSpeed })
            }
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('crewPage.voice.confidence', {
                percent: Math.round(settings.voiceConfidence * PERCENT),
              })}
            </div>

            <div className={styles.fieldDesc}>
              {t('crewPage.voice.confidenceDesc')}
            </div>
          </div>

          <Slider
            className={styles.control}
            min={0}
            max={1}
            step={CONFIDENCE_STEP}
            value={settings.voiceConfidence}
            onChange={(voiceConfidence) =>
              appSettings.setVoiceSettings({ voiceConfidence })
            }
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>{t('crewPage.voice.test')}</div>

            <div className={styles.fieldDesc}>
              {t('crewPage.voice.testDesc')}
            </div>

            <div
              className={`${styles.testResult} ${crew.lastTest ? '' : styles.testIdle}`}
            >
              {crew.lastTest
                ? t('crewPage.voice.testResult', {
                    text: crew.lastTest.text || '—',
                    intent:
                      crew.lastTest.intents.length > 0
                        ? crew.lastTest.intents.join(', ')
                        : t('crewPage.voice.testNotUnderstood'),
                    percent: Math.round(crew.lastTest.confidence * PERCENT),
                  })
                : t('crewPage.voice.testIdle')}
            </div>
          </div>

          <Button
            icon={<Mic size={14} />}
            type={crew.testing ? 'primary' : 'default'}
            disabled={!settings.voiceEnabled}
            onPointerDown={() => crew.testPress(true)}
            onPointerUp={() => crew.testPress(false)}
            onPointerLeave={() => crew.testing && crew.testPress(false)}
          >
            {t('crewPage.voice.hold')}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
});

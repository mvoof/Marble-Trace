import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Empty, Progress, Segmented, Select, Tag } from 'antd';
import {
  Download,
  FileUp,
  FolderUp,
  Play,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import type { VoiceComponentView } from '@shared/contracts/generated/bindings';
import styles from './CrewPage.module.scss';

const BYTES_PER_MEGABYTE = 1024 * 1024;
const PERCENT = 100;

type DownloadsTab = 'recognition' | 'voices' | 'custom';
/** A language's voices, or every voice. */
type VoiceLanguageFilter = string;

const DOWNLOADS_TABS: DownloadsTab[] = ['recognition', 'voices', 'custom'];
const ALL_LANGUAGES = 'all';
const RECOGNITION_KINDS = ['sttEngine', 'sttModel'];

const megabytes = (bytes: number) => Math.round(bytes / BYTES_PER_MEGABYTE);

/** The engines, voices and models: what is installed, and getting the rest. */
export const CrewDownloads = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const [tab, setTab] = useState<DownloadsTab>('voices');

  return (
    <>
      {crew.recommendedMissing.length > 0 && (
        <Alert
          className={styles.alert}
          type="info"
          showIcon
          message={t('crewPage.downloads.banner', {
            size: megabytes(crew.recommendedMissingBytes),
          })}
          action={
            <Button
              type="primary"
              icon={<Download size={14} />}
              loading={crew.downloading}
              onClick={() => void crew.installRecommended()}
            >
              {t('crewPage.downloads.recommended')}
            </Button>
          }
        />
      )}

      <Segmented
        className={styles.downloadsTabs}
        value={tab}
        onChange={(value) => setTab(value as DownloadsTab)}
        options={DOWNLOADS_TABS.map((value) => ({
          value,
          label: t(`crewPage.downloads.tabs.${value}`),
        }))}
      />

      {tab === 'recognition' && <RecognitionDownloads />}

      {tab === 'voices' && <VoiceDownloads />}

      {tab === 'custom' && <CustomVoices />}

      {crew.status && (
        <SettingsCard title={t('crewPage.downloads.folder')}>
          <div className={styles.fieldRow}>
            <div className={`${styles.fieldDesc} ${styles.mono}`}>
              {crew.status.voiceFolder}
            </div>

            <div className={styles.actions}>
              <Button
                onClick={() =>
                  crew.status && crew.revealFolder(crew.status.voiceFolder)
                }
              >
                {t('crewPage.openFolder')}
              </Button>

              <Button
                disabled={crew.busy || crew.downloading}
                onClick={() => void crew.changeFolder()}
              >
                {t('crewPage.downloads.changeFolder')}
              </Button>

              {crew.customFolder && (
                <Button
                  disabled={crew.busy || crew.downloading}
                  onClick={() => void crew.changeFolder(true)}
                >
                  {t('crewPage.downloads.defaultFolder')}
                </Button>
              )}
            </div>
          </div>

          <div className={styles.fieldHint}>
            {t('crewPage.downloads.folderDesc')}
          </div>
        </SettingsCard>
      )}
    </>
  );
});

const RecognitionDownloads = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const components = crew.components.filter((component) =>
    RECOGNITION_KINDS.includes(component.kind)
  );

  return (
    <SettingsCard title={t('crewPage.downloads.tabs.recognition')}>
      {components.map((component) => (
        <ComponentRow key={component.id} component={component} />
      ))}
    </SettingsCard>
  );
});

const VoiceDownloads = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const [chosen, setChosen] = useState<VoiceLanguageFilter | null>(null);
  const crewHasVoices = crew.voiceLanguages.some(
    ({ language }) => language === crew.language
  );
  const filter = chosen ?? (crewHasVoices ? crew.language : ALL_LANGUAGES);
  const engines = crew.components.filter(
    (component) => component.kind === 'ttsEngine'
  );
  const voices = crew.components
    .filter(
      (component) =>
        component.kind === 'ttsVoice' &&
        (filter === ALL_LANGUAGES || component.language === filter)
    )
    .sort(
      (left, right) =>
        Number(right.recommended) - Number(left.recommended) ||
        left.title.localeCompare(right.title)
    );
  const allVoices = crew.voiceLanguages.reduce(
    (total, { count }) => total + count,
    0
  );
  const languageOptions = [
    {
      value: ALL_LANGUAGES,
      label: `${t('crewPage.downloads.languageFilter.all')} · ${allVoices}`,
    },
    ...crew.voiceLanguages.map(({ language, count }) => ({
      value: language,
      label: `${t(`crewPage.voice.languages.${language}`, { defaultValue: language })} · ${count}`,
    })),
  ];

  return (
    <>
      <SettingsCard title={t('crewPage.downloads.kind.ttsEngine')}>
        {engines.map((component) => (
          <ComponentRow key={component.id} component={component} />
        ))}
      </SettingsCard>

      <SettingsCard
        title={t('crewPage.downloads.voicesTitle', { count: voices.length })}
        extra={
          <Select
            size="small"
            showSearch
            optionFilterProp="label"
            className={styles.languagePicker}
            value={filter}
            onChange={setChosen}
            options={languageOptions}
            aria-label={t('crewPage.voice.language')}
          />
        }
      >
        {voices.map((component) => (
          <ComponentRow key={component.id} component={component} />
        ))}
      </SettingsCard>
    </>
  );
});

const CustomVoices = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const names = crew.status?.customVoices ?? [];

  return (
    <SettingsCard
      title={t('crewPage.downloads.customVoice')}
      extra={
        <div className={styles.componentRow}>
          <Button
            icon={<FolderUp size={14} />}
            onClick={() => void crew.importCustomVoiceFolder()}
          >
            {t('crewPage.downloads.importFolder')}
          </Button>

          <Button
            icon={<FileUp size={14} />}
            onClick={() => void crew.importCustomVoice()}
          >
            {t('crewPage.downloads.importVoice')}
          </Button>
        </div>
      }
    >
      <div className={styles.fieldGroup}>
        <div className={styles.fieldDesc}>
          {t('crewPage.downloads.customVoiceDesc')}
        </div>
      </div>

      {names.length === 0 && (
        <div className={styles.fieldGroup}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('crewPage.downloads.noCustomVoices')}
          />
        </div>
      )}

      {names.map((name) => (
        <div key={name} className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={`${styles.fieldTitle} ${styles.mono}`}>{name}</div>

            <Button
              icon={<Trash2 size={14} />}
              onClick={() => void crew.removeCustomVoice(name)}
              aria-label={t('crewPage.downloads.remove')}
            />
          </div>
        </div>
      ))}
    </SettingsCard>
  );
});

const ComponentRow = observer(
  ({ component }: { component: VoiceComponentView }) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const progress = crew.downloads[component.id];
    const running = progress !== undefined && !progress.finished;
    const percent =
      running && progress.totalBytes > 0
        ? Math.round((progress.doneBytes / progress.totalBytes) * PERCENT)
        : 0;
    const stateColor =
      component.state === 'installed'
        ? 'green'
        : component.state === 'outdated'
          ? 'orange'
          : 'default';
    const playing = crew.playingSample === component.id;

    return (
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {component.title}{' '}
              <Tag color={stateColor}>
                {t(`crewPage.downloads.state.${component.state}`)}
              </Tag>
              {component.recommended && component.kind === 'ttsVoice' && (
                <Tag color="blue">{t('crewPage.downloads.recommendedTag')}</Tag>
              )}
            </div>

            <div className={styles.fieldDesc}>
              {t(`crewPage.downloads.kind.${component.kind}`)} ·{' '}
              {megabytes(component.sizeBytes)} MB ·{' '}
              <Button
                className={styles.inlineLink}
                type="link"
                size="small"
                onClick={() => crew.openLicense(component)}
              >
                {component.license}
              </Button>
            </div>
          </div>

          <div className={styles.componentRow}>
            {component.sampleUrl !== null && (
              <Button
                icon={playing ? <Square size={14} /> : <Play size={14} />}
                onClick={() => crew.toggleSample(component)}
                aria-label={t('crewPage.downloads.sample')}
                title={t('crewPage.downloads.sample')}
              />
            )}

            {running ? (
              <>
                <Progress
                  className={styles.componentProgress}
                  percent={percent}
                  size="small"
                />

                <Button
                  icon={<X size={14} />}
                  onClick={() => crew.cancelDownload()}
                  aria-label={t('crewPage.downloads.cancel')}
                />
              </>
            ) : component.state === 'installed' ? (
              <Button
                icon={<Trash2 size={14} />}
                onClick={() => void crew.remove(component.id)}
                aria-label={t('crewPage.downloads.remove')}
              />
            ) : (
              <>
                <Button
                  icon={<Download size={14} />}
                  disabled={crew.downloading}
                  onClick={() => void crew.install(component.id)}
                >
                  {t('crewPage.downloads.download')}
                </Button>

                <Button
                  icon={<FileUp size={14} />}
                  onClick={() => void crew.importFiles(component.id)}
                  aria-label={t('crewPage.downloads.importFiles')}
                />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
);

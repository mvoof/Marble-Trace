import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Input, Segmented, Tag, Tooltip } from 'antd';
import { AudioLines, MessageSquare, Plus, Search } from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { VOICE_QUESTION_PREFIX } from '@shared/contracts/generated/backend-constants';
import type {
  VoiceIntentView,
  VoicePackView,
} from '@shared/contracts/generated/bindings';
import { ActionCard } from './ActionCard';
import { PhraseEditor } from './PhraseEditor';
import { CrewSaveBar } from './CrewSaveBar';
import { RadioCheck } from './RadioCheck';
import { SyntaxHelp } from './SyntaxHelp';
import styles from './CrewCommands.module.scss';

/** Intents grouped by the first part of their id: `pit.fuel` is a pit order. */
const GROUPS = ['pit', 'query', 'control'] as const;

/** The list's own entry for the answers no single command owns. */
const SHARED_ANSWERS = 'shared';

const groupOf = (intent: VoiceIntentView) => intent.id.split('.')[0];

/** The phrases no command answers with: not understood, no data. */
const sharedPhrases = (pack: VoicePackView) => {
  const answered = new Set(pack.intents.flatMap((intent) => intent.replies));

  return pack.phrases.filter((phrase) => !answered.has(phrase.key));
};

/**
 * What the driver can say and what the engineer answers: the commands listed
 * on the left — found by name or by a sentence as it would be said — and the
 * chosen one edited on the right.
 */
export const CrewCommands = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const pack = crew.pack;

  if (!pack) {
    return null;
  }

  const actionTitle = (id: string) => {
    const questionName = crew.questionName(id);

    if (questionName === null) {
      return t(`crewPage.actions.${id}.title`, { defaultValue: id });
    }

    return questionName || t('crewPage.questions.untitled');
  };
  const needle = filter.trim().toLowerCase();
  const matches = (intent: VoiceIntentView) =>
    needle.length === 0 ||
    actionTitle(intent.id).toLowerCase().includes(needle);
  const questions = pack.intents.filter((intent) =>
    intent.id.startsWith(VOICE_QUESTION_PREFIX)
  );
  const groups = [
    ...GROUPS.map((group) => ({
      key: group,
      title: t(`crewPage.commands.groups.${group}`),
      intents: pack.intents.filter((intent) => groupOf(intent) === group),
    })),
    {
      key: 'questions',
      title: t('crewPage.questions.title'),
      intents: questions,
    },
  ].map((group) => ({ ...group, intents: group.intents.filter(matches) }));
  const current =
    selected === SHARED_ANSWERS
      ? null
      : (pack.intents.find((intent) => intent.id === selected) ??
        pack.intents[0] ??
        null);
  const conflicts = crew.draftCheck?.conflicts ?? pack.conflicts;
  const sentenceCount = crew.draftCheck?.sentenceCount ?? pack.sentenceCount;
  const addQuestion = () => {
    const key = crew.addQuestion(t('crewPage.questions.newName'));

    if (key) {
      setSelected(key);
    }
  };

  const heardIntents = new Set(
    crew.trial?.heard.map((heard) => heard.intent) ?? []
  );

  return (
    <div className={styles.root}>
      <div className={styles.commands}>
        <div className={styles.list}>
          <Input
            allowClear
            prefix={<Search size={14} />}
            placeholder={t('crewPage.commands.search')}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />

          <SentenceTrial />

          <div className={styles.listScroll}>
            {groups
              .filter((group) => group.intents.length > 0)
              .map((group) => (
                <div className={styles.group} key={group.key}>
                  <div className={styles.groupTitle}>{group.title}</div>

                  {group.intents.map((intent) => (
                    <CommandItem
                      key={intent.id}
                      intent={intent}
                      title={actionTitle(intent.id)}
                      active={intent.id === current?.id}
                      heard={heardIntents.has(intent.id)}
                      conflicted={conflicts.some((conflict) =>
                        conflict.intents.includes(intent.id)
                      )}
                      onSelect={() => setSelected(intent.id)}
                    />
                  ))}
                </div>
              ))}

            <div className={styles.group}>
              <button
                type="button"
                className={`${styles.item} ${selected === SHARED_ANSWERS ? styles.itemActive : ''}`}
                onClick={() => setSelected(SHARED_ANSWERS)}
              >
                <MessageSquare size={14} className={styles.itemIcon} />

                <span className={styles.itemTitle}>
                  {t('crewPage.phrases.shared')}
                </span>
              </button>
            </div>
          </div>

          <Button block icon={<Plus size={14} />} onClick={addQuestion}>
            {t('crewPage.questions.add')}
          </Button>

          <div className={styles.listFooter}>
            {t('crewPage.commands.counts', {
              intents: pack.intents.length,
              sentences: sentenceCount,
            })}

            {crew.draftCheck && !crew.draftCheck.vocabularyChecked && (
              <div>{t('crewPage.commands.vocabularyUnchecked')}</div>
            )}
          </div>
        </div>

        <div className={styles.detail}>
          {pack.issues.map((issue) => (
            <Alert
              key={`${issue.location}:${issue.message}`}
              className={styles.alert}
              type={issue.severity === 'error' ? 'error' : 'warning'}
              showIcon
              message={`${issue.location}: ${issue.message}`}
            />
          ))}

          <div className={styles.detailHeader}>
            <h3 className={styles.detailTitle}>
              {current ? actionTitle(current.id) : t('crewPage.phrases.shared')}
            </h3>

            <EditingTools />
          </div>

          {current &&
            conflicts
              .filter((conflict) => conflict.intents.includes(current.id))
              .map((conflict) => (
                <Alert
                  key={conflict.sentence}
                  className={styles.alert}
                  type="warning"
                  showIcon
                  message={t('crewPage.commands.conflict', {
                    sentence: conflict.sentence,
                    intents: conflict.intents.map(actionTitle).join(', '),
                  })}
                />
              ))}

          {current ? (
            <ActionCard key={current.id} intent={current} />
          ) : (
            <SharedAnswers />
          )}
        </div>
      </div>

      <CrewSaveBar
        lead={<RadioCheck actionTitle={actionTitle} onOpen={setSelected} />}
      />
    </div>
  );
});

interface CommandItemProps {
  intent: VoiceIntentView;
  title: string;
  active: boolean;
  /** The sentence tried last calls this command. */
  heard: boolean;
  conflicted: boolean;
  onSelect: () => void;
}

/** A command in the list: its name, how many sentences call it, what is wrong. */
const CommandItem = observer(
  ({
    intent,
    title,
    active,
    heard,
    conflicted,
    onSelect,
  }: CommandItemProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const checks = intent.templates.map((_, index) =>
      crew.templateChecks.get(`${intent.id}#${index}`)
    );
    const sentences = checks.reduce(
      (total, check) => total + (check?.sentences ?? 0),
      0
    );
    const broken = checks.some((check) => check?.error);

    return (
      <button
        type="button"
        className={`${styles.item} ${active ? styles.itemActive : ''}`}
        onClick={onSelect}
      >
        <span className={styles.itemTitle}>{title}</span>

        {heard && <AudioLines size={12} className={styles.itemHeard} />}

        {broken && <Tag color="red">{t('crewPage.commands.broken')}</Tag>}

        {!broken && conflicted && (
          <Tag color="orange">{t('crewPage.commands.conflicted')}</Tag>
        )}

        {checks.some(Boolean) && (
          <span className={styles.itemCount}>{sentences}</span>
        )}
      </button>
    );
  }
);

/** A sentence typed as it would be said; what it calls shows in the radio check. */
const SentenceTrial = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');

  return (
    <Input.Search
      placeholder={t('crewPage.commands.tryShort')}
      title={t('crewPage.commands.tryPlaceholder')}
      enterButton={
        <Tooltip title={t('crewPage.commands.tryButton')}>
          <AudioLines size={14} />
        </Tooltip>
      }
      onSearch={(sentence) => void crew.trySentence(sentence)}
    />
  );
});

/** Blocks or text for every sentence and reply, and how a sentence is written. */
const EditingTools = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');

  return (
    <div className={styles.tools}>
      <Tooltip title={t('crewPage.blocks.modeDesc')}>
        <Segmented
          size="small"
          value={crew.blockEditing ? 'blocks' : 'text'}
          onChange={(mode) => crew.setBlockEditing(mode === 'blocks')}
          options={[
            { value: 'blocks', label: t('crewPage.blocks.blocks') },
            { value: 'text', label: t('crewPage.blocks.text') },
          ]}
        />
      </Tooltip>

      <SyntaxHelp />
    </div>
  );
});

/** The answers no single command owns: not understood, no data. */
const SharedAnswers = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');

  return (
    <div className={styles.shared}>
      <div className={styles.sharedDesc}>{t('crewPage.phrases.desc')}</div>

      {crew.pack &&
        sharedPhrases(crew.pack).map((phrase) => (
          <PhraseEditor key={phrase.key} phrase={phrase} />
        ))}
    </div>
  );
});

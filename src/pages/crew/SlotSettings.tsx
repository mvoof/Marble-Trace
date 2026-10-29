import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Select } from 'antd';
import { NUMBER_SLOT } from '@features/voice-crew/voice-crew.store';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { VOICE_ASK_WHEN_UNSAID } from '@shared/contracts/generated/backend-constants';
import type { VoiceIntentView } from '@shared/contracts/generated/bindings';
import styles from './CrewPage.module.scss';

/** A number the engineer takes for an unsaid number until one is typed. */
const FIRST_UNSAID_NUMBER = '1';

interface SlotSettingsProps {
  intent: VoiceIntentView;
  slot: string;
}

/**
 * Everything about one of an action's values: what it means, the words for
 * each of its values, and what a sentence that leaves it out does.
 */
export const SlotSettings = observer(({ intent, slot }: SlotSettingsProps) => (
  <div className={styles.slotSettings}>
    <SlotWords slot={slot} />

    {intent.whenUnsaid !== null && intent.slots[0] === slot && (
      <WhenUnsaid intentId={intent.id} slot={slot} value={intent.whenUnsaid} />
    )}
  </div>
));

interface WhenUnsaidProps {
  intentId: string;
  slot: string;
  value: string;
}

/**
 * What a sentence that leaves the value out does: the engineer asks for it,
 * or takes the value chosen here — all four tyres for "change the tyres".
 */
const WhenUnsaid = observer(({ intentId, slot, value }: WhenUnsaidProps) => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const isNumber = slot === NUMBER_SLOT;
  const asks = value === VOICE_ASK_WHEN_UNSAID;
  const values =
    crew.pack?.slots.find((candidate) => candidate.slot === slot)?.values ?? [];
  const options = [
    { value: VOICE_ASK_WHEN_UNSAID, label: t('crewPage.commands.unsaidAsk') },
    ...(isNumber
      ? [{ value: 'number', label: t('crewPage.commands.unsaidNumber') }]
      : values.map((entry) => ({
          value: entry.value,
          label: t(`crewPage.commands.slotValues.${slot}.${entry.value}`, {
            defaultValue: entry.value,
          }),
        }))),
  ];
  const selected = isNumber && !asks ? 'number' : value;

  return (
    <div>
      <div className={styles.fieldTitle}>
        {t('crewPage.commands.unsaidTitle', { slot: `{${slot}}` })}
      </div>

      <div className={styles.fieldDesc}>
        {t('crewPage.commands.unsaidDesc')}
      </div>

      <div className={`${styles.actions} ${styles.slotControls}`}>
        <Select
          size="small"
          className={styles.control}
          value={selected}
          options={options}
          onChange={(next: string) =>
            crew.setWhenUnsaid(
              intentId,
              next === 'number' ? FIRST_UNSAID_NUMBER : next
            )
          }
        />

        {isNumber && !asks && (
          <InputNumber
            size="small"
            min={0}
            precision={0}
            value={Number(value)}
            onChange={(next) =>
              next !== null && crew.setWhenUnsaid(intentId, String(next))
            }
          />
        )}
      </div>
    </div>
  );
});

/** What a slot means, and — unless it is a number — the words for each value. */
const SlotWords = observer(({ slot }: { slot: string }) => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const values =
    crew.pack?.slots.find((candidate) => candidate.slot === slot)?.values ?? [];

  return (
    <div>
      <div className={styles.fieldTitle}>
        {t('crewPage.commands.slotTitle', { slot: `{${slot}}` })}
      </div>

      <div className={styles.fieldDesc}>
        {t(`crewPage.commands.slots.${slot}`)}
      </div>

      {slot !== NUMBER_SLOT &&
        values.map((value) => (
          <div className={styles.slotRow} key={value.value}>
            <span className={styles.slotValue}>
              {t(`crewPage.commands.slotValues.${slot}.${value.value}`, {
                defaultValue: value.value,
              })}
            </span>

            <Select
              size="small"
              className={styles.variantText}
              mode="tags"
              value={value.phrases}
              open={false}
              suffixIcon={null}
              onChange={(phrases: string[]) =>
                crew.setSlotPhrases(slot, value.value, phrases)
              }
            />
          </div>
        ))}
    </div>
  );
});

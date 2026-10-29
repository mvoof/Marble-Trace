import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, InputNumber, Select } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import {
  NUMBER_SLOT,
  type StepAction,
} from '@features/voice-crew/voice-crew.store';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import {
  VOICE_CHAT_MACRO_ACTION,
  VOICE_CHAT_MACRO_COUNT,
} from '@shared/contracts/generated/backend-constants';
import type { VoiceStep } from '@shared/contracts/generated/bindings';
import styles from './CrewPage.module.scss';

/** The most liters a fuel step takes — the number words go no higher. */
const MAX_FUEL_LITERS = 200;

/**
 * What a question carries out before it answers, in order: pit actions and
 * the sim's chat macros, each with its value.
 */
export const QuestionSteps = observer(
  ({ questionId }: { questionId: string }) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const steps = crew.findQuestion(questionId)?.steps ?? [];
    const actionName = (action: string) =>
      t(`crewPage.actions.${action}.title`, { defaultValue: action });

    return (
      <div className={styles.actionSection}>
        <div className={styles.fieldTitle}>{t('crewPage.questions.steps')}</div>

        <div className={styles.fieldHint}>
          {t('crewPage.questions.stepsDesc')}
        </div>

        {steps.map((step, index) => (
          <StepRow
            key={index}
            questionId={questionId}
            index={index}
            step={step}
            actions={crew.stepActions}
            actionName={actionName}
          />
        ))}

        <div className={styles.actions}>
          <Dropdown
            trigger={['click']}
            menu={{
              items: crew.stepActions.map(({ action }) => ({
                key: action,
                label: actionName(action),
                onClick: () => crew.addStep(questionId, action),
              })),
            }}
          >
            <Button size="small" icon={<Plus size={12} />}>
              {t('crewPage.questions.addStep')}
            </Button>
          </Dropdown>
        </div>
      </div>
    );
  }
);

interface StepRowProps {
  questionId: string;
  index: number;
  step: VoiceStep;
  actions: StepAction[];
  actionName: (action: string) => string;
}

const StepRow = observer(
  ({ questionId, index, step, actions, actionName }: StepRowProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const slot =
      actions.find((candidate) => candidate.action === step.action)?.slot ??
      null;
    const setValue = (value: string | null) =>
      crew.setStep(questionId, index, { ...step, value });

    return (
      <div className={styles.variantRow}>
        <span className={styles.stepNumber}>{index + 1}</span>

        <Select
          className={styles.variantText}
          value={step.action}
          options={actions.map(({ action }) => ({
            value: action,
            label: actionName(action),
          }))}
          onChange={(action: string) =>
            crew.setStep(questionId, index, {
              action,
              value: crew.defaultStepValue(action),
            })
          }
        />

        {slot === NUMBER_SLOT && (
          <InputNumber
            min={1}
            max={
              step.action === VOICE_CHAT_MACRO_ACTION
                ? VOICE_CHAT_MACRO_COUNT
                : MAX_FUEL_LITERS
            }
            precision={0}
            value={Number(step.value ?? 1)}
            addonBefore={
              step.action === VOICE_CHAT_MACRO_ACTION
                ? t('crewPage.questions.macroSlot')
                : undefined
            }
            onChange={(value) => value !== null && setValue(String(value))}
          />
        )}

        {slot !== null && slot !== NUMBER_SLOT && (
          <Select
            className={styles.stepValue}
            value={step.value ?? undefined}
            options={(
              crew.pack?.slots.find((candidate) => candidate.slot === slot)
                ?.values ?? []
            ).map(({ value }) => ({
              value,
              label: t(`crewPage.commands.slotValues.${slot}.${value}`, {
                defaultValue: value,
              }),
            }))}
            onChange={(value: string) => setValue(value)}
          />
        )}

        <Button
          icon={<Trash2 size={14} />}
          onClick={() => crew.removeStep(questionId, index)}
          aria-label={t('crewPage.questions.removeStep')}
        />
      </div>
    );
  }
);

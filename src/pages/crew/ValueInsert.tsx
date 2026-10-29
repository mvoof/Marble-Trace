import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Input, Modal, Segmented, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { Plus } from 'lucide-react';
import {
  pluralForms,
  pluralMessage,
  pluralSample,
  type PluralForm,
} from '@features/voice-crew/plural-message';
import {
  SIM_SCALES,
  defaultSimScale,
  searchVariables,
  simValueName,
  type OverlayVariable,
  type SimScale,
} from '@features/voice-crew/sim-values';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import styles from './CrewPage.module.scss';

/** Values the engineer fills with a name, not a number — no word to agree. */
const TEXT_VALUES = ['compound'];

interface ValueInsertProps {
  language: string;
  values: string[];
  /** A question's reply, which may also read any of the sim's variables. */
  simValues?: boolean;
  /** What the menu offers before the values: plain text, for blocks. */
  leadingItems?: NonNullable<MenuProps['items']>;
  onInsert: (text: string) => void;
}

/** A value being agreed with a word: its name in the reply, and what to call it. */
interface AgreeingValue {
  value: string;
  label: string;
}

/**
 * Puts a value into a reply: as it is, or — for a number — with the word that
 * agrees with it, its forms typed in one field each.
 */
export const ValueInsert = observer(
  ({
    language,
    values,
    simValues = false,
    leadingItems = [],
    onInsert,
  }: ValueInsertProps) => {
    const { t } = useTranslation('main-app');
    const [agreeing, setAgreeing] = useState<AgreeingValue | null>(null);
    const [pickingVariable, setPickingVariable] = useState(false);

    if (values.length === 0 && !simValues && leadingItems.length === 0) {
      return null;
    }

    const valueItems = values.flatMap((value) => {
      const plain = {
        key: `${value}:plain`,
        label: t('crewPage.values.insertPlain', {
          value: t(`crewPage.values.names.${value}`),
        }),
        onClick: () => onInsert(`{${value}}`),
      };

      if (TEXT_VALUES.includes(value)) {
        return [plain];
      }

      return [
        plain,
        {
          key: `${value}:plural`,
          label: t('crewPage.values.insertWithWord', {
            value: t(`crewPage.values.names.${value}`),
          }),
          onClick: () =>
            setAgreeing({
              value,
              label: t(`crewPage.values.names.${value}`),
            }),
        },
      ];
    });
    const ownItems = simValues
      ? [
          ...valueItems,
          { type: 'divider' as const },
          {
            key: 'sim',
            label: t('crewPage.values.simVariable'),
            onClick: () => setPickingVariable(true),
          },
        ]
      : valueItems;
    const items =
      leadingItems.length > 0 && ownItems.length > 0
        ? [...leadingItems, { type: 'divider' as const }, ...ownItems]
        : [...leadingItems, ...ownItems];

    return (
      <>
        <Dropdown menu={{ items }} trigger={['click']}>
          <Tooltip title={t('crewPage.values.insert')}>
            <Button
              size="small"
              type="text"
              icon={<Plus size={14} />}
              aria-label={t('crewPage.values.insert')}
            />
          </Tooltip>
        </Dropdown>

        {pickingVariable && (
          <SimVariableDialog
            onClose={() => setPickingVariable(false)}
            onInsert={(text) => {
              onInsert(text);
              setPickingVariable(false);
            }}
            onAgree={(value, label) => {
              setPickingVariable(false);
              setAgreeing({ value, label });
            }}
          />
        )}

        {agreeing && (
          <PluralDialog
            language={language}
            value={agreeing.value}
            label={agreeing.label}
            onClose={() => setAgreeing(null)}
            onInsert={(text) => {
              onInsert(text);
              setAgreeing(null);
            }}
          />
        )}
      </>
    );
  }
);

interface SimVariableDialogProps {
  onClose: () => void;
  onInsert: (text: string) => void;
  /** The number with a word that agrees with it, written next. */
  onAgree: (value: string, label: string) => void;
}

/** The sim's variables the overlay reads, found by name or description, and how to read one. */
const SimVariableDialog = observer(
  ({ onClose, onInsert, onAgree }: SimVariableDialogProps) => {
    const crew = useVoiceCrewStore();
    const { t } = useTranslation('main-app');
    const [query, setQuery] = useState('');
    const [chosen, setChosen] = useState<OverlayVariable | null>(null);
    const [scale, setScale] = useState<SimScale>('whole');
    const found = searchVariables(crew.simVariables, query);
    const value = chosen ? simValueName(chosen.name, scale) : null;

    useEffect(() => {
      void crew.loadSimVariables();
    }, [crew]);

    const missing = crew.missingSimVariables;

    const choose = (variable: OverlayVariable) => {
      setChosen(variable);
      setScale(defaultSimScale(variable));
    };

    return (
      <Modal
        open
        width={640}
        title={t('crewPage.values.simTitle')}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('crewPage.values.cancel')}
          </Button>,
          <Button
            key="word"
            disabled={value === null}
            onClick={() => chosen && value && onAgree(value, chosen.name)}
          >
            {t('crewPage.values.simWithWord')}
          </Button>,
          <Button
            key="insert"
            type="primary"
            disabled={value === null}
            onClick={() => value && onInsert(`{${value}}`)}
          >
            {t('crewPage.values.insert')}
          </Button>,
        ]}
      >
        <div className={styles.fieldDesc}>
          {t('crewPage.values.simList', { count: crew.simVariables.length })}
          {crew.simVariablesLive && ` ${t('crewPage.values.simMissingNote')}`}
        </div>

        <Input
          className={styles.variableSearch}
          allowClear
          value={query}
          placeholder={t('crewPage.values.simSearch')}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className={styles.variableList}>
          {found.map((variable) => (
            <button
              type="button"
              key={variable.name}
              className={
                variable.name === chosen?.name
                  ? `${styles.variableRow} ${styles.variableRowActive}`
                  : styles.variableRow
              }
              onClick={() => choose(variable)}
            >
              <span className={styles.variableName}>
                {variable.name}
                {variable.unit && (
                  <span className={styles.variableUnit}>
                    {' '}
                    · {variable.unit}
                  </span>
                )}
                {variable.ready && (
                  <span className={styles.variableReady}>
                    {' '}
                    ·{' '}
                    {t('crewPage.values.simReady', {
                      value: `{${variable.ready}}`,
                    })}
                  </span>
                )}
                {missing.has(variable.name) && (
                  <span className={styles.variableUnit}>
                    {' '}
                    · {t('crewPage.values.simMissing')}
                  </span>
                )}
              </span>

              {variable.desc && (
                <span className={styles.variableDesc}>{variable.desc}</span>
              )}
            </button>
          ))}

          {found.length === 0 && (
            <div className={styles.fieldDesc}>
              {t('crewPage.values.simNothing')}
            </div>
          )}
        </div>

        {chosen?.ready && (
          <div className={styles.variableRead}>
            <div className={styles.fieldDesc}>
              {t('crewPage.values.simReadyDesc', {
                value: `{${chosen.ready}}`,
              })}
            </div>

            <Button
              type="primary"
              onClick={() => chosen.ready && onInsert(`{${chosen.ready}}`)}
            >
              {t('crewPage.values.simReadyInsert', {
                value: `{${chosen.ready}}`,
              })}
            </Button>
          </div>
        )}

        {value !== null && (
          <div className={styles.variableRead}>
            <div className={styles.fieldTitle}>
              {t('crewPage.values.simRead')}
            </div>

            <Segmented
              value={scale}
              onChange={(next) => setScale(next as SimScale)}
              options={SIM_SCALES.map((option) => ({
                value: option,
                label: t(`crewPage.values.simScales.${option}`),
              }))}
            />

            <div className={styles.fieldHint}>{`{${value}}`}</div>
          </div>
        )}
      </Modal>
    );
  }
);

interface PluralDialogProps {
  language: string;
  value: string;
  /** What the value is called in the dialog's title. */
  label: string;
  /** The forms already written, when an agreeing word is edited. */
  initialWords?: Partial<Record<PluralForm, string>>;
  okText?: string;
  onClose: () => void;
  onInsert: (text: string) => void;
}

/** The word that agrees with a number, one field per form the language has. */
export const PluralDialog = observer(
  ({
    language,
    value,
    label,
    initialWords = {},
    okText,
    onClose,
    onInsert,
  }: PluralDialogProps) => {
    const { t } = useTranslation('main-app');
    const forms = pluralForms(language);
    const [words, setWords] =
      useState<Partial<Record<PluralForm, string>>>(initialWords);
    const complete = forms.every((form) => (words[form] ?? '').trim() !== '');
    const numberFormat = new Intl.NumberFormat(language);

    return (
      <Modal
        open
        title={t('crewPage.values.pluralTitle', { value: label })}
        okText={okText ?? t('crewPage.values.insert')}
        okButtonProps={{ disabled: !complete }}
        onOk={() => onInsert(pluralMessage(value, words))}
        onCancel={onClose}
      >
        <div className={styles.fieldDesc}>
          {t('crewPage.values.pluralDesc')}
        </div>

        {forms.map((form) => {
          const sample = numberFormat.format(pluralSample(language, form));

          return (
            <div className={styles.pluralRow} key={form}>
              <span className={styles.pluralSample}>{sample}</span>

              <Input
                value={words[form] ?? ''}
                placeholder={t('crewPage.values.pluralPlaceholder', {
                  sample,
                })}
                onChange={(event) =>
                  setWords({ ...words, [form]: event.target.value })
                }
              />
            </div>
          );
        })}

        {complete && (
          <div className={styles.fieldHint}>
            {forms
              .map(
                (form) =>
                  `${numberFormat.format(pluralSample(language, form))} ${words[form]?.trim()}`
              )
              .join(' · ')}
          </div>
        )}
      </Modal>
    );
  }
);

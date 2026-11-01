import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Input, Modal, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { Plus } from 'lucide-react';
import {
  pluralForms,
  pluralMessage,
  pluralSample,
  type PluralForm,
} from '@features/voice-crew/plural-message';
import styles from './CrewPage.module.scss';

/** Values the engineer fills with a name, not a number — no word to agree. */
const TEXT_VALUES = ['compound'];

interface ValueInsertProps {
  language: string;
  values: string[];
  /** What the menu offers before the values: plain text, for blocks. */
  leadingItems?: NonNullable<MenuProps['items']>;
  /** A value's name in the menu; a built-in phrase's values by default. */
  valueName?: (value: string) => string;
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
    leadingItems = [],
    valueName,
    onInsert,
  }: ValueInsertProps) => {
    const { t } = useTranslation('main-app');
    const [agreeing, setAgreeing] = useState<AgreeingValue | null>(null);
    const nameOf =
      valueName ?? ((value: string) => t(`crewPage.values.names.${value}`));

    if (values.length === 0 && leadingItems.length === 0) {
      return null;
    }

    const valueItems = values.flatMap((value) => {
      const plain = {
        key: `${value}:plain`,
        label: t('crewPage.values.insertPlain', { value: nameOf(value) }),
        onClick: () => onInsert(`{${value}}`),
      };

      if (TEXT_VALUES.includes(value)) {
        return [plain];
      }

      return [
        plain,
        {
          key: `${value}:plural`,
          label: t('crewPage.values.insertWithWord', { value: nameOf(value) }),
          onClick: () => setAgreeing({ value, label: nameOf(value) }),
        },
      ];
    });
    const items =
      leadingItems.length > 0 && valueItems.length > 0
        ? [...leadingItems, { type: 'divider' as const }, ...valueItems]
        : [...leadingItems, ...valueItems];

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

import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Segmented, Select } from 'antd';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useCarCatalogueStore } from '@entities/cars/car-catalogue-context';
import {
  withRuleChange,
  type RuleSituation,
} from '@entities/layout/auto-switch-rules';
import type { SessionContext } from '@shared/contracts/widget-settings';

import { SESSION_CONTEXTS, SESSION_LOOKS } from './session-labels';
import { ruleOptions } from './rule-options';
import { useLiveCars } from './use-live-cars';
import styles from './SituationPicker.module.scss';

// Ant's Select and Segmented take no null value: "any" travels as this.
const ANY = '';

const EMPTY_DRAFT: RuleSituation = {
  context: null,
  carClass: null,
  carId: null,
};

const fromControl = (value: string): string | null =>
  value === ANY ? null : value;

/** A held option's note — the layout it is on, by name. */
const useHeldNote = () => {
  const layouts = useLayoutsStore();
  const { t } = useTranslation('main-app');

  return (heldBy: string | null): string | null => {
    if (heldBy === null) {
      return null;
    }

    const name =
      layouts.layouts.find((layout) => layout.id === heldBy)?.name ?? heldBy;

    return t('layoutList.autoSwitch.onLayout', { name });
  };
};

interface PickerOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Why a disabled option is taken: the layout holding it. */
  note?: string | null;
}

// Ant hands groups through here too: they carry a label, never a note.
const renderPickerOption = (option: { data: Partial<PickerOption> }) => (
  <span className={styles.option}>
    <span className={styles.optionLabel}>{option.data.label}</span>

    {option.data.note && (
      <span className={styles.optionNote}>{option.data.note}</span>
    )}
  </span>
);

interface SituationPickerProps {
  layoutId: string;
  onAdded: () => void;
}

/**
 * A situation for a layout: a session, then a class or a car. An option
 * another layout holds is disabled and names that layout.
 */
export const SituationPicker = observer(
  ({ layoutId, onAdded }: SituationPickerProps) => {
    const layouts = useLayoutsStore();
    const catalogue = useCarCatalogueStore();
    const liveCars = useLiveCars();
    const heldNote = useHeldNote();
    const { t } = useTranslation('main-app');
    const [draft, setDraft] = useState<RuleSituation>(EMPTY_DRAFT);

    const { classes, carGroups, carBadge, heldBy } = ruleOptions({
      catalogue: catalogue.cars,
      liveCars,
      draft,
      rules: layouts.autoSwitchRules,
    });

    const changeDraft = (change: Partial<RuleSituation>) => {
      setDraft((current) => withRuleChange(current, change));
    };

    const sessionOptions = [
      { value: ANY, label: t('layoutList.autoSwitch.anySessionShort') },
      ...SESSION_CONTEXTS.map((context) => ({
        value: context,
        label: t(SESSION_LOOKS[context].labelKey),
      })),
    ];
    const classOptions: PickerOption[] = [
      { value: ANY, label: t('layoutList.autoSwitch.anyClass') },
      ...classes.map((option) => ({
        value: option.badge,
        label: option.badge,
        disabled: option.heldBy !== null,
        note: heldNote(option.heldBy),
      })),
    ];
    const carOptions = [
      { value: ANY, label: t('layoutList.autoSwitch.anyCar') },
      ...carGroups.map((group) => {
        const groupLabel = group.badge ?? t('layoutList.autoSwitch.noClass');

        return {
          label: groupLabel,
          title: groupLabel,
          options: group.cars.map((car) => ({
            value: String(car.carId),
            label:
              car.name ?? t('layoutList.autoSwitch.carById', { id: car.carId }),
            disabled: car.heldBy !== null,
            note: heldNote(car.heldBy),
          })),
        };
      }),
    ];
    const heldDraftNote = heldNote(heldBy);

    const handleCarChange = (value: string) => {
      const carId = fromControl(value);

      changeDraft({ carId: carId === null ? null : Number(carId) });
    };

    const handleAdd = () => {
      if (layouts.addAutoSwitchRule(layoutId, draft)) {
        setDraft(EMPTY_DRAFT);
        onAdded();
      }
    };

    return (
      <div className={styles.picker}>
        <Segmented
          size="small"
          value={draft.context ?? ANY}
          options={sessionOptions}
          onChange={(value) =>
            changeDraft({
              context: fromControl(value) as SessionContext | null,
            })
          }
          aria-label={t('layoutList.autoSwitch.session')}
        />

        {carBadge === null ? (
          <Select
            showSearch
            optionFilterProp="label"
            value={draft.carClass ?? ANY}
            options={classOptions}
            optionRender={renderPickerOption}
            onChange={(value: string) =>
              changeDraft({ carClass: fromControl(value) })
            }
            aria-label={t('layoutList.autoSwitch.carClass')}
          />
        ) : (
          <span className={styles.carBadge}>
            <span className={styles.carBadgeLabel}>
              {t('layoutList.autoSwitch.carClass')}
            </span>
            {carBadge}
          </span>
        )}

        <Select
          showSearch
          optionFilterProp="label"
          value={draft.carId === null ? ANY : String(draft.carId)}
          options={carOptions}
          optionRender={renderPickerOption}
          onChange={handleCarChange}
          aria-label={t('layoutList.autoSwitch.car')}
        />

        <div className={styles.pickerFooter}>
          {heldDraftNote && (
            <span className={styles.heldNote}>{heldDraftNote}</span>
          )}

          <Button
            className={styles.addButton}
            type="primary"
            size="small"
            disabled={heldBy !== null}
            onClick={handleAdd}
          >
            {t('layoutList.autoSwitch.add')}
          </Button>
        </div>
      </div>
    );
  }
);

import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popover, Tooltip } from 'antd';
import { Plus, X } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useCarCatalogueStore } from '@entities/cars/car-catalogue-context';
import { rulesTakingOver } from '@entities/layout/auto-switch-rules';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { cx } from '@shared/lib/class-names';
import type { AutoSwitchRule } from '@shared/contracts/widget-settings';

import { SituationPicker } from './SituationPicker';
import { useSituationLabel } from './use-situation-label';
import styles from './ShowWhenBlock.module.scss';

interface ShowWhenBlockProps {
  layoutId: string;
}

interface SituationChipProps {
  rule: AutoSwitchRule;
  isAutoSwitchEnabled: boolean;
}

/**
 * One situation of the layout. A situation that changes nothing — other
 * situations put the same layout on without it — is marked, and says why on
 * hover.
 */
const SituationChip = observer(
  ({ rule, isAutoSwitchEnabled }: SituationChipProps) => {
    const layouts = useLayoutsStore();
    const catalogue = useCarCatalogueStore();
    const situationLabel = useSituationLabel();
    const { t } = useTranslation('main-app');

    const takingOver = rulesTakingOver(
      layouts.autoSwitchRules,
      rule,
      catalogue.cars
    );
    let redundantHint: string | null = null;

    if (takingOver === null) {
      redundantHint = null;
    } else if (takingOver.length === 0) {
      redundantHint = t('layoutList.autoSwitch.shadowed');
    } else {
      redundantHint = t('layoutList.autoSwitch.redundant', {
        rules: takingOver.map(situationLabel).join(', '),
      });
    }

    return (
      <Tooltip title={redundantHint}>
        <span
          className={cx(
            styles.chip,
            !isAutoSwitchEnabled && styles.chipOff,
            redundantHint !== null && styles.chipRedundant
          )}
        >
          {situationLabel(rule)}

          <button
            type="button"
            className={styles.removeChip}
            onClick={() => layouts.removeAutoSwitchRule(rule.id)}
            aria-label={t('layoutList.autoSwitch.removeSituation')}
            title={t('layoutList.autoSwitch.removeSituation')}
          >
            <X size={12} />
          </button>
        </span>
      </Tooltip>
    );
  }
);

/**
 * The situations that put a layout on screen, as chips: removed by their
 * cross, added through the `+` picker.
 */
export const ShowWhenBlock = observer(({ layoutId }: ShowWhenBlockProps) => {
  const layouts = useLayoutsStore();
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const [isPicking, setIsPicking] = useState(false);

  const isAutoSwitchEnabled = appSettings.appSettings.autoSwitchLayouts;
  const layoutRules = layouts.autoSwitchRules.filter(
    (rule) => rule.layoutId === layoutId
  );

  return (
    <section className={styles.block}>
      <span className={styles.title}>
        {t('layoutList.autoSwitch.showWhen')}
      </span>

      <div className={styles.chips}>
        {layoutRules.length === 0 && (
          <span className={styles.notAssigned}>
            {t('layoutList.notAutoSwitched')}
          </span>
        )}

        {layoutRules.map((rule) => (
          <SituationChip
            key={rule.id}
            rule={rule}
            isAutoSwitchEnabled={isAutoSwitchEnabled}
          />
        ))}

        <Popover
          trigger="click"
          placement="bottomLeft"
          open={isPicking}
          onOpenChange={setIsPicking}
          destroyOnHidden
          content={
            <SituationPicker
              layoutId={layoutId}
              onAdded={() => setIsPicking(false)}
            />
          }
        >
          <Button
            size="small"
            type="text"
            className={styles.addChip}
            icon={<Plus size={14} />}
            aria-label={t('layoutList.autoSwitch.addSituation')}
            title={t('layoutList.autoSwitch.addSituation')}
          />
        </Popover>
      </div>
    </section>
  );
});

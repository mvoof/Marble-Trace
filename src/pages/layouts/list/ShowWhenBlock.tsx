import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popover } from 'antd';
import { Plus, X } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { cx } from '@shared/lib/class-names';

import { SituationPicker } from './SituationPicker';
import { useSituationLabel } from './use-situation-label';
import styles from './ShowWhenBlock.module.scss';

interface ShowWhenBlockProps {
  layoutId: string;
}

/**
 * The situations that put a layout on screen, as chips: removed by their
 * cross, added through the `+` picker.
 */
export const ShowWhenBlock = observer(({ layoutId }: ShowWhenBlockProps) => {
  const layouts = useLayoutsStore();
  const appSettings = useAppSettingsStore();
  const situationLabel = useSituationLabel();
  const { t } = useTranslation('main-app');
  const [isPicking, setIsPicking] = useState(false);

  const autoSwitchEnabled = appSettings.appSettings.autoSwitchLayouts;
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
          <span
            key={rule.id}
            className={cx(styles.chip, !autoSwitchEnabled && styles.chipOff)}
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

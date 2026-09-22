import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Slider } from 'antd';

import type { PitLineWidgetSettings } from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { useUnitsStore } from '@store/root-store-context';

import { Card } from './Card';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';
import { distanceScale } from './distance-scale';

// The bars' own pit entry countdown. Zero switches it off and they appear on
// pit road; past a kilometer they are up for most of a lap on a short track.
const APPROACH_MIN_M = 0;
const APPROACH_MAX_M = 1000;
const APPROACH_STEP_M = 50;
const APPROACH_STEP_FT = 100;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['pit-line'];

const { SwitchRow } = panelRows<PitLineWidgetSettings>();

export const PitLineSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('pit-line');
  const { t } = useTranslation('widgets');
  const units = useUnitsStore();

  const settings =
    liveWidgets.getSettings<PitLineWidgetSettings>(panelWidgetId);

  const isImperial = units.unitSystem === 'imperial';

  const approachScale = distanceScale(isImperial, {
    minM: APPROACH_MIN_M,
    maxM: APPROACH_MAX_M,
    stepM: APPROACH_STEP_M,
    stepFt: APPROACH_STEP_FT,
  });

  const update = (partial: Partial<PitLineWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.pitLine.sections')}>
        <SwitchRow
          settingKey="showPitSpeed"
          title={t('settingsPanels.pitLine.pitSpeed')}
          desc={t('settingsPanels.pitLine.pitSpeedDesc')}
        />

        <SwitchRow
          settingKey="showPitApproach"
          title={t('settingsPanels.pitLine.approach')}
          desc={t('settingsPanels.pitLine.approachDesc')}
        />

        <SwitchRow
          settingKey="showPitBrakeCue"
          dependsOn="showPitApproach"
          title={t('settingsPanels.pitLine.brakeCue')}
          desc={t('settingsPanels.pitLine.brakeCueDesc')}
        />

        <SwitchRow
          settingKey="showUnits"
          title={t('settingsPanels.pitLine.showUnits')}
          desc={t('settingsPanels.pitLine.showUnitsDesc')}
        />
      </Card>

      <Card title={t('settingsPanels.pitLine.visibility')}>
        <SwitchRow
          settingKey="alwaysVisible"
          title={t('settingsPanels.pitLine.alwaysVisible')}
          desc={t('settingsPanels.pitLine.alwaysVisibleDesc')}
        />

        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>
            {t('settingsPanels.pitLine.revealOnApproach', {
              distance: `${approachScale.toDisplay(settings.revealOnApproachM)} ${approachScale.unit}`,
            })}
          </div>

          <div className={styles.fieldDesc}>
            {t('settingsPanels.pitLine.revealOnApproachDesc')}
          </div>

          <Slider
            min={approachScale.min}
            max={approachScale.max}
            step={approachScale.step}
            value={approachScale.toDisplay(settings.revealOnApproachM)}
            onChange={(value) =>
              update({ revealOnApproachM: approachScale.toMeters(value) })
            }
          />
        </div>
      </Card>
    </>
  );
});

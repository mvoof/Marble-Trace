import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Slider } from 'antd';

import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { useUnitsStore } from '@entities/app-settings/units-context';

import { Card } from '@features/widget-settings/Card';
import { usePanelSettings } from '@features/widget-settings/use-panel-settings';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { distanceScale } from '@features/widget-settings/distance-scale';
import {
  PIT_LINE_SETTINGS,
  type PitLineWidgetSettings,
} from './settings-schema';

// The slider's step, per unit system; the bounds are the setting's own.
const APPROACH_STEP_M = 50;
const APPROACH_STEP_FT = 100;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['pit-line'];

const { Row, useLabels } = schemaRows(PIT_LINE_SETTINGS);
const { revealOnApproachM } = PIT_LINE_SETTINGS.shape;

export const PitLineSettingsPanel = observer(() => {
  const [settings, update] =
    usePanelSettings<PitLineWidgetSettings>('pit-line');
  const { t } = useTranslation('widgets');
  const units = useUnitsStore();
  const revealLabels = useLabels('revealOnApproachM');

  const isImperial = units.unitSystem === 'imperial';

  const approachScale = distanceScale(isImperial, {
    minM: revealOnApproachM.min,
    maxM: revealOnApproachM.max,
    stepM: APPROACH_STEP_M,
    stepFt: APPROACH_STEP_FT,
  });

  return (
    <>
      <Card title={t('settingsPanels.pitLine.sections')}>
        <Row setting="showPitSpeed" />

        <Row setting="showLimitPlate" dependsOn="showPitSpeed" />

        <Row setting="showPitApproach" />

        <Row setting="showPitBrakeCue" dependsOn="showPitApproach" />

        <Row setting="showUnits" />
      </Card>

      <Card title={t('settingsPanels.pitLine.visibility')}>
        <Row setting="alwaysVisible" />

        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>
            {t('settingsPanels.pitLine.revealOnApproachM', {
              distance: `${approachScale.toDisplay(settings.revealOnApproachM)} ${approachScale.unit}`,
            })}
          </div>

          <div className={styles.fieldDesc}>{revealLabels.desc}</div>

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

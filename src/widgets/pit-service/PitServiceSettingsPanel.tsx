import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Slider } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { usePanelSettings } from '@features/widget-settings/use-panel-settings';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { distanceScale } from '@features/widget-settings/distance-scale';
import {
  PIT_SERVICE_SETTINGS,
  type PitServiceWidgetSettings,
} from './settings-schema';

// The slider is read and dragged in the driver's own units; the setting stays
// meters, its bounds the schema's. The step is rounded to something a foot
// scale would actually offer rather than to whatever 50 m converts to.
const APPROACH_STEP_M = 50;
const APPROACH_STEP_FT = 100;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['pit-service'];

const { Row, useLabels } = schemaRows(PIT_SERVICE_SETTINGS);
const { revealOnApproachM, commandRevealSeconds } = PIT_SERVICE_SETTINGS.shape;

export const PitServiceSettingsPanel = observer(() => {
  const [settings, update] =
    usePanelSettings<PitServiceWidgetSettings>('pit-service');
  const { t } = useTranslation('widgets');
  const units = useUnitsStore();
  const revealLabels = useLabels('revealOnApproachM');
  const commandRevealLabels = useLabels('commandRevealSeconds');

  // Both distances are stored in meters and shown in whatever the app is set
  // to: a driver on imperial reads and drags feet, and the file still holds the
  // one unit every comparison in the widget is made in.
  const isImperial = units.unitSystem === 'imperial';

  const approachScale = distanceScale(isImperial, {
    minM: revealOnApproachM.min,
    maxM: revealOnApproachM.max,
    stepM: APPROACH_STEP_M,
    stepFt: APPROACH_STEP_FT,
  });

  return (
    <>
      <Card group="content">
        <Row setting="showFuel" />
        <Row setting="showTires" />
        <Row setting="showRepairs" />
        <Row setting="showFooter" />
      </Card>

      <Card title={t('settingsPanels.pitService.position')}>
        <Row setting="classPositionInMulticlass" />

        <Row setting="showProjectedPosition" />
      </Card>

      <Card group="behaviour">
        <Row setting="alwaysVisible" />

        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>
            {t('settingsPanels.pitService.revealOnApproachM', {
              distance: `${approachScale.toDisplay(settings.revealOnApproachM)} ${approachScale.unit}`,
            })}
          </div>

          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {revealLabels.desc}
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

        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>
            {t('settingsPanels.pitService.commandRevealSeconds', {
              seconds: settings.commandRevealSeconds,
            })}
          </div>

          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {commandRevealLabels.desc}
          </div>

          <Slider
            min={commandRevealSeconds.min}
            max={commandRevealSeconds.max}
            step={commandRevealSeconds.step}
            value={settings.commandRevealSeconds}
            onChange={(value) => update({ commandRevealSeconds: value })}
          />
        </div>
      </Card>

      {/*
        The auto-mode rules and the fuel key step are the car's, not this
        screen's: they live under Settings, and this card only says so — a
        panel on a stream screen used to offer them and ignore them.
      */}
      <Card title={t('settingsPanels.pitService.commands')}>
        <div className={styles.fieldDesc}>
          {t('settingsPanels.pitService.strategyMoved')}
        </div>
      </Card>
    </>
  );
});

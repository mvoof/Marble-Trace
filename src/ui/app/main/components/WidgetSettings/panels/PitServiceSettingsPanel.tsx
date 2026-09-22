import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider, Switch } from 'antd';
import type {
  FuelAdjustStep,
  PitServiceWidgetSettings,
} from '@/types/widget-settings';
import { FUEL_ADJUST_STEPS } from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';
import { useUnitsStore } from '@store/root-store-context';
import { distanceScale } from './distance-scale';

// Remaining tread, in percent. Above 90 every fresh set would be ordered and
// below 10 the tires are already gone, so neither end is worth offering.
const WEAR_THRESHOLD_MIN_PCT = 10;
const WEAR_THRESHOLD_MAX_PCT = 90;
const WEAR_THRESHOLD_STEP_PCT = 5;

// The pit entry countdown. Below 100 m the box arrives after the braking, and
// past 1 km it is up for most of a lap on a short track. Zero switches it off.
const APPROACH_MIN_M = 0;
const APPROACH_MAX_M = 1000;
const APPROACH_STEP_M = 50;

// The slider is read and dragged in the driver's own units; the setting stays
// meters. The step is rounded to something a foot scale would actually offer
// rather than to whatever 50 m converts to.
const APPROACH_STEP_FT = 100;

// Zero switches the reveal off; past fifteen seconds a pit entry has usually
// shown the panel anyway.
const REVEAL_MIN_S = 0;
const REVEAL_MAX_S = 15;
const REVEAL_STEP_S = 1;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['pit-service'];

const { DependentBlock, SwitchRow } = panelRows<PitServiceWidgetSettings>();

export const PitServiceSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('pit-service');
  const { t } = useTranslation('widgets');
  const units = useUnitsStore();

  const settings =
    liveWidgets.getSettings<PitServiceWidgetSettings>(panelWidgetId);

  // Both distances are stored in meters and shown in whatever the app is set
  // to: a driver on imperial reads and drags feet, and the file still holds the
  // one unit every comparison in the widget is made in.
  const isImperial = units.unitSystem === 'imperial';

  const approachScale = distanceScale(isImperial, {
    minM: APPROACH_MIN_M,
    maxM: APPROACH_MAX_M,
    stepM: APPROACH_STEP_M,
    stepFt: APPROACH_STEP_FT,
  });

  const update = (partial: Partial<PitServiceWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  const sections = [
    {
      titleKey: 'settingsPanels.pitService.fuel',
      descKey: 'settingsPanels.pitService.fuelDesc',
      value: settings.showFuel,
      key: 'showFuel',
    },
    {
      titleKey: 'settingsPanels.pitService.tires',
      descKey: 'settingsPanels.pitService.tiresDesc',
      value: settings.showTires,
      key: 'showTires',
    },
    {
      titleKey: 'settingsPanels.pitService.repairs',
      descKey: 'settingsPanels.pitService.repairsDesc',
      value: settings.showRepairs,
      key: 'showRepairs',
    },
    {
      titleKey: 'settingsPanels.pitService.footer',
      descKey: 'settingsPanels.pitService.footerDesc',
      value: settings.showFooter,
      key: 'showFooter',
    },
  ] as const;

  return (
    <>
      <Card title={t('settingsPanels.pitService.sections')}>
        {sections.map((section) => (
          <SettingRow
            key={section.key}
            title={t(section.titleKey)}
            desc={t(section.descKey)}
          >
            <Switch
              checked={section.value}
              onChange={(checked) => update({ [section.key]: checked })}
            />
          </SettingRow>
        ))}
      </Card>

      <Card title={t('settingsPanels.pitService.position')}>
        <SwitchRow
          settingKey="classPositionInMulticlass"
          title={t('settingsPanels.common.classPositionInMulticlass')}
          desc={t('settingsPanels.common.classPositionInMulticlassDesc')}
        />

        <SwitchRow
          settingKey="showProjectedPosition"
          title={t('settingsPanels.pitService.projectedPosition')}
          desc={t('settingsPanels.pitService.projectedPositionDesc')}
        />
      </Card>

      <Card title={t('settingsPanels.pitService.visibility')}>
        <SwitchRow
          settingKey="alwaysVisible"
          title={t('settingsPanels.pitService.alwaysVisible')}
          desc={t('settingsPanels.pitService.alwaysVisibleDesc')}
        />

        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>
            {t('settingsPanels.pitService.revealOnApproach', {
              distance: `${approachScale.toDisplay(settings.revealOnApproachM)} ${approachScale.unit}`,
            })}
          </div>

          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {t('settingsPanels.pitService.revealOnApproachDesc')}
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
            {t('settingsPanels.pitService.commandRevealSecondsDesc')}
          </div>

          <Slider
            min={REVEAL_MIN_S}
            max={REVEAL_MAX_S}
            step={REVEAL_STEP_S}
            value={settings.commandRevealSeconds}
            onChange={(value) => update({ commandRevealSeconds: value })}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.pitService.commands')}>
        {/*
          Auto mode has no master switch: it is on exactly when it has something
          to order, so these two toggles are the whole of it.
        */}
        <SwitchRow
          settingKey="autoFuel"
          title={t('settingsPanels.pitService.autoFuel')}
          desc={t('settingsPanels.pitService.autoFuelDesc')}
        />

        <SwitchRow
          settingKey="autoTires"
          title={t('settingsPanels.pitService.autoTires')}
          desc={t('settingsPanels.pitService.autoTiresDesc')}
        />

        <DependentBlock dependsOn="autoTires">
          <div className={styles.fieldLabel}>
            {t('settingsPanels.pitService.autoTireWearThreshold', {
              percent: settings.autoTireWearThreshold,
            })}
          </div>

          <Slider
            min={WEAR_THRESHOLD_MIN_PCT}
            max={WEAR_THRESHOLD_MAX_PCT}
            step={WEAR_THRESHOLD_STEP_PCT}
            value={settings.autoTireWearThreshold}
            onChange={(value) => update({ autoTireWearThreshold: value })}
          />
        </DependentBlock>

        {/*
          Not gated on auto mode: the step belongs to the fuel up / down keys,
          which are the driver's own hands and work whether auto mode is on or
          not.
        */}
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.pitService.fuelAdjustStep')}
          </span>

          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {t('settingsPanels.pitService.fuelAdjustStepDesc')}
          </div>

          <Segmented
            block
            value={settings.fuelAdjustStep}
            options={FUEL_ADJUST_STEPS.map((step) => ({
              label: String(step),
              value: step,
            }))}
            onChange={(value) =>
              update({ fuelAdjustStep: value as FuelAdjustStep })
            }
          />
        </div>
      </Card>
    </>
  );
});

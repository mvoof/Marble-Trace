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
import { panelRows } from './setting-rows';
import { useUnitsStore } from '@store/root-store-context';
import {
  displayDistanceToMeters,
  metersToDisplayDistance,
} from '@utils/telemetry-format';

// Remaining tread, in percent. Above 90 every fresh set would be ordered and
// below 10 the tires are already gone, so neither end is worth offering.
const WEAR_THRESHOLD_MIN_PCT = 10;
const WEAR_THRESHOLD_MAX_PCT = 90;
const WEAR_THRESHOLD_STEP_PCT = 5;

// The countdown warns from this far out. Below 20 m the warning arrives after
// the braking, and past 250 m every lap of the pit lane would be amber.
const CUE_MIN_M = 20;
const CUE_MAX_M = 250;
const CUE_STEP_M = 10;

// The pit entry countdown. Below 100 m the box arrives after the braking, and
// past 1 km it is up for most of a lap on a short track. Zero switches it off.
const APPROACH_MIN_M = 0;
const APPROACH_MAX_M = 1000;
const APPROACH_STEP_M = 50;

// The sliders are read and dragged in the driver's own units; the setting stays
// meters. Steps are rounded to something a foot scale would actually offer
// rather than to whatever 10 m converts to.
const CUE_STEP_FT = 25;
const APPROACH_STEP_FT = 100;

// Meters are stored to the centimeter — enough for a foot slider to land back
// on its own notch, short of writing a float nobody can read into the file.
const CM_PER_M = 100;

// Zero switches the reveal off; past fifteen seconds a pit entry has usually
// shown the panel anyway.
const REVEAL_MIN_S = 0;
const REVEAL_MAX_S = 15;
const REVEAL_STEP_S = 1;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['pit-service'];

const { SwitchRow } = panelRows<PitServiceWidgetSettings>();

interface DistanceSliderScale {
  min: number;
  max: number;
  step: number;
  unit: string;
  toDisplay: (meters: number) => number;
  toMeters: (value: number) => number;
}

const distanceScale = (
  isImperial: boolean,
  bounds: { minM: number; maxM: number; stepM: number; stepFt: number }
): DistanceSliderScale => {
  const system = isImperial ? 'imperial' : 'metric';
  const toDisplay = (meters: number) =>
    Math.round(metersToDisplayDistance(meters, system));

  return {
    min: toDisplay(bounds.minM),
    max: toDisplay(bounds.maxM),
    step: isImperial ? bounds.stepFt : bounds.stepM,
    unit: isImperial ? 'ft' : 'm',
    toDisplay,
    // Feet are kept exact rather than rounded to whole meters: 100 ft is
    // 30.48 m, and a 30 m round trip reads back as 98 ft — the thumb would
    // slide off the notch the driver just dropped it on. Meters are already
    // whole, so they stay whole.
    toMeters: (value: number) =>
      isImperial
        ? Math.round(displayDistanceToMeters(value, system) * CM_PER_M) /
          CM_PER_M
        : Math.round(value),
  };
};

export const PitServiceSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');
  const units = useUnitsStore();

  const settings =
    widgetSettings.getSettings<PitServiceWidgetSettings>('pit-service');

  // Both distances are stored in meters and shown in whatever the app is set
  // to: a driver on imperial reads and drags feet, and the file still holds the
  // one unit every comparison in the widget is made in.
  const isImperial = units.unitSystem === 'imperial';

  const cueScale = distanceScale(isImperial, {
    minM: CUE_MIN_M,
    maxM: CUE_MAX_M,
    stepM: CUE_STEP_M,
    stepFt: CUE_STEP_FT,
  });

  const approachScale = distanceScale(isImperial, {
    minM: APPROACH_MIN_M,
    maxM: APPROACH_MAX_M,
    stepM: APPROACH_STEP_M,
    stepFt: APPROACH_STEP_FT,
  });

  const update = (partial: Partial<PitServiceWidgetSettings>) => {
    widgetSettings.updateUserSettings('pit-service', {
      ...settings,
      ...partial,
    });
  };

  const sections = [
    {
      titleKey: 'settingsPanels.pitService.pitSpeed',
      descKey: 'settingsPanels.pitService.pitSpeedDesc',
      value: settings.showPitSpeed,
      key: 'showPitSpeed',
    },
    {
      titleKey: 'settingsPanels.pitService.approach',
      descKey: 'settingsPanels.pitService.approachDesc',
      value: settings.showPitApproach,
      key: 'showPitApproach',
    },
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

      {settings.showPitApproach && (
        <Card title={t('settingsPanels.pitService.approachCard')}>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              {t('settingsPanels.pitService.approachCueDist', {
                distance: `${cueScale.toDisplay(settings.pitApproachCueDistM)} ${cueScale.unit}`,
              })}
            </div>

            <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
              {t('settingsPanels.pitService.approachCueDistDesc')}
            </div>

            <Slider
              min={cueScale.min}
              max={cueScale.max}
              step={cueScale.step}
              value={cueScale.toDisplay(settings.pitApproachCueDistM)}
              onChange={(value) =>
                update({ pitApproachCueDistM: cueScale.toMeters(value) })
              }
            />
          </div>

          <SwitchRow
            settingKey="showPitBrakeCue"
            title={t('settingsPanels.pitService.brakeCue')}
            desc={t('settingsPanels.pitService.brakeCueDesc')}
          />
        </Card>
      )}

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

        {settings.autoTires && (
          <div className={styles.fieldGroup}>
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
          </div>
        )}

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

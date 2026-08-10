import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider, Switch } from 'antd';
import type {
  FuelAdjustStep,
  PitServiceWidgetSettings,
} from '@/types/widget-settings';
import { FUEL_ADJUST_STEPS } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

// Remaining tread, in percent. Above 90 every fresh set would be ordered and
// below 10 the tires are already gone, so neither end is worth offering.
const WEAR_THRESHOLD_MIN_PCT = 10;
const WEAR_THRESHOLD_MAX_PCT = 90;
const WEAR_THRESHOLD_STEP_PCT = 5;

// Zero switches the reveal off; past fifteen seconds a pit entry has usually
// shown the panel anyway.
const REVEAL_MIN_S = 0;
const REVEAL_MAX_S = 15;
const REVEAL_STEP_S = 1;

export const PitServiceSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<PitServiceWidgetSettings>('pit-service');

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
        <SettingRow
          title={t('settingsPanels.common.classPositionInMulticlass')}
          desc={t('settingsPanels.common.classPositionInMulticlassDesc')}
        >
          <Switch
            checked={settings.classPositionInMulticlass}
            onChange={(checked) =>
              update({ classPositionInMulticlass: checked })
            }
          />
        </SettingRow>

        <SettingRow
          title={t('settingsPanels.pitService.projectedPosition')}
          desc={t('settingsPanels.pitService.projectedPositionDesc')}
        >
          <Switch
            checked={settings.showProjectedPosition}
            onChange={(checked) => update({ showProjectedPosition: checked })}
          />
        </SettingRow>
      </Card>

      <Card title={t('settingsPanels.pitService.visibility')}>
        <SettingRow
          title={t('settingsPanels.pitService.alwaysVisible')}
          desc={t('settingsPanels.pitService.alwaysVisibleDesc')}
        >
          <Switch
            checked={settings.alwaysVisible}
            onChange={(checked) => update({ alwaysVisible: checked })}
          />
        </SettingRow>

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
        <SettingRow
          title={t('settingsPanels.pitService.autoFuel')}
          desc={t('settingsPanels.pitService.autoFuelDesc')}
        >
          <Switch
            checked={settings.autoFuel}
            onChange={(checked) => update({ autoFuel: checked })}
          />
        </SettingRow>

        <SettingRow
          title={t('settingsPanels.pitService.autoTires')}
          desc={t('settingsPanels.pitService.autoTiresDesc')}
        >
          <Switch
            checked={settings.autoTires}
            onChange={(checked) => update({ autoTires: checked })}
          />
        </SettingRow>

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

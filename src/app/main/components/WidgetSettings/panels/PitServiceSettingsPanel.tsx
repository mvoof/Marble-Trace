import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Select, Switch } from 'antd';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import { HotkeyRecorder } from '@app/main/components/HotkeyRecorder/HotkeyRecorder';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

const TIRE_OPTIONS: PitServiceWidgetSettings['commandTires'][] = [
  'none',
  'all',
  'fronts',
  'rears',
];

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

        <SettingRow
          title={t('settingsPanels.pitService.toggleHotkey')}
          desc={t('settingsPanels.pitService.toggleHotkeyDesc')}
        >
          <HotkeyRecorder
            currentHotkey={settings.toggleHotkey}
            onApply={(hotkey) => update({ toggleHotkey: hotkey })}
            onClear={() => update({ toggleHotkey: '' })}
          />
        </SettingRow>
      </Card>

      <Card title={t('settingsPanels.pitService.commands')}>
        <SettingRow
          title={t('settingsPanels.pitService.enableCommands')}
          desc={t('settingsPanels.pitService.enableCommandsDesc')}
        >
          <Switch
            checked={settings.enableCommands}
            onChange={(checked) => update({ enableCommands: checked })}
          />
        </SettingRow>

        <SettingRow
          title={t('settingsPanels.pitService.commandTires')}
          desc={t('settingsPanels.pitService.commandTiresDesc')}
        >
          <Select
            value={settings.commandTires}
            disabled={!settings.enableCommands}
            onChange={(value) => update({ commandTires: value })}
            options={TIRE_OPTIONS.map((option) => ({
              value: option,
              label: t(`settingsPanels.pitService.commandTires_${option}`),
            }))}
          />
        </SettingRow>

        <SettingRow
          title={t('settingsPanels.pitService.applyOrderHotkey')}
          desc={t('settingsPanels.pitService.applyOrderHotkeyDesc')}
        >
          <HotkeyRecorder
            currentHotkey={settings.applyOrderHotkey}
            onApply={(hotkey) => update({ applyOrderHotkey: hotkey })}
            onClear={() => update({ applyOrderHotkey: '' })}
          />
        </SettingRow>

        <SettingRow
          title={t('settingsPanels.pitService.clearOrderHotkey')}
          desc={t('settingsPanels.pitService.clearOrderHotkeyDesc')}
        >
          <HotkeyRecorder
            currentHotkey={settings.clearOrderHotkey}
            onApply={(hotkey) => update({ clearOrderHotkey: hotkey })}
            onClear={() => update({ clearOrderHotkey: '' })}
          />
        </SettingRow>
      </Card>
    </>
  );
});

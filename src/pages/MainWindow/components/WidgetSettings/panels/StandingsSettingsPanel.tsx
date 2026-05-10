import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { StandingsWidgetSettings } from '../../../../../types/widget-settings';
import { HotkeyRecorder } from '../../../../../components/shared/HotkeyRecorder/HotkeyRecorder';
import styles from '../WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';

export const StandingsSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getStandingsSettings();

  const update = (partial: Partial<StandingsWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('standings', {
      standings: { ...settings, ...partial },
    });
  };

  return (
    <>
      <Card title="Logic & Grouping">
        <SettingRow
          title="Class Cycling"
          desc="Show one class at a time. Off shows all drivers combined."
        >
          <Switch
            checked={settings.enableClassCycling}
            onChange={(v) => update({ enableClassCycling: v })}
          />
        </SettingRow>
      </Card>

      <Card title="Hotkeys">
        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label="Toggle Class Cycling"
            currentHotkey={settings.classCyclingToggleHotkey}
            onApply={(key) => update({ classCyclingToggleHotkey: key })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label="Previous Class"
            currentHotkey={settings.classPrevHotkey}
            onApply={(key) => update({ classPrevHotkey: key })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label="Next Class"
            currentHotkey={settings.classNextHotkey}
            onApply={(key) => update({ classNextHotkey: key })}
          />
        </div>
      </Card>

      <Card title="Data Columns">
        {[
          {
            title: 'Position Change (+/-)',
            desc: 'Arrow showing positions gained or lost since session start.',
            value: settings.showPosChange,
            key: 'showPosChange',
          },
          {
            title: 'Vehicle Brand Logo',
            desc: 'Manufacturer badge next to driver name.',
            value: settings.showBrand,
            key: 'showBrand',
          },
          {
            title: 'Tire Compound',
            desc: 'Visual indicator of current tire type.',
            value: settings.showTire,
            key: 'showTire',
          },
          {
            title: 'Class Badge',
            desc: "Colored badge for the driver's car class.",
            value: settings.showClassBadge,
            key: 'showClassBadge',
          },
          {
            title: 'License / iRating Badge',
            desc: 'Driver safety rating and iRating indicator.',
            value: settings.showIRatingBadge,
            key: 'showIRatingBadge',
          },
          {
            title: 'iRating Delta (projected)',
            desc: 'Projected iRating gain or loss based on current position.',
            value: settings.showIrChange,
            key: 'showIrChange',
          },
          {
            title: 'Laps Completed',
            desc: 'Number of laps completed by each driver.',
            value: settings.showLapsCompleted,
            key: 'showLapsCompleted',
          },
          {
            title: 'Abbreviate Driver Names',
            desc: 'Shorten names to save column space.',
            value: settings.abbreviateNames,
            key: 'abbreviateNames',
          },
        ].map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <SettingRow title={item.title} desc={item.desc}>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </SettingRow>
          </div>
        ))}
      </Card>

      <Card title="Header Info">
        {[
          {
            title: 'Column Headers',
            desc: 'Show labels above each data column.',
            value: settings.showColumnHeaders,
            key: 'showColumnHeaders',
          },
          {
            title: 'Session Progress Info',
            desc: 'Laps or time remaining bar at the top.',
            value: settings.showSessionHeader,
            key: 'showSessionHeader',
          },
          {
            title: 'Live Weather Info',
            desc: 'Wind and temperature row in the header.',
            value: settings.showWeather,
            key: 'showWeather',
          },
          {
            title: 'Strength of Field (SOF)',
            desc: 'Average iRating of all registered drivers.',
            value: settings.showSOF,
            key: 'showSOF',
          },
          {
            title: 'Pit Stop Counter (player only)',
            desc: 'Number of pit stops made by the player car.',
            value: settings.showPitStops,
            key: 'showPitStops',
          },
          {
            title: 'Incidents Badge (player only)',
            desc: 'Incident count accumulated by the player car.',
            value: settings.showIncidentsBadge,
            key: 'showIncidentsBadge',
          },
          {
            title: 'Total Drivers Count',
            desc: 'Total number of drivers in the session.',
            value: settings.showTotalDrivers,
            key: 'showTotalDrivers',
          },
        ].map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <SettingRow title={item.title} desc={item.desc}>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </SettingRow>
          </div>
        ))}
      </Card>
    </>
  );
});

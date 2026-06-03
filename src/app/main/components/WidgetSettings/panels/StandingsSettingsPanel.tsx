import { observer } from 'mobx-react-lite';
import { Switch, Segmented } from 'antd';
import type {
  StandingsViewMode,
  StandingsWidgetSettings,
} from '@/types/widget-settings';
import { HotkeyRecorder } from '@app/main/components/HotkeyRecorder/HotkeyRecorder';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const StandingsSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  const update = (partial: Partial<StandingsWidgetSettings>) => {
    widgetSettings.updateUserSettings('standings', {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title="View Mode">
        <div className={styles.fieldGroup}>
          <Segmented<StandingsViewMode>
            block
            value={settings.viewMode}
            onChange={(v) => update({ viewMode: v })}
            options={[
              { label: 'All Drivers', value: 'all' },
              { label: 'Group by Class', value: 'grouped' },
              { label: 'Class Cycling', value: 'cycling' },
            ]}
          />
        </div>
      </Card>

      <Card title="Hotkeys">
        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label="Cycle View Mode (All → Grouped → Cycling)"
            currentHotkey={settings.viewModeHotkey}
            onApply={(key) => update({ viewModeHotkey: key })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label="Previous Class (Cycling mode)"
            currentHotkey={settings.classPrevHotkey}
            onApply={(key) => update({ classPrevHotkey: key })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label="Next Class (Cycling mode)"
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
          {
            title: 'Driver Flags',
            desc: 'Display active warning flags (e.g. Mechanical Damage/Meatball) next to driver name.',
            value: settings.showDriverFlags,
            key: 'showDriverFlags',
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

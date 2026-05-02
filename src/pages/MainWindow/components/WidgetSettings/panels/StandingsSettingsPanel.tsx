import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { StandingsWidgetSettings } from '../../../../../types/widget-settings';
import { HotkeyRecorder } from '../../../../../components/shared/HotkeyRecorder';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

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
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>Class Cycling</div>
            <div className={styles.fieldDesc}>
              Show one class at a time. Off shows all drivers combined.
            </div>
          </div>
          <Switch
            checked={settings.enableClassCycling}
            onChange={(v) => update({ enableClassCycling: v })}
          />
        </div>
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
            value: settings.showPosChange,
            key: 'showPosChange',
          },
          {
            title: 'Vehicle Brand Logo',
            value: settings.showBrand,
            key: 'showBrand',
          },
          { title: 'Tire Compound', value: settings.showTire, key: 'showTire' },
          {
            title: 'Class Badge',
            value: settings.showClassBadge,
            key: 'showClassBadge',
          },
          {
            title: 'License / iRating Badge',
            value: settings.showIRatingBadge,
            key: 'showIRatingBadge',
          },
          {
            title: 'iRating Delta (projected)',
            value: settings.showIrChange,
            key: 'showIrChange',
          },
          {
            title: 'Pit Stop Count',
            value: settings.showPitStops,
            key: 'showPitStops',
          },
          {
            title: 'Laps Completed',
            value: settings.showLapsCompleted,
            key: 'showLapsCompleted',
          },
          {
            title: 'Abbreviate Driver Names',
            value: settings.abbreviateNames,
            key: 'abbreviateNames',
          },
        ].map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>{item.title}</div>
              </div>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </div>
          </div>
        ))}
      </Card>

      <Card title="Header Info">
        {[
          {
            title: 'Column Headers',
            value: settings.showColumnHeaders,
            key: 'showColumnHeaders',
          },
          {
            title: 'Session Progress Info',
            value: settings.showSessionHeader,
            key: 'showSessionHeader',
          },
          {
            title: 'Live Weather Info',
            value: settings.showWeather,
            key: 'showWeather',
          },
          {
            title: 'Strength of Field (SOF)',
            value: settings.showSOF,
            key: 'showSOF',
          },
          {
            title: 'Total Drivers Count',
            value: settings.showTotalDrivers,
            key: 'showTotalDrivers',
          },
        ].map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>{item.title}</div>
              </div>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </div>
          </div>
        ))}
      </Card>
    </>
  );
});

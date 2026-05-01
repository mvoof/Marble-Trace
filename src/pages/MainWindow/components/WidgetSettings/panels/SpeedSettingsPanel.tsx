import { observer } from 'mobx-react-lite';
import { ColorPicker, InputNumber, Segmented, Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import {
  SpeedWidgetFocusMode,
  SpeedWidgetSettings,
} from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const SpeedSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getSpeedSettings();

  const update = (partial: Partial<SpeedWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('speed', {
      speed: { ...settings, ...partial },
    });
  };

  return (
    <Card title="Module Parameters">
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Primary Focus</span>
        <Segmented
          block
          value={settings.focusMode}
          options={[
            { label: 'Vehicle Speed', value: 'speed' },
            { label: 'Current Gear', value: 'gear' },
          ]}
          onChange={(v) => update({ focusMode: v as SpeedWidgetFocusMode })}
        />
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>RPM Bar Colors</span>
        <div className={styles.rpmColorGrid}>
          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>Low</span>
            <ColorPicker
              value={settings.rpmColorLow}
              onChange={(c) => update({ rpmColorLow: c.toHexString() })}
            />
          </div>
          <div className={styles.rpmColorLine} />
          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>Mid</span>
            <ColorPicker
              value={settings.rpmColorMid}
              onChange={(c) => update({ rpmColorMid: c.toHexString() })}
            />
          </div>
          <div className={styles.rpmColorLine} />
          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>High</span>
            <ColorPicker
              value={settings.rpmColorHigh}
              onChange={(c) => update({ rpmColorHigh: c.toHexString() })}
            />
          </div>
          <div className={styles.rpmColorLine} />
          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>Blink</span>
            <ColorPicker
              value={settings.rpmColorLimit}
              onChange={(c) => update({ rpmColorLimit: c.toHexString() })}
            />
          </div>
        </div>
        <div className={styles.fieldDesc} style={{ marginTop: 6 }}>
          Blink color flashes the entire bar at shift point.
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>RPM Bar</div>
            <div className={styles.fieldDesc}>
              Show segmented RPM bar along the top edge of the widget.
            </div>
          </div>
          <Switch
            checked={settings.showRpmBar}
            onChange={(v) => update({ showRpmBar: v })}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>Temperatures</div>
            <div className={styles.fieldDesc}>
              Show oil and water temperature.
            </div>
          </div>
          <Switch
            checked={settings.showTemps}
            onChange={(v) => update({ showTemps: v })}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>Pit Lane Panel</div>
            <div className={styles.fieldDesc}>
              Show banner with pit speed info when on pit road or limiter
              active.
            </div>
          </div>
          <Switch
            checked={settings.showPitPanel}
            onChange={(v) => update({ showPitPanel: v })}
          />
        </div>
      </div>

      {settings.showPitPanel && (
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Pit Speed Override (km/h)</span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            Leave 0 to auto-detect from session data.
          </div>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.pitSpeedLimitOverride ?? 0}
            min={0}
            max={200}
            step={5}
            onChange={(v) =>
              update({ pitSpeedLimitOverride: v && v > 0 ? v : null })
            }
          />
        </div>
      )}
    </Card>
  );
});

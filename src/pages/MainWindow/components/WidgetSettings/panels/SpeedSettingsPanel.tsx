import { observer } from 'mobx-react-lite';
import { ColorPicker, InputNumber, Segmented, Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { unitsStore } from '../../../../../store/units.store';
import { speedUnit } from '../../../../../utils/telemetry-format';
import {
  SpeedWidgetSettings,
  LedShape,
} from '../../../../../types/widget-settings';
import { Card, SettingRow } from './shared';

import styles from '../WidgetSettings.module.scss';

export const SpeedSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getSpeedSettings();

  const update = (partial: Partial<SpeedWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('speed', {
      speed: { ...settings, ...partial },
    });
  };

  return (
    <>
      <Card title="Gear Panel">
        <div className={styles.fieldGroup}>
          <SettingRow title="Gear Color" desc="Color of the gear digit.">
            <ColorPicker
              value={settings.gearColor}
              onChange={(color) => update({ gearColor: color.toHexString() })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title="Panel Background"
            desc="Background color of the gear panel (not applied during pit state)."
          >
            <ColorPicker
              value={settings.gearPanelBg}
              onChange={(color) => update({ gearPanelBg: color.toRgbString() })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title="RPM Bar">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Colors</span>

          <div className={styles.rpmColorGrid}>
            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>Low</span>

              <ColorPicker
                value={settings.rpmColorLow}
                onChange={(color) =>
                  update({ rpmColorLow: color.toHexString() })
                }
              />
            </div>
            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>Mid</span>

              <ColorPicker
                value={settings.rpmColorMid}
                onChange={(color) =>
                  update({ rpmColorMid: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>High</span>

              <ColorPicker
                value={settings.rpmColorHigh}
                onChange={(color) =>
                  update({ rpmColorHigh: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>Shift</span>

              <ColorPicker
                value={settings.rpmColorShift}
                onChange={(color) =>
                  update({ rpmColorShift: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>Blink</span>

              <ColorPicker
                value={settings.rpmColorLimit}
                onChange={(color) =>
                  update({ rpmColorLimit: color.toHexString() })
                }
              />
            </div>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>LED Shape</span>

          <Segmented
            block
            value={settings.ledShape}
            options={[
              { label: 'Square', value: 'square' },
              { label: 'Circle', value: 'circle' },
            ]}
            onChange={(value) => update({ ledShape: value as LedShape })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title="RPM Bar" desc="Show segmented RPM bar.">
            <Switch
              checked={settings.showRpmBar}
              onChange={(value) => update({ showRpmBar: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title="Color RPM Text"
            desc="Apply zone color to the RPM number display."
          >
            <Switch
              checked={settings.showRpmColor}
              onChange={(value) => update({ showRpmColor: value })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title="Display">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Temperatures"
            desc="Show oil and water temperature badges."
          >
            <Switch
              checked={settings.showTemps}
              onChange={(value) => update({ showTemps: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            Pit Speed Override ({speedUnit(unitsStore.system)})
          </span>

          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            Leave 0 to auto-detect from session data.
          </div>

          <InputNumber
            style={{ width: '100%' }}
            value={settings.pitSpeedLimitOverride ?? 0}
            min={0}
            max={200}
            step={5}
            onChange={(value) =>
              update({
                pitSpeedLimitOverride: value && value > 0 ? value : null,
              })
            }
          />
        </div>
      </Card>
    </>
  );
});

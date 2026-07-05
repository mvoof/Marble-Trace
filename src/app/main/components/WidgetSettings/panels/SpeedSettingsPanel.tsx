import { observer } from 'mobx-react-lite';
import { ColorPicker, InputNumber, Segmented, Switch } from 'antd';
import { speedUnit } from '@utils/formatters/telemetry-format';
import {
  SpeedWidgetSettings,
  LedShape,
  PitBoxSide,
} from '@/types/widget-settings';
import { Card } from './Card';
import { SettingRow } from './SettingRow';

import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { useUnitsStore } from '@store/root-store-context';
import { useWidgetEditor } from '../WidgetEditorContext';

export const SpeedSettingsPanel = observer(() => {
  const units = useUnitsStore();
  const widgetSettings = useWidgetEditor();

  const settings = widgetSettings.getSettings<SpeedWidgetSettings>('speed');

  const update = (partial: Partial<SpeedWidgetSettings>) => {
    widgetSettings.updateUserSettings('speed', {
      ...settings,
      ...partial,
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
              { label: 'Slant', value: 'parallelogram' },
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
          <span className={styles.fieldLabel}>
            Pit Speed Override ({speedUnit(units.unitSystem)})
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

        <div className={styles.fieldGroup}>
          <SettingRow
            title="Pit Lane Assist"
            desc="Show distance to pit exit when driving without pit limiter."
          >
            <Switch
              checked={settings.showPitAssist}
              onChange={(value) => update({ showPitAssist: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Pit Box Side</span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            Which side the pit box entry is on.
          </div>
          <Segmented
            block
            value={settings.pitBoxSide}
            options={[
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ]}
            onChange={(value) => update({ pitBoxSide: value as PitBoxSide })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Box Cue Distance (m)</span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            Show BOX indicator this many meters before your pit box.
          </div>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.boxCueDistM}
            min={5}
            max={300}
            step={5}
            onChange={(value) => update({ boxCueDistM: value ?? 50 })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            Near-Limit Warning ({speedUnit(units.unitSystem)})
          </span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            Color speed red when this many {speedUnit(units.unitSystem)} below
            the pit speed limit.
          </div>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.nearLimitDelta}
            min={1}
            max={30}
            step={1}
            onChange={(value) => update({ nearLimitDelta: value ?? 5 })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title="Reference Lap Speed"
            desc="Show your best lap's recorded speed at this point on track."
          >
            <Switch
              checked={settings.showReferenceLap}
              onChange={(value) => update({ showReferenceLap: value })}
            />
          </SettingRow>
        </div>
      </Card>
    </>
  );
});

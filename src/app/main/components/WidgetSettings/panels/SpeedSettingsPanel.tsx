import { observer } from 'mobx-react-lite';
import { ColorPicker, InputNumber, Segmented, Switch } from 'antd';
import { speedUnit } from '@utils/formatters/telemetry-format';
import { SpeedWidgetSettings, PitBoxSide } from '@/types/widget-settings';
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
      </Card>
    </>
  );
});

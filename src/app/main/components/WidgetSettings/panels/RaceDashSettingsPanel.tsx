import { observer } from 'mobx-react-lite';
import { Button, ColorPicker, InputNumber, Popconfirm, Switch } from 'antd';
import { invoke } from '@tauri-apps/api/core';

import { speedUnit } from '@utils/formatters/telemetry-format';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { Card } from './Card';
import { SettingRow } from './SettingRow';

import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import {
  useReferenceLapStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';
import { useWidgetEditor } from '../WidgetEditorContext';

export const RaceDashSettingsPanel = observer(() => {
  const units = useUnitsStore();
  const widgetSettings = useWidgetEditor();
  const { sessionInfo } = useSessionStore();
  const referenceLap = useReferenceLapStore();

  const playerCar = sessionInfo?.cars.find(
    (car) => car.carIdx === sessionInfo.playerCarIdx
  );
  const canDeleteReference = sessionInfo != null && playerCar != null;

  const handleDeleteReferenceLap = async () => {
    if (!sessionInfo || !playerCar) {
      return;
    }

    await invoke('delete_reference_lap', {
      trackId: sessionInfo.trackId,
      carScreenName: playerCar.carScreenName,
    });
    referenceLap.reset();
  };

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const update = (partial: Partial<RaceDashWidgetSettings>) => {
    widgetSettings.updateUserSettings('race-dash', {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title="RPM Fill">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Zone Colors</span>

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
          <SettingRow
            title="Colorize Digits"
            desc="Tint the gear digit and RPM number with the zone color at high revs."
          >
            <Switch
              checked={settings.colorizeByRpmZone}
              onChange={(value) => update({ colorizeByRpmZone: value })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title="Driving Coach">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Reference Speed"
            desc="Show your best lap's speed at this point on track."
          >
            <Switch
              checked={settings.showReferenceSpeed}
              onChange={(value) => update({ showReferenceSpeed: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title="Brake Accent" desc="Color of the BRAKE advisory.">
            <ColorPicker
              value={settings.brakeColor}
              onChange={(color) => update({ brakeColor: color.toHexString() })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title="Gas Accent" desc="Color of the GAS advisory.">
            <ColorPicker
              value={settings.gasColor}
              onChange={(color) => update({ gasColor: color.toHexString() })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title="Delete Reference Lap"
            desc="Remove the stored best lap for the current track and car; recording restarts on the next completed lap."
          >
            <Popconfirm
              title="Delete the stored reference lap?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={handleDeleteReferenceLap}
            >
              <Button danger disabled={!canDeleteReference}>
                Delete
              </Button>
            </Popconfirm>
          </SettingRow>
        </div>
      </Card>

      <Card title="Pit Assist">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Pit Lane Assist"
            desc="Transform into the pit panel when entering the pit lane."
          >
            <Switch
              checked={settings.showPitAssist}
              onChange={(value) => update({ showPitAssist: value })}
            />
          </SettingRow>
        </div>

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
          <span className={styles.fieldLabel}>
            Near-Limit Warning ({speedUnit(units.unitSystem)})
          </span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            Color speed amber when this many {speedUnit(units.unitSystem)} below
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

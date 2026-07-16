import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, InputNumber, Segmented, Switch } from 'antd';

import { speedUnit } from '@utils/formatters/telemetry-format';
import type {
  RaceDashWidgetSettings,
  RpmIndicatorMode,
} from '@/types/widget-settings';
import { Card } from './Card';
import { SettingRow } from './SettingRow';

import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { useUnitsStore } from '@store/root-store-context';
import { useWidgetEditor } from '../WidgetEditorContext';

export const RaceDashSettingsPanel = observer(() => {
  const units = useUnitsStore();
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

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
      <Card title={t('settingsPanels.raceDash.rpmFill')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.raceDash.zoneColors')}
          </span>

          <div className={styles.rpmColorGrid}>
            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.low')}
              </span>
              <ColorPicker
                value={settings.rpmColorLow}
                onChange={(color) =>
                  update({ rpmColorLow: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.mid')}
              </span>
              <ColorPicker
                value={settings.rpmColorMid}
                onChange={(color) =>
                  update({ rpmColorMid: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.high')}
              </span>
              <ColorPicker
                value={settings.rpmColorHigh}
                onChange={(color) =>
                  update({ rpmColorHigh: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.shift')}
              </span>
              <ColorPicker
                value={settings.rpmColorShift}
                onChange={(color) =>
                  update({ rpmColorShift: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.blink')}
              </span>
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
            title={t('settingsPanels.raceDash.colorizeDigits')}
            desc={t('settingsPanels.raceDash.colorizeDigitsDesc')}
          >
            <Switch
              checked={settings.colorizeByRpmZone}
              onChange={(value) => update({ colorizeByRpmZone: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.raceDash.rpmIndicator')}
          </span>
          <Segmented
            block
            value={settings.rpmIndicatorMode}
            options={[
              { label: t('settingsPanels.raceDash.fill'), value: 'fill' },
              { label: t('settingsPanels.raceDash.glow'), value: 'glow' },
              { label: t('settingsPanels.raceDash.off'), value: 'off' },
            ]}
            onChange={(value) =>
              update({ rpmIndicatorMode: value as RpmIndicatorMode })
            }
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.raceDash.drivingCoach')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.raceDash.coachSection')}
            desc={t('settingsPanels.raceDash.coachSectionDesc')}
          >
            <Switch
              checked={settings.showReferenceSpeed}
              onChange={(value) => update({ showReferenceSpeed: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.raceDash.brakeAccent')}
            desc={t('settingsPanels.raceDash.brakeAccentDesc')}
          >
            <ColorPicker
              value={settings.brakeColor}
              onChange={(color) => update({ brakeColor: color.toHexString() })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.raceDash.gasAccent')}
            desc={t('settingsPanels.raceDash.gasAccentDesc')}
          >
            <ColorPicker
              value={settings.gasColor}
              onChange={(color) => update({ gasColor: color.toHexString() })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.raceDash.pitAssist')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.raceDash.pitLaneAssist')}
            desc={t('settingsPanels.raceDash.pitLaneAssistDesc')}
          >
            <Switch
              checked={settings.showPitAssist}
              onChange={(value) => update({ showPitAssist: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.raceDash.pitSpeedOverride', {
              unit: speedUnit(units.unitSystem),
            })}
          </span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {t('settingsPanels.raceDash.pitSpeedOverrideDesc')}
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
            {t('settingsPanels.raceDash.nearLimitWarning', {
              unit: speedUnit(units.unitSystem),
            })}
          </span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {t('settingsPanels.raceDash.nearLimitWarningDesc', {
              unit: speedUnit(units.unitSystem),
            })}
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

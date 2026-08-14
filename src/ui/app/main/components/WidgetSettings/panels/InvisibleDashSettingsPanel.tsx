import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, Segmented, Slider, Switch } from 'antd';

import type {
  InvisibleDashRenderMode,
  InvisibleDashRpmFormat,
  InvisibleDashWidgetSettings,
} from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';

import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

const WIDGET_ID = 'invisible-dash';

const PERCENT_MIN = 0;
const PERCENT_MAX = 100;

export const InvisibleDashSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<InvisibleDashWidgetSettings>(WIDGET_ID);

  const update = (partial: Partial<InvisibleDashWidgetSettings>) => {
    widgetSettings.updateUserSettings(WIDGET_ID, { ...settings, ...partial });
  };

  const isProjection = settings.renderMode === 'projection';

  return (
    <>
      <Card title={t('settingsPanels.invisibleDash.projection')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.invisibleDash.render')}
          </span>

          <Segmented
            block
            value={settings.renderMode}
            options={[
              {
                label: t('settingsPanels.invisibleDash.modeProjection'),
                value: 'projection',
              },
              {
                label: t('settingsPanels.invisibleDash.modeContour'),
                value: 'contour',
              },
            ]}
            onChange={(value) =>
              update({ renderMode: value as InvisibleDashRenderMode })
            }
          />

          <div className={styles.fieldDesc} style={{ marginTop: 8 }}>
            {t('settingsPanels.invisibleDash.renderDesc')}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.invisibleDash.bloom')}
          </span>

          <Slider
            min={PERCENT_MIN}
            max={PERCENT_MAX}
            value={settings.bloomIntensity}
            disabled={!isProjection}
            onChange={(value) => update({ bloomIntensity: value })}
          />

          <div className={styles.fieldDesc}>
            {t('settingsPanels.invisibleDash.bloomDesc', {
              percent: settings.bloomIntensity,
            })}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.tint')}
            desc={t('settingsPanels.invisibleDash.tintDesc')}
          >
            <ColorPicker
              value={settings.projectionTint}
              disabled={!isProjection}
              onChange={(color) =>
                update({ projectionTint: color.toHexString() })
              }
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.textColor')}
            desc={t('settingsPanels.invisibleDash.textColorDesc')}
          >
            <ColorPicker
              value={settings.textColor}
              onChange={(color) => update({ textColor: color.toHexString() })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.invisibleDash.distance')}
          </span>

          <Slider
            min={PERCENT_MIN}
            max={PERCENT_MAX}
            value={settings.depth}
            onChange={(value) => update({ depth: value })}
          />

          <div className={styles.fieldDesc}>
            {t('settingsPanels.invisibleDash.distanceDesc')}
          </div>
        </div>
      </Card>

      <Card title={t('settingsPanels.invisibleDash.backdrop')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.backdropColor')}
            desc={t('settingsPanels.invisibleDash.backdropColorDesc')}
          >
            <ColorPicker
              value={settings.backdropColor}
              onChange={(color) =>
                update({ backdropColor: color.toRgbString() })
              }
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.invisibleDash.zoneColorsCard')}>
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
            title={t('settingsPanels.invisibleDash.colorizeRpm')}
            desc={t('settingsPanels.invisibleDash.colorizeRpmDesc')}
          >
            <Switch
              checked={settings.colorizeRpmByZone}
              onChange={(value) => update({ colorizeRpmByZone: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.colorizeGear')}
            desc={t('settingsPanels.invisibleDash.colorizeGearDesc')}
          >
            <Switch
              checked={settings.colorizeGearByZone}
              onChange={(value) => update({ colorizeGearByZone: value })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.invisibleDash.blocks')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.speed')}
            desc={t('settingsPanels.invisibleDash.speedDesc')}
          >
            <Switch
              checked={settings.showSpeed}
              onChange={(value) => update({ showSpeed: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.rpm')}
            desc={t('settingsPanels.invisibleDash.rpmDesc')}
          >
            <Switch
              checked={settings.showRpm}
              onChange={(value) => update({ showRpm: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.rpmFormat')}
            desc={t('settingsPanels.invisibleDash.rpmFormatDesc')}
          >
            <Segmented
              value={settings.rpmFormat}
              options={[
                {
                  label: t('settingsPanels.invisibleDash.formatAbsolute'),
                  value: 'absolute',
                },
                {
                  label: t('settingsPanels.invisibleDash.formatPercent'),
                  value: 'percent',
                },
              ]}
              onChange={(value) =>
                update({ rpmFormat: value as InvisibleDashRpmFormat })
              }
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.shiftBar')}
            desc={t('settingsPanels.invisibleDash.shiftBarDesc')}
          >
            <Switch
              checked={settings.showShiftBar}
              onChange={(value) => update({ showShiftBar: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.gear')}
            desc={t('settingsPanels.invisibleDash.gearDesc')}
          >
            <Switch
              checked={settings.showGear}
              onChange={(value) => update({ showGear: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.position')}
            desc={t('settingsPanels.invisibleDash.positionDesc')}
          >
            <Switch
              checked={settings.showPosition}
              onChange={(value) => update({ showPosition: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.lap')}
            desc={t('settingsPanels.invisibleDash.lapDesc')}
          >
            <Switch
              checked={settings.showLap}
              onChange={(value) => update({ showLap: value })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.invisibleDash.positionSource')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.livePositions')}
            desc={t('settingsPanels.invisibleDash.livePositionsDesc')}
          >
            <Switch
              checked={settings.useLivePositions}
              onChange={(value) => update({ useLivePositions: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.invisibleDash.classPosition')}
            desc={t('settingsPanels.invisibleDash.classPositionDesc')}
          >
            <Switch
              checked={settings.classPositionInMulticlass}
              onChange={(value) => update({ classPositionInMulticlass: value })}
            />
          </SettingRow>
        </div>
      </Card>
    </>
  );
});

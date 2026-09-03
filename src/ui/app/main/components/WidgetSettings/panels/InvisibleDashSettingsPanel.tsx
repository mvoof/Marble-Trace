import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, Segmented, Slider } from 'antd';

import type {
  InvisibleDashBackdropScope,
  InvisibleDashRenderMode,
  InvisibleDashRpmFormat,
  InvisibleDashWidgetSettings,
} from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';

import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';

const WIDGET_ID = 'invisible-dash';

const PERCENT_MIN = 0;
const PERCENT_MAX = 100;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['invisible-dash'];

const { ColorRow, SwitchRow } = panelRows<InvisibleDashWidgetSettings>();

export const InvisibleDashSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId(WIDGET_ID);
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<InvisibleDashWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<InvisibleDashWidgetSettings>) => {
    widgetSettings.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
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
          <ColorRow
            settingKey="projectionTint"
            title={t('settingsPanels.invisibleDash.tint')}
            desc={t('settingsPanels.invisibleDash.tintDesc')}
            hex
            disabled={!isProjection}
          />
        </div>

        <div className={styles.fieldGroup}>
          <ColorRow
            settingKey="textColor"
            title={t('settingsPanels.invisibleDash.textColor')}
            desc={t('settingsPanels.invisibleDash.textColorDesc')}
            hex
          />
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

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.invisibleDash.curvature')}
          </span>

          <Slider
            min={PERCENT_MIN}
            max={PERCENT_MAX}
            value={settings.curvature}
            onChange={(value) => update({ curvature: value })}
          />

          <div className={styles.fieldDesc}>
            {t('settingsPanels.invisibleDash.curvatureDesc')}
          </div>
        </div>
      </Card>

      <Card title={t('settingsPanels.invisibleDash.backdrop')}>
        <div className={styles.fieldGroup}>
          <ColorRow
            settingKey="backdropColor"
            title={t('settingsPanels.invisibleDash.backdropColor')}
            desc={t('settingsPanels.invisibleDash.backdropColorDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.invisibleDash.backdropScope')}
          </span>

          <Segmented
            block
            value={settings.backdropScope}
            options={[
              {
                label: t('settingsPanels.invisibleDash.scopeClusters'),
                value: 'clusters',
              },
              {
                label: t('settingsPanels.invisibleDash.scopeFull'),
                value: 'full',
              },
            ]}
            onChange={(value) =>
              update({ backdropScope: value as InvisibleDashBackdropScope })
            }
          />

          <div className={styles.fieldDesc} style={{ marginTop: 8 }}>
            {t('settingsPanels.invisibleDash.backdropScopeDesc')}
          </div>
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
          <SwitchRow
            settingKey="colorizeRpmByZone"
            title={t('settingsPanels.invisibleDash.colorizeRpm')}
            desc={t('settingsPanels.invisibleDash.colorizeRpmDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="colorizeGearByZone"
            title={t('settingsPanels.invisibleDash.colorizeGear')}
            desc={t('settingsPanels.invisibleDash.colorizeGearDesc')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.invisibleDash.blocks')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showSpeed"
            title={t('settingsPanels.invisibleDash.speed')}
            desc={t('settingsPanels.invisibleDash.speedDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showRpm"
            title={t('settingsPanels.invisibleDash.rpm')}
            desc={t('settingsPanels.invisibleDash.rpmDesc')}
          />
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
          <SwitchRow
            settingKey="showShiftBar"
            title={t('settingsPanels.invisibleDash.shiftBar')}
            desc={t('settingsPanels.invisibleDash.shiftBarDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showGear"
            title={t('settingsPanels.invisibleDash.gear')}
            desc={t('settingsPanels.invisibleDash.gearDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showPosition"
            title={t('settingsPanels.invisibleDash.position')}
            desc={t('settingsPanels.invisibleDash.positionDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showLap"
            title={t('settingsPanels.invisibleDash.lap')}
            desc={t('settingsPanels.invisibleDash.lapDesc')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.invisibleDash.positionSource')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="useLivePositions"
            title={t('settingsPanels.invisibleDash.livePositions')}
            desc={t('settingsPanels.invisibleDash.livePositionsDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="classPositionInMulticlass"
            title={t('settingsPanels.invisibleDash.classPosition')}
            desc={t('settingsPanels.invisibleDash.classPositionDesc')}
          />
        </div>
      </Card>
    </>
  );
});

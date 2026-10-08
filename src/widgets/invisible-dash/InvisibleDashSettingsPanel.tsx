import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, Slider } from 'antd';

import styles from '@features/widget-settings/WidgetSettings.module.scss';

import { Card } from '@features/widget-settings/Card';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import { usePanelWidgetId } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  INVISIBLE_DASH_SETTINGS,
  type InvisibleDashWidgetSettings,
} from './settings-schema';

const WIDGET_ID = 'invisible-dash';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['invisible-dash'];

const { Row } = schemaRows(INVISIBLE_DASH_SETTINGS);
const { bloomIntensity } = INVISIBLE_DASH_SETTINGS.shape;

export const InvisibleDashSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId(WIDGET_ID);
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<InvisibleDashWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<InvisibleDashWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  const isProjection = settings.renderMode === 'projection';

  return (
    <>
      <Card title={t('settingsPanels.invisibleDash.projection')}>
        <div className={styles.fieldGroup}>
          <Row setting="renderMode" stacked />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.invisibleDash.bloomIntensity')}
          </span>

          <Slider
            min={bloomIntensity.min}
            max={bloomIntensity.max}
            value={settings.bloomIntensity}
            disabled={!isProjection}
            onChange={(value) => update({ bloomIntensity: value })}
          />

          <div className={styles.fieldDesc}>
            {t('settingsPanels.invisibleDash.bloomIntensityDesc', {
              percent: settings.bloomIntensity,
            })}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="projectionTint" disabled={!isProjection} />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="textColor" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="depth" stacked />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="curvature" stacked />
        </div>
      </Card>

      <Card title={t('settingsPanels.invisibleDash.backdrop')}>
        <div className={styles.fieldGroup}>
          <Row setting="backdropColor" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="backdropScope" stacked />
        </div>
      </Card>

      <Card title={t('settingsPanels.invisibleDash.zoneColorsCard')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.common.rpmZoneColors')}
          </span>

          <div className={styles.rpmColorGrid}>
            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.common.rpmColorLow')}
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
                {t('settingsPanels.common.rpmColorMid')}
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
                {t('settingsPanels.common.rpmColorHigh')}
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
                {t('settingsPanels.common.rpmColorShift')}
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
                {t('settingsPanels.common.rpmColorLimit')}
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
      </Card>

      <Card title={t('settingsPanels.invisibleDash.blocks')}>
        <div className={styles.fieldGroup}>
          <Row setting="showSpeed" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showRpm" />
        </div>

        <Row setting="rpmFormat" dependsOn="showRpm" />

        <Row setting="colorizeRpmByZone" dependsOn="showRpm" />

        <div className={styles.fieldGroup}>
          <Row setting="showShiftBar" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showGear" />
        </div>

        <Row setting="colorizeGearByZone" dependsOn="showGear" />

        <div className={styles.fieldGroup}>
          <Row setting="showPosition" />
        </div>

        <Row setting="useLivePositions" dependsOn="showPosition" />

        <Row setting="classPositionInMulticlass" dependsOn="showPosition" />

        <div className={styles.fieldGroup}>
          <Row setting="showLap" />
        </div>
      </Card>
    </>
  );
});

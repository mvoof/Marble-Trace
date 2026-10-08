import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, InputNumber } from 'antd';

import { speedUnit } from '@shared/lib/telemetry-format';
import { Card } from '@features/widget-settings/Card';

import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import {
  panelRows,
  usePanelWidgetId,
} from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  RACE_DASH_SETTINGS,
  type RaceDashWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['race-dash'];

const { DependentBlock } = panelRows<RaceDashWidgetSettings>();
const { Row } = schemaRows(RACE_DASH_SETTINGS);
const { pitSpeedLimitOverride, nearLimitDelta } = RACE_DASH_SETTINGS.shape;

export const RaceDashSettingsPanel = observer(() => {
  const units = useUnitsStore();
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('race-dash');
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<RaceDashWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<RaceDashWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.raceDash.rpmFill')}>
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

        <div className={styles.fieldGroup}>
          <Row setting="colorizeByRpmZone" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="rpmIndicatorMode" stacked />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showSteeringMarker" />
        </div>

        <Row setting="steeringTrailColor" dependsOn="showSteeringMarker" />
      </Card>

      <Card title={t('settingsPanels.common.positions')}>
        <div className={styles.fieldGroup}>
          <Row setting="useLivePositions" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="classPositionInMulticlass" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="colorizePosition" />
        </div>

        <DependentBlock dependsOn="colorizePosition">
          <span className={styles.fieldLabel}>
            {t('settingsPanels.raceDash.positionBands')}
          </span>

          <div className={styles.rpmColorGrid}>
            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.positionColorP1')}
              </span>
              <ColorPicker
                value={settings.positionColorP1}
                onChange={(color) =>
                  update({ positionColorP1: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.positionColorTop3')}
              </span>
              <ColorPicker
                value={settings.positionColorTop3}
                onChange={(color) =>
                  update({ positionColorTop3: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.positionColorTop5')}
              </span>
              <ColorPicker
                value={settings.positionColorTop5}
                onChange={(color) =>
                  update({ positionColorTop5: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.positionColorTop10')}
              </span>
              <ColorPicker
                value={settings.positionColorTop10}
                onChange={(color) =>
                  update({ positionColorTop10: color.toHexString() })
                }
              />
            </div>

            <div className={styles.rpmColorLine} />

            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>
                {t('settingsPanels.raceDash.positionColorRest')}
              </span>
              <ColorPicker
                value={settings.positionColorRest}
                onChange={(color) =>
                  update({ positionColorRest: color.toHexString() })
                }
              />
            </div>
          </div>
        </DependentBlock>
      </Card>

      <Card title={t('settingsPanels.raceDash.pitAssist')}>
        <div className={styles.fieldGroup}>
          <Row setting="showPitAssist" />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.raceDash.pitSpeedLimitOverride', {
              unit: speedUnit(units.unitSystem),
            })}
          </span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {t('settingsPanels.raceDash.pitSpeedLimitOverrideDesc')}
          </div>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.pitSpeedLimitOverride ?? 0}
            min={pitSpeedLimitOverride.min}
            max={pitSpeedLimitOverride.max}
            step={pitSpeedLimitOverride.step}
            onChange={(value) =>
              update({
                pitSpeedLimitOverride: value && value > 0 ? value : null,
              })
            }
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.raceDash.nearLimitDelta', {
              unit: speedUnit(units.unitSystem),
            })}
          </span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {t('settingsPanels.raceDash.nearLimitDeltaDesc', {
              unit: speedUnit(units.unitSystem),
            })}
          </div>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.nearLimitDelta}
            min={nearLimitDelta.min}
            max={nearLimitDelta.max}
            step={nearLimitDelta.step}
            onChange={(value) =>
              value !== null && update({ nearLimitDelta: value })
            }
          />
        </div>
      </Card>
    </>
  );
});

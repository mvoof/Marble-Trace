import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber } from 'antd';

import { speedUnit } from '@shared/lib/telemetry-format';
import { Card } from '@features/widget-settings/Card';
import { ColorGrid } from '@features/widget-settings/ColorGrid';
import { RpmZoneColorGrid } from '@features/widget-settings/RpmZoneColorGrid';

import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { usePanelSettings } from '@features/widget-settings/use-panel-settings';
import { panelRows } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  RACE_DASH_SETTINGS,
  type RaceDashWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['race-dash'];

const POSITION_BAND_KEYS = [
  'positionColorP1',
  'positionColorTop3',
  'positionColorTop5',
  'positionColorTop10',
  'positionColorRest',
] as const;

const { DependentBlock } = panelRows<RaceDashWidgetSettings>();
const { Row } = schemaRows(RACE_DASH_SETTINGS);
const { pitSpeedLimitOverride, nearLimitDelta } = RACE_DASH_SETTINGS.shape;

export const RaceDashSettingsPanel = observer(() => {
  const units = useUnitsStore();
  const [settings, update] =
    usePanelSettings<RaceDashWidgetSettings>('race-dash');
  const { t } = useTranslation('widgets');

  return (
    <>
      <Card title={t('settingsPanels.common.speedCard')}>
        <div className={styles.fieldGroup}>
          <Row setting="showSpeedTargetColor" />
        </div>

        <Row setting="speedOnTargetColor" dependsOn="showSpeedTargetColor" />
        <Row setting="speedOverTargetColor" dependsOn="showSpeedTargetColor" />
      </Card>

      <Card title={t('settingsPanels.common.cornerSpeedsCard')}>
        <div className={styles.fieldGroup}>
          <Row setting="showCornerSpeeds" />
        </div>

        <Row setting="entrySpeedColor" dependsOn="showCornerSpeeds" />
        <Row setting="apexSpeedColor" dependsOn="showCornerSpeeds" />
        <Row setting="exitSpeedColor" dependsOn="showCornerSpeeds" />
      </Card>

      <Card title={t('settingsPanels.common.gearRpmCard')}>
        <RpmZoneColorGrid
          colors={{
            rpmColorLow: settings.rpmColorLow,
            rpmColorMid: settings.rpmColorMid,
            rpmColorHigh: settings.rpmColorHigh,
            rpmColorShift: settings.rpmColorShift,
            rpmColorLimit: settings.rpmColorLimit,
          }}
          onChange={(key, color) => update({ [key]: color })}
        />

        <div className={styles.fieldGroup}>
          <Row setting="colorizeByRpmZone" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="blinkAtShift" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="rpmIndicatorMode" stacked />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.steeringCard')}>
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
          <ColorGrid
            caption={t('settingsPanels.raceDash.positionBands')}
            items={POSITION_BAND_KEYS.map((key) => ({
              key,
              label: t(`settingsPanels.raceDash.${key}`),
              color: settings[key],
            }))}
            onChange={(key, color) => update({ [key]: color })}
          />
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

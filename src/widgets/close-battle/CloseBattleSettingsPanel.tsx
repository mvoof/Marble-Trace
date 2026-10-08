import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented, Slider } from 'antd';

import { useUnitsStore } from '@entities/app-settings/units-context';
import { toDisplayDistance, toMeters } from './close-battle-utils';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { SettingRow } from '@features/widget-settings/SettingRow';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import { usePanelWidgetId } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  CLOSE_BATTLE_SETTINGS,
  type CloseBattleWidgetSettings,
} from './settings-schema';

/** Feet round to fives, so the field steps by five of whatever it shows. */
const DISTANCE_STEP = 5;

const NAME_COLUMN_SLIDER_WIDTH_PX = 160;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['close-battle'];

const { Row } = schemaRows(CLOSE_BATTLE_SETTINGS);
const {
  gapThreshold,
  distanceThreshold,
  maxRows,
  nameColumnWidth,
  plateOpacity,
} = CLOSE_BATTLE_SETTINGS.shape;

const ROW_COUNTS = Array.from(
  { length: maxRows.max - maxRows.min + 1 },
  (_unused, offset) => maxRows.min + offset
);

// Labels hang off the ticks, which hang off the axis; one level of nesting, so
// the labels row names both.
const areTicksShown = (settings: CloseBattleWidgetSettings): boolean =>
  settings.showAxis && settings.showTicks;

export const CloseBattleSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('close-battle');
  const units = useUnitsStore();
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<CloseBattleWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<CloseBattleWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  const isGapTrigger = settings.trigger === 'gap';
  const isMetric = units.isMetric;

  // The field shows the unit the widget draws in and stores meters regardless,
  // so switching the unit system never rewrites what the user chose.
  const asDisplay = (meters: number) =>
    Math.round(toDisplayDistance(meters, isMetric));

  return (
    <>
      <Card title={t('settingsPanels.closeBattle.appearsWhen')}>
        <div className={styles.fieldGroup}>
          <Row setting="trigger" />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={
              isGapTrigger
                ? t('settingsPanels.closeBattle.gapThreshold')
                : t('settingsPanels.closeBattle.distanceThreshold', {
                    unit: isMetric ? 'm' : 'ft',
                  })
            }
            desc={t('settingsPanels.closeBattle.thresholdDesc')}
          >
            {/* Each trigger keeps its own number: seconds and meters share no
                range, so one field would show 5 as invalid the moment the
                trigger flips. */}
            {isGapTrigger ? (
              <InputNumber
                value={settings.gapThreshold}
                min={gapThreshold.min}
                max={gapThreshold.max}
                step={gapThreshold.step}
                onChange={(value) => {
                  if (value !== null) {
                    update({ gapThreshold: value });
                  }
                }}
              />
            ) : (
              <InputNumber
                value={asDisplay(settings.distanceThreshold)}
                min={asDisplay(distanceThreshold.min)}
                max={asDisplay(distanceThreshold.max)}
                step={DISTANCE_STEP}
                onChange={(value) => {
                  if (value !== null) {
                    update({ distanceThreshold: toMeters(value, isMetric) });
                  }
                }}
              />
            )}
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="hideDelay" input />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="sides" />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.maxRows')}
            desc={t('settingsPanels.closeBattle.maxRowsDesc')}
          >
            <Segmented<number>
              value={settings.maxRows}
              onChange={(value) => update({ maxRows: value })}
              options={ROW_COUNTS}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="otherClass" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="hideInPits" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="raceOnly" />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.qualifying')}>
        <div className={styles.fieldGroup}>
          <Row setting="qualifyingVisibility" />
        </div>
      </Card>

      <Card title={t('settingsPanels.closeBattle.axis')}>
        <div className={styles.fieldGroup}>
          <Row setting="glowRange" input />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showAxis" />
        </div>

        <Row setting="showTicks" dependsOn="showAxis" />

        <Row setting="showTickLabels" dependsOn={areTicksShown} />

        <div className={styles.fieldGroup}>
          <Row setting="showPlayerLine" />
        </div>

        <Row setting="playerLineColor" dependsOn="showPlayerLine" />

        <div className={styles.fieldGroup}>
          <Row setting="compactMode" />
        </div>
      </Card>

      <Card title={t('settingsPanels.closeBattle.plates')}>
        <div className={styles.fieldGroup}>
          <Row setting="showDistance" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showLapGap" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showBrand" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showClassBadge" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="nameMode" />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.common.nameColumnWidth')}
            desc={t('settingsPanels.common.nameColumnWidthDesc')}
          >
            <Slider
              style={{ width: NAME_COLUMN_SLIDER_WIDTH_PX }}
              min={nameColumnWidth.min}
              max={nameColumnWidth.max}
              step={nameColumnWidth.step}
              value={settings.nameColumnWidth}
              tooltip={{ formatter: (value) => `${value ?? 0} px` }}
              onChange={(value) => update({ nameColumnWidth: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.plateOpacity')}
            desc={t('settingsPanels.closeBattle.plateOpacityDesc')}
          >
            <Slider
              style={{ width: NAME_COLUMN_SLIDER_WIDTH_PX }}
              min={plateOpacity.min}
              max={plateOpacity.max}
              step={plateOpacity.step}
              value={settings.plateOpacity}
              tooltip={{
                formatter: (value) => `${Math.round((value ?? 1) * 100)}%`,
              }}
              onChange={(value) => update({ plateOpacity: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="mergeOverlapping" />
        </div>

        <div className={styles.fieldGroup}>
          <Row
            setting="mergeDistance"
            input
            disabled={!settings.mergeOverlapping}
          />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="scaleByDistance" />
        </div>
      </Card>
    </>
  );
});

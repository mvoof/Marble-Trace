import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider } from 'antd';
import {
  STANDINGS_VIEW_MODE,
  type StandingsViewMode,
} from '@shared/contracts/widget-choices';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { SettingRow } from '@features/widget-settings/SettingRow';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import { usePanelWidgetId } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  STANDINGS_SETTINGS,
  type StandingsWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['standings'];

const { Row, useLabels } = schemaRows(STANDINGS_SETTINGS);
const { nameColumnWidth, groupedRowsPerClass, driversAhead } =
  STANDINGS_SETTINGS.shape;

const PLAYER_WINDOW_OPTIONS = Array.from(
  { length: driversAhead.max - driversAhead.min + 1 },
  (_unused, offset) => {
    const count = driversAhead.min + offset;

    return { label: String(count), value: count };
  }
);

const SCROLL_RESET_OPTIONS = [0, 5, 8, 15, 30];

const NAME_COLUMN_SLIDER_WIDTH_PX = 160;

export const StandingsSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('standings');
  const { t } = useTranslation('widgets');
  const nameColumnLabels = useLabels('nameColumnWidth');
  const aheadLabels = useLabels('driversAhead');
  const behindLabels = useLabels('driversBehind');
  const scrollResetLabels = useLabels('scrollResetSeconds');

  const settings =
    liveWidgets.getSettings<StandingsWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<StandingsWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.standings.appearance')}>
        <div className={styles.fieldGroup}>
          <Row setting="rowPadding" />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={nameColumnLabels.title}
            desc={nameColumnLabels.desc}
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
          <Row setting="dimSecondaryColumns" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="playerRowColor" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="playerAccentColor" />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.positions')}>
        <div className={styles.fieldGroup}>
          <Row setting="useLivePositions" />
        </div>
      </Card>

      <Card title={t('settingsPanels.standings.viewMode')}>
        <div className={styles.fieldGroup}>
          <Segmented<StandingsViewMode>
            block
            value={settings.viewMode}
            onChange={(value) => update({ viewMode: value })}
            options={STANDINGS_VIEW_MODE.map((mode) => ({
              label: t(`settingsPanels.standings.viewMode_${mode}`),
              value: mode,
            }))}
          />
        </div>

        {/*
          Not gated on the grouped view: the view is cycled by a hotkey mid-race,
          and a row that came and went with each press would move the panel
          under the pointer. It only takes effect while the view is grouped.
        */}
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.standings.groupedRowsPerClass', {
              value:
                settings.groupedRowsPerClass > 0
                  ? settings.groupedRowsPerClass
                  : t('settingsPanels.standings.rowsPerClassAuto'),
            })}
          </span>

          <Slider
            min={groupedRowsPerClass.min}
            max={groupedRowsPerClass.max}
            step={groupedRowsPerClass.step}
            value={settings.groupedRowsPerClass}
            onChange={(value) => update({ groupedRowsPerClass: value })}
            tooltip={{
              formatter: (value) =>
                value === 0
                  ? t('settingsPanels.standings.rowsPerClassAuto')
                  : String(value),
            }}
          />

          <div className={styles.fieldDesc}>
            {t('settingsPanels.standings.groupedRowsPerClassDesc')}
          </div>
        </div>
      </Card>

      <Card title={t('settingsPanels.standings.playerWindow')}>
        <div className={styles.fieldGroup}>
          <SettingRow title={aheadLabels.title} desc={aheadLabels.desc}>
            <Segmented<number>
              value={settings.driversAhead}
              onChange={(value) => update({ driversAhead: value })}
              options={PLAYER_WINDOW_OPTIONS}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title={behindLabels.title} desc={behindLabels.desc}>
            <Segmented<number>
              value={settings.driversBehind}
              onChange={(value) => update({ driversBehind: value })}
              options={PLAYER_WINDOW_OPTIONS}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.standings.scrolling')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={scrollResetLabels.title}
            desc={scrollResetLabels.desc}
          >
            <Segmented<number>
              value={settings.scrollResetSeconds}
              onChange={(value) => update({ scrollResetSeconds: value })}
              options={SCROLL_RESET_OPTIONS.map((seconds) => ({
                label:
                  seconds === 0
                    ? t('settingsPanels.standings.scrollResetOff')
                    : `${seconds}s`,
                value: seconds,
              }))}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.common.dataColumns')}>
        <Row setting="showPosChange" />
        <Row setting="showLivePosChange" />
        <Row setting="showBrand" />
        <Row setting="showTire" />
        <Row setting="showLicBadge" />
        <Row setting="licBadgeStyle" dependsOn="showLicBadge" />
        <Row setting="showLicenseLetter" dependsOn="showLicBadge" />
        <Row setting="showIRating" />
        <Row setting="abbreviateIRating" dependsOn="showIRating" />
        <Row setting="showGap" />
        <Row setting="showLastLap" />
        <Row setting="showBestLap" />
        <Row setting="showPitIndicator" />
        <Row setting="showIrChange" />
        <Row setting="showLapsCompleted" />
        <Row setting="abbreviateNames" />
        <Row setting="showCountryFlag" />
        <Row setting="showDriverFlags" />
        <Row setting="hideRetiredDrivers" />
        <Row setting="hideDriversWithoutLap" />
      </Card>

      <Card title={t('settingsPanels.standings.headerInfo')}>
        <Row setting="showColumnHeaders" />
        <Row setting="showSessionHeader" />
        <Row setting="showSessionTime" />
        <Row setting="showSOF" />
        <Row setting="abbreviateSof" dependsOn="showSOF" />
        <Row setting="showTotalDrivers" />
      </Card>

      <Card title={t('settingsPanels.standings.footerInfo')}>
        <Row setting="showPitStops" />
        <Row setting="showIncidentsBadge" />
        <Row setting="showWeather" />
      </Card>
    </>
  );
});

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch, Segmented, Slider } from 'antd';
import type {
  RowPadding,
  StandingsViewMode,
  StandingsWidgetSettings,
} from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows } from './setting-rows';
import {
  NAME_COLUMN_MAX_PX,
  NAME_COLUMN_MIN_PX,
} from '@ui/widgets/StandingsWidget/standings-utils';

const PLAYER_WINDOW_OPTIONS = [0, 1, 2, 3, 4, 5].map((count) => ({
  label: String(count),
  value: count,
}));

// 0 keeps the automatic split; above that the user picks the exact row count.
const GROUPED_ROWS_PER_CLASS_MIN = 0;
const GROUPED_ROWS_PER_CLASS_MAX = 30;

const SCROLL_RESET_OPTIONS = [0, 5, 8, 15, 30];

// Pixel granularity of the name-column slider — finer steps are invisible on screen.
const NAME_COLUMN_STEP_PX = 5;
const NAME_COLUMN_SLIDER_WIDTH_PX = 160;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['standings'];

const { SwitchRow, ColorRow } = panelRows<StandingsWidgetSettings>();

export const StandingsSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  const update = (partial: Partial<StandingsWidgetSettings>) => {
    widgetSettings.updateUserSettings('standings', {
      ...settings,
      ...partial,
    });
  };

  const dataColumns = [
    {
      titleKey: 'settingsPanels.standings.positionChange',
      descKey: 'settingsPanels.standings.positionChangeDesc',
      value: settings.showPosChange,
      key: 'showPosChange',
    },
    {
      titleKey: 'settingsPanels.standings.livePositionChange',
      descKey: 'settingsPanels.standings.livePositionChangeDesc',
      value: settings.showLivePosChange,
      key: 'showLivePosChange',
    },
    {
      titleKey: 'settingsPanels.standings.brandLogo',
      descKey: 'settingsPanels.standings.brandLogoDesc',
      value: settings.showBrand,
      key: 'showBrand',
    },
    {
      titleKey: 'settingsPanels.standings.tireCompound',
      descKey: 'settingsPanels.standings.tireCompoundDesc',
      value: settings.showTire,
      key: 'showTire',
    },
    {
      titleKey: 'settingsPanels.standings.licenseBadge',
      descKey: 'settingsPanels.standings.licenseBadgeDesc',
      value: settings.showLicBadge,
      key: 'showLicBadge',
    },
    {
      titleKey: 'settingsPanels.standings.iRating',
      descKey: 'settingsPanels.standings.iRatingDesc',
      value: settings.showIRating,
      key: 'showIRating',
    },
    {
      titleKey: 'settingsPanels.standings.iRatingDelta',
      descKey: 'settingsPanels.standings.iRatingDeltaDesc',
      value: settings.showIrChange,
      key: 'showIrChange',
    },
    {
      titleKey: 'settingsPanels.standings.lapsCompleted',
      descKey: 'settingsPanels.standings.lapsCompletedDesc',
      value: settings.showLapsCompleted,
      key: 'showLapsCompleted',
    },
    {
      titleKey: 'settingsPanels.standings.abbreviateNames',
      descKey: 'settingsPanels.standings.abbreviateNamesDesc',
      value: settings.abbreviateNames,
      key: 'abbreviateNames',
    },
    {
      titleKey: 'settingsPanels.standings.countryFlag',
      descKey: 'settingsPanels.standings.countryFlagDesc',
      value: settings.showCountryFlag,
      key: 'showCountryFlag',
    },
    {
      titleKey: 'settingsPanels.standings.driverFlags',
      descKey: 'settingsPanels.standings.driverFlagsDesc',
      value: settings.showDriverFlags,
      key: 'showDriverFlags',
    },
    {
      titleKey: 'settingsPanels.standings.hideRetiredDrivers',
      descKey: 'settingsPanels.standings.hideRetiredDriversDesc',
      value: settings.hideRetiredDrivers,
      key: 'hideRetiredDrivers',
    },
    {
      titleKey: 'settingsPanels.standings.hideDriversWithoutLap',
      descKey: 'settingsPanels.standings.hideDriversWithoutLapDesc',
      value: settings.hideDriversWithoutLap,
      key: 'hideDriversWithoutLap',
    },
  ] as const;

  const headerInfo = [
    {
      titleKey: 'settingsPanels.standings.columnHeaders',
      descKey: 'settingsPanels.standings.columnHeadersDesc',
      value: settings.showColumnHeaders,
      key: 'showColumnHeaders',
    },
    {
      titleKey: 'settingsPanels.standings.sessionProgressInfo',
      descKey: 'settingsPanels.standings.sessionProgressInfoDesc',
      value: settings.showSessionHeader,
      key: 'showSessionHeader',
    },
    {
      titleKey: 'settingsPanels.standings.sessionTime',
      descKey: 'settingsPanels.standings.sessionTimeDesc',
      value: settings.showSessionTime,
      key: 'showSessionTime',
    },
    {
      titleKey: 'settingsPanels.standings.sof',
      descKey: 'settingsPanels.standings.sofDesc',
      value: settings.showSOF,
      key: 'showSOF',
    },
    {
      titleKey: 'settingsPanels.standings.totalDriversCount',
      descKey: 'settingsPanels.standings.totalDriversCountDesc',
      value: settings.showTotalDrivers,
      key: 'showTotalDrivers',
    },
  ] as const;

  const footerInfo = [
    {
      titleKey: 'settingsPanels.standings.pitStopCounter',
      descKey: 'settingsPanels.standings.pitStopCounterDesc',
      value: settings.showPitStops,
      key: 'showPitStops',
    },
    {
      titleKey: 'settingsPanels.standings.incidentsBadge',
      descKey: 'settingsPanels.standings.incidentsBadgeDesc',
      value: settings.showIncidentsBadge,
      key: 'showIncidentsBadge',
    },
    {
      titleKey: 'settingsPanels.standings.liveWeatherInfo',
      descKey: 'settingsPanels.standings.liveWeatherInfoDesc',
      value: settings.showWeather,
      key: 'showWeather',
    },
  ] as const;

  return (
    <>
      <Card title={t('settingsPanels.standings.appearance')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.relative.rowHeight')}
            desc={t('settingsPanels.relative.rowHeightDesc')}
          >
            <Segmented<RowPadding>
              value={settings.rowPadding}
              onChange={(v) => update({ rowPadding: v })}
              options={[
                {
                  label: t('settingsPanels.relative.narrow'),
                  value: 'narrow',
                },
                {
                  label: t('settingsPanels.relative.medium'),
                  value: 'medium',
                },
                { label: t('settingsPanels.relative.wide'), value: 'wide' },
              ]}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.common.nameColumnWidth')}
            desc={t('settingsPanels.common.nameColumnWidthDesc')}
          >
            <Slider
              style={{ width: NAME_COLUMN_SLIDER_WIDTH_PX }}
              min={NAME_COLUMN_MIN_PX}
              max={NAME_COLUMN_MAX_PX}
              step={NAME_COLUMN_STEP_PX}
              value={settings.nameColumnWidth}
              tooltip={{ formatter: (value) => `${value ?? 0} px` }}
              onChange={(value) => update({ nameColumnWidth: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="dimSecondaryColumns"
            title={t('settingsPanels.standings.dimSecondaryColumns')}
            desc={t('settingsPanels.standings.dimSecondaryColumnsDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <ColorRow
            settingKey="playerRowColor"
            title={t('settingsPanels.relative.playerRowColor')}
            desc={t('settingsPanels.relative.playerRowColorDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <ColorRow
            settingKey="playerAccentColor"
            title={t('settingsPanels.relative.playerNumberColor')}
            desc={t('settingsPanels.relative.playerNumberColorDesc')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.positions')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="useLivePositions"
            title={t('settingsPanels.common.useLivePositions')}
            desc={t('settingsPanels.common.useLivePositionsStandingsDesc')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.standings.viewMode')}>
        <div className={styles.fieldGroup}>
          <Segmented<StandingsViewMode>
            block
            value={settings.viewMode}
            onChange={(v) => update({ viewMode: v })}
            options={[
              {
                label: t('settingsPanels.standings.allDrivers'),
                value: 'all',
              },
              {
                label: t('settingsPanels.standings.groupByClass'),
                value: 'grouped',
              },
              {
                label: t('settingsPanels.standings.classCycling'),
                value: 'cycling',
              },
            ]}
          />
        </div>

        {settings.viewMode === 'grouped' ? (
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
              min={GROUPED_ROWS_PER_CLASS_MIN}
              max={GROUPED_ROWS_PER_CLASS_MAX}
              step={1}
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
        ) : null}
      </Card>

      <Card title={t('settingsPanels.standings.playerWindow')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.standings.driversAhead')}
            desc={t('settingsPanels.standings.driversAheadDesc')}
          >
            <Segmented<number>
              value={settings.driversAhead}
              onChange={(v) => update({ driversAhead: v })}
              options={PLAYER_WINDOW_OPTIONS}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.standings.driversBehind')}
            desc={t('settingsPanels.standings.driversBehindDesc')}
          >
            <Segmented<number>
              value={settings.driversBehind}
              onChange={(v) => update({ driversBehind: v })}
              options={PLAYER_WINDOW_OPTIONS}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.standings.scrolling')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.standings.scrollResetSeconds')}
            desc={t('settingsPanels.standings.scrollResetSecondsDesc')}
          >
            <Segmented<number>
              value={settings.scrollResetSeconds}
              onChange={(v) => update({ scrollResetSeconds: v })}
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

      <Card title={t('settingsPanels.relative.dataColumns')}>
        {dataColumns.map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <SettingRow title={t(item.titleKey)} desc={t(item.descKey)}>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </SettingRow>
          </div>
        ))}
      </Card>

      <Card title={t('settingsPanels.standings.headerInfo')}>
        {headerInfo.map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <SettingRow title={t(item.titleKey)} desc={t(item.descKey)}>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </SettingRow>
          </div>
        ))}
      </Card>

      <Card title={t('settingsPanels.standings.footerInfo')}>
        {footerInfo.map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <SettingRow title={t(item.titleKey)} desc={t(item.descKey)}>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </SettingRow>
          </div>
        ))}
      </Card>
    </>
  );
});

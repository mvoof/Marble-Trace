import { Fragment, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider } from 'antd';
import type {
  RowPadding,
  StandingsViewMode,
  StandingsWidgetSettings,
} from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId, type SwitchKey } from './setting-rows';
import { LicBadgeStyleRow } from './shared';
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

const { ColorRow, DependentBlock, SwitchRow } =
  panelRows<StandingsWidgetSettings>();

interface ColumnSwitch {
  key: SwitchKey<StandingsWidgetSettings>;
  titleKey: string;
  descKey: string;
  /** Rows that only format this column, drawn under it while it is shown. */
  dependants?: ReactNode;
}

export const StandingsSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('standings');
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<StandingsWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<StandingsWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  const dataColumns: ColumnSwitch[] = [
    {
      titleKey: 'settingsPanels.standings.positionChange',
      descKey: 'settingsPanels.standings.positionChangeDesc',
      key: 'showPosChange',
    },
    {
      titleKey: 'settingsPanels.standings.livePositionChange',
      descKey: 'settingsPanels.standings.livePositionChangeDesc',
      key: 'showLivePosChange',
    },
    {
      titleKey: 'settingsPanels.standings.brandLogo',
      descKey: 'settingsPanels.standings.brandLogoDesc',
      key: 'showBrand',
    },
    {
      titleKey: 'settingsPanels.standings.tireCompound',
      descKey: 'settingsPanels.standings.tireCompoundDesc',
      key: 'showTire',
    },
    {
      titleKey: 'settingsPanels.standings.licenseBadge',
      descKey: 'settingsPanels.standings.licenseBadgeDesc',
      key: 'showLicBadge',
      dependants: (
        <>
          <DependentBlock dependsOn="showLicBadge">
            <LicBadgeStyleRow
              value={settings.licBadgeStyle}
              onChange={(v) => update({ licBadgeStyle: v })}
            />
          </DependentBlock>

          <SwitchRow
            settingKey="showLicenseLetter"
            dependsOn="showLicBadge"
            title={t('settingsPanels.standings.licenseLetter')}
            desc={t('settingsPanels.standings.licenseLetterDesc')}
          />
        </>
      ),
    },
    {
      titleKey: 'settingsPanels.standings.iRating',
      descKey: 'settingsPanels.standings.iRatingDesc',
      key: 'showIRating',
      dependants: (
        <SwitchRow
          settingKey="abbreviateIRating"
          dependsOn="showIRating"
          title={t('settingsPanels.standings.abbreviateIRating')}
          desc={t('settingsPanels.standings.abbreviateIRatingDesc')}
        />
      ),
    },
    {
      titleKey: 'settingsPanels.standings.gap',
      descKey: 'settingsPanels.standings.gapDesc',
      key: 'showGap',
    },
    {
      titleKey: 'settingsPanels.standings.lastLap',
      descKey: 'settingsPanels.standings.lastLapDesc',
      key: 'showLastLap',
    },
    {
      titleKey: 'settingsPanels.standings.bestLap',
      descKey: 'settingsPanels.standings.bestLapDesc',
      key: 'showBestLap',
    },
    {
      titleKey: 'settingsPanels.relative.pitIndicator',
      descKey: 'settingsPanels.relative.pitIndicatorDesc',
      key: 'showPitIndicator',
    },
    {
      titleKey: 'settingsPanels.standings.iRatingDelta',
      descKey: 'settingsPanels.standings.iRatingDeltaDesc',
      key: 'showIrChange',
    },
    {
      titleKey: 'settingsPanels.standings.lapsCompleted',
      descKey: 'settingsPanels.standings.lapsCompletedDesc',
      key: 'showLapsCompleted',
    },
    {
      titleKey: 'settingsPanels.standings.abbreviateNames',
      descKey: 'settingsPanels.standings.abbreviateNamesDesc',
      key: 'abbreviateNames',
    },
    {
      titleKey: 'settingsPanels.standings.countryFlag',
      descKey: 'settingsPanels.standings.countryFlagDesc',
      key: 'showCountryFlag',
    },
    {
      titleKey: 'settingsPanels.standings.driverFlags',
      descKey: 'settingsPanels.standings.driverFlagsDesc',
      key: 'showDriverFlags',
    },
    {
      titleKey: 'settingsPanels.standings.hideRetiredDrivers',
      descKey: 'settingsPanels.standings.hideRetiredDriversDesc',
      key: 'hideRetiredDrivers',
    },
    {
      titleKey: 'settingsPanels.standings.hideDriversWithoutLap',
      descKey: 'settingsPanels.standings.hideDriversWithoutLapDesc',
      key: 'hideDriversWithoutLap',
    },
  ];

  const headerInfo: ColumnSwitch[] = [
    {
      titleKey: 'settingsPanels.standings.columnHeaders',
      descKey: 'settingsPanels.standings.columnHeadersDesc',
      key: 'showColumnHeaders',
    },
    {
      titleKey: 'settingsPanels.standings.sessionProgressInfo',
      descKey: 'settingsPanels.standings.sessionProgressInfoDesc',
      key: 'showSessionHeader',
    },
    {
      titleKey: 'settingsPanels.standings.sessionTime',
      descKey: 'settingsPanels.standings.sessionTimeDesc',
      key: 'showSessionTime',
    },
    {
      titleKey: 'settingsPanels.standings.sof',
      descKey: 'settingsPanels.standings.sofDesc',
      key: 'showSOF',
      dependants: (
        <SwitchRow
          settingKey="abbreviateSof"
          dependsOn="showSOF"
          title={t('settingsPanels.standings.abbreviateSof')}
          desc={t('settingsPanels.standings.abbreviateSofDesc')}
        />
      ),
    },
    {
      titleKey: 'settingsPanels.standings.totalDriversCount',
      descKey: 'settingsPanels.standings.totalDriversCountDesc',
      key: 'showTotalDrivers',
    },
  ];

  const footerInfo: ColumnSwitch[] = [
    {
      titleKey: 'settingsPanels.standings.pitStopCounter',
      descKey: 'settingsPanels.standings.pitStopCounterDesc',
      key: 'showPitStops',
    },
    {
      titleKey: 'settingsPanels.standings.incidentsBadge',
      descKey: 'settingsPanels.standings.incidentsBadgeDesc',
      key: 'showIncidentsBadge',
    },
    {
      titleKey: 'settingsPanels.standings.liveWeatherInfo',
      descKey: 'settingsPanels.standings.liveWeatherInfoDesc',
      key: 'showWeather',
    },
  ];

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
          <Fragment key={item.key}>
            <SwitchRow
              settingKey={item.key}
              title={t(item.titleKey)}
              desc={t(item.descKey)}
            />

            {item.dependants}
          </Fragment>
        ))}
      </Card>

      <Card title={t('settingsPanels.standings.headerInfo')}>
        {headerInfo.map((item) => (
          <Fragment key={item.key}>
            <SwitchRow
              settingKey={item.key}
              title={t(item.titleKey)}
              desc={t(item.descKey)}
            />

            {item.dependants}
          </Fragment>
        ))}
      </Card>

      <Card title={t('settingsPanels.standings.footerInfo')}>
        {footerInfo.map((item) => (
          <Fragment key={item.key}>
            <SwitchRow
              settingKey={item.key}
              title={t(item.titleKey)}
              desc={t(item.descKey)}
            />

            {item.dependants}
          </Fragment>
        ))}
      </Card>
    </>
  );
});

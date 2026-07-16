import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch, Segmented, ColorPicker } from 'antd';
import type {
  RowPadding,
  StandingsViewMode,
  StandingsWidgetSettings,
} from '@/types/widget-settings';
import { HotkeyRecorder } from '@app/main/components/HotkeyRecorder/HotkeyRecorder';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

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
      titleKey: 'settingsPanels.standings.driverFlags',
      descKey: 'settingsPanels.standings.driverFlagsDesc',
      value: settings.showDriverFlags,
      key: 'showDriverFlags',
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
      titleKey: 'settingsPanels.standings.liveWeatherInfo',
      descKey: 'settingsPanels.standings.liveWeatherInfoDesc',
      value: settings.showWeather,
      key: 'showWeather',
    },
    {
      titleKey: 'settingsPanels.standings.sof',
      descKey: 'settingsPanels.standings.sofDesc',
      value: settings.showSOF,
      key: 'showSOF',
    },
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
      titleKey: 'settingsPanels.standings.totalDriversCount',
      descKey: 'settingsPanels.standings.totalDriversCountDesc',
      value: settings.showTotalDrivers,
      key: 'showTotalDrivers',
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
            title={t('settingsPanels.relative.playerRowColor')}
            desc={t('settingsPanels.relative.playerRowColorDesc')}
          >
            <ColorPicker
              value={settings.playerRowColor}
              onChange={(color) =>
                update({ playerRowColor: color.toRgbString() })
              }
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.relative.playerNumberColor')}
            desc={t('settingsPanels.relative.playerNumberColorDesc')}
          >
            <ColorPicker
              value={settings.playerAccentColor}
              onChange={(color) =>
                update({ playerAccentColor: color.toRgbString() })
              }
            />
          </SettingRow>
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
      </Card>

      <Card title={t('settingsPanels.standings.hotkeys')}>
        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label={t('settingsPanels.standings.cycleViewModeHotkey')}
            currentHotkey={settings.viewModeHotkey}
            onApply={(key) => update({ viewModeHotkey: key })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label={t('settingsPanels.standings.previousClassHotkey')}
            currentHotkey={settings.classPrevHotkey}
            onApply={(key) => update({ classPrevHotkey: key })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label={t('settingsPanels.standings.nextClassHotkey')}
            currentHotkey={settings.classNextHotkey}
            onApply={(key) => update({ classNextHotkey: key })}
          />
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
    </>
  );
});

import { Fragment, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider } from 'antd';
import type {
  RowPadding,
  RelativeWidgetSettings,
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
} from '@ui/widgets/RelativeWidget/relative-utils';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['relative'];

interface RelativeColumnSwitch {
  key: SwitchKey<RelativeWidgetSettings>;
  titleKey: string;
  descKey: string;
  /** Rows that only format this column, drawn under it while it is shown. */
  dependants?: ReactNode;
}

const { ColorRow, DependentBlock, SwitchRow } =
  panelRows<RelativeWidgetSettings>();

// Pixel granularity of the name-column slider — finer steps are invisible on screen.
const NAME_COLUMN_STEP_PX = 5;
const NAME_COLUMN_SLIDER_WIDTH_PX = 160;

export const RelativeSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('relative');
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<RelativeWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<RelativeWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  const dataColumns: RelativeColumnSwitch[] = [
    {
      titleKey: 'settingsPanels.common.carNumber',
      descKey: 'settingsPanels.common.carNumberDesc',
      key: 'showCarNumber',
    },
    {
      titleKey: 'settingsPanels.relative.licenseBadge',
      descKey: 'settingsPanels.relative.licenseBadgeDesc',
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
            title={t('settingsPanels.relative.licenseLetter')}
            desc={t('settingsPanels.relative.licenseLetterDesc')}
          />
        </>
      ),
    },
    {
      titleKey: 'settingsPanels.relative.iRating',
      descKey: 'settingsPanels.relative.iRatingDesc',
      key: 'showIRating',
      dependants: (
        <SwitchRow
          settingKey="abbreviateIRating"
          dependsOn="showIRating"
          title={t('settingsPanels.relative.abbreviateIRating')}
          desc={t('settingsPanels.relative.abbreviateIRatingDesc')}
        />
      ),
    },
    {
      titleKey: 'settingsPanels.relative.pitIndicator',
      descKey: 'settingsPanels.relative.pitIndicatorDesc',
      key: 'showPitIndicator',
    },
    {
      titleKey: 'settingsPanels.relative.abbreviateNames',
      descKey: 'settingsPanels.relative.abbreviateNamesDesc',
      key: 'abbreviateNames',
    },
    {
      titleKey: 'settingsPanels.relative.countryFlag',
      descKey: 'settingsPanels.relative.countryFlagDesc',
      key: 'showCountryFlag',
    },
    {
      titleKey: 'settingsPanels.relative.driverFlags',
      descKey: 'settingsPanels.relative.driverFlagsDesc',
      key: 'showDriverFlags',
    },
  ];

  return (
    <>
      <Card title={t('settingsPanels.relative.appearance')}>
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
            desc={t('settingsPanels.common.useLivePositionsRelativeDesc')}
          />
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

      <Card title={t('settingsPanels.trackMap.safetyCar')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="paceCarShowInPits"
            title={t('settingsPanels.trackMap.paceCarShowInPits')}
            desc={t('settingsPanels.trackMap.paceCarShowInPitsDesc')}
            fallback={false}
          />
        </div>
      </Card>
    </>
  );
});

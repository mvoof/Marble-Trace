import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch, Segmented, ColorPicker } from 'antd';
import type {
  RowPadding,
  RelativeWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const RelativeSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<RelativeWidgetSettings>('relative');

  const update = (partial: Partial<RelativeWidgetSettings>) => {
    widgetSettings.updateUserSettings('relative', {
      ...settings,
      ...partial,
    });
  };

  const dataColumns = [
    {
      titleKey: 'settingsPanels.relative.licenseBadge',
      descKey: 'settingsPanels.relative.licenseBadgeDesc',
      value: settings.showLicBadge,
      onChange: (v: boolean) => update({ showLicBadge: v }),
    },
    {
      titleKey: 'settingsPanels.relative.iRating',
      descKey: 'settingsPanels.relative.iRatingDesc',
      value: settings.showIRating,
      onChange: (v: boolean) => update({ showIRating: v }),
    },
    {
      titleKey: 'settingsPanels.relative.pitIndicator',
      descKey: 'settingsPanels.relative.pitIndicatorDesc',
      value: settings.showPitIndicator,
      onChange: (v: boolean) => update({ showPitIndicator: v }),
    },
    {
      titleKey: 'settingsPanels.relative.abbreviateNames',
      descKey: 'settingsPanels.relative.abbreviateNamesDesc',
      value: settings.abbreviateNames,
      onChange: (v: boolean) => update({ abbreviateNames: v }),
    },
    {
      titleKey: 'settingsPanels.relative.driverFlags',
      descKey: 'settingsPanels.relative.driverFlagsDesc',
      value: settings.showDriverFlags,
      onChange: (v: boolean) => update({ showDriverFlags: v }),
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

      <Card title={t('settingsPanels.relative.dataColumns')}>
        {dataColumns.map((item) => (
          <div key={item.titleKey} className={styles.fieldGroup}>
            <SettingRow title={t(item.titleKey)} desc={t(item.descKey)}>
              <Switch checked={item.value} onChange={item.onChange} />
            </SettingRow>
          </div>
        ))}
      </Card>
    </>
  );
});

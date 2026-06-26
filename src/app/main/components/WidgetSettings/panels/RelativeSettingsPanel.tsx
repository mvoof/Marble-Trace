import { observer } from 'mobx-react-lite';
import { Switch, Segmented } from 'antd';
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

  const settings =
    widgetSettings.getSettings<RelativeWidgetSettings>('relative');

  const update = (partial: Partial<RelativeWidgetSettings>) => {
    widgetSettings.updateUserSettings('relative', {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title="Appearance">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Row Height"
            desc="Vertical padding of each driver row."
          >
            <Segmented<RowPadding>
              value={settings.rowPadding}
              onChange={(v) => update({ rowPadding: v })}
              options={[
                { label: 'Narrow', value: 'narrow' },
                { label: 'Medium', value: 'medium' },
                { label: 'Wide', value: 'wide' },
              ]}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title="Data Columns">
        {[
          {
            title: 'License Badge',
            desc: 'Driver safety rating badge (A, B, C, D, R).',
            value: settings.showLicBadge,
            onChange: (v: boolean) => update({ showLicBadge: v }),
          },
          {
            title: 'iRating',
            desc: 'Driver iRating value.',
            value: settings.showIRating,
            onChange: (v: boolean) => update({ showIRating: v }),
          },
          {
            title: 'Pit Indicator',
            desc: 'Show icon when driver is in pits.',
            value: settings.showPitIndicator,
            onChange: (v: boolean) => update({ showPitIndicator: v }),
          },
          {
            title: 'Abbreviate Names',
            desc: 'Use short names to save space.',
            value: settings.abbreviateNames,
            onChange: (v: boolean) => update({ abbreviateNames: v }),
          },
          {
            title: 'Driver Flags',
            desc: 'Show active warning flags next to driver name.',
            value: settings.showDriverFlags,
            onChange: (v: boolean) => update({ showDriverFlags: v }),
          },
        ].map((item) => (
          <div key={item.title} className={styles.fieldGroup}>
            <SettingRow title={item.title} desc={item.desc}>
              <Switch checked={item.value} onChange={item.onChange} />
            </SettingRow>
          </div>
        ))}
      </Card>
    </>
  );
});

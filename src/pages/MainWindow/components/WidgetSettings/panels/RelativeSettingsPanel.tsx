import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { RelativeWidgetSettings } from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const RelativeSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getRelativeSettings();

  const update = (partial: Partial<RelativeWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('relative', {
      relative: { ...settings, ...partial },
    });
  };

  return (
    <Card title="Data Columns">
      {[
        {
          title: 'Class Badges',
          desc: 'Show colored class indicators.',
          value: settings.showClassBadge,
          onChange: (v: boolean) => update({ showClassBadge: v }),
        },
        {
          title: 'License / iRating',
          desc: 'Show driver license and iRating info.',
          value: settings.showIRatingBadge,
          onChange: (v: boolean) => update({ showIRatingBadge: v }),
        },
        {
          title: 'Trend Icon',
          desc: 'Show arrow indicating if gap is closing or opening.',
          value: settings.showTrendIcon,
          onChange: (v: boolean) => update({ showTrendIcon: v }),
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
      ].map((item, i) => (
        <div key={i} className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>{item.title}</div>
              <div className={styles.fieldDesc}>{item.desc}</div>
            </div>
            <Switch checked={item.value} onChange={item.onChange} />
          </div>
        </div>
      ))}
    </Card>
  );
});

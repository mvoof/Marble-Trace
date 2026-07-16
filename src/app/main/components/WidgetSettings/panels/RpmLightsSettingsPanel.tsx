import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, Segmented } from 'antd';
import { RpmLightsWidgetSettings, LedShape } from '@/types/widget-settings';
import { Card } from './Card';

import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { useWidgetEditor } from '../WidgetEditorContext';

export const RpmLightsSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<RpmLightsWidgetSettings>('rpm-lights');

  const update = (partial: Partial<RpmLightsWidgetSettings>) => {
    widgetSettings.updateUserSettings('rpm-lights', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title={t('settingsPanels.rpmLights.shiftLights')}>
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          {t('settingsPanels.rpmLights.colors')}
        </span>

        <div className={styles.rpmColorGrid}>
          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>
              {t('settingsPanels.raceDash.low')}
            </span>

            <ColorPicker
              value={settings.rpmColorLow}
              onChange={(color) => update({ rpmColorLow: color.toHexString() })}
            />
          </div>
          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>
              {t('settingsPanels.raceDash.mid')}
            </span>

            <ColorPicker
              value={settings.rpmColorMid}
              onChange={(color) => update({ rpmColorMid: color.toHexString() })}
            />
          </div>

          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>
              {t('settingsPanels.raceDash.high')}
            </span>

            <ColorPicker
              value={settings.rpmColorHigh}
              onChange={(color) =>
                update({ rpmColorHigh: color.toHexString() })
              }
            />
          </div>

          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>
              {t('settingsPanels.raceDash.shift')}
            </span>

            <ColorPicker
              value={settings.rpmColorShift}
              onChange={(color) =>
                update({ rpmColorShift: color.toHexString() })
              }
            />
          </div>

          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>
              {t('settingsPanels.raceDash.blink')}
            </span>

            <ColorPicker
              value={settings.rpmColorLimit}
              onChange={(color) =>
                update({ rpmColorLimit: color.toHexString() })
              }
            />
          </div>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          {t('settingsPanels.rpmLights.ledShape')}
        </span>

        <Segmented
          block
          value={settings.ledShape}
          options={[
            {
              label: t('settingsPanels.rpmLights.square'),
              value: 'square',
            },
            {
              label: t('settingsPanels.rpmLights.circle'),
              value: 'circle',
            },
            {
              label: t('settingsPanels.rpmLights.slant'),
              value: 'parallelogram',
            },
          ]}
          onChange={(value) => update({ ledShape: value as LedShape })}
        />
      </div>
    </Card>
  );
});

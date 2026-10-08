import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker } from 'antd';
import { Card } from '@features/widget-settings/Card';

import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import { usePanelWidgetId } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  RPM_LIGHTS_SETTINGS,
  type RpmLightsWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['rpm-lights'];

const { Row } = schemaRows(RPM_LIGHTS_SETTINGS);

export const RpmLightsSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('rpm-lights');
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<RpmLightsWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<RpmLightsWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
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
              {t('settingsPanels.common.rpmColorLow')}
            </span>

            <ColorPicker
              value={settings.rpmColorLow}
              onChange={(color) => update({ rpmColorLow: color.toHexString() })}
            />
          </div>
          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>
              {t('settingsPanels.common.rpmColorMid')}
            </span>

            <ColorPicker
              value={settings.rpmColorMid}
              onChange={(color) => update({ rpmColorMid: color.toHexString() })}
            />
          </div>

          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>
              {t('settingsPanels.common.rpmColorHigh')}
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
              {t('settingsPanels.common.rpmColorShift')}
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
              {t('settingsPanels.common.rpmColorLimit')}
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

      <Row setting="ledShape" stacked />
    </Card>
  );
});

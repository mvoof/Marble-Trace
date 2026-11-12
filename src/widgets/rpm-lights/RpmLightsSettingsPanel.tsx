import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Card } from '@features/widget-settings/Card';
import { ColorGrid } from '@features/widget-settings/ColorGrid';

import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { usePanelSettings } from '@features/widget-settings/use-panel-settings';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  RPM_LIGHTS_SETTINGS,
  type RpmLightsWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['rpm-lights'];

const RPM_ZONE_KEYS = [
  'rpmColorLow',
  'rpmColorMid',
  'rpmColorHigh',
  'rpmColorShift',
  'rpmColorLimit',
] as const;

const { Row } = schemaRows(RPM_LIGHTS_SETTINGS);

export const RpmLightsSettingsPanel = observer(() => {
  const [settings, update] =
    usePanelSettings<RpmLightsWidgetSettings>('rpm-lights');
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.rpmLights.shiftLights')}>
      <div className={styles.fieldGroup}>
        <ColorGrid
          caption={t('settingsPanels.rpmLights.colors')}
          items={RPM_ZONE_KEYS.map((key) => ({
            key,
            label: t(`settingsPanels.common.${key}`),
            color: settings[key],
          }))}
          onChange={(key, color) => update({ [key]: color })}
        />
      </div>

      <Row setting="ledShape" stacked />
    </Card>
  );
});

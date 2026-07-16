import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Col, InputNumber, Row, Segmented } from 'antd';
import type {
  RadarQualifyingVisibility,
  RadarSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { useWidgetEditor } from '../WidgetEditorContext';

export const RadarSettingsPanel = observer(
  ({ widgetId }: { widgetId: 'proximity-radar' | 'radar-bar' }) => {
    const widgetSettings = useWidgetEditor();
    const { t } = useTranslation('widgets');
    const settings = widgetSettings.getSettings<RadarSettings>(widgetId);

    const update = (partial: Partial<RadarSettings>) => {
      widgetSettings.updateUserSettings(widgetId, {
        ...settings,
        ...partial,
      });
    };

    return (
      <>
        <Card title={t('settingsPanels.radar.radarBehavior')}>
          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={8}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.radar.activationRange')}
              </span>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.proximityThreshold}
                min={1}
                max={20}
                step={0.5}
                onChange={(v) => {
                  if (v !== null) {
                    update({ proximityThreshold: v });
                  }
                }}
              />
            </Col>

            <Col span={8}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.radar.fadeOutDelay')}
              </span>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.hideDelay}
                min={0}
                max={30}
                step={0.5}
                onChange={(v) => {
                  if (v !== null) {
                    update({ hideDelay: v });
                  }
                }}
              />
            </Col>

            <Col span={8}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.radar.carLength')}
              </span>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.carLength}
                min={1}
                max={10}
                step={0.1}
                onChange={(v) => {
                  if (v !== null) {
                    update({ carLength: v });
                  }
                }}
              />
            </Col>
          </Row>
        </Card>

        <Card title={t('settingsPanels.radar.qualifying')}>
          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={24}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.radar.showInQualifying')}
              </span>
              <Segmented
                value={settings.qualifyingVisibility}
                onChange={(v) => {
                  update({
                    qualifyingVisibility: v as RadarQualifyingVisibility,
                  });
                }}
                options={[
                  { label: t('settingsPanels.radar.always'), value: 'always' },
                  { label: t('settingsPanels.radar.auto'), value: 'auto' },
                  { label: t('settingsPanels.radar.never'), value: 'never' },
                ]}
              />
              <div className={styles.fieldDesc}>
                {t('settingsPanels.radar.autoDesc')}
              </div>
            </Col>
          </Row>
        </Card>
      </>
    );
  }
);

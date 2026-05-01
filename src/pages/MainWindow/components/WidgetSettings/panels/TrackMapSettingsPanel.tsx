import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  App,
  Button,
  ColorPicker,
  Flex,
  InputNumber,
  Row,
  Col,
  Segmented,
  Switch,
} from 'antd';
import { emit } from '@tauri-apps/api/event';
import { appDataDir } from '@tauri-apps/api/path';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import {
  TrackMapLeaderLabelMode,
  TrackMapWidgetSettings,
} from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const TrackMapSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getTrackMapSettings();
  const [tracksPath, setTracksPath] = useState<string | null>(null);
  const { message } = App.useApp();

  const update = (partial: Partial<TrackMapWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('track-map', {
      'track-map': { ...settings, ...partial },
    });
  };

  const handleRerecord = async () => {
    await emit('track-map:clear');
  };

  const handleShowPath = async () => {
    try {
      const dir = await appDataDir();
      setTracksPath(`${dir}tracks.json`);
    } catch {
      setTracksPath('Could not resolve path');
    }
  };

  const handleCopyPath = async () => {
    if (tracksPath) {
      await navigator.clipboard.writeText(tracksPath);
    }
  };

  return (
    <>
      <Card title="Visual Elements">
        {[
          {
            title: 'Class Legend',
            value: settings.showLegend,
            key: 'showLegend',
          },
          {
            title: 'Sector Times',
            value: settings.showSectorTimes,
            key: 'showSectorTimes',
          },
          {
            title: 'Sectors on Map',
            value: settings.showSectorsOnMap,
            key: 'showSectorsOnMap',
          },
        ].map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>{item.title}</div>
              </div>
              <Switch
                checked={item.value}
                onChange={(v) =>
                  update({ [item.key as keyof TrackMapWidgetSettings]: v })
                }
              />
            </div>
          </div>
        ))}
      </Card>

      <Card title="Player Marker">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>Player Dot Color</div>
              <div className={styles.fieldDesc}>
                Ping ring and label pill color for your car.
              </div>
            </div>
            <ColorPicker
              value={settings.playerDotColor}
              onChange={(c) => update({ playerDotColor: c.toHexString() })}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                Show &quot;YOU&quot; Label
              </div>
              <div className={styles.fieldDesc}>
                Display the label above your car dot.
              </div>
            </div>
            <Switch
              checked={settings.showPlayerLabel}
              onChange={(v) => update({ showPlayerLabel: v })}
            />
          </div>
        </div>
      </Card>

      <Card title="Leader Labels">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Show P1 Label</span>
          <Segmented
            block
            value={settings.leaderLabelMode}
            options={[
              { label: 'All Classes', value: 'all' },
              { label: 'Own Class', value: 'own-class' },
              { label: 'Hidden', value: 'none' },
            ]}
            onChange={(v) =>
              update({ leaderLabelMode: v as TrackMapLeaderLabelMode })
            }
          />
        </div>
      </Card>

      <Card title="Track Styling">
        <Row gutter={[24, 24]}>
          <Col span={12}>
            <span className={styles.fieldLabel}>Track Stroke (px)</span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.trackStrokePx}
              min={1}
              max={30}
              onChange={(v) => v !== null && update({ trackStrokePx: v })}
            />
          </Col>

          <Col span={12}>
            <span className={styles.fieldLabel}>Track Border (px)</span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.trackBorderPx}
              min={0}
              max={20}
              onChange={(v) => v !== null && update({ trackBorderPx: v })}
            />
          </Col>

          <Col span={12}>
            <span className={styles.fieldLabel}>Sector Stroke (px)</span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.sectorStrokePx}
              min={1}
              max={20}
              onChange={(v) => v !== null && update({ sectorStrokePx: v })}
            />
          </Col>

          <Col span={12}>
            <span className={styles.fieldLabel}>Target Dot Radius (px)</span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.targetDotRadiusPx}
              min={1}
              max={30}
              onChange={(v) => v !== null && update({ targetDotRadiusPx: v })}
            />
          </Col>
        </Row>
      </Card>

      <Card title="Track Database">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldTitle}>Re-record Track</div>
          <div className={styles.fieldDesc} style={{ marginBottom: 16 }}>
            Clears current map data and starts fresh on next lap crossing or
            manual trigger.
          </div>
          <Flex gap={8}>
            <Button
              style={{ flex: 1 }}
              size="small"
              danger
              onClick={() => void handleRerecord()}
            >
              Reset Current Track Data
            </Button>
            <Button
              style={{ flex: 1 }}
              size="small"
              type={
                widgetSettingsStore.isTrackMapForceStartPending
                  ? 'primary'
                  : 'default'
              }
              danger={widgetSettingsStore.isTrackMapForceStartPending}
              onClick={() => {
                const next = !widgetSettingsStore.isTrackMapForceStartPending;
                widgetSettingsStore.setTrackMapForceStartPending(next);
                if (next) {
                  void emit('track-map:force-start');
                  message.info(
                    'Manual start active. Drive to begin recording.'
                  );
                } else {
                  message.warning('Manual start canceled.');
                }
              }}
            >
              {widgetSettingsStore.isTrackMapForceStartPending
                ? 'Cancel Force Start'
                : 'Force Start Recording'}
            </Button>
          </Flex>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldTitle}>Storage Location</div>
          {!tracksPath ? (
            <Button block size="small" onClick={() => void handleShowPath()}>
              Show tracks.json Path
            </Button>
          ) : (
            <Flex vertical gap={8}>
              <div
                className={styles.fieldDesc}
                style={{ wordBreak: 'break-all' }}
              >
                {tracksPath}
              </div>
              <Button block size="small" onClick={() => void handleCopyPath()}>
                Copy Path
              </Button>
            </Flex>
          )}
        </div>
      </Card>
    </>
  );
});

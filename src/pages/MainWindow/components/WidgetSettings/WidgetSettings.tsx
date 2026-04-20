import React, { useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import {
  InputNumber,
  Typography,
  Card,
  Row,
  Col,
  ColorPicker,
  Flex,
  Button,
  Tag,
  Select,
  Segmented,
  Divider,
  Switch,
  Space,
} from 'antd';
import {
  widgetSettingsStore,
  type SpeedWidgetSettings,
  type SpeedWidgetFocusMode,
  type RpmColorTheme,
  type InputTraceSettings,
  type InputTraceBarMode,
  type RadarSettings,
  type RadarVisibilityMode,
  type RadarBarDisplayMode,
  type StandingsWidgetSettings,
  type RelativeWidgetSettings,
  type TrackMapWidgetSettings,
  type TrackMapRotationMode,
  type LinearMapWidgetSettings,
  type LinearMapOrientation,
} from '../../../../store/widget-settings.store';
import { appSettingsStore } from '../../../../store/app-settings.store';
import { emit } from '@tauri-apps/api/event';
import { appDataDir } from '@tauri-apps/api/path';

const { Title, Text } = Typography;

export const WidgetSettings = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    if (!widgetId) {
      return <Text type="secondary">Select a widget to configure</Text>;
    }

    const widget = widgetSettingsStore.getWidget(widgetId);

    if (!widget) {
      return <Text type="secondary">Widget not found</Text>;
    }

    return (
      <Card>
        <Title level={5}>{widget.label}</Title>
        <Flex vertical gap={16}>
          <Row gutter={16}>
            <Col span={12}>
              <Text>X</Text>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.x}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'x', v)
                }
              />
            </Col>

            <Col span={12}>
              <Text>Y</Text>

              <InputNumber
                style={{ width: '100%' }}
                value={widget.y}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'y', v)
                }
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Text>Width</Text>

              <InputNumber
                style={{ width: '100%' }}
                value={widget.width}
                min={100}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'width', v)
                }
              />
            </Col>

            <Col span={12}>
              <Text>Height</Text>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.height}
                min={50}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'height', v)
                }
              />
            </Col>
          </Row>

          {widgetId !== 'radar-bar' && (
            <Row gutter={16}>
              <Col span={12}>
                <Flex vertical>
                  <Text>Background Center</Text>

                  <ColorPicker
                    value={widget.backgroundColor ?? '#1a1a1a'}
                    allowClear
                    onChange={(color) =>
                      widgetSettingsStore.updateField(
                        widgetId,
                        'backgroundColor',
                        color.toHexString()
                      )
                    }
                  />
                </Flex>
              </Col>

              <Col span={12}>
                <Flex vertical>
                  <Text>Background Edge</Text>

                  <ColorPicker
                    value={widget.backgroundColorEdge ?? '#0a0a0a'}
                    allowClear
                    onChange={(color) =>
                      widgetSettingsStore.updateField(
                        widgetId,
                        'backgroundColorEdge',
                        color.toHexString()
                      )
                    }
                  />
                </Flex>
              </Col>
            </Row>
          )}

          <HotkeyRecorder
            key={widgetId}
            widgetId={widgetId}
            currentHotkey={widget.hotkey}
          />

          {widgetId === 'speed' && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <SpeedSettings />
            </>
          )}

          {widgetId === 'input-trace' && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <InputTraceSettingsPanel />
            </>
          )}

          {(widgetId === 'proximity-radar' || widgetId === 'radar-bar') && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <RadarSettingsPanel widgetId={widgetId} />
            </>
          )}

          {widgetId === 'standings' && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <StandingsSettingsPanel />
            </>
          )}

          {widgetId === 'relative' && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <RelativeSettingsPanel />
            </>
          )}

          {widgetId === 'linear-map' && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <LinearMapSettingsPanel />
            </>
          )}

          {widgetId === 'track-map' && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <TrackMapSettingsPanel />
            </>
          )}
        </Flex>
      </Card>
    );
  }
);

const HotkeyRecorder = ({
  widgetId,
  currentHotkey,
}: {
  widgetId: string;
  currentHotkey: string;
}) => {
  const [recording, setRecording] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!recording) return;
      e.preventDefault();

      const parts: string[] = [];

      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');

      const key = e.key;

      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key);
        setPendingKey(parts.join('+'));
        setRecording(false);
      }
    },
    [recording]
  );

  const applyHotkey = async () => {
    if (!pendingKey) return;

    widgetSettingsStore.updateField(widgetId, 'hotkey', pendingKey);
    await appSettingsStore.registerWidgetHotkey(widgetId, pendingKey);

    setPendingKey(null);
  };

  const clearHotkey = async () => {
    widgetSettingsStore.updateField(widgetId, 'hotkey', '');
    await appSettingsStore.unregisterWidgetHotkey(widgetId);

    setPendingKey(null);
  };

  return (
    <Flex vertical gap={8}>
      <Text>
        Toggle Hotkey:{' '}
        {currentHotkey ? <Tag color="blue">{currentHotkey}</Tag> : 'None'}
      </Text>

      <Flex gap={8}>
        <Button
          size="small"
          type={recording ? 'primary' : 'default'}
          danger={recording}
          onClick={() => {
            setRecording(!recording);
            setPendingKey(null);
          }}
          onKeyDown={handleKeyDown}
        >
          {recording ? 'Press a key...' : 'Record Hotkey'}
        </Button>

        {pendingKey && (
          <>
            <Tag color="green">{pendingKey}</Tag>

            <Button
              size="small"
              type="primary"
              onClick={() => {
                void applyHotkey();
              }}
            >
              Apply
            </Button>
          </>
        )}

        {currentHotkey && (
          <Button
            size="small"
            danger
            onClick={() => {
              void clearHotkey();
            }}
          >
            Clear
          </Button>
        )}
      </Flex>
    </Flex>
  );
};

const SpeedSettings = observer(() => {
  const settings = widgetSettingsStore.getSpeedSettings();

  const update = (partial: Partial<SpeedWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('speed', {
      speed: { ...settings, ...partial },
    });
  };

  return (
    <Flex vertical gap={12}>
      <Title level={5} style={{ margin: 0 }}>
        Speed Widget
      </Title>

      <Flex vertical gap={4}>
        <Text>Focus Mode</Text>

        <Segmented
          value={settings.focusMode}
          options={[
            { label: 'Speed', value: 'speed' },
            { label: 'Gear', value: 'gear' },
          ]}
          onChange={(v) => update({ focusMode: v as SpeedWidgetFocusMode })}
        />
      </Flex>

      <Flex vertical gap={4}>
        <Text>RPM Color Theme</Text>

        <Select
          value={settings.rpmColorTheme}
          onChange={(v) => update({ rpmColorTheme: v as RpmColorTheme })}
          options={[
            { label: 'Custom', value: 'custom' },
            { label: 'Gradient', value: 'gradient' },
            { label: 'Classic', value: 'classic' },
          ]}
        />
      </Flex>

      {settings.rpmColorTheme === 'custom' && (
        <Row gutter={[12, 8]}>
          <Col span={6}>
            <Flex vertical align="center" gap={4}>
              <Text type="secondary">Low</Text>

              <ColorPicker
                value={settings.rpmColorLow}
                onChange={(c) => update({ rpmColorLow: c.toHexString() })}
                size="small"
              />
            </Flex>
          </Col>

          <Col span={6}>
            <Flex vertical align="center" gap={4}>
              <Text type="secondary">Mid</Text>

              <ColorPicker
                value={settings.rpmColorMid}
                onChange={(c) => update({ rpmColorMid: c.toHexString() })}
                size="small"
              />
            </Flex>
          </Col>

          <Col span={6}>
            <Flex vertical align="center" gap={4}>
              <Text type="secondary">High</Text>

              <ColorPicker
                value={settings.rpmColorHigh}
                onChange={(c) => update({ rpmColorHigh: c.toHexString() })}
                size="small"
              />
            </Flex>
          </Col>

          <Col span={6}>
            <Flex vertical align="center" gap={4}>
              <Text type="secondary">Limit</Text>

              <ColorPicker
                value={settings.rpmColorLimit}
                onChange={(c) => update({ rpmColorLimit: c.toHexString() })}
                size="small"
              />
            </Flex>
          </Col>
        </Row>
      )}

      {settings.rpmColorTheme !== 'custom' && (
        <Flex vertical gap={4}>
          <Text type="secondary">Limit Color</Text>

          <ColorPicker
            value={settings.rpmColorLimit}
            onChange={(c) => update({ rpmColorLimit: c.toHexString() })}
            size="small"
          />
        </Flex>
      )}
    </Flex>
  );
});

const InputTraceSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getInputTraceSettings();

  const update = (partial: Partial<InputTraceSettings>) => {
    widgetSettingsStore.updateCustomSettings('input-trace', {
      'input-trace': { ...settings, ...partial },
    });
  };

  return (
    <Flex vertical gap={12}>
      <Title level={5} style={{ margin: 0 }}>
        Input Trace
      </Title>

      <Flex vertical gap={8}>
        <Text>Channels</Text>

        <Space direction="vertical">
          <Space>
            <Switch
              checked={settings.showThrottle}
              onChange={(v) => update({ showThrottle: v })}
              size="small"
            />

            <Text>Throttle</Text>

            <ColorPicker
              value={settings.throttleColor}
              onChange={(c) => update({ throttleColor: c.toHexString() })}
              size="small"
            />
          </Space>

          <Space>
            <Switch
              checked={settings.showBrake}
              onChange={(v) => update({ showBrake: v })}
              size="small"
            />

            <Text>Brake</Text>

            <ColorPicker
              value={settings.brakeColor}
              onChange={(c) => update({ brakeColor: c.toHexString() })}
              size="small"
            />
          </Space>

          <Space>
            <Switch
              checked={settings.showClutch}
              onChange={(v) => update({ showClutch: v })}
              size="small"
            />

            <Text>Clutch</Text>

            <ColorPicker
              value={settings.clutchColor}
              onChange={(c) => update({ clutchColor: c.toHexString() })}
              size="small"
            />
          </Space>
        </Space>
      </Flex>

      <Flex vertical gap={4}>
        <Text>Progress Bars</Text>

        <Segmented
          value={settings.barMode}
          options={[
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
            { label: 'Hidden', value: 'hidden' },
          ]}
          onChange={(v) => update({ barMode: v as InputTraceBarMode })}
        />
      </Flex>
    </Flex>
  );
});

const RadarSettingsPanel = observer(
  ({ widgetId }: { widgetId: 'proximity-radar' | 'radar-bar' }) => {
    const settings = widgetSettingsStore.getRadarSettings(widgetId);

    const update = (partial: Partial<RadarSettings>) => {
      widgetSettingsStore.updateCustomSettings(widgetId, {
        [widgetId]: { ...settings, ...partial },
      });
    };

    return (
      <Flex vertical gap={12}>
        <Title level={5} style={{ margin: 0 }}>
          Radar Settings
        </Title>

        <Flex vertical gap={4}>
          <Text>Visibility</Text>

          <Segmented
            value={settings.visibilityMode}
            options={[
              { label: 'Always', value: 'always' },
              { label: 'Proximity', value: 'proximity' },
            ]}
            onChange={(v) =>
              update({ visibilityMode: v as RadarVisibilityMode })
            }
          />
        </Flex>

        {settings.visibilityMode === 'proximity' && (
          <>
            <Flex vertical gap={4}>
              <Text>Show when car within (m)</Text>

              <InputNumber
                style={{ width: '100%' }}
                value={settings.proximityThreshold}
                min={1}
                max={20}
                step={0.5}
                onChange={(v) =>
                  v !== null && update({ proximityThreshold: v })
                }
              />
            </Flex>

            <Flex vertical gap={4}>
              <Text>Hide delay (seconds)</Text>

              <InputNumber
                style={{ width: '100%' }}
                value={settings.hideDelay}
                min={0}
                max={30}
                step={0.5}
                onChange={(v) => v !== null && update({ hideDelay: v })}
              />
            </Flex>
          </>
        )}

        {widgetId === 'radar-bar' && (
          <>
            <Flex vertical gap={4}>
              <Text>Bar Display</Text>

              <Segmented
                value={settings.barDisplayMode ?? 'both'}
                options={[
                  { label: 'Both Sides', value: 'both' },
                  { label: 'Active Only', value: 'active-only' },
                ]}
                onChange={(v) =>
                  update({ barDisplayMode: v as RadarBarDisplayMode })
                }
              />
            </Flex>

            <Flex vertical gap={4}>
              <Text>Bar Spacing (px)</Text>

              <InputNumber
                style={{ width: '100%' }}
                value={settings.barSpacing ?? 0}
                min={0}
                max={1000}
                step={10}
                onChange={(v) => v !== null && update({ barSpacing: v })}
              />
            </Flex>
          </>
        )}
      </Flex>
    );
  }
);

const RelativeSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getRelativeSettings();

  const update = (partial: Partial<RelativeWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('relative', {
      relative: { ...settings, ...partial },
    });
  };

  return (
    <Flex vertical gap={12}>
      <Title level={5} style={{ margin: 0 }}>
        Relative
      </Title>

      <Space direction="vertical">
        <Space>
          <Switch
            checked={settings.showClassBadge}
            onChange={(v) => update({ showClassBadge: v })}
            size="small"
          />
          <Text>Class Badge</Text>
        </Space>

        <Space>
          <Switch
            checked={settings.showIRatingBadge}
            onChange={(v) => update({ showIRatingBadge: v })}
            size="small"
          />
          <Text>License / iRating</Text>
        </Space>

        <Space>
          <Switch
            checked={settings.showPitIndicator}
            onChange={(v) => update({ showPitIndicator: v })}
            size="small"
          />
          <Text>Pit Indicator</Text>
        </Space>

        <Space>
          <Switch
            checked={settings.abbreviateNames}
            onChange={(v) => update({ abbreviateNames: v })}
            size="small"
          />
          <Text>Abbreviate Names</Text>
        </Space>
      </Space>
    </Flex>
  );
});

const StandingsSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getStandingsSettings();

  const update = (partial: Partial<StandingsWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('standings', {
      standings: { ...settings, ...partial },
    });
  };

  return (
    <Flex vertical gap={12}>
      <Title level={5} style={{ margin: 0 }}>
        Standings
      </Title>

      <Flex vertical gap={4}>
        <Space>
          <Switch
            checked={settings.groupByClass}
            onChange={(v) => update({ groupByClass: v })}
            size="small"
          />
          <Text>Group by Class</Text>
        </Space>

        <Text type="secondary" style={{ fontSize: 11 }}>
          Separate standings into class blocks. If player is not in the visible
          top rows, they are always pinned at the bottom.
        </Text>
      </Flex>

      <Divider style={{ margin: '4px 0' }} />

      <Flex vertical gap={8}>
        <Text>Columns</Text>

        <Space direction="vertical">
          <Space>
            <Switch
              checked={settings.showPosChange}
              onChange={(v) => update({ showPosChange: v })}
              size="small"
            />
            <Text>Position Change (+/-)</Text>
          </Space>

          <Space>
            <Switch
              checked={settings.showBrand}
              onChange={(v) => update({ showBrand: v })}
              size="small"
            />
            <Text>Brand</Text>
          </Space>

          <Space>
            <Switch
              checked={settings.showTire}
              onChange={(v) => update({ showTire: v })}
              size="small"
            />
            <Text>Tire</Text>
          </Space>

          <Space>
            <Switch
              checked={settings.showIrChange}
              onChange={(v) => update({ showIrChange: v })}
              size="small"
            />
            <Text>ΔiR (estimate)</Text>
          </Space>

          <Space>
            <Switch
              checked={settings.showPitStops}
              onChange={(v) => update({ showPitStops: v })}
              size="small"
            />
            <Text>Pit Stops (player only)</Text>
          </Space>
        </Space>

        <Text type="secondary" style={{ fontSize: 11 }}>
          Tire shows the session compound (iRacing does not expose per-driver
          tire data). ΔiR is an Elo-based projection, not real iRacing data. Pit
          Stops are counted on the frontend for the player only.
        </Text>
      </Flex>

      <Divider style={{ margin: '4px 0' }} />

      <Flex vertical gap={8}>
        <Text>Header</Text>

        <Space direction="vertical">
          <Space>
            <Switch
              checked={settings.showColumnHeaders}
              onChange={(v) => update({ showColumnHeaders: v })}
              size="small"
            />
            <Text>Column Names</Text>
          </Space>

          <Space>
            <Switch
              checked={settings.showSessionHeader}
              onChange={(v) => update({ showSessionHeader: v })}
              size="small"
            />
            <Text>Session Info</Text>
          </Space>

          <Space>
            <Switch
              checked={settings.showWeather}
              onChange={(v) => update({ showWeather: v })}
              size="small"
            />
            <Text>Weather</Text>
          </Space>

          <Space>
            <Switch
              checked={settings.showSOF}
              onChange={(v) => update({ showSOF: v })}
              size="small"
            />
            <Text>SOF</Text>
          </Space>

          <Space>
            <Switch
              checked={settings.showTotalDrivers}
              onChange={(v) => update({ showTotalDrivers: v })}
              size="small"
            />
            <Text>Total Drivers</Text>
          </Space>
        </Space>
      </Flex>
    </Flex>
  );
});

const LinearMapSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getLinearMapSettings();

  const update = (partial: Partial<LinearMapWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('linear-map', {
      'linear-map': { ...settings, ...partial },
    });
  };

  return (
    <Flex vertical gap={12}>
      <Title level={5} style={{ margin: 0 }}>
        Linear Map
      </Title>

      <Flex vertical gap={4}>
        <Text>Orientation</Text>

        <Segmented
          value={settings.orientation}
          options={[
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
          ]}
          onChange={(v) => update({ orientation: v as LinearMapOrientation })}
        />
      </Flex>
    </Flex>
  );
});

const TrackMapSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getTrackMapSettings();
  const [tracksPath, setTracksPath] = useState<string | null>(null);

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
    <Flex vertical gap={12}>
      <Title level={5} style={{ margin: 0 }}>
        Track Map
      </Title>

      <Flex vertical gap={4}>
        <Text>Map Rotation</Text>

        <Segmented
          value={settings.rotationMode}
          options={[
            { label: 'Fixed (North up)', value: 'fixed' },
            { label: 'Heading up', value: 'heading-up' },
          ]}
          onChange={(v) => update({ rotationMode: v as TrackMapRotationMode })}
        />
      </Flex>

      <Space>
        <Switch
          checked={settings.showLegend}
          onChange={(v) => update({ showLegend: v })}
          size="small"
        />
        <Text>Class Legend</Text>
      </Space>

      <Space>
        <Switch
          checked={settings.showSectors}
          onChange={(v) => update({ showSectors: v })}
          size="small"
        />
        <Text>Sectors</Text>
      </Space>

      <Space>
        <Switch
          checked={settings.showCornerNumbers}
          onChange={(v) => update({ showCornerNumbers: v })}
          size="small"
        />
        <Text>Corner Numbers</Text>
      </Space>

      <Divider style={{ margin: '4px 0' }} />

      <Flex vertical gap={8}>
        <Text>Track Data</Text>

        <Button
          size="small"
          danger
          onClick={() => {
            void handleRerecord();
          }}
        >
          Re-record current track
        </Button>

        <Text type="secondary" style={{ fontSize: 11 }}>
          Clears the saved map for the current track and starts a new recording
          on your next lap.
        </Text>

        {!tracksPath ? (
          <Button
            size="small"
            onClick={() => {
              void handleShowPath();
            }}
          >
            Show tracks.json path
          </Button>
        ) : (
          <Flex vertical gap={4}>
            <Text
              type="secondary"
              style={{ fontSize: 11, wordBreak: 'break-all' }}
            >
              {tracksPath}
            </Text>

            <Button
              size="small"
              onClick={() => {
                void handleCopyPath();
              }}
            >
              Copy path
            </Button>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
});

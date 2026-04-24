import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  InputNumber,
  Row,
  Col,
  ColorPicker,
  Flex,
  Button,
  Select,
  Segmented,
  Switch,
  Space,
} from 'antd';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import type {
  SpeedWidgetSettings,
  SpeedWidgetFocusMode,
  RpmColorTheme,
  InputTraceSettings,
  InputTraceBarMode,
  RadarSettings,
  RadarVisibilityMode,
  RadarBarDisplayMode,
  StandingsWidgetSettings,
  RelativeWidgetSettings,
  TrackMapWidgetSettings,
  LinearMapWidgetSettings,
  LinearMapOrientation,
  WeatherWidgetSettings,
  FuelWidgetSettings,
  FlagsWidgetSettings,
  FlagsVariant,
} from '../../../../types/widget-settings';
import { emit } from '@tauri-apps/api/event';
import { appDataDir } from '@tauri-apps/api/path';
import { HotkeyRecorder } from '../../../../components/shared/HotkeyRecorder';
import styles from './WidgetSettings.module.scss';

interface CardProps {
  title?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children }) => (
  <div className={styles.card}>
    {title && <h3 className={styles.cardTitle}>{title}</h3>}
    <div className={styles.cardContent}>{children}</div>
  </div>
);

export const WidgetSettings = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    if (!widgetId) {
      return (
        <div className={styles.fieldDesc}>Select a widget to configure</div>
      );
    }

    const widget = widgetSettingsStore.getWidget(widgetId);

    if (!widget) {
      return <div className={styles.fieldDesc}>Widget not found</div>;
    }

    return (
      <div className={styles.animateFadeIn}>
        <header className={styles.header}>
          <span className={styles.moduleLabel}>Module Config</span>
          <h1 className={styles.title}>{widget.label}</h1>
        </header>

        <Card title="Layout & Dimensions">
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <span className={styles.fieldLabel}>Position X</span>
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
              <span className={styles.fieldLabel}>Position Y</span>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.y}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'y', v)
                }
              />
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Width (px)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.width}
                min={10}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'width', v)
                }
              />
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Height (px)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.height}
                min={10}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'height', v)
                }
              />
            </Col>
          </Row>
        </Card>

        {widgetId !== 'radar-bar' && (
          <Card title="Aesthetics">
            <Row gutter={[24, 24]}>
              <Col span={12}>
                <span className={styles.fieldLabel}>Background Center</span>
                <div className={styles.colorPickerContainer}>
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
                  <div className={styles.fieldDesc}>
                    {widget.backgroundColor ?? 'transparent'}
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <span className={styles.fieldLabel}>Background Edge</span>
                <div className={styles.colorPickerContainer}>
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
                  <div className={styles.fieldDesc}>
                    {widget.backgroundColorEdge ?? 'transparent'}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        <Card title="Controls">
          <HotkeyRecorderWrapper
            key={widgetId}
            widgetId={widgetId}
            currentHotkey={widget.hotkey}
          />
        </Card>

        {widgetId === 'speed' && <SpeedSettings />}
        {widgetId === 'input-trace' && <InputTraceSettingsPanel />}
        {(widgetId === 'proximity-radar' || widgetId === 'radar-bar') && (
          <RadarSettingsPanel widgetId={widgetId} />
        )}
        {widgetId === 'standings' && <StandingsSettingsPanel />}
        {widgetId === 'relative' && <RelativeSettingsPanel />}
        {widgetId === 'linear-map' && <LinearMapSettingsPanel />}
        {widgetId === 'track-map' && <TrackMapSettingsPanel />}
        {widgetId === 'weather' && <WeatherSettingsPanel />}
        {widgetId === 'fuel' && <FuelSettingsPanel />}
        {widgetId === 'flags' && <FlagsSettingsPanel />}
      </div>
    );
  }
);

const HotkeyRecorderWrapper = ({
  widgetId,
  currentHotkey,
}: {
  widgetId: string;
  currentHotkey: string;
}) => {
  return (
    <HotkeyRecorder
      label="Toggle Hotkey"
      currentHotkey={currentHotkey}
      onApply={(key: string) =>
        widgetSettingsStore.updateField(widgetId, 'hotkey', key)
      }
    />
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
    <Card title="Module Parameters">
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Primary Focus</span>
        <Segmented
          block
          value={settings.focusMode}
          options={[
            { label: 'Vehicle Speed', value: 'speed' },
            { label: 'Current Gear', value: 'gear' },
          ]}
          onChange={(v) => update({ focusMode: v as SpeedWidgetFocusMode })}
        />
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>RPM Scale Theme</span>
        <Select
          style={{ width: '100%' }}
          value={settings.rpmColorTheme}
          onChange={(v) => update({ rpmColorTheme: v as RpmColorTheme })}
          options={[
            { label: 'Custom Palette', value: 'custom' },
            { label: 'Gradient Theme', value: 'gradient' },
            { label: 'Classic Theme', value: 'classic' },
          ]}
        />
      </div>

      {settings.rpmColorTheme === 'custom' && (
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Palette Colors</span>
          <div className={styles.rpmColorGrid}>
            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>Low</span>
              <ColorPicker
                value={settings.rpmColorLow}
                onChange={(c) => update({ rpmColorLow: c.toHexString() })}
              />
            </div>
            <div className={styles.rpmColorLine} />
            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>Mid</span>
              <ColorPicker
                value={settings.rpmColorMid}
                onChange={(c) => update({ rpmColorMid: c.toHexString() })}
              />
            </div>
            <div className={styles.rpmColorLine} />
            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>High</span>
              <ColorPicker
                value={settings.rpmColorHigh}
                onChange={(c) => update({ rpmColorHigh: c.toHexString() })}
              />
            </div>
            <div className={styles.rpmColorLine} />
            <div className={styles.rpmColorItem}>
              <span className={styles.rpmColorLabel}>Limit</span>
              <ColorPicker
                value={settings.rpmColorLimit}
                onChange={(c) => update({ rpmColorLimit: c.toHexString() })}
              />
            </div>
          </div>
        </div>
      )}

      {settings.rpmColorTheme !== 'custom' && (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>Limit Flash Color</div>
              <div className={styles.fieldDesc}>
                Color when engine reaches RPM limit.
              </div>
            </div>
            <ColorPicker
              value={settings.rpmColorLimit}
              onChange={(c) => update({ rpmColorLimit: c.toHexString() })}
            />
          </div>
        </div>
      )}
    </Card>
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
    <Card title="Data Channels">
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>Throttle</div>
          </div>
          <Space>
            <ColorPicker
              value={settings.throttleColor}
              onChange={(c) => update({ throttleColor: c.toHexString() })}
            />
            <Switch
              checked={settings.showThrottle}
              onChange={(v) => update({ showThrottle: v })}
            />
          </Space>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>Brake</div>
          </div>
          <Space>
            <ColorPicker
              value={settings.brakeColor}
              onChange={(c) => update({ brakeColor: c.toHexString() })}
            />
            <Switch
              checked={settings.showBrake}
              onChange={(v) => update({ showBrake: v })}
            />
          </Space>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>Clutch</div>
          </div>
          <Space>
            <ColorPicker
              value={settings.clutchColor}
              onChange={(c) => update({ clutchColor: c.toHexString() })}
            />
            <Switch
              checked={settings.showClutch}
              onChange={(v) => update({ showClutch: v })}
            />
          </Space>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Progress Bars Orientation</span>
        <Segmented
          block
          value={settings.barMode}
          options={[
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
            { label: 'Hidden', value: 'hidden' },
          ]}
          onChange={(v) => update({ barMode: v as InputTraceBarMode })}
        />
      </div>
    </Card>
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
      <Card title="Radar Behavior">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Visibility Logic</span>
          <Segmented
            block
            value={settings.visibilityMode}
            options={[
              { label: 'Always Visible', value: 'always' },
              { label: 'On Proximity Only', value: 'proximity' },
            ]}
            onChange={(v) =>
              update({ visibilityMode: v as RadarVisibilityMode })
            }
          />
        </div>

        {settings.visibilityMode === 'proximity' && (
          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={12}>
              <span className={styles.fieldLabel}>Activation Range (m)</span>
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
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Fade Out Delay (s)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.hideDelay}
                min={0}
                max={30}
                step={0.5}
                onChange={(v) => v !== null && update({ hideDelay: v })}
              />
            </Col>
          </Row>
        )}

        {widgetId === 'radar-bar' && (
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Bar Display Mode</span>
            <Segmented
              block
              value={settings.barDisplayMode ?? 'both'}
              options={[
                { label: 'Show Both Sides', value: 'both' },
                { label: 'Active Side Only', value: 'active-only' },
              ]}
              onChange={(v) =>
                update({ barDisplayMode: v as RadarBarDisplayMode })
              }
            />
          </div>
        )}
      </Card>
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

const StandingsSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getStandingsSettings();

  const update = (partial: Partial<StandingsWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('standings', {
      standings: { ...settings, ...partial },
    });
  };

  return (
    <>
      <Card title="Logic & Grouping">
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>Class Cycling</div>
            <div className={styles.fieldDesc}>
              Show one class at a time. Off shows all drivers combined.
            </div>
          </div>
          <Switch
            checked={settings.enableClassCycling}
            onChange={(v) => update({ enableClassCycling: v })}
          />
        </div>
      </Card>

      <Card title="Hotkeys">
        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label="Toggle Class Cycling"
            currentHotkey={settings.classCyclingToggleHotkey}
            onApply={(key) => update({ classCyclingToggleHotkey: key })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label="Previous Class"
            currentHotkey={settings.classPrevHotkey}
            onApply={(key) => update({ classPrevHotkey: key })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <HotkeyRecorder
            label="Next Class"
            currentHotkey={settings.classNextHotkey}
            onApply={(key) => update({ classNextHotkey: key })}
          />
        </div>
      </Card>

      <Card title="Data Columns">
        {[
          {
            title: 'Position Change (+/-)',
            value: settings.showPosChange,
            key: 'showPosChange',
          },
          {
            title: 'Vehicle Brand Logo',
            value: settings.showBrand,
            key: 'showBrand',
          },
          { title: 'Tire Compound', value: settings.showTire, key: 'showTire' },
          {
            title: 'iRating Delta (projected)',
            value: settings.showIrChange,
            key: 'showIrChange',
          },
          {
            title: 'Pit Stop Count',
            value: settings.showPitStops,
            key: 'showPitStops',
          },
          {
            title: 'Laps Completed',
            value: settings.showLapsCompleted,
            key: 'showLapsCompleted',
          },
          {
            title: 'Abbreviate Driver Names',
            value: settings.abbreviateNames,
            key: 'abbreviateNames',
          },
        ].map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>{item.title}</div>
              </div>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </div>
          </div>
        ))}
      </Card>

      <Card title="Header Info">
        {[
          {
            title: 'Column Headers',
            value: settings.showColumnHeaders,
            key: 'showColumnHeaders',
          },
          {
            title: 'Session Progress Info',
            value: settings.showSessionHeader,
            key: 'showSessionHeader',
          },
          {
            title: 'Live Weather Info',
            value: settings.showWeather,
            key: 'showWeather',
          },
          {
            title: 'Strength of Field (SOF)',
            value: settings.showSOF,
            key: 'showSOF',
          },
          {
            title: 'Total Drivers Count',
            value: settings.showTotalDrivers,
            key: 'showTotalDrivers',
          },
        ].map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>{item.title}</div>
              </div>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </div>
          </div>
        ))}
      </Card>
    </>
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
    <Card title="Module Layout">
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Orientation</span>
        <Segmented
          block
          value={settings.orientation}
          options={[
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
          ]}
          onChange={(v) => update({ orientation: v as LinearMapOrientation })}
        />
      </div>
    </Card>
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
    <>
      <Card title="Visual Elements">
        {[
          {
            title: 'Class Legend',
            value: settings.showLegend,
            key: 'showLegend',
          },
          {
            title: 'Track Sectors',
            value: settings.showSectors,
            key: 'showSectors',
          },
          {
            title: 'Corner Numbers',
            value: settings.showCornerNumbers,
            key: 'showCornerNumbers',
          },
        ].map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>{item.title}</div>
              </div>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </div>
          </div>
        ))}
      </Card>

      <Card title="Track Database">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldTitle}>Re-record Track</div>
          <div className={styles.fieldDesc} style={{ marginBottom: 16 }}>
            Clears current map data and starts fresh on next lap.
          </div>
          <Button
            block
            size="small"
            danger
            onClick={() => void handleRerecord()}
          >
            Reset Current Track Data
          </Button>
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

const WeatherSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getWeatherSettings();

  const update = (partial: Partial<WeatherWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('weather', {
      weather: { ...settings, ...partial },
    });
  };

  return (
    <Card title="Module Parameters">
      {[
        {
          title: 'Wind Compass',
          value: settings.showCompass,
          key: 'showCompass',
        },
        {
          title: 'Air Temperature',
          value: settings.showAirTemp,
          key: 'showAirTemp',
        },
        {
          title: 'Track Temperature',
          value: settings.showTrackTemp,
          key: 'showTrackTemp',
        },
        {
          title: 'Wind Speed & Dir',
          value: settings.showWind,
          key: 'showWind',
        },
        {
          title: 'Relative Humidity',
          value: settings.showHumidity,
          key: 'showHumidity',
        },
      ].map((item) => (
        <div key={item.key} className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>{item.title}</div>
            </div>
            <Switch
              checked={item.value}
              onChange={(v) => update({ [item.key]: v })}
            />
          </div>
        </div>
      ))}
    </Card>
  );
});

const FuelSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getFuelSettings();

  const update = (partial: Partial<FuelWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('fuel', {
      fuel: { ...settings, ...partial },
    });
  };

  return (
    <Card title="Analytics & Warnings">
      <div className={styles.fieldGroup}>
        <div
          className={styles.fieldRow}
          style={{ marginBottom: settings.showChart ? 16 : 0 }}
        >
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>History Chart</div>
            <div className={styles.fieldDesc}>Visual consumption history.</div>
          </div>
          <Switch
            checked={settings.showChart}
            onChange={(v) => update({ showChart: v })}
          />
        </div>
        {settings.showChart && (
          <Segmented
            block
            value={settings.chartType}
            options={[
              { label: 'Bar Chart', value: 'bar' },
              { label: 'Line Chart', value: 'line' },
            ]}
            onChange={(v) => update({ chartType: v as 'bar' | 'line' })}
          />
        )}
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          Low Fuel Warning Threshold (Laps)
        </span>
        <InputNumber
          style={{ width: '100%' }}
          value={settings.pitWarningLaps}
          min={1}
          max={20}
          onChange={(v) => v !== null && update({ pitWarningLaps: v })}
        />
      </div>
    </Card>
  );
});

const FlagsSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getFlagsSettings();

  const update = (partial: Partial<FlagsWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('flags', {
      flags: { ...settings, ...partial },
    });
  };

  return (
    <Card title="Module Display">
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Visual Variant</span>
        <Segmented
          block
          value={settings.variant}
          options={[
            { label: 'Full Overlay', value: 'overlay' },
            { label: 'Under Mirror', value: 'under-mirror' },
            { label: 'Standalone', value: 'standalone' },
          ]}
          onChange={(v) => update({ variant: v as FlagsVariant })}
        />
      </div>

      <Row gutter={24} className={styles.fieldGroup}>
        <Col span={12}>
          <span className={styles.fieldLabel}>Width Multiplier</span>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.cutoutWidth}
            min={1}
            max={20}
            onChange={(v) => v !== null && update({ cutoutWidth: v })}
          />
        </Col>

        <Col span={12}>
          <span className={styles.fieldLabel}>Height Multiplier</span>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.cutoutHeight}
            min={1}
            max={10}
            onChange={(v) => v !== null && update({ cutoutHeight: v })}
          />
        </Col>
      </Row>
    </Card>
  );
});

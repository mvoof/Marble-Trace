import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Select } from 'antd';
import { ArrowDown, ArrowUp, Maximize2, X } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLapAnalysisStore } from '@features/lap-analysis/lap-analysis-context';
import {
  DELTA_CHANNEL,
  ELAPSED_CHANNEL,
  channelInfo,
  channelLook,
  formatChannelValue,
} from '@features/lap-analysis/channel-looks';
import { LapChart, type ChartSeries } from '@shared/ui/LapChart/LapChart';
import { GestureHint } from './GestureHint';
import styles from './AnalysisCharts.module.scss';

const ICON_SIZE = 13;
const CHART_HEIGHT = 130;
/** The bottom chart is taller by its distance axis. */
const AXIS_HEIGHT = 28;
const SYNC_KEY = 'lap-analysis';
const METRES_PER_KM = 1000;
const KM_DIGITS = 1;
const PLAQUE_KM_DIGITS = 3;

const formatAxisKm = (metres: number) =>
  `${(metres / METRES_PER_KM).toFixed(KM_DIGITS)}`;

const formatPlaqueKm = (metres: number) =>
  `${(metres / METRES_PER_KM).toFixed(PLAQUE_KM_DIGITS)} km`;

interface ChannelChartProps {
  channel: string;
  index: number;
  count: number;
  distances: Float64Array;
}

/** One channel, every lap of the set in its colour. */
const ChannelChart = observer(
  ({ channel, index, count, distances }: ChannelChartProps) => {
    const { t } = useTranslation('main-app');
    const analysis = useLapAnalysisStore();
    const appSettings = useAppSettingsStore();
    const catalog = analysis.loaded?.channels ?? [];
    const info = channelInfo(channel, catalog);
    const look = channelLook(channel, info?.unit ?? '');
    const values = analysis.chartValues(channel);
    const isLast = index === count - 1;

    if (values === null) {
      return null;
    }

    const series: ChartSeries[] = analysis.laps.map((lap, lapIndex) => ({
      key: `${lap.lap.path}:${lap.lap.sessionNum}:${lap.lap.lapNum}`,
      color: lap.color,
      visible: lap.visible && !analysis.isMissing(lap.lap),
      values:
        look.scale === 1
          ? values[lapIndex]
          : values[lapIndex].map((value) => value * look.scale),
    }));

    const move = (offset: number) => {
      const channels = [...appSettings.appSettings.analysisChannels];
      const [moved] = channels.splice(index, 1);
      channels.splice(index + offset, 0, moved);
      appSettings.update({ analysisChannels: channels });
    };

    const remove = () =>
      appSettings.update({
        analysisChannels: appSettings.appSettings.analysisChannels.filter(
          (shown) => shown !== channel
        ),
      });

    const title =
      channel === DELTA_CHANNEL ? t('dataPage.analysis.delta') : channel;

    return (
      <LapChart
        title={look.unit === '' ? title : `${title} · ${look.unit}`}
        distances={distances}
        series={series}
        height={CHART_HEIGHT + (isLast ? AXIS_HEIGHT : 0)}
        showDistanceAxis={isLast}
        syncKey={SYNC_KEY}
        viewport={analysis.viewport}
        sectorStartsM={analysis.sectorStartsM}
        formatValue={(value) => formatChannelValue(look, value)}
        formatDistance={formatPlaqueKm}
        formatAxisDistance={formatAxisKm}
        tools={
          <>
            <button
              type="button"
              className={styles.tool}
              disabled={index === 0}
              title={t('dataPage.analysis.moveUp')}
              onClick={() => move(-1)}
            >
              <ArrowUp size={ICON_SIZE} />
            </button>

            <button
              type="button"
              className={styles.tool}
              disabled={isLast}
              title={t('dataPage.analysis.moveDown')}
              onClick={() => move(1)}
            >
              <ArrowDown size={ICON_SIZE} />
            </button>

            <button
              type="button"
              className={styles.tool}
              title={t('dataPage.analysis.removeChart')}
              onClick={remove}
            >
              <X size={ICON_SIZE} />
            </button>
          </>
        }
      />
    );
  }
);

/** "+ Channel": any channel the file holds, searchable. */
const AddChannel = observer(() => {
  const { t } = useTranslation('main-app');
  const analysis = useLapAnalysisStore();
  const appSettings = useAppSettingsStore();
  const shown = appSettings.appSettings.analysisChannels;
  const options = [
    { name: DELTA_CHANNEL, description: t('dataPage.analysis.delta') },
    ...(analysis.loaded?.channels ?? []).filter(
      (channel) => channel.name !== ELAPSED_CHANNEL
    ),
  ]
    .filter((channel) => !shown.includes(channel.name))
    .map((channel) => ({
      value: channel.name,
      label:
        channel.description === ''
          ? channel.name
          : `${channel.name} — ${channel.description}`,
    }));

  return (
    <Select
      size="small"
      showSearch
      className={styles.addChannel}
      placeholder={t('dataPage.analysis.addChannel')}
      value={null}
      options={options}
      optionFilterProp="label"
      popupMatchSelectWidth={false}
      onChange={(name: string) =>
        appSettings.update({ analysisChannels: [...shown, name] })
      }
    />
  );
});

/** The stacked charts on one distance axis, the cursor shared. */
export const AnalysisCharts = observer(() => {
  const { t } = useTranslation('main-app');
  const analysis = useLapAnalysisStore();
  const appSettings = useAppSettingsStore();
  const channels = appSettings.appSettings.analysisChannels;
  const points = analysis.chartData?.points ?? 0;

  if (points === 0) {
    return null;
  }

  const distances = analysis.chartDistances;

  return (
    <div>
      <div className={styles.head}>
        <AddChannel />

        <Button
          size="small"
          icon={<Maximize2 size={ICON_SIZE} />}
          onClick={() => analysis.viewport.setRange(null, 'chart')}
        >
          {t('dataPage.analysis.resetZoom')}
        </Button>

        <GestureHint viewport={analysis.viewport} />
      </div>

      {channels.map((channel, index) => (
        <ChannelChart
          key={channel}
          channel={channel}
          index={index}
          count={channels.length}
          distances={distances}
        />
      ))}
    </div>
  );
});

import { useId } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
  type TooltipContentProps,
} from 'recharts';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import {
  directionOf,
  IRATING_RANGES,
  type IratingRange,
  type IratingStep,
} from '@features/statistics/home-stats';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import { useCategoryName } from './home-format';
import styles from './IratingChart.module.scss';

const CHART_HEIGHT = 240;
const Y_AXIS_WIDTH = 44;
/** Room above and below the line, in iRating. */
const Y_PADDING = 40;
const DOT_RADIUS = 2.5;
const LINE_WIDTH = 1.6;
/** The fill under the line, at its top; it fades to nothing at the axis. */
const FILL_OPACITY_TOP = 0.22;
/** Room between date labels, px. */
const X_TICK_GAP = 24;
const MS_PER_SECOND = 1000;

const stepDot = ({ cx, cy, payload }: DotItemDotProps) => {
  const step = payload as IratingStep;

  if (cx === undefined || cy === undefined) {
    return null;
  }

  return (
    <circle
      key={step.key}
      cx={cx}
      cy={cy}
      r={DOT_RADIUS}
      className={styles[directionOf(step.change)]}
    />
  );
};

const StepTooltip = observer(({ step }: { step: IratingStep }) => {
  const { i18n } = useTranslation('main-app');
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const direction = directionOf(step.change);
  const sign = direction === 'up' ? '+' : '';

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>
        {dateFormat.format(new Date(step.startedAt * MS_PER_SECOND))}
      </div>

      {step.trackName !== null && <div>{step.trackName}</div>}

      <div className={styles.tooltipFigures}>
        <span>{step.irating}</span>

        {direction !== 'flat' && (
          <span className={styles[direction]}>
            {sign}
            {step.change}
          </span>
        )}
      </div>
    </div>
  );
});

const renderStepTooltip = ({ active, payload }: TooltipContentProps) => {
  const step = payload?.[0]?.payload as IratingStep | undefined;

  if (!active || step === undefined) {
    return null;
  }

  return <StepTooltip step={step} />;
};

/** iRating at the start of each session of one category: a step a session. */
export const IratingChart = observer(() => {
  const { t, i18n } = useTranslation('main-app');
  const statistics = useStatisticsStore();
  const gradientId = useId();
  const rating = statistics.chartRating;
  const categoryName = useCategoryName(rating?.category ?? '');

  if (rating === null) {
    return null;
  }

  const steps = statistics.iratingSteps;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
  });
  const formatDate = (startedAt: number) =>
    dateFormat.format(new Date(startedAt * MS_PER_SECOND));

  const handleRangeChange = (range: IratingRange) =>
    statistics.setIratingRange(range);

  return (
    <SettingsCard
      title={
        <>
          {t('homePage.irating.title')}
          <span className={styles.titleAside}>
            {' · '}
            {categoryName} · {t('homePage.irating.perSession')}
          </span>
        </>
      }
      extra={
        <Segmented<IratingRange>
          size="small"
          value={statistics.iratingRange}
          onChange={handleRangeChange}
          options={IRATING_RANGES.map((range) => ({
            value: range,
            label: t(`homePage.irating.range.${range}`),
          }))}
        />
      }
    >
      {steps.length === 0 ? (
        <p className={styles.empty}>{t('homePage.irating.noneInRange')}</p>
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={steps}>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="0"
                    stopColor="currentColor"
                    stopOpacity={FILL_OPACITY_TOP}
                  />
                  <stop offset="1" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} className={styles.grid} />

              <XAxis
                dataKey="startedAt"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                minTickGap={X_TICK_GAP}
              />

              <YAxis
                width={Y_AXIS_WIDTH}
                domain={[
                  (min: number) => min - Y_PADDING,
                  (max: number) => max + Y_PADDING,
                ]}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                content={renderStepTooltip}
                cursor={{ className: styles.cursor }}
                isAnimationActive={false}
              />

              <Area
                type="stepAfter"
                dataKey="irating"
                stroke="currentColor"
                strokeWidth={LINE_WIDTH}
                fill={`url(#${gradientId})`}
                dot={stepDot}
                activeDot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </SettingsCard>
  );
});

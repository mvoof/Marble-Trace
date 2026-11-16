import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { DatePicker, Input, Pagination, Segmented, Switch, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { List, Search } from 'lucide-react';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import { useLapAnalysisStore } from '@features/lap-analysis/lap-analysis-context';
import {
  SESSION_KINDS,
  SESSION_PERIODS,
  type SessionsTableStore,
} from '@features/statistics/sessions-table.store';
import { formatLapTimeOrDash } from '@shared/lib/telemetry-format';
import type { RecentSession } from '@shared/contracts/generated/bindings';
import { finishText } from './recent-session-format';
import { SessionLapsModal } from './SessionLapsModal';
import styles from './RecentSessionsTable.module.scss';

const MS_PER_SECOND = 1000;
const ICON_SIZE = 14;
const DASH = '—';

/** Period, date range, search, kinds and bots — one row over the table. */
const SessionFilters = observer(({ table }: { table: SessionsTableStore }) => {
  const { t } = useTranslation('main-app');
  const range: [Dayjs, Dayjs] | null =
    table.range === null
      ? null
      : [
          dayjs(table.range.fromS * MS_PER_SECOND),
          dayjs(table.range.lastDayS * MS_PER_SECOND),
        ];

  return (
    <div className={styles.filters}>
      <Segmented
        size="small"
        value={table.period === 'range' ? undefined : table.period}
        options={SESSION_PERIODS.map((period) => ({
          value: period,
          label: t(`homePage.recentSessions.period.${period}`),
        }))}
        onChange={(period) => table.setPeriod(period)}
      />

      <DatePicker.RangePicker
        size="small"
        value={range}
        onChange={(picked) => {
          const [from, to] = picked ?? [];

          table.setRange(
            from && to
              ? {
                  fromS: from.startOf('day').valueOf() / MS_PER_SECOND,
                  lastDayS: to.startOf('day').valueOf() / MS_PER_SECOND,
                }
              : null
          );
        }}
      />

      <Input
        size="small"
        allowClear
        className={styles.search}
        prefix={<Search size={ICON_SIZE} />}
        placeholder={t('homePage.recentSessions.search')}
        value={table.text}
        onChange={(event) => table.setText(event.target.value)}
      />

      <div className={styles.kinds}>
        {SESSION_KINDS.map((kind) => (
          <Tag.CheckableTag
            key={kind}
            checked={table.kinds.includes(kind)}
            onChange={() => table.toggleKind(kind)}
          >
            {t(`homePage.recentSessions.kind.${kind}`)}
          </Tag.CheckableTag>
        ))}
      </div>

      <label className={styles.bots}>
        <Switch
          size="small"
          checked={table.withBots}
          onChange={(withBots) => table.setWithBots(withBots)}
        />
        {t('homePage.recentSessions.withBots')}
      </label>
    </div>
  );
});

const SessionRow = observer(({ session }: { session: RecentSession }) => {
  const { t, i18n } = useTranslation('main-app');
  const analysis = useLapAnalysisStore();
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
  });
  const finish = finishText(session);

  return (
    <tr
      className={styles.row}
      onClick={() => void analysis.openSession(session.key)}
    >
      <td className={styles.secondary}>
        {dateFormat.format(new Date(session.startedAt * MS_PER_SECOND))}
      </td>

      <td className={styles.secondary}>
        {t(`homePage.recentSessions.kind.${session.kind}`)}
      </td>

      <td title={session.trackConfig ?? undefined}>
        {session.trackName ?? DASH}
        {session.hasAi && (
          <span className={styles.botsTag}>
            {t('homePage.recentSessions.botsTag')}
          </span>
        )}
      </td>

      <td className={styles.secondary}>{session.carName ?? DASH}</td>

      <td className={finish === null ? styles.muted : styles.mono}>
        {finish ?? DASH}
      </td>

      <td className={styles.mono}>{formatLapTimeOrDash(session.bestLapS)}</td>

      <td className={styles.mono}>{session.laps}</td>

      <td className={styles.mono}>{session.incidents}</td>
    </tr>
  );
});

/** The recorded sessions, newest first, filtered and paged in the database. */
export const RecentSessionsTable = observer(() => {
  const { t } = useTranslation('main-app');
  const { sessionsTable: table } = useStatisticsStore();

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <List size={ICON_SIZE} />
        {t('homePage.recentSessions.title')}
      </div>

      <SessionFilters table={table} />

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('homePage.recentSessions.date')}</th>
              <th>{t('homePage.recentSessions.type')}</th>
              <th>{t('homePage.recentSessions.track')}</th>
              <th>{t('homePage.recentSessions.car')}</th>
              <th>{t('homePage.recentSessions.finish')}</th>
              <th>{t('homePage.recentSessions.bestLap')}</th>
              <th>{t('homePage.recentSessions.laps')}</th>
              <th>{t('homePage.recentSessions.incidents')}</th>
            </tr>
          </thead>

          <tbody>
            {table.rows.map((session) => (
              <SessionRow key={session.key} session={session} />
            ))}
          </tbody>
        </table>

        {table.loaded && table.rows.length === 0 && (
          <p className={styles.empty}>{t('homePage.recentSessions.none')}</p>
        )}
      </div>

      {table.total > table.pageSize && (
        <div className={styles.pager}>
          <span className={styles.muted}>
            {t('homePage.recentSessions.shown', {
              from: table.page * table.pageSize + 1,
              to: table.page * table.pageSize + table.rows.length,
              total: table.total,
            })}
          </span>

          <Pagination
            size="small"
            showSizeChanger={false}
            current={table.page + 1}
            pageSize={table.pageSize}
            total={table.total}
            onChange={(page) => table.setPage(page - 1)}
          />
        </div>
      )}

      <SessionLapsModal />
    </section>
  );
});

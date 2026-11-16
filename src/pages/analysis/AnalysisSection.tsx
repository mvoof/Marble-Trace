import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, Spin, Tabs, Tooltip } from 'antd';
import { Eye, EyeOff, Flag, PauseCircle, Plus, Star, X } from 'lucide-react';

import { useLapAnalysisStore } from '@features/lap-analysis/lap-analysis-context';
import {
  hasTelemetry,
  type AnalysisTab,
} from '@features/lap-analysis/lap-analysis.store';
import { cx } from '@shared/lib/class-names';
import { formatLapTimeOrDash } from '@shared/lib/telemetry-format';
import type { AnalysisLap } from '@shared/contracts/generated/bindings';
import { AnalysisCharts } from './AnalysisCharts';
import { AnalysisMap } from './AnalysisMap';
import { AnalysisSettings } from './AnalysisSettings';
import { AnalysisSetup } from './AnalysisSetup';
import styles from './AnalysisSection.module.scss';

const MS_PER_SECOND = 1000;
const ICON_SIZE = 14;
const GATE_ICON_SIZE = 28;
const BEST_STAR = '★';
const DASH = '—';

const LapItem = observer(({ lap }: { lap: AnalysisLap }) => {
  const { t } = useTranslation('main-app');
  const analysis = useLapAnalysisStore();

  return (
    <div className={cx(styles.lap, !lap.visible && styles.hidden)}>
      <ColorPicker
        size="small"
        value={lap.color}
        disabledAlpha
        onChangeComplete={(color) =>
          void analysis.setColor(lap.lap, color.toHexString())
        }
      >
        <button
          type="button"
          className={styles.swatch}
          style={{ background: lap.color }}
          aria-label={t('dataPage.analysis.color')}
        />
      </ColorPicker>

      <button
        type="button"
        className={cx(styles.icon, lap.visible && styles.on)}
        title={t(
          lap.visible ? 'dataPage.analysis.hide' : 'dataPage.analysis.show'
        )}
        onClick={() => void analysis.toggleVisible(lap)}
      >
        {lap.visible ? <Eye size={ICON_SIZE} /> : <EyeOff size={ICON_SIZE} />}
      </button>

      <span className={styles.lapName}>
        {lap.isBest && <span className={styles.best}>{BEST_STAR} </span>}
        {t('dataPage.analysis.lap', { number: lap.lap.lapNum })}
        <small>{lap.runType}</small>
      </span>

      <span className={cx(styles.time, lap.isBest && styles.best)}>
        {hasTelemetry(lap) && !analysis.isMissing(lap.lap) ? (
          formatLapTimeOrDash(lap.timeS)
        ) : (
          <Tooltip title={t('dataPage.analysis.fileDeleted')}>
            <span className={styles.muted}>{DASH}</span>
          </Tooltip>
        )}
      </span>

      <button
        type="button"
        className={cx(styles.icon, lap.reference && styles.reference)}
        title={t('dataPage.analysis.reference')}
        onClick={() => void analysis.setReference(lap.lap)}
      >
        <Star size={ICON_SIZE} fill={lap.reference ? 'currentColor' : 'none'} />
      </button>

      <button
        type="button"
        className={styles.icon}
        title={t('dataPage.analysis.remove')}
        onClick={() => void analysis.remove(lap.lap)}
      >
        <X size={ICON_SIZE} />
      </button>
    </div>
  );
});

/** In place of the charts while the game runs and the window was away. */
const UnloadedNote = observer(() => {
  const { t } = useTranslation('main-app');

  return (
    <div className={styles.gate}>
      <PauseCircle size={GATE_ICON_SIZE} />
      <p className={styles.gateTitle}>{t('dataPage.analysis.unloaded')}</p>
      <p>{t('dataPage.analysis.unloadedNote')}</p>
    </div>
  );
});

/** What the charts' place shows for the telemetry's state. */
const TelemetryArea = observer(() => {
  const { t } = useTranslation('main-app');
  const analysis = useLapAnalysisStore();

  if (analysis.telemetry === 'unloaded') {
    return <UnloadedNote />;
  }

  if (analysis.telemetry === 'loading') {
    return (
      <div className={styles.gate}>
        <Spin />
        <p>{t('dataPage.analysis.loading')}</p>
      </div>
    );
  }

  return <AnalysisCharts />;
});

/** The laps picked for the analysis, from one session, and their telemetry. */
export const AnalysisSection = observer(() => {
  const { t, i18n } = useTranslation('main-app');
  const analysis = useLapAnalysisStore();
  const session = analysis.set.session;

  if (session === null) {
    return null;
  }

  const date = new Intl.DateTimeFormat(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(session.startedAt * MS_PER_SECOND));

  return (
    <div className={styles.section}>
      <div className={styles.session}>
        <Flag size={ICON_SIZE} />
        <span>
          <b className={styles.track}>
            {session.trackName ?? DASH}
            {session.trackConfig !== null && ` · ${session.trackConfig}`}
          </b>
          {' · '}
          {session.carName ?? DASH}
          {' · '}
          {t(`homePage.recentSessions.kind.${session.kind}`)}
          {' · '}
          {date}
        </span>

        <span className={styles.sessionActions}>
          <AnalysisSettings />
        </span>
      </div>

      <Tabs
        className={styles.tabs}
        activeKey={analysis.tab}
        onChange={(key) => analysis.setTab(key as AnalysisTab)}
        items={[
          { key: 'telemetry', label: t('dataPage.analysis.telemetryTab') },
          { key: 'setup', label: t('dataPage.analysis.setupTab') },
        ]}
      />

      {analysis.tab === 'setup' ? (
        <AnalysisSetup />
      ) : (
        <div className={styles.body}>
          <aside className={styles.side}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                {t('dataPage.analysis.laps')}
                <span className={styles.hint}>
                  {t('dataPage.analysis.referenceHint')}
                </span>
              </div>

              <button
                type="button"
                className={styles.addLaps}
                onClick={() => void analysis.openSession(session.key)}
              >
                <Plus size={ICON_SIZE} />
                {t('dataPage.analysis.addLaps')}
              </button>

              {analysis.laps.map((lap) => (
                <LapItem
                  key={`${lap.lap.path}:${lap.lap.sessionNum}:${lap.lap.lapNum}`}
                  lap={lap}
                />
              ))}
            </div>

            <AnalysisMap />
          </aside>

          <div className={styles.charts}>
            <TelemetryArea />
          </div>
        </div>
      )}
    </div>
  );
});

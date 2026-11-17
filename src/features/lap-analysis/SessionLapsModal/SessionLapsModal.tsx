import { Fragment, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from 'antd';
import { Activity, Check, Plus, Trash2 } from 'lucide-react';

import { useLapAnalysisStore } from '../lap-analysis-context';
import { hasTelemetry, isAnalysable } from '../lap-analysis.store';
import { cx } from '@shared/lib/class-names';
import { formatLapTimeOrDash } from '@shared/lib/telemetry-format';
import type {
  LapRef,
  RecentSession,
  SessionLap,
} from '@shared/contracts/generated/bindings';
import { finishText } from '@shared/lib/finish-text';
import { DeleteSessionDialog } from './DeleteSessionDialog';
import { useAnalysisToast } from './useAnalysisToast';
import styles from './SessionLapsModal.module.scss';

const MS_PER_SECOND = 1000;
const ICON_SIZE = 14;
const MODAL_WIDTH = 720;
const DELTA_DIGITS = 3;
const DASH = '—';
const STAR = '★';

const useSessionDate = (session: RecentSession) => {
  const { i18n } = useTranslation('main-app');

  return new Intl.DateTimeFormat(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(session.startedAt * MS_PER_SECOND));
};

interface LapRowProps {
  lap: SessionLap;
  inSet: boolean;
  onAdd: (lap: LapRef) => void;
}

const LapRow = observer(({ lap, inSet, onAdd }: LapRowProps) => {
  const { t } = useTranslation('main-app');
  const dimmed = lap.partial || lap.inPit;
  const delta =
    lap.isBest || lap.deltaS === null
      ? null
      : `${lap.deltaS < 0 ? '−' : '+'}${Math.abs(lap.deltaS).toFixed(DELTA_DIGITS)}`;

  const action = () => {
    if (inSet) {
      return (
        <span className={styles.inSet}>
          <Check size={ICON_SIZE} />
          {t('homePage.sessionLaps.inAnalysis')}
        </span>
      );
    }

    if (!hasTelemetry(lap)) {
      return (
        <span className={styles.muted}>
          {t('homePage.sessionLaps.fileDeleted')}
        </span>
      );
    }

    return (
      <Button
        size="small"
        icon={<Plus size={ICON_SIZE} />}
        disabled={!isAnalysable(lap)}
        onClick={() => onAdd(lap.lap)}
      >
        {t('homePage.sessionLaps.toAnalysis')}
      </Button>
    );
  };

  return (
    <tr className={cx(dimmed && styles.dimmed)}>
      <td className={styles.mono}>
        {lap.isBest && <span className={styles.best}>{STAR} </span>}
        {lap.lap.lapNum}
      </td>

      <td className={cx(styles.mono, lap.isBest && styles.best)}>
        {formatLapTimeOrDash(lap.timeS)}
      </td>

      <td className={styles.mono}>
        {lap.isBest ? (
          <span className={styles.best}>{t('homePage.sessionLaps.best')}</span>
        ) : (
          (delta ?? <span className={styles.muted}>{DASH}</span>)
        )}
      </td>

      <td className={styles.mono}>
        {lap.incidents > 0 ? `${lap.incidents}x` : DASH}
      </td>

      <td>
        {lap.inPit && (
          <span className={styles.tag}>{t('homePage.sessionLaps.pit')}</span>
        )}
        {lap.partial && (
          <span className={styles.tag}>
            {t('homePage.sessionLaps.partial')}
          </span>
        )}
      </td>

      <td className={styles.action}>{action()}</td>
    </tr>
  );
});

const ModalHead = observer(({ session }: { session: RecentSession }) => {
  const { t } = useTranslation('main-app');
  const date = useSessionDate(session);
  const finish = finishText(session);

  return (
    <div>
      <div className={styles.title}>
        {session.trackName ?? DASH}
        {session.trackConfig !== null && (
          <span className={styles.config}> · {session.trackConfig}</span>
        )}
      </div>

      <div className={styles.meta}>
        {[
          t(`homePage.recentSessions.kind.${session.kind}`),
          session.carName ?? DASH,
          date,
          finish,
          t('homePage.sessionLaps.incidentsCount', {
            count: session.incidents,
          }),
        ]
          .filter((part) => part !== null)
          .join(' · ')}
      </div>
    </div>
  );
});

interface SessionLapsModalProps {
  /** The toast's link to the analysis page; none when already on it. */
  onOpenAnalysis?: () => void;
  /** A session was deleted: the lists that show sessions load again. */
  onSessionDeleted?: () => void;
}

/** The laps of one session, to pick those the analysis shows. */
export const SessionLapsModal = observer(
  ({ onOpenAnalysis, onSessionDeleted }: SessionLapsModalProps) => {
    const { t } = useTranslation('main-app');
    const analysis = useLapAnalysisStore();
    const showToast = useAnalysisToast(analysis, onOpenAnalysis);
    const loaded = analysis.modalLaps;
    const laps = loaded?.laps ?? [];
    const severalRuns = new Set(laps.map((lap) => lap.lap.sessionNum)).size > 1;
    const [isConfirmingDelete, setConfirmingDelete] = useState(false);

    const handleAdd = async (lap: LapRef) => {
      await analysis.addLaps([lap]);
      showToast();
    };

    const handleAddAll = async () => {
      await analysis.addAllLaps();
      showToast();
    };

    return (
      <Modal
        open={analysis.modalKey !== null}
        width={MODAL_WIDTH}
        footer={null}
        destroyOnHidden
        onCancel={() => analysis.closeSession()}
        title={loaded && <ModalHead session={loaded.session} />}
      >
        <div className={styles.headActions}>
          <Button
            danger
            size="small"
            icon={<Trash2 size={ICON_SIZE} />}
            disabled={loaded === null}
            onClick={() => setConfirmingDelete(true)}
          >
            {t('homePage.sessionLaps.delete')}
          </Button>

          <Button
            type="primary"
            size="small"
            icon={<Activity size={ICON_SIZE} />}
            disabled={!laps.some(isAnalysable)}
            onClick={() => void handleAddAll()}
          >
            {t('homePage.sessionLaps.allToAnalysis')}
          </Button>
        </div>

        <div className={styles.body}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('homePage.sessionLaps.lap')}</th>
                <th>{t('homePage.sessionLaps.time')}</th>
                <th>{t('homePage.sessionLaps.delta')}</th>
                <th>{t('homePage.sessionLaps.incidents')}</th>
                <th
                  aria-label={`${t('homePage.sessionLaps.pit')} / ${t('homePage.sessionLaps.partial')}`}
                />
                <th aria-label={t('homePage.sessionLaps.toAnalysis')} />
              </tr>
            </thead>

            <tbody>
              {laps.map((lap, index) => {
                const runStarts =
                  severalRuns &&
                  (index === 0 ||
                    laps[index - 1].lap.sessionNum !== lap.lap.sessionNum);

                return (
                  <Fragment key={`${lap.lap.sessionNum}:${lap.lap.lapNum}`}>
                    {runStarts && (
                      <tr className={styles.run}>
                        <td colSpan={6}>{lap.runType}</td>
                      </tr>
                    )}

                    <LapRow
                      lap={lap}
                      inSet={analysis.isInSet(lap.lap)}
                      onAdd={(added) => void handleAdd(added)}
                    />
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <DeleteSessionDialog
          open={isConfirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          onDeleted={onSessionDeleted}
        />
      </Modal>
    );
  }
);

import { useEffect, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { RefreshCw, Save, Undo2 } from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import styles from './CrewPage.module.scss';

/**
 * Saves the pack from whichever section the edits were made in, Ctrl+S too;
 * once saved, offers to voice the replies that have no recording yet. `lead`
 * comes first and keeps the bar shown: the radio check on Commands.
 */
export const CrewSaveBar = observer(({ lead }: { lead?: ReactNode }) => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');

  useEffect(() => {
    const saveOnShortcut = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';

      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();

      if (crew.dirty && !crew.busy) {
        void crew.savePack();
      }
    };

    window.addEventListener('keydown', saveOnShortcut);

    return () => window.removeEventListener('keydown', saveOnShortcut);
  }, [crew]);

  const unvoiced = !crew.dirty && crew.unvoicedLines > 0;

  if (lead === undefined && !crew.dirty && !unvoiced) {
    return null;
  }

  return (
    <div className={styles.saveBar}>
      {lead}

      <div className={styles.saveBarEnd}>
        {unvoiced && (
          <>
            <div className={styles.saveBarText}>
              {t('crewPage.saveBar.unvoiced', { count: crew.unvoicedLines })}
            </div>

            <Button
              icon={<RefreshCw size={14} />}
              loading={crew.busy}
              disabled={!crew.ready}
              onClick={() => void crew.generate()}
            >
              {t('crewPage.saveBar.generate')}
            </Button>
          </>
        )}

        {crew.dirty && (
          <>
            <div className={styles.saveBarText}>
              {t('crewPage.saveBar.changes')}

              {crew.draftErrors > 0 && (
                <span className={styles.saveBarErrors}>
                  {t('crewPage.saveBar.errors', { count: crew.draftErrors })}
                </span>
              )}
            </div>

            <Button
              icon={<Undo2 size={14} />}
              disabled={crew.busy}
              onClick={() => crew.discardEdits()}
            >
              {t('crewPage.saveBar.discard')}
            </Button>

            <Button
              type="primary"
              icon={<Save size={14} />}
              loading={crew.busy}
              onClick={() => void crew.savePack()}
            >
              {t('crewPage.save')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

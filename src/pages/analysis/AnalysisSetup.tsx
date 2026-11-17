import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Spin } from 'antd';
import { FileWarning, FileX } from 'lucide-react';

import { useLapAnalysisStore } from '@features/lap-analysis/lap-analysis-context';
import { setupLabel } from '@features/lap-analysis/setup-label';
import { cx } from '@shared/lib/class-names';
import type { SetupGroup } from '@shared/contracts/generated/bindings';
import styles from './AnalysisSetup.module.scss';

const GATE_ICON_SIZE = 28;

const SetupGroupCard = observer(({ group }: { group: SetupGroup }) => (
  <div className={styles.card}>
    <p className={styles.title}>{setupLabel(group.name)}</p>

    {/* The sections side by side: the four wheels read across, a row each. */}
    <div
      className={cx(
        styles.sections,
        group.sections.length === 1 && styles.singleSection
      )}
    >
      {group.sections.map((section, sectionIndex) => (
        <div key={`${section.name}:${sectionIndex}`} className={styles.section}>
          {section.name !== '' && (
            <p className={styles.sectionName}>{setupLabel(section.name)}</p>
          )}

          {section.rows.map((row, rowIndex) => (
            <div key={`${row.label}:${rowIndex}`} className={styles.row}>
              <span className={styles.label}>{setupLabel(row.label)}</span>
              <span className={styles.value}>{row.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
));

/** The car's setup as the file of the analysed laps wrote it. */
export const AnalysisSetup = observer(() => {
  const { t } = useTranslation('main-app');
  const analysis = useLapAnalysisStore();
  const path = analysis.setupPath;
  const setup = analysis.setup;

  useEffect(() => {
    void analysis.fetchSetup();
  }, [analysis, path]);

  if (setup === null || setup.state === 'loading') {
    return (
      <div className={styles.gate}>
        <Spin />
      </div>
    );
  }

  if (setup.state === 'unreadable') {
    return (
      <div className={styles.gate}>
        <FileWarning size={GATE_ICON_SIZE} />
        <p>{t('dataPage.analysis.setupUnreadable')}</p>
      </div>
    );
  }

  if (setup.state === 'fileDeleted') {
    return (
      <div className={styles.gate}>
        <FileX size={GATE_ICON_SIZE} />
        <p>{t('dataPage.analysis.fileDeleted')}</p>
      </div>
    );
  }

  return (
    <div className={styles.setup}>
      <p className={styles.note}>
        {t('dataPage.analysis.setupNote')}
        {setup.name !== null && (
          <>
            {' · '}
            <span className={styles.fileName}>{setup.name}</span>
          </>
        )}
      </p>

      {setup.groups.length === 0 ? (
        <p className={styles.note}>{t('dataPage.analysis.noSetup')}</p>
      ) : (
        setup.groups.map((group) => (
          <SetupGroupCard key={group.name} group={group} />
        ))
      )}
    </div>
  );
});

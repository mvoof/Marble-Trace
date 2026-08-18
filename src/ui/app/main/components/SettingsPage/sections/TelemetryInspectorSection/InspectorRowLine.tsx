import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { useTelemetryInspectorStore } from '@store/root-store-context';
import type { InspectorRow } from '@/types/inspector';
import { formatInspectorValue } from './format-value';
import styles from './TelemetryInspectorSection.module.scss';

/** Indent per nesting level, in pixels. */
const INDENT_STEP = 14;

interface InspectorRowLineProps {
  row: InspectorRow;
}

/**
 * One line of the list.
 *
 * An absent value is drawn dimmed with a marker rather than hidden, because "the
 * sim does not report this here" is the answer the inspector exists to give — an
 * AI or hosted session leaves a good many fields empty.
 */
export const InspectorRowLine = observer(({ row }: InspectorRowLineProps) => {
  const inspector = useTelemetryInspectorStore();
  const { t } = useTranslation('main-app');

  const isAbsent = row.kind === 'absent';
  const limit = inspector.entryLimit(row.path);
  const hiddenEntries =
    row.kind === 'array' && row.expanded && row.length !== undefined
      ? row.length - limit
      : 0;

  const className = [
    styles.row,
    isAbsent ? styles.rowAbsent : '',
    row.expandable ? styles.rowBranch : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div
        className={className}
        style={{ paddingLeft: row.depth * INDENT_STEP }}
      >
        {row.expandable ? (
          <button
            type="button"
            className={styles.caret}
            onClick={() => inspector.toggleExpanded(row.path)}
            aria-expanded={row.expanded}
          >
            {row.expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>
        ) : (
          <span className={styles.caretSpacer} />
        )}

        <span className={styles.name} title={row.path}>
          {row.name}
        </span>

        <span className={styles.value}>
          {isAbsent
            ? t('settingsPage.telemetryInspector.absent')
            : formatInspectorValue(row)}
        </span>
      </div>

      {hiddenEntries > 0 && (
        <div
          className={styles.more}
          style={{ paddingLeft: (row.depth + 1) * INDENT_STEP }}
        >
          <Button
            size="small"
            type="link"
            onClick={() =>
              inspector.showAllEntries(row.path, row.length as number)
            }
          >
            {t('settingsPage.telemetryInspector.showAll', {
              count: hiddenEntries,
            })}
          </Button>
        </div>
      )}
    </>
  );
});

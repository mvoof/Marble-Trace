import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { Plus, Search, MoveRight } from 'lucide-react';
import { useClickOutside } from '@ui/hooks/useClickOutside';
import { useWidgetSettingsStore } from '@store/root-store-context';
import type { PickableWidget } from '@store/settings/widget-settings.store';
import { getWidgetDescription } from '@ui/app/widget-i18n';
import styles from './WidgetPicker.module.scss';

const PickerRow = observer(
  ({
    widget,
    monitorName,
    onAdded,
  }: {
    widget: PickableWidget;
    monitorName: string;
    onAdded: () => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');

    const isElsewhere = widget.currentMonitorName !== null;

    const handleAdd = () => {
      if (!widget.available) {
        return;
      }

      widgetSettings.addWidgetToMonitor(widget.id, monitorName);
      onAdded();
    };

    return (
      <button
        type="button"
        className={`${styles.row} ${widget.available ? '' : styles.rowDisabled}`}
        disabled={!widget.available}
        title={
          widget.available ? undefined : t('overlayWidgetPicker.unavailable')
        }
        onClick={handleAdd}
      >
        <span className={styles.rowText}>
          <span className={styles.rowLabel}>{widget.label}</span>
          <span className={styles.rowDescription}>
            {getWidgetDescription(t, widget)}
          </span>
        </span>

        {isElsewhere && (
          <span className={styles.rowBadge}>
            <MoveRight />
            {t('overlayWidgetPicker.moveHere', {
              monitor: widget.currentMonitorName,
            })}
          </span>
        )}
      </button>
    );
  }
);

// F9 edit-mode widget catalogue. Adds straight into the layout the overlay is
// currently rendering — the one the session picked — so nothing has to be done
// in the main window while the sim is running.
export const WidgetPicker = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const { t } = useTranslation('main-app');

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const panelRef = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    searchRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);

    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const monitorName = widgetSettings.ownMonitorName;

  if (!monitorName) {
    return null;
  }

  const normalizedQuery = query.trim().toLowerCase();

  const candidates = widgetSettings
    .pickableWidgetsForMonitor(monitorName)
    .filter((widget) => widget.label.toLowerCase().includes(normalizedQuery));

  const toggleOpen = () => {
    setOpen((previous) => !previous);
    setQuery('');
  };

  return (
    <div className={styles.container} ref={panelRef}>
      <Button
        type="primary"
        icon={<Plus size={16} />}
        size="large"
        onClick={toggleOpen}
      >
        {t('overlayWidgetPicker.addWidget')}
      </Button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.searchRow}>
            <Search className={styles.searchIcon} />
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="text"
              value={query}
              aria-label={t('overlayWidgetPicker.search')}
              placeholder={t('overlayWidgetPicker.search')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className={styles.list}>
            {candidates.length === 0 && (
              <div className={styles.empty}>
                {t('overlayWidgetPicker.empty')}
              </div>
            )}

            {candidates.map((widget) => (
              <PickerRow
                key={widget.id}
                widget={widget}
                monitorName={monitorName}
                onAdded={() => setOpen(false)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

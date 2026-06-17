import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { LayoutGrid, Settings2 } from 'lucide-react';
import styles from './WidgetDragToolbar.module.scss';
import { SnapPanel } from './SnapPanel/SnapPanel';
import { WidgetSettingsPopup } from './WidgetSettingsPopup/WidgetSettingsPopup';

interface WidgetDragToolbarProps {
  widgetId: string;
}

export const WidgetDragToolbar = observer(
  ({ widgetId }: WidgetDragToolbarProps) => {
    const [snapOpen, setSnapOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
      if (!snapOpen && !settingsOpen) {
        return;
      }

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setSnapOpen(false);
          setSettingsOpen(false);
        }
      };

      document.addEventListener('keydown', onKey);

      return () => document.removeEventListener('keydown', onKey);
    }, [snapOpen, settingsOpen]);

    const toggleSnap = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSnapOpen((prev) => !prev);
      setSettingsOpen(false);
    };

    const toggleSettings = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSettingsOpen((prev) => !prev);
      setSnapOpen(false);
    };

    return (
      <div
        role="toolbar"
        tabIndex={-1}
        className={styles.toolbar}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className={styles.dragLabel}>DRAG</span>

        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.toolbarButton} ${snapOpen ? styles.active : ''}`}
            title="Quick placement"
            onClick={toggleSnap}
          >
            <LayoutGrid />
          </button>

          <button
            type="button"
            className={`${styles.toolbarButton} ${settingsOpen ? styles.active : ''}`}
            title="Widget settings"
            onClick={toggleSettings}
          >
            <Settings2 />
          </button>
        </div>

        {snapOpen && (
          <SnapPanel widgetId={widgetId} onClose={() => setSnapOpen(false)} />
        )}

        {settingsOpen && (
          <WidgetSettingsPopup
            widgetId={widgetId}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
    );
  }
);

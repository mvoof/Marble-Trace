import { observer } from 'mobx-react-lite';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import styles from './WidgetList.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

// Pure widget catalog. Visibility is governed by presence in the active layout
// (the Layouts editor), so this list has no enable/disable toggle — selecting a
// widget previews it and exposes its global defaults.
const WidgetListItem = observer(
  ({
    widget,
    isActive,
    onSelect,
  }: {
    widget: WidgetDefaultConfig;
    isActive: boolean;
    onSelect: (id: string) => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();

    const isAvailable = widgetSettings.availableWidgetIds.includes(widget.id);

    return (
      <button
        type="button"
        className={`${styles.listItem} ${isActive ? styles.active : ''} ${
          !isAvailable ? styles.disabled : ''
        }`}
        onClick={() => onSelect(widget.id)}
      >
        <div className={styles.content}>
          <span className={styles.title}>{widget.label}</span>
          <span className={styles.description}>
            {widget.description || 'Configure widget settings.'}
          </span>
          {!isAvailable && (
            <span className={styles.unavailable}>Unavailable</span>
          )}
        </div>
      </button>
    );
  }
);

export const WidgetList = observer(
  ({
    selectedId,
    onSelect,
  }: {
    selectedId: string | null;
    onSelect: (id: string) => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();

    return (
      <div className={styles.list}>
        {widgetSettings.allWidgets.map((widget) => (
          <WidgetListItem
            key={widget.id}
            widget={widget}
            isActive={selectedId === widget.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }
);

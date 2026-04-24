import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import type { WidgetConfig } from '../../../../types/widget-settings';
import styles from './WidgetList.module.scss';

const WidgetListItem = observer(
  ({
    widget,
    isActive,
    onSelect,
  }: {
    widget: WidgetConfig;
    isActive: boolean;
    onSelect: (id: string) => void;
  }) => {
    const handleToggle = (checked: boolean) => {
      widgetSettingsStore.setWidgetEnabled(widget.id, checked);
    };

    return (
      <button
        type="button"
        className={`${styles.listItem} ${isActive ? styles.active : ''}`}
        onClick={() => onSelect(widget.id)}
      >
        <div className={styles.content}>
          <span className={styles.title}>{widget.label}</span>
          <span className={styles.description}>
            {widget.description || 'Configure widget settings.'}
          </span>
        </div>
        <div
          className={styles.switch}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Switch
            checked={widget.enabled}
            size="small"
            onChange={handleToggle}
          />
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
    return (
      <div className={styles.list}>
        {widgetSettingsStore.widgets.map((widget) => (
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

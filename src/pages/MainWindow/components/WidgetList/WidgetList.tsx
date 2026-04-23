import { observer } from 'mobx-react-lite';
import { List, Switch, Typography } from 'antd';
import {
  widgetSettingsStore,
  WidgetConfig,
} from '../../../../store/widget-settings.store';
import styles from './WidgetList.module.scss';

const { Text } = Typography;

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
      <List.Item
        className={`${styles.listItem} ${isActive ? styles.active : ''}`}
        onClick={() => onSelect(widget.id)}
      >
        <List.Item.Meta
          title={<Text>{widget.label}</Text>}
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {widget.description || 'Configure widget settings.'}
            </Text>
          }
        />
        <Switch
          checked={widget.enabled}
          size="small"
          onChange={handleToggle}
          onClick={(_, e) => e.stopPropagation()}
        />
      </List.Item>
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
      <List
        dataSource={widgetSettingsStore.widgets.slice()}
        split={false}
        renderItem={(widget) => (
          <WidgetListItem
            key={widget.id}
            widget={widget}
            isActive={selectedId === widget.id}
            onSelect={onSelect}
          />
        )}
      />
    );
  }
);

import { observer } from 'mobx-react-lite';
import { List, Switch, Typography } from 'antd';
import {
  widgetSettingsStore,
  WidgetConfig,
} from '../../../../store/widget-settings.store';
import { windowManagerStore } from '../../../../store/window-manager.store';

const { Text } = Typography;

const WidgetListItem = observer(
  ({
    widget,
    onSelect,
  }: {
    widget: WidgetConfig;
    onSelect: (id: string) => void;
  }) => {
    const handleToggle = async (checked: boolean) => {
      widgetSettingsStore.setWidgetEnabled(widget.id, checked);

      if (checked) {
        const config = widgetSettingsStore.getWidget(widget.id);
        if (config) {
          await windowManagerStore.openWidget(config);
        }
      } else {
        await windowManagerStore.closeWidget(widget.id);
      }
    };

    return (
      <List.Item
        style={{ cursor: 'pointer', padding: '8px 16px' }}
        onClick={() => onSelect(widget.id)}
      >
        <List.Item.Meta
          title={<Text>{widget.label}</Text>}
          description={`${widget.width}×${widget.height}`}
        />
        <Switch
          checked={widget.enabled}
          onChange={handleToggle}
          onClick={(_, e) => e.stopPropagation()}
        />
      </List.Item>
    );
  }
);

export const WidgetList = observer(
  ({ onSelect }: { onSelect: (id: string) => void }) => {
    return (
      <List
        dataSource={widgetSettingsStore.widgets.slice()}
        renderItem={(widget) => (
          <WidgetListItem key={widget.id} widget={widget} onSelect={onSelect} />
        )}
      />
    );
  }
);

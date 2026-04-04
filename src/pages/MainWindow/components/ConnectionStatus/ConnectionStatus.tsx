import { observer } from 'mobx-react-lite';
import { Badge, Typography } from 'antd';
import type { PresetStatusColorType } from 'antd/es/_util/colors';
import {
  telemetryConnection,
  type TelemetryStatus,
} from '../../../../store/iracing';

const { Text } = Typography;

const STATUS_CONFIG: Record<
  TelemetryStatus,
  { text: string; badge: PresetStatusColorType }
> = {
  connected: { text: 'Connected', badge: 'success' },
  waiting: { text: 'Waiting for iRacing...', badge: 'warning' },
  disconnected: { text: 'Disconnected', badge: 'warning' },
  error: { text: 'Error', badge: 'error' },
};

export const ConnectionStatus = observer(() => {
  const { status } = telemetryConnection;
  const config = STATUS_CONFIG[status];

  return <Badge status={config.badge} text={<Text>{config.text}</Text>} />;
});

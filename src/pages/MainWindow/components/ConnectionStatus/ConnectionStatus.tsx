import { observer } from 'mobx-react-lite';
import { Badge, Typography } from 'antd';
import { telemetryStore } from '../../../../store/telemetry.store';

const { Text } = Typography;

export const ConnectionStatus = observer(() => {
  const { isConnected, error } = telemetryStore;

  const status = error ? 'error' : isConnected ? 'connected' : 'waiting';
  const statusText =
    status === 'error'
      ? 'Error'
      : status === 'connected'
        ? 'Connected'
        : 'Waiting for iRacing...';
  const badgeStatus =
    status === 'error'
      ? 'error'
      : status === 'connected'
        ? 'success'
        : 'default';

  return <Badge status={badgeStatus} text={<Text>{statusText}</Text>} />;
});

import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { parseAllSessionFlags } from '../FlagsWidget/flags-utils';
import { FlatFlagsWidget } from './FlatFlagsWidget';

export const FlatFlagsWidgetContainer = observer(() => {
  const sessionFlags = telemetryStore.session?.session_flags ?? null;
  const flags = parseAllSessionFlags(sessionFlags);

  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBlinkOn((v) => !v), 400);
    return () => clearInterval(id);
  }, []);

  return <FlatFlagsWidget flags={flags} blinkOn={blinkOn} />;
});

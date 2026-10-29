import type { WidgetMount } from '@widgets/widget-mount';
import { CREW_RADIO_MANIFEST } from './manifest';
import { CrewRadioWidget } from './CrewRadioWidget';
import { CrewRadioWidgetStore } from './crew-radio.store';

export const mount: WidgetMount = {
  id: CREW_RADIO_MANIFEST.id,
  component: CrewRadioWidget,
  store: (context) => new CrewRadioWidgetStore(context),
};

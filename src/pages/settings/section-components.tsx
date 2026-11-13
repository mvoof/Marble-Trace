import type { SettingsSectionId } from './settings-sections';
import { BindingsSettings } from '@pages/settings/bindings/BindingsSettings';
import { DevicesSettings } from '@pages/settings/bindings/DevicesSettings';
import { GeneralSection } from './sections/GeneralSection';
import { CompanionAppsSection } from '@features/companion-apps/CompanionAppsSection';
import { UpdatesSection } from './sections/UpdatesSection';
import { AboutSection } from './sections/AboutSection';
import { OverlaySection } from './sections/OverlaySection';
import { InteractionSection } from './sections/InteractionSection';
import { TrackMapSection } from './sections/TrackMapSection';
import { SharedValuesSection } from './sections/SharedValuesSection';
import { StreamChatSection } from './sections/StreamChatSection';
import { MaintenanceSection } from './sections/MaintenanceSection';
import { TelemetryInspectorSection } from '@features/telemetry-inspector/TelemetryInspectorSection/TelemetryInspectorSection';
import { RemoteScreensSection } from '@features/remote-screens/RemoteScreensSection';

/** What each section of the settings, and of the feature pages, draws. */
export const SECTION_COMPONENTS: Record<
  SettingsSectionId,
  () => React.ReactElement
> = {
  general: GeneralSection,
  companionApps: CompanionAppsSection,
  updates: UpdatesSection,
  about: AboutSection,
  overlay: OverlaySection,
  interaction: InteractionSection,
  bindings: BindingsSettings,
  devices: DevicesSettings,
  trackMap: TrackMapSection,
  sharedValues: SharedValuesSection,
  streamChat: StreamChatSection,
  remoteScreens: RemoteScreensSection,
  maintenance: MaintenanceSection,
  telemetryInspector: TelemetryInspectorSection,
};

import type { SettingsSectionId } from './settings-sections';
import { GeneralSection } from './sections/GeneralSection';
import { UpdatesSection } from './sections/UpdatesSection';
import { AboutSection } from './sections/AboutSection';
import { OverlaySection } from './sections/OverlaySection';
import { InteractionSection } from './sections/InteractionSection';
import { MaintenanceSection } from './sections/MaintenanceSection';
import { HotkeysSection } from './hotkeys/HotkeysSection';
import { TrackMapSection } from './data/TrackMapSection';
import { SharedValuesSection } from './data/SharedValuesSection';
import { StatisticsSection } from './data/StatisticsSection';
import { StreamChatSection } from './sections/StreamChatSection';
import { RemoteScreensSection } from '@features/remote-screens/RemoteScreensSection';
import { CompanionAppsSection } from '@features/companion-apps/CompanionAppsSection';
import { TelemetryInspectorSection } from '@features/telemetry-inspector/TelemetryInspectorSection/TelemetryInspectorSection';

/** What each section of the Settings page draws. */
export const SECTION_COMPONENTS: Record<
  SettingsSectionId,
  () => React.ReactElement
> = {
  general: GeneralSection,
  updates: UpdatesSection,
  about: AboutSection,
  overlay: OverlaySection,
  interaction: InteractionSection,
  hotkeys: HotkeysSection,
  browserScreens: RemoteScreensSection,
  streamChat: StreamChatSection,
  companionApps: CompanionAppsSection,
  tracks: TrackMapSection,
  strategy: SharedValuesSection,
  statistics: StatisticsSection,
  maintenance: MaintenanceSection,
  telemetryInspector: TelemetryInspectorSection,
};

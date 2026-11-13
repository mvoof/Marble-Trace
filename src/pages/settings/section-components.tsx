import type { SettingsSectionId } from './settings-sections';
import { GeneralSection } from './sections/GeneralSection';
import { UpdatesSection } from './sections/UpdatesSection';
import { AboutSection } from './sections/AboutSection';
import { OverlaySection } from './sections/OverlaySection';
import { InteractionSection } from './sections/InteractionSection';
import { TrackMapSection } from './sections/TrackMapSection';
import { SharedValuesSection } from './sections/SharedValuesSection';
import { MaintenanceSection } from './sections/MaintenanceSection';
import { TelemetryInspectorSection } from '@features/telemetry-inspector/TelemetryInspectorSection/TelemetryInspectorSection';

/** What each section of the settings, and of the feature pages, draws. */
export const SECTION_COMPONENTS: Record<
  SettingsSectionId,
  () => React.ReactElement
> = {
  general: GeneralSection,
  updates: UpdatesSection,
  about: AboutSection,
  overlay: OverlaySection,
  interaction: InteractionSection,
  trackMap: TrackMapSection,
  sharedValues: SharedValuesSection,
  maintenance: MaintenanceSection,
  telemetryInspector: TelemetryInspectorSection,
};

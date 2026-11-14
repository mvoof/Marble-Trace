import type { SettingsSectionId } from './settings-sections';
import { GeneralSection } from './sections/GeneralSection';
import { UpdatesSection } from './sections/UpdatesSection';
import { AboutSection } from './sections/AboutSection';
import { OverlaySection } from './sections/OverlaySection';
import { InteractionSection } from './sections/InteractionSection';
import { MaintenanceSection } from './sections/MaintenanceSection';
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
  maintenance: MaintenanceSection,
  telemetryInspector: TelemetryInspectorSection,
};

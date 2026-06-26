// Storybook re-exports the neutral shared seeders so it stays decoupled from the
// main app — both depend on the common fixtures, not on each other.
export { seedSampleTelemetry as seedFromSnapshot } from '@store/preview/sample-telemetry';
export {
  seedScenario,
  PREVIEW_SCENARIOS,
  PREVIEW_SCENARIO_BY_ID,
  DEFAULT_PREVIEW_SCENARIO_ID,
} from '@store/preview/scenarios';

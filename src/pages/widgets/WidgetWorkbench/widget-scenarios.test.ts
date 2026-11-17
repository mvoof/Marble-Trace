import { describe, expect, it } from 'vitest';
import { DEFAULT_PREVIEW_SCENARIO_ID } from '@features/preview/scenarios';
import { catalogScenarioFor } from './widget-scenarios';

describe('catalogScenarioFor', () => {
  it('draws a widget the baseline leaves blank in its opening state', () => {
    expect(catalogScenarioFor('battery')).toBe('hybrid-deploying');
    expect(catalogScenarioFor('drs')).toBe('drs-armed');
    expect(catalogScenarioFor('wheel-to-wheel')).toBe('field-close-pack');
  });

  it('keeps every other widget on the shared baseline', () => {
    expect(catalogScenarioFor('standings')).toBe(DEFAULT_PREVIEW_SCENARIO_ID);
    expect(catalogScenarioFor('flat-flags')).toBe(DEFAULT_PREVIEW_SCENARIO_ID);
  });
});

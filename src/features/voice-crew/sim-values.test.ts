import { describe, expect, it } from 'vitest';
import type { RawVarMeta } from '@shared/contracts/generated/bindings';
import {
  OVERLAY_VARIABLES,
  defaultSimScale,
  searchVariables,
  simValueName,
} from './sim-values';

const variable = (
  name: string,
  unit = '',
  desc = '',
  count = 1,
  typeName = 'float'
): RawVarMeta => ({ name, unit, desc, count, typeName });

describe('sim values', () => {
  it('names a variable the way the pack reads it', () => {
    expect(simValueName('PlayerCarMyIncidentCount', 'whole')).toBe(
      'sim.PlayerCarMyIncidentCount'
    );
    expect(simValueName('Speed', 'kmh')).toBe('sim.Speed.kmh');
    expect(simValueName('FuelLevelPct', 'percent')).toBe(
      'sim.FuelLevelPct.percent'
    );
  });

  it('guesses the reading from the unit', () => {
    expect(defaultSimScale(variable('Speed', 'm/s'))).toBe('kmh');
    expect(defaultSimScale(variable('FuelLevelPct', '%'))).toBe('percent');
    expect(defaultSimScale(variable('LapLastLapTime', 's'))).toBe('tenths');
    expect(defaultSimScale(variable('Lap'))).toBe('whole');
  });

  it('finds by name first, then by description', () => {
    const found = searchVariables(
      [
        variable('AirTemp', 'C', 'Temperature of air'),
        variable('TrackTemp', 'C', 'Temperature of the track'),
        variable('Incidents', '', 'air quality'),
      ],
      'air'
    ).map((match) => match.name);

    expect(found).toEqual(['AirTemp', 'Incidents']);
  });

  it('lists every variable the overlay reads once', () => {
    const names = OVERLAY_VARIABLES.map((listed) => listed.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('describes the variables from kerb', () => {
    const find = (name: string) =>
      OVERLAY_VARIABLES.find((listed) => listed.name === name);

    expect(find('PlayerCarMyIncidentCount')?.desc).not.toBe('');
    expect(find('Speed')?.unit).toBe('m/s');
    expect(find('FuelLevel')?.ready).toBe('fuel');
  });

  it('finds every match, not a first page of them', () => {
    expect(searchVariables(OVERLAY_VARIABLES, '')).toHaveLength(
      OVERLAY_VARIABLES.length
    );
  });
});

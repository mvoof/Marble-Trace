import type {
  EnvironmentFrame,
  Skies,
  WeatherForecastEntry,
} from '@/types/bindings';

// Mock builders for the weather domain. Pure: each returns a *complete*
// environment frame typed from the generated bindings, so a field added to the
// contract breaks this file rather than leaking silently into every fixture.
// Nothing here touches a store.

/** The track conditions the weather widget has to be sized against. */
export type MockTrackCondition = 'dry' | 'wet' | 'heavy-rain';

/**
 * What each condition changes about the weather. Only the wet readouts differ
 * — the temperatures, the wind and the sky are stated once per condition
 * because a wet track is colder and darker than a dry one, and a widget shown
 * rain with a dry track's numbers beside it is not the picture a driver gets.
 */
const CONDITIONS: Record<MockTrackCondition, Partial<EnvironmentFrame>> = {
  dry: {
    airTemp: 24.5,
    trackTemp: 38.2,
    relativeHumidity: 0.42,
    skies: 'PartlyCloudy',
    precipitation: 0,
    // 1 is the sim's "dry", not 0 — 0 is the state before it has decided.
    trackWetness: 1,
    weatherDeclaredWet: false,
  },
  wet: {
    airTemp: 17.8,
    trackTemp: 19.4,
    relativeHumidity: 0.86,
    skies: 'Overcast',
    precipitation: 0.42,
    trackWetness: 5,
    weatherDeclaredWet: true,
  },
  'heavy-rain': {
    airTemp: 15.2,
    trackTemp: 16.1,
    relativeHumidity: 0.98,
    skies: 'Overcast',
    precipitation: 0.95,
    // The top of the scale, which is also the widest wetness label.
    trackWetness: 7,
    weatherDeclaredWet: true,
  },
};

// How much water is in the air under each sky. The forecast strip colours its
// hours by these, so they are stated once here rather than per fixture.
const FORECAST_BY_SKIES: Record<Skies, { humidity: number; rainPct: number }> =
  {
    Clear: { humidity: 0.38, rainPct: 0 },
    PartlyCloudy: { humidity: 0.46, rainPct: 0.05 },
    MostlyCloudy: { humidity: 0.62, rainPct: 0.25 },
    Overcast: { humidity: 0.84, rainPct: 0.7 },
  };

/**
 * A complete environment frame for one track condition.
 *
 * The wind is the same in all three: it is what the compass is sized against,
 * and a bearing that moves with the rain would make two scenarios differ in
 * something neither of them is about.
 */
export const mockEnvironment = (
  condition: MockTrackCondition,
  overrides: Partial<EnvironmentFrame> = {}
): EnvironmentFrame => ({
  airTemp: null,
  trackTemp: null,
  windVel: 6.4,
  windDir: 2.25,
  relativeHumidity: null,
  skies: null,
  precipitation: null,
  trackWetness: null,
  weatherDeclaredWet: null,
  ...CONDITIONS[condition],
  ...overrides,
});

/** One hour of the forecast strip, as the sim reports it. */
export interface MockForecastHour {
  /** Seconds from the session start the entry forecasts. */
  time: number;
  skies: Skies;
  tempC: number;
  windVelMps: number;
  windDirRad: number;
}

/**
 * The forecast strip, as a complete list of entries.
 *
 * A forecast hour is stated by what the strip draws — the hour, the sky and
 * the temperature — and the rest is derived here: the humidity and the rain
 * chance follow the sky the way the sim's own forecast does, so a strip cannot
 * show an overcast hour with a clear one's numbers behind it.
 */
export const mockForecast = (
  hours: MockForecastHour[]
): WeatherForecastEntry[] =>
  hours.map(({ time, skies, tempC, windVelMps, windDirRad }) => ({
    Time: time,
    Temp: tempC,
    WindSpeed: windVelMps,
    WindDir: windDirRad,
    Skies: skies,
    Humidity: FORECAST_BY_SKIES[skies].humidity,
    Fog: 0,
    RainPct: FORECAST_BY_SKIES[skies].rainPct,
  }));

import { makeAutoObservable } from 'mobx';

import type { EnvironmentFrame, WeatherForecastEntry } from '@/types/bindings';

export class EnvironmentStore {
  environment: EnvironmentFrame | null = null;
  weatherForecast: WeatherForecastEntry[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  updateEnvironment(frame: EnvironmentFrame) {
    this.environment = frame;
  }

  updateWeatherForecast(entries: WeatherForecastEntry[]) {
    this.weatherForecast = entries;
  }

  reset() {
    this.environment = null;
    this.weatherForecast = [];
  }
}

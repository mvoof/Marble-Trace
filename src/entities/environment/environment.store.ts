import { makeAutoObservable, observableRef } from 'mobx';

import type {
  EnvironmentFrame,
  WeatherForecastEntry,
} from '@shared/contracts/generated/bindings';

export class EnvironmentStore {
  environment: EnvironmentFrame | null = null;
  weatherForecast: WeatherForecastEntry[] = [];

  constructor() {
    makeAutoObservable(this, { environment: observableRef });
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

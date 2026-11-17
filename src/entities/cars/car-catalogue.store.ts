import { makeAutoObservable, observableRef } from 'mobx';

import { getCarCatalogue } from '@shared/api/car-catalogue.service';
import type { CatalogueCar } from '@shared/contracts/generated/bindings';

/**
 * Every car the sim knows, with its class badge — read once, since the table
 * is built into the app. Empty until read, or when the read fails.
 */
export class CarCatalogueStore {
  cars: readonly CatalogueCar[] = [];

  constructor() {
    makeAutoObservable(this, { cars: observableRef }, { autoBind: true });
  }

  async load() {
    try {
      const cars = await getCarCatalogue();

      this.setCars(cars);
    } catch (error) {
      console.error('[car catalogue] not read:', error);
    }
  }

  setCars(cars: readonly CatalogueCar[]) {
    this.cars = cars;
  }
}

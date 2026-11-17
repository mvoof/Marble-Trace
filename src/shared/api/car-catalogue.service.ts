import { invoke } from '@tauri-apps/api/core';

import type { CatalogueCar } from '@shared/contracts/generated/bindings';

/** Every car of the sim's car badge table, retired ones too. */
export const getCarCatalogue = () =>
  invoke<CatalogueCar[]>('get_car_catalogue');

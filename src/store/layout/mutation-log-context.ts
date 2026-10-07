import { createStoreContext } from '@utils/store-context';
import type { SettingsMutationLog } from './mutation-log.store';

export const [SettingsMutationLogContext, useSettingsMutationLog] =
  createStoreContext<SettingsMutationLog>('SettingsMutationLog');

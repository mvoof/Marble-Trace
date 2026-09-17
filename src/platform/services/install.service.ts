import { invoke } from '@tauri-apps/api/core';

import type { InstallMismatch } from '@/types/bindings';

/**
 * Temporary — part of the `.msi` migration, removed together with everything
 * listed in the module doc of `src-tauri/src/commands/install.rs`, which a test
 * there fails to remind us about.
 *
 * Resolves null for every healthy install — see `model::install` on the backend
 * for the one situation this reports.
 */
export const checkInstallIntegrity = () =>
  invoke<InstallMismatch | null>('check_install_integrity');

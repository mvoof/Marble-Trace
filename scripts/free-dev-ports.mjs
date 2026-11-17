// Runs before `npm run tauri:dev`. A dev run that closed badly can leave its
// vite server listening on the fixed ports, and vite (`strictPort`) then
// refuses to start. Stops the `node` process that holds them, with its
// process tree (esbuild); anything else on those ports is left alone.

import process from 'node:process';
import { execFileSync } from 'node:child_process';

const VITE_PORTS = [1420, 1421];
const DEV_SERVER_PROCESS_NAME = 'node';

const LIST_DEV_SERVERS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$listenerIds = @(Get-NetTCPConnection -State Listen -LocalPort ${VITE_PORTS.join(',')} |
  Select-Object -ExpandProperty OwningProcess -Unique)
$devServers = @()
if ($listenerIds.Count -gt 0) {
  $devServers = @(Get-Process -Id $listenerIds | Where-Object ProcessName -eq '${DEV_SERVER_PROCESS_NAME}')
}
ConvertTo-Json -Compress -InputObject @($devServers | Select-Object Id, ProcessName)
`;

const runPowerShell = (script) => {
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');

  return execFileSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
  );
};

const findDevServers = () => {
  const output = runPowerShell(LIST_DEV_SERVERS_SCRIPT).trim();

  if (!output) {
    return [];
  }

  return JSON.parse(output);
};

const stopProcessTree = (devServer) => {
  try {
    execFileSync('taskkill', ['/T', '/F', '/PID', String(devServer.Id)], {
      stdio: 'ignore',
    });
    console.log(
      `[free-dev-ports] Stopped the leftover dev server (${devServer.Id}).`
    );
  } catch (error) {
    console.warn(
      `[free-dev-ports] Could not stop process ${devServer.Id}: ${error.message}`
    );
  }
};

const main = () => {
  if (process.platform !== 'win32') {
    return;
  }

  let devServers = [];

  try {
    devServers = findDevServers();
  } catch (error) {
    console.warn(`[free-dev-ports] Could not list processes: ${error.message}`);

    return;
  }

  for (const devServer of devServers) {
    stopProcessTree(devServer);
  }
};

main();

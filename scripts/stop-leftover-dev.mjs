// Runs before `npm run tauri:dev`. A dev run that closed badly can leave
// behind processes that block the next one:
//   - the vite server on the fixed ports: vite (`strictPort`) refuses to start;
//   - the debug app: cargo cannot replace the running exe (os error 5).
// Stops only those two: the `node` process listening on the vite ports, with
// its process tree (esbuild), and `marble-trace.exe` from `target/debug`.
// An installed Marble Trace and the release build that perf measures keep
// running; anything else on the vite ports is left alone.

import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const VITE_PORTS = [1420, 1421];
const DEV_SERVER_PROCESS_NAME = 'node';
const APP_PROCESS_NAME = 'marble-trace';
const DEBUG_BUILD_DIRECTORY = path.resolve(
  import.meta.dirname,
  '..',
  'src-tauri',
  'target',
  'debug'
);

const LIST_LEFTOVERS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$listenerIds = @(Get-NetTCPConnection -State Listen -LocalPort ${VITE_PORTS.join(',')} |
  Select-Object -ExpandProperty OwningProcess -Unique)
$devServers = @()
if ($listenerIds.Count -gt 0) {
  $devServers = @(Get-Process -Id $listenerIds | Where-Object ProcessName -eq '${DEV_SERVER_PROCESS_NAME}')
}
$apps = @(Get-Process -Name '${APP_PROCESS_NAME}')
ConvertTo-Json -Compress -InputObject @($apps + $devServers | Select-Object Id, ProcessName, Path)
`;

const runPowerShell = (script) => {
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');

  return execFileSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
  );
};

const isDebugBuild = (executablePath) => {
  if (!executablePath) {
    return false;
  }

  const debugPrefix = `${DEBUG_BUILD_DIRECTORY}${path.sep}`.toLowerCase();

  return executablePath.toLowerCase().startsWith(debugPrefix);
};

const findLeftovers = () => {
  const output = runPowerShell(LIST_LEFTOVERS_SCRIPT).trim();

  if (!output) {
    return [];
  }

  const candidates = JSON.parse(output);

  return candidates.filter((candidate) => {
    if (candidate.ProcessName === APP_PROCESS_NAME) {
      return isDebugBuild(candidate.Path);
    }

    return true;
  });
};

const stopProcessTree = (leftover) => {
  try {
    execFileSync('taskkill', ['/T', '/F', '/PID', String(leftover.Id)], {
      stdio: 'ignore',
    });
    console.log(
      `[stop-leftover-dev] Stopped the leftover ${leftover.ProcessName} (${leftover.Id}).`
    );
  } catch (error) {
    console.warn(
      `[stop-leftover-dev] Could not stop ${leftover.ProcessName} (${leftover.Id}): ${error.message}`
    );
  }
};

const main = () => {
  if (process.platform !== 'win32') {
    return;
  }

  let leftovers = [];

  try {
    leftovers = findLeftovers();
  } catch (error) {
    console.warn(
      `[stop-leftover-dev] Could not list processes: ${error.message}`
    );

    return;
  }

  for (const leftover of leftovers) {
    stopProcessTree(leftover);
  }
};

main();

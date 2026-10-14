// PowerShell from Node: the Windows half of the in-game harness (windows,
// screenshots, perf counters) has no Node API, and every caller here is
// Windows-only anyway, as the app is.

import { execFileSync } from 'node:child_process';

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/** Runs a PowerShell script and returns its standard output, trimmed. */
export const runPowerShell = (script) =>
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ],
    { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES }
  ).trim();

/** A string as a single-quoted PowerShell literal. */
export const psString = (value) => `'${String(value).replaceAll("'", "''")}'`;

const USER32 = `
Add-Type -Namespace PerfGame -Name User32 -MemberDefinition @'
public delegate bool EnumProc(System.IntPtr window, System.IntPtr parameter);
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, System.IntPtr parameter);
[DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(System.IntPtr window, out int processId);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(System.IntPtr window, System.Text.StringBuilder text, int length);
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr window, int command);
'@ -ErrorAction SilentlyContinue
`;

const SW_SHOWNOACTIVATE = 4;
const SW_MINIMIZE = 6;

/**
 * Minimizes the settings window of the app with this process id and makes
 * sure every overlay is shown. A visible settings window paints on its own and
 * would be measured with the overlay.
 */
export const minimizeSettingsWindow = (processId) =>
  runPowerShell(`${USER32}
$found = New-Object System.Collections.ArrayList
[PerfGame.User32]::EnumWindows({ param($window, $parameter)
  $owner = 0
  [void][PerfGame.User32]::GetWindowThreadProcessId($window, [ref]$owner)
  if ($owner -eq ${processId}) {
    $title = New-Object System.Text.StringBuilder 256
    [void][PerfGame.User32]::GetWindowText($window, $title, 256)
    if ($title.ToString() -like 'Marble Trace Overlay*') {
      [void][PerfGame.User32]::ShowWindow($window, ${SW_SHOWNOACTIVATE})
      [void]$found.Add('overlay')
    } elseif ($title.ToString() -eq 'Marble Trace') {
      [void][PerfGame.User32]::ShowWindow($window, ${SW_MINIMIZE})
      [void]$found.Add('settings')
    }
  }
  $true }, [IntPtr]::Zero) | Out-Null
$found -join ','`);

const SCREENSHOT_SCALE = 2;

/** Saves the primary screen, at half size, to `filePath`. */
export const saveScreenshot = (filePath) =>
  runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$full = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
[System.Drawing.Graphics]::FromImage($full).CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$half = New-Object System.Drawing.Bitmap $full, ([int]($bounds.Width / ${SCREENSHOT_SCALE})), ([int]($bounds.Height / ${SCREENSHOT_SCALE}))
$half.Save(${psString(filePath)}, [System.Drawing.Imaging.ImageFormat]::Png)`);

/**
 * Whether a process with this executable name (without `.exe`) owns the
 * foreground window. Another window over the game — a chat, an editor — makes
 * DWM compose the game like an overlay would, and its redraws cost the game's
 * frames the same way.
 */
export const ownsForegroundWindow = (name) =>
  runPowerShell(`
Add-Type -Namespace PerfGame -Name Foreground -MemberDefinition '[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(System.IntPtr window, out int processId);' -ErrorAction SilentlyContinue
$owner = 0
[void][PerfGame.Foreground]::GetWindowThreadProcessId([PerfGame.Foreground]::GetForegroundWindow(), [ref]$owner)
(Get-Process -Id $owner -ErrorAction SilentlyContinue).Name -eq ${psString(name)}`) ===
  'True';

/** Process ids running the given executable name (without `.exe`). */
export const processIdsOf = (name) => {
  const output = runPowerShell(
    `(Get-Process -Name ${psString(name)} -ErrorAction SilentlyContinue).Id -join ','`
  );

  return output ? output.split(',').map(Number) : [];
};

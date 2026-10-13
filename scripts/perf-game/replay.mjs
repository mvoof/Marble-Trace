// The iRacing replay, driven so every capture covers the same stretch: `mark`
// saves the frame the replay stands on, `run --rewind` puts it back there and
// plays it at 1x before the lead time starts. The frame is read from the sim's
// shared memory and the replay is moved with the SDK's broadcast messages —
// the same channel the app's pit commands use.

import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

import { runPowerShell } from './powershell.mjs';

const POINT_FILE = 'replay-point.json';

// irsdk_BroadcastMsg and irsdk_RpyPosMode, from the SDK's irsdk_defines.h.
const BROADCAST_REPLAY_SET_PLAY_SPEED = 3;
const BROADCAST_REPLAY_SET_PLAY_POSITION = 4;
const REPLAY_POSITION_FROM_BEGIN = 0;
const NORMAL_SPEED = 1;
const NOT_SLOW_MOTION = 0;

// The shared memory header and a variable header, from irsdk_defines.h.
const HEADER_NUM_VARS = 24;
const HEADER_VAR_HEADER_OFFSET = 28;
const HEADER_NUM_BUF = 32;
const HEADER_VAR_BUF = 48;
const VAR_BUF_SIZE = 16;
const VAR_HEADER_SIZE = 144;
const VAR_HEADER_OFFSET_FIELD = 4;
const VAR_HEADER_NAME = 16;
const VAR_NAME_LENGTH = 32;

/** Time the sim takes to land on a frame before it is told to play. */
const SEEK_SETTLE_MS = 1500;

/** The replay's current frame, from the newest telemetry buffer. */
const readReplayFrame = () =>
  Number(
    runPowerShell(`
$map = [System.IO.MemoryMappedFiles.MemoryMappedFile]::OpenExisting('Local\\IRSDKMemMapFileName')
$view = $map.CreateViewAccessor()
try {
  $numVars = $view.ReadInt32(${HEADER_NUM_VARS})
  $varHeaders = $view.ReadInt32(${HEADER_VAR_HEADER_OFFSET})
  $newestTick = -1
  $newestOffset = 0
  for ($index = 0; $index -lt $view.ReadInt32(${HEADER_NUM_BUF}); $index++) {
    $tick = $view.ReadInt32(${HEADER_VAR_BUF} + $index * ${VAR_BUF_SIZE})
    if ($tick -gt $newestTick) {
      $newestTick = $tick
      $newestOffset = $view.ReadInt32(${HEADER_VAR_BUF} + $index * ${VAR_BUF_SIZE} + 4)
    }
  }
  for ($index = 0; $index -lt $numVars; $index++) {
    $header = $varHeaders + $index * ${VAR_HEADER_SIZE}
    $name = New-Object byte[] ${VAR_NAME_LENGTH}
    [void]$view.ReadArray($header + ${VAR_HEADER_NAME}, $name, 0, ${VAR_NAME_LENGTH})
    if ([System.Text.Encoding]::ASCII.GetString($name).TrimEnd([char]0) -eq 'ReplayFrameNum') {
      $view.ReadInt32($newestOffset + $view.ReadInt32($header + ${VAR_HEADER_OFFSET_FIELD}))
      break
    }
  }
} finally {
  $view.Dispose()
  $map.Dispose()
}`)
  );

const broadcast = (message, var1, var2) =>
  runPowerShell(`
Add-Type -Namespace PerfGame -Name Broadcast -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern uint RegisterWindowMessage(string name);
[DllImport("user32.dll")] public static extern bool SendNotifyMessage(System.IntPtr window, uint message, System.IntPtr wParam, System.IntPtr lParam);
'@ -ErrorAction SilentlyContinue
$id = [PerfGame.Broadcast]::RegisterWindowMessage('IRSDK_BROADCASTMSG')
[void][PerfGame.Broadcast]::SendNotifyMessage([System.IntPtr]0xFFFF, $id, [System.IntPtr](${var1} -shl 16 -bor ${message}), [System.IntPtr]${var2})`);

const pointPath = (outDir) => path.join(outDir, POINT_FILE);

/** Saves the frame the replay stands on as the point every `--rewind` run starts from. */
export const markReplayPoint = (outDir) => {
  const frame = readReplayFrame();

  if (!Number.isInteger(frame) || frame <= 0) {
    throw new Error(
      'no replay frame — is iRacing running with a replay loaded?'
    );
  }

  writeFileSync(pointPath(outDir), JSON.stringify({ frame }));

  return frame;
};

/** Puts the replay back on the marked frame and plays it at normal speed. */
export const rewindReplay = async (outDir) => {
  const { frame } = JSON.parse(readFileSync(pointPath(outDir), 'utf8'));

  broadcast(
    BROADCAST_REPLAY_SET_PLAY_POSITION,
    REPLAY_POSITION_FROM_BEGIN,
    frame
  );
  await new Promise((resolve) => setTimeout(resolve, SEEK_SETTLE_MS));
  broadcast(BROADCAST_REPLAY_SET_PLAY_SPEED, NORMAL_SPEED, NOT_SLOW_MOTION);

  return frame;
};

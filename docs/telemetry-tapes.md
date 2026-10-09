# Recording, replaying and measuring on a tape

A **tape** is a recorded sim session: every telemetry tick the backend adapted,
plus the raw session YAML, gzipped into one `session-<unix seconds>.tape.jsonl.gz`.
It lets you run the app without iRacing, and it is what `npm run perf`
measures on, so two perf runs see the same stretch of driving.

Tapes are for performance work and for reproducing a session. Widget previews
and Storybook run on mock builders, never on a recording
([ADR-0004](adr/0004-widget-preview-runs-on-mocks.md)). Keep tapes out of git —
a 35-minute race is about 95 MB.

Everything here needs a build with the cargo feature `dev`: `npm run tauri:dev`,
`npm run tauri:build:dev`, or the binary `npm run perf -- --build` makes. A
release build ignores every tape and perf variable.

---

## Paths: read this first

- **Use absolute paths.** `tauri dev` runs the backend with `src-tauri/` as its
  working directory, so a relative path lands there.
- **In Git Bash, a backslash is an escape character.** `D:\tapes\session.tape.jsonl.gz`
  reaches the app as `D:tapessession.tape.jsonl.gz`, the tape is not found, and
  the app silently connects to the live sim instead. Write paths with forward
  slashes — `D:/tapes/session.tape.jsonl.gz` — which work in every shell, or
  quote them in single quotes in Bash.
- The examples below use forward slashes for that reason. `D:/tapes` is only an
  example directory; any directory works.

How to set a variable for one run:

| Shell      | Form                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| PowerShell | `$env:NAME = 'value'; npm run tauri:dev` — stays set in that terminal; `Remove-Item Env:NAME` clears it |
| Git Bash   | `NAME=value npm run tauri:dev` — for that command only                                                  |

---

## Record a session

1. Start iRacing.
2. Start the app with a directory to record into:

   ```powershell
   # PowerShell
   $env:MARBLE_TRACE_RECORD = 'D:/tapes'; npm run tauri:dev
   ```

   ```bash
   # Git Bash
   MARBLE_TRACE_RECORD=D:/tapes npm run tauri:dev
   ```

3. Get in the car and drive what you want on the tape — a race start, traffic,
   a pit stop. Every connection to the sim becomes its own file in that
   directory (created if missing). The backend log says
   `Recording telemetry to …` when it starts.
4. Leave the session or close the app; the tape is finished on disconnect.

Writing runs on its own thread, off the telemetry loop, so recording does not
change what it records. Remember to clear `MARBLE_TRACE_RECORD` afterwards in
PowerShell, or the next run records too.

---

## Replay a tape

```powershell
$env:MARBLE_TRACE_REPLAY = 'D:/tapes/session-1791104931.tape.jsonl.gz'; npm run tauri:dev
```

```bash
MARBLE_TRACE_REPLAY=D:/tapes/session-1791104931.tape.jsonl.gz npm run tauri:dev
```

The tape plays **instead of** the sim, at the pace it was recorded, and loops:
at its end the source disconnects, the runtime resets and the tape starts over.
The main window's status reads **`REPLAY: <tape>`** while it plays.

To start partway in, add `MARBLE_TRACE_REPLAY_FROM=<seconds>`. Frames before it
are skipped; the last session YAML recorded before it is kept.

**No `REPLAY:` in the status?** The tape was not opened and the app fell back
to the live sim. The log says why — `Tape … cannot be replayed: …` — in
`%APPDATA%\com.voof.marble-trace\logs\marble-trace.log`. Nine times out of ten
it is the path (see above).

Pit orders are never sent to the sim while a tape plays.

---

## Measure performance on a tape

`npm run perf` (`scripts/perf-run.mjs`) starts the app on a tape, lets it warm
up, measures a fixed span, writes a JSON report and prints it as tables. The
results and what every row means are in [perf-baseline.md](perf-baseline.md).

Close every running Marble Trace first — instances share one WebView2 data
folder and one settings file — and leave the machine idle.

```bash
# once per code change: release backend with the `dev` feature, production
# frontend with hidden source maps, no installer
npm run perf -- --tape D:/tapes/session-1791104931.tape.jsonl.gz --from 600 --build

# two runs, so the spread is printed beside the numbers
npm run perf -- --tape D:/tapes/session-1791104931.tape.jsonl.gz --from 600 --runs 2

# the same without a single widget mounted: what the stores alone cost
npm run perf -- --tape D:/tapes/session-1791104931.tape.jsonl.gz --from 600 --runs 2 --mode stores-only

# where the overlay's bytes go (a heap profile; its timings are not baseline numbers)
npm run perf -- --tape D:/tapes/session-1791104931.tape.jsonl.gz --from 600 --seconds 30 --heap

# saved reports side by side
npm run perf -- --report a.json --report b.json
```

| Flag            | Meaning                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| `--tape <path>` | the tape to play (required unless `--report`)                                |
| `--from <s>`    | start this many seconds into the tape (default 0)                            |
| `--warmup <s>`  | playback before measuring (default 10)                                       |
| `--seconds <s>` | measured span (default 60)                                                   |
| `--runs <n>`    | run n times, print each and the spread                                       |
| `--mode`        | `widgets` (default) or `stores-only`                                         |
| `--heap`        | sampling heap profile of the overlay over CDP; needs a binary from `--build` |
| `--build`       | build the measured binary first                                              |
| `--out <dir>`   | where reports go (default `%TEMP%\marble-trace-perf\`)                       |
| `--report <f>`  | print a saved report instead of running; repeat to compare                   |

The app runs on **your own settings**: whichever layout is active is the one
measured, and each report names the widgets it had on every monitor. Pick
`--from` past the formation lap, where the field is on track.

**`tape … not found`** — the script checks the path before it starts anything;
it prints the path it actually received, so a backslash Git Bash dropped shows.

**`the app exited with 0 and no report`** — the tape exists but the run did not
happen on it: the app could not read it, or another instance was running. Check
the log.

New numbers go into `perf-baseline.md` as a new row — that file is appended to,
never rewritten.

---

## The variables underneath

`npm run perf` sets these for you; set them by hand only to run the harness
without the script. All of them are listed in
[CONTRIBUTING → Environment variables](../CONTRIBUTING.md#environment-variables).

| Variable                    | Effect                                                          |
| --------------------------- | --------------------------------------------------------------- |
| `MARBLE_TRACE_RECORD`       | directory to record every live connection into                  |
| `MARBLE_TRACE_REPLAY`       | tape to play instead of the sim                                 |
| `MARBLE_TRACE_REPLAY_FROM`  | seconds into the tape to start                                  |
| `MARBLE_TRACE_PERF`         | path of the JSON report; starts a perf run and exits after it   |
| `MARBLE_TRACE_PERF_SECONDS` | measured span, default 60                                       |
| `MARBLE_TRACE_PERF_WARMUP`  | warm-up, default 10                                             |
| `MARBLE_TRACE_PERF_MODE`    | `widgets` or `stores-only`                                      |
| `MARBLE_TRACE_PERF_HEAP`    | `1`: overlays hold their report until the heap profile is taken |

Code: `src-tauri/src/sources/tape.rs` (format, writer, reader),
`src-tauri/src/sources/replay.rs` (the source and the env vars),
`scripts/perf-run.mjs` and `scripts/perf-heap.mjs` (the harness).

> [!NOTE]
> Please prefer English language for all communication.

## Creating an issue

Before creating an issue please ensure that the problem is not [already reported](https://github.com/mvoof/Marble-Trace/issues).

## How to Contribute

1. **Fork and Clone the Repository**

   First, create your own copy of the repository by clicking the "Fork" button on GitHub. Then, clone your fork to your local machine:

   ```sh
   git clone https://github.com/your-username/Marble-Trace.git
   cd Marble-Trace
   git remote add upstream https://github.com/mvoof/Marble-Trace.git
   ```

2. **Create a New Branch**

   ```sh
   git checkout -b feature/short-description
   ```

3. **Make Changes**
   Implement your feature or fix the bug. Be sure to follow the project's coding style and add tests if necessary.

   If you are **building a new widget**, read
   [docs/widget-authoring.md](docs/widget-authoring.md) before you open a widget
   file. It is the route from an idea to a merged widget, ordered by cost —
   which telemetry exists and at what rate, which fields are sent only while a
   widget asks for them, whether the widget needs a store, and what is collected
   automatically and needs no shared file edited. Beside it,
   [docs/widget-toolbox.md](docs/widget-toolbox.md) lists every helper, shared
   component, hook and design token that already exists, so you do not write a
   fifth lap-time formatter.

   If you are touching a widget that reads telemetry, read
   [docs/rendering.md](docs/rendering.md) first — the overlay renders under a
   60 Hz feed, and a component that reads a hot field has to follow the
   hot/cold split described there.

4. **Commit Changes**

   Before committing, ensure your code is clean and functional:
   - Run linting and formatting: `npm run lint` and `npm run format`
   - Build the application to check for compilation errors: `npm run tauri:build:dev`
   - Run the application to verify your changes: `npm run tauri:dev`

   Once verified, commit your changes:

   ```sh
   git add .
   git commit -m "feat: add new super feature"
   ```

5. **Keep Your Branch Up to Date**

   Before pushing, make sure your branch is rebased on top of the latest `main` to avoid merge conflicts and keep the history clean:

   ```sh
   git fetch upstream
   git rebase upstream/main
   ```

   If conflicts arise, resolve them, then continue:

   ```sh
   git rebase --continue
   ```

6. **Push Changes**

   ```sh
   git push -u origin feature/short-description
   ```

   If you had to rebase after already pushing, use `--force-with-lease`:

   ```sh
   git push --force-with-lease
   ```

   > [!IMPORTANT]
   > Never run `git pull` on your branch after a rebase. The rebase rewrote your
   > commits, so local and remote have diverged; `pull` merges the two and brings
   > the pre-rebase copies back as duplicates. Force-push instead.

7. **Create a Pull Request**

## Environment variables

None of these is needed to build or run the app. They switch on diagnostics,
recording and generation steps you use while developing.

On PowerShell set a variable for one run with `$env:NAME = 'value'; npm run tauri:dev`
(it stays set for the rest of that terminal; `Remove-Item Env:NAME` clears it).
In Git Bash, prefix the command: `NAME=value npm run tauri:dev`.

### Runtime — read when the app starts

| Variable              | Build      | Effect                                                                                                                                                                                                                                                                                |
| --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RUST_LOG`            | any        | `tracing` filter for the backend console and the log file, replacing the default (`marble_trace_lib=info` for the file). `RUST_LOG=marble_trace_lib=debug` gives verbose backend logs; `marble_trace_lib::telemetry=debug` narrows them to one module.                                |
| `MARBLE_TRACE_RECORD` | `dev` only | A directory. Every live sim connection is recorded into it as its own tape, `session-<unix seconds>.tape.jsonl.gz`: each tick's adapted frame plus the raw session YAML. The directory is created if missing. Writing happens on a thread of its own, off the telemetry loop.         |
| `MARBLE_TRACE_REPLAY` | `dev` only | Path to a tape. The app plays it at the pace it was recorded **instead of** connecting to the sim, and loops it: at the end of the tape the source disconnects, the runtime resets and reconnects, and the tape starts over. A tape that cannot be opened falls back to the live sim. |

`dev` is the cargo feature `npm run tauri:dev` and `npm run tauri:build:dev`
enable; a release build ignores both tape variables. Use **absolute paths** for
them — `tauri dev` runs the backend with `src-tauri/` as its working directory,
so a relative path lands there.

```powershell
# record a session: start iRacing, then
$env:MARBLE_TRACE_RECORD = 'D:\tapes'; npm run tauri:dev

# replay it without iRacing
$env:MARBLE_TRACE_REPLAY = 'D:\tapes\session-1790000000.tape.jsonl.gz'; npm run tauri:dev
```

Tapes are for performance measurement only — widget previews and Storybook run
on mock builders, never on a recording (ADR-0004). Keep large tapes out of git.

### Build time — baked into the executable

Read by `src-tauri/build.rs` from the environment or from `src-tauri/.env`
(gitignored). A missing value still builds.

| Variable           | Effect                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `APTABASE_KEY`     | Analytics key. Unset, the analytics plugin gets an empty key.                                                 |
| `TWITCH_CLIENT_ID` | Twitch application id for stream chat. Unset, Twitch sign-in needs a client id entered in the app's settings. |

### Tooling

| Variable          | Used by                     | Effect                                                                                                                                                                                                                                           |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UPDATE_BINDINGS` | `cargo test --features dev` | Lets the test `regenerates_the_contract_on_demand` rewrite `src/types/bindings.ts` and the generated constants; without it the test does nothing: `UPDATE_BINDINGS=1 cargo test --features dev regenerates_the_contract`, then `npm run format`. |
| `STORYBOOK_URL`   | `npm run capture:widgets`   | Storybook to take widget pictures from. Default `http://localhost:6006`.                                                                                                                                                                         |
| `TAURI_DEV_HOST`  | `vite.config.ts`            | Host the dev server binds and serves HMR on, for running the frontend on another device. Set by the Tauri CLI when needed.                                                                                                                       |

## Commit messages

Commit messages should follow the [Conventional Commits](https://conventionalcommits.org) specification:

```
<type>[optional scope]: <description>
```

### Allowed `<type>`

- `chore`: any repository maintainance changes
- `feat`: code change that adds a new feature
- `fix`: bug fix
- `perf`: code change that improves performance
- `refactor`: code change that is neither a feature addition nor a bug fix nor a performance improvement
- `docs`: documentation only changes
- `ci`: a change made to CI configurations and scripts
- `style`: cosmetic code change
- `test`: change that only adds or corrects tests
- `revert`: change that reverts previous commits

If you have any questions or need help, feel free to open an issue or ask in the discussions section. We appreciate your contributions!

## Agent tooling

`AGENTS.md`, the project skills under `.claude/skills/` and `.mcp.json` are tracked: they are the shared contract an agent working in this repository reads, and the MCP server the visual-testing workflow needs.

Anything that makes your machine run third-party code is **not** tracked, and is yours to opt into. `.claude/settings.json` is gitignored along with `settings.local.json` — put `enabledPlugins`, `enableAllProjectMcpServers` and your permission allow-list in the local file, so a clone never enables a plugin you have not read. The MCP server in `.mcp.json` is pinned to an exact version for the same reason; bump it deliberately, in its own commit.

## Widget screenshots

The widget pictures the README and the website gallery show are one set, in `site/assets/widgets/`: transparent PNGs taken at 3x, so they stay sharp on high-density screens. The README shows each at a third of its width (`<img width>`), the widget's own size. The site shows one picture per widget; the README may add variants beside it (Delta against the best lap, Fuel with the pit window open…).

They are taken from **Storybook** by `scripts/capture-widgets.mjs` — every picture is one story, so it shows exactly the data that story seeds. Start Storybook, and nothing else heavy beside it:

```bash
npm run storybook
```

then:

```bash
npm run capture:widgets                 # every picture in SHOTS
npm run capture:widgets -- fuel timer   # only these files
```

`SHOTS` in the script maps each file to its story (`fuel` → `FuelWidget` / `full-preview`). The first entry of a widget is its picture on the site; the entries after it are the README's variants. The script opens each story in its own headless browser and takes the widget alone: the container's ground and border — the user's background setting on the overlay, which the story decorator draws — are taken off and everything around is transparent. A widget that paints its own plate keeps it. The file of the same name is written over.

**A picture is a story.** To change what a widget shows, change or add its story — seeded the way the widget looks in a race — and point `SHOTS` at it. A widget that draws a history (a trace, a trail) builds it from successive frames, and a seed gives it only one; replay a burst after mount with `withReplay` from `src/storybook/with-replay.tsx`, as the `Showcase` stories of Input Trace and G-Meter do.

A new widget needs a story to be taken from, a line in `SHOTS`, and a width in the README of a third of its PNG's.

**The site serves WebP copies, not the PNGs.** `site/scripts/images.mjs` (`npm run images` in `site/`) writes each picture as WebP at a ladder of widths into `site/assets/img/`, with a manifest, and the site's build turns every `<img src="assets/...">` into those copies with a `srcset`. `capture:widgets` runs it for you at the end, so a recaptured widget reaches the site with nothing else to do; commit `site/assets/img/` with the PNGs. Run it by hand only when you put a picture in `site/assets/` some other way — a replaced screenshot in `control/`, `layouts/` or `screens/`. The PNGs and the other originals stay: they are the sources the copies are made from, and the README shows the PNGs. The site build warns about any `<img>` it finds no copies for.

## Settings schema

User settings are persisted in `settings.json` via `tauri-plugin-store`, and the file is versioned: format changes go through a chain of migrations in `src/platform/settings-schema/`.

Most changes need no migration. Adding a field with a default, removing one, or adding an action with a default binding are all picked up on the next load — unknown and removed fields are purged from disk automatically, and defaults fill the gaps. A migration is for values that would otherwise be silently misread or be expensive for the user to recreate: a field that changes meaning or unit, a value that moves between blocks, or anything inside `layouts[]`, which the default-merging never reaches.

**Renaming a widget `id`** — the saved widget with the old `id` is dropped and replaced with a new one at its default position. The user will need to reposition it.

A file this build cannot read is left untouched and the app refuses to write over it, showing an explanation instead.

See **[docs/settings-schema.md](docs/settings-schema.md)** for the load pipeline, the full "when do I need a migration" split, and how to write and test one.

## Steering wheel silhouettes

The Input Trace widget's steering block can draw a wheel silhouette instead of the built-in dial. Each one is a single SVG in `src/assets/wheels/`, traced from a product photograph by `scripts/trace-wheel-svg.py`:

```bash
npm run wheel:trace -- <photo.jpg> <asset-name>
```

The script declares its own Python dependencies inline and is run through [uv](https://docs.astral.sh/uv/), so there is no install step and no Python environment inside the repo — you only need uv on `PATH` (`winget install --id=astral-sh.uv -e`).

The photo has to be a **head-on shot of a dark wheel on a plain light background** — watermarks, buttons and screens are handled, a cockpit shot or an angled one is not. Adding the traced file to the picker is three one-line registrations and needs no settings migration.

See **[docs/steering-wheel-assets.md](docs/steering-wheel-assets.md)** for the photo requirements in full, installing uv, the flags to reach for when a trace comes out wrong, and the three files to register it in.

## Car class badges

The badge next to a driver is resolved in Rust, in `src-tauri/src/sources/iracing/`: `car_badges.rs` is the map (`CarID → badge`), `car_classes.rs` the resolution and the class colors. Widgets only read `carClassShortName`.

iRacing's `CarClassShortName` is **empty in AI and hosted sessions**, so each class gets one badge from the cars in it, in this order:

| #   | Source               | Notes                                                        |
| --- | -------------------- | ------------------------------------------------------------ |
| 1   | `car_badges.rs`      | when every car of the class is in the map and they all agree |
| 2   | `CarClassShortName`  | the sim's class name, as it is                               |
| 3   | `CarScreenNameShort` | the car name, when the class holds one model                 |
| 4   | `Class <CarClassID>` | a multi-model class nothing above could name                 |

**Adding a car** — one line in `car_badges.rs`: a GT3/GT4/GTP/LMP2/TCR… car gets its category, a single-make car whose name is too long for the badge column gets a short label (at most 6 characters, enforced by a test). The map is keyed by `CarID`, not `CarClassID`, because iRacing gives the same car a different class id in every series that runs it.

**Class colors** — `CLASS_COLOR_MAP` corrects known mismatches between the telemetry color and what iRacing displays in-game.

**Reading real values** — dump the session YAML with the sim running (`kerb::save_session`, or `cargo run --example test` in `kerb/examples`, which writes `session.yaml`), then:

```bash
grep -o "CarID: [0-9]*\|CarClassID: [0-9]*\|CarScreenName: .*" session.yaml | paste - - - | sort -u
```

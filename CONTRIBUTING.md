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

## Settings schema

User settings are persisted in `settings.json` via `tauri-plugin-store`, and the file is versioned: format changes go through a chain of migrations in `src/store/settings-schema/`.

Most changes need no migration. Adding a field with a default, removing one, or adding an action with a default binding are all picked up on the next load — unknown and removed fields are purged from disk automatically, and defaults fill the gaps. A migration is for values that would otherwise be silently misread or be expensive for the user to recreate: a field that changes meaning or unit, a value that moves between blocks, or anything inside `layouts[]`, which the default-merging never reaches.

**Renaming a widget `id`** — the saved widget with the old `id` is dropped and replaced with a new one at its default position. The user will need to reposition it.

A file this build cannot read is left untouched and the app refuses to write over it, showing an explanation instead.

See **[docs/settings-schema.md](docs/settings-schema.md)** for the load pipeline, the full "when do I need a migration" split, and how to write and test one.

## Car class badges

Everything class-related — constants, resolution logic, tests — lives in `src-tauri/src/sources/iracing/car_classes.rs`. `session_parse.rs` only calls `apply_class_badges()` and `normalize_class_color()`.

iRacing's `CarClassShortName` is **empty in AI and hosted sessions**, and in single-model classes it holds the _car_ name ("BMW M4 GT4"), not a class label. So `car_class_short_name` is resolved in this order:

| #   | Source                          | Notes                                                                                    |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `CarClassShortName`             | whatever the sim reports — never overwritten                                             |
| 2   | `CLASS_BADGE_BY_ID`             | curated badge per `CarClassID` — the only hand-maintained list                           |
| 3   | `derive_badge_from_car_names()` | tokens shared by every model in the class ("BMW M4 GT3 EVO" + "Ferrari 296 GT3" → `GT3`) |
| 4   | `CarScreenNameShort`            | the car name, as a last resort                                                           |

**Adding a class** — add to `CLASS_BADGE_BY_ID` only when a class holds a single model whose name is too long for the badge column. Multi-model classes (GT3, LMP2, TCR…) resolve themselves at step 3 and need no entry. `CarClassID` is stable across sessions and seasons.

**Class colors** — `CLASS_COLOR_MAP` corrects known mismatches between the telemetry color and what iRacing displays in-game.

**Reading real values** — dump the session YAML with the sim running (`kerb::utils::save_session`, or `cargo run --example session_diagnostics` in `kerb/examples`), then:

```bash
grep -o "CarClassID: [0-9]*\|CarScreenNameShort: .*" dump.yaml | paste - - | sort -u
```

The same list is available from the iRacing `/data/carclass/get` endpoint (fields `car_class_id` / `name`), which requires an account login — note that its `short_name` is the _longer_ car name and `name` is the concise one.

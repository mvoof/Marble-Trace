# Adding a steering wheel to the Input Trace widget

The Input Trace widget's steering block draws either the built-in dial (`Default
dial` — the recessed groove with the marker running around the rim) or one of a
set of wheel silhouettes. This page is about adding a silhouette.

A wheel ships as **one SVG**, traced from a photograph by
`scripts/trace-wheel-svg.py`, plus three small registrations in the code. The
tracing is the part worth reading; the wiring is four lines.

---

## 1. Find a usable photograph

The tracer works on the shape of the wheel against its background, so the photo
has to make that shape unambiguous. A product shot from a shop listing is
usually perfect.

**Required:**

- **Head-on.** The wheel square to the camera, not angled or in perspective —
  the silhouette is going to be rotated live by the steering angle, and a wheel
  photographed at three-quarters looks broken the moment it turns.
- **Plain light background.** White or near-white, with no gradient behind the
  wheel. The tracer separates by brightness.
- **Dark wheel.** Nearly all of them are. A pale wheel on white has no edge to
  find.
- **The whole wheel in frame,** nothing cropped.

**Fine, and handled:**

- Watermarks, shop logos and captions — anything not touching the wheel is
  dropped as a separate object.
- A soft drop shadow under the wheel.
- Screens, buttons, LEDs, carbon texture, stitching — they get filled in.
- Any resolution from ~500 px up; the tracer works at 1000 px on the long side.
  Below ~300 px the outline comes out visibly lumpy.

**Won't work:**

- A photo of a wheel in a cockpit, or on a rig, or held by someone.
- A busy or dark background, or one the wheel's own shadow blends into.
- A wheel behind glass, or with a hand on it.

---

## 2. Install uv (once per machine)

The tracer is a Python script, but you do not install Python packages for it and
nothing about it lands in this repo. It declares its own dependencies in a
[PEP 723](https://peps.python.org/pep-0723/) block at the top of the file, and
[uv](https://docs.astral.sh/uv/) reads that block, fetches what it needs into
its own cache and runs the script. The first run takes a few seconds; after that
it is instant.

You only need uv itself. Any of these works — pick the shell you are in:

```powershell
# Windows — PowerShell
winget install --id=astral-sh.uv -e
```

```bash
# Windows — Git Bash. winget is a normal executable, so it works here too.
winget install --id=astral-sh.uv -e

# …or the shell installer, which detects MSYS/MINGW and fetches the native
# Windows build rather than trying to run a Linux one:
curl -LsSf https://astral.sh/uv/install.sh | sh
```

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Close and reopen the terminal, then check it is on `PATH`:

```bash
uv --version
```

**Nothing goes in the project.** uv keeps its environments in its own cache
(`%LOCALAPPDATA%\uv\cache` on Windows, `~/.cache/uv` elsewhere), and the npm
script passes `--no-project`, so uv never treats this repo as a Python project
or creates a `.venv` inside it. There is no environment here to activate, break
or commit by accident — `.venv/` and `__pycache__/` are gitignored anyway, as a
backstop.

If you would rather not install uv, the script runs under any Python 3.10+ that
has `numpy`, `scipy`, `pillow` and `scikit-image` available: call
`python scripts/trace-wheel-svg.py …` directly instead of the npm script. That
is a fallback, not the supported path.

---

## 3. Trace it

```bash
npm run wheel:trace -- <path/to/photo.jpg> <asset-name>
```

The `--` is required — it hands the arguments to the script rather than to npm.
Quote the path if it has spaces in it.

Both path styles work in Git Bash — `/c/Users/you/photo.jpg` and
`C:/Users/you/photo.jpg` — because MSYS rewrites the POSIX form before the
native Python sees it. In PowerShell, use the `C:\…` form.

`<asset-name>` is the file name and, further down, the setting value: lowercase,
hyphen-separated, and named for the **kind** of wheel rather than its brand
(`gt-round`, `formula-open`), since the user is picking a shape.

It writes `src/assets/wheels/<asset-name>.svg` and prints what it made:

```
src/assets/wheels/gt-round.svg — 7 contours, viewBox 931, 2715 bytes
```

**Open the file and look at it** before going further — a browser tab is enough.
A good result is 3–10 contours and 1–3 KB. Far more contours than that means
noise got traced; far fewer means the gaps between the spokes were filled in.

### When the result is wrong

Three flags, in the order you'll reach for them:

| Flag          | Default | Raise it when…                                                   | Lower it when…                                                           |
| ------------- | ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `--min-hole`  | `0.002` | buttons, screens or bolt holes punch specks through the shape    | a real gap between the spokes has been filled solid                      |
| `--threshold` | `215`   | a dark wheel comes out eaten away, or the rim breaks into pieces | the background bleeds into the shape, or the drop shadow joins the wheel |
| `--tolerance` | `1.2`   | the outline is jagged, or the file is unreasonably large         | curves are being cut into visible straight segments                      |

`--min-hole` is a fraction of the wheel's own area, so it means the same thing at
any resolution. `--threshold` is luminance, 0–255: a pixel at or below it counts
as wheel.

Formula wheels have large openings between the grips and the plate, and a
display in the middle that is bright and roughly the same size — those want
`--min-hole 0.006` or so. Round GT wheels have three enormous gaps and little
else, and are happy near `0.0015`. The wheels already in the repo were traced
with:

```bash
npm run wheel:trace -- gt-round.jpg          gt-round      --threshold 205 --min-hole 0.0015
npm run wheel:trace -- gt-flat-bottom.jpg    gt-flat-bottom                --min-hole 0.0015
npm run wheel:trace -- formula-open.jpg      formula-open                  --min-hole 0.006
npm run wheel:trace -- formula-compact.jpg   formula-compact               --min-hole 0.009 --tolerance 0.8
```

### What comes out

A single `<path>` with `fill-rule="evenodd"` on a **square** `viewBox`, filled
with `currentColor`.

All three matter. Even-odd is what turns the inner contours into holes, and it
only does that between subpaths of the same `<path>` — one contour per element
would fill each of them solid instead. The square box is why one square slot
holds a round GT wheel and a wide formula wheel at a sensible size each. And
`currentColor` is what lets the widget's `color` drive the fill, so the wheel
follows the theme instead of pinning itself to a hex.

---

## 4. Register it

Three files, next to each other, none of them shared:

1. **`src/types/widget-settings.ts`** — add the asset name to the
   `SteeringWheelStyle` union.
2. **`src/ui/widgets/InputTraceWidget/SteeringWheel/WheelArt.tsx`** — import the
   SVG with `?react` and add it to `WHEEL_ART`.
3. **`src/ui/widgets/InputTraceWidget/SteeringWheel/wheel-styles.ts`** — add an
   entry to `STEERING_WHEEL_STYLE_OPTIONS` with the label the picker shows.

The split between the last two is deliberate: `wheel-styles.ts` is a plain list
with no SVG imports, so the settings window lists every wheel without bundling
seven silhouettes it never draws.

No settings migration is needed — an existing `settings.json` simply keeps
whatever `steeringWheelStyle` it already had, and a file written before the
setting existed picks up the default.

---

## 5. Check it in the app

```bash
npm run tauri:dev
```

Widgets → Input Trace → Data Channels → Wheel Style. Look at three things:

- The gaps between the spokes are transparent, not filled.
- Turning the wheel doesn't reveal a lopsided outline — that's a photo that
  wasn't square to the camera.
- With **Center Display** set to something other than `None`, the readout falls
  on the wheel's dark centre section rather than over a gap, where it would be
  left sitting on whatever is behind the overlay.

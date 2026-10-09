# Widget screenshots

The widget pictures the README and the website gallery show are one set, in
`site/assets/widgets/`: transparent PNGs taken at 3x, so they stay sharp on
high-density screens. The README shows each at a third of its width
(`<img width>`), the widget's own size. The site shows one picture per widget;
the README may add variants beside it (Delta against the best lap, Fuel with the
pit window open…).

## Take them

They are taken from **Storybook** by `scripts/capture-widgets.mjs` — every
picture is one story, so it shows exactly the data that story seeds. Start
Storybook, and nothing else heavy beside it:

```bash
npm run storybook
```

then, in a second terminal:

```bash
npm run capture:widgets                 # every picture in SHOTS
npm run capture:widgets -- fuel timer   # only these files
npm run capture:widgets -- --border      # keep the frame's border
```

Stop Storybook afterwards. `STORYBOOK_URL` points the script at another
Storybook (default `http://localhost:6006`).

`SHOTS` in the script maps each file to its story (`fuel` → `FuelWidget` /
`full-preview`). The first entry of a widget is its picture on the site; the
entries after it are the README's variants. The script opens each story in its
own headless browser and takes the widget alone: the container's ground and
border — the user's background setting on the overlay, which the story decorator
draws — are taken off and everything around is transparent. A widget that paints
its own plate keeps it. The file of the same name is written over.

## A picture is a story

To change what a widget shows, change or add its story — seeded the way the
widget looks in a race — and point `SHOTS` at it. How to write one:
[widget-stories.md](widget-stories.md). A widget that draws a history (a trace,
a trail) builds it from successive frames, and a seed gives it only one; replay
a burst after mount with `withReplay` from `src/storybook/with-replay.tsx`, as
the `Showcase` stories of Input Trace and G-Meter do.

## A new widget

1. A story to take it from, and a line in `SHOTS`.
2. `npm run capture:widgets -- <file>`.
3. Its section in `README.md`, the `<img>` width a third of the PNG's.
4. Its card on the site — the full list of edits is
   [widget-authoring.md → Step 12](widget-authoring.md#step-12--put-it-in-the-readme-and-on-the-site).

## The site serves WebP copies, not the PNGs

`site/scripts/images.mjs` (`npm run images` in `site/`) writes each picture as
WebP at a ladder of widths into `site/assets/img/`, with a manifest, and the
site's build turns every `<img src="assets/...">` into those copies with a
`srcset`. `capture:widgets` runs it for you at the end, so a recaptured widget
reaches the site with nothing else to do; **commit `site/assets/img/` with the
PNGs**.

Run it by hand only when you put a picture in `site/assets/` some other way — a
replaced screenshot in `control/`, `layouts/` or `screens/`. The PNGs and the
other originals stay: they are the sources the copies are made from, and the
README shows the PNGs. The site build warns about any `<img>` it finds no copies
for.

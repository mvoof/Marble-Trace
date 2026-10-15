# Frontend style rules

Code style, styling, color tokens, fixed digits and `ws()` scaling.

## Code Style

_Held by: lint for the imports (a component reaching `@shared/api/*` or `@tauri-apps/*`); review for the rest — `oxfmt` formats but never adds a blank line or renames anything._

- Arrow functions everywhere; always assign to a named `const`. No anonymous standalone functions.
- Descriptive names — 1–3 char names forbidden (including callback params).
- No magic numbers — use named constants.
- Only comment code sections that are unclear even with the surrounding context — do not comment self-explanatory logic.
- All non-UI business logic in MobX stores.
- Components (`app/windows`, `pages`, `widgets`, `features/**/*.tsx`) never import from `@tauri-apps/*` or `@shared/api/*` — they talk to MobX stores only. (Exception: the window shells — `MainWindow`, `WindowControls`, `OverlayWindow`, `OverlayCanvas`, `DiagnosticsHudWindow` — may start their window's sync and use `getCurrentWindow` / `getCurrentWebviewWindow`; their override in `.oxlintrc.json` lists them by name.)
- Icons: `lucide-react` only.
- No barrel file imports — always use direct file paths.

## if/else

_Held by: review._

```ts
if (condition) {
} else {
}
```

Always block form. Blank line before `return`. Blank line before and after every `if`/`else` block.

## Styling

_Held by: review._

- `ComponentName.module.scss` next to every component — never import from a parent or sibling.
- Do **not** manually import `_variables.scss`, `_functions.scss`, or `_widget-tokens.scss` — auto-injected via Vite/Storybook `additionalData`.
- No inline styles — conditional styles use named CSS classes. (Exception: data-driven values like car-class color or dynamic `grid-template`.)
- Flat camelCase class names in CSS Modules (e.g. `driverNamePlayer`).
- SCSS modifier classes declared **after** their base class.
- CSS variable names must not indicate color.
- Fonts: `$font-widget` = `'Rajdhani', sans-serif`. `$font-mono` = `'Consolas', monospace`.

## Color tokens

_Held by: review._

Never hardcode hex/rgba in widgets. Use semantic tokens from `_widget-tokens.scss`. The `$race-*` palette follows Tailwind 500/600. JS-side canvas colors live in the widget manifests, `widgets/g-meter/g-meter-utils.ts`, `shared/lib/weather-utils.ts` and `shared/lib/colors.ts` — same palette hexes.

## Numbers must not shuffle

_Held by: review._

**A number that changes while the driver is looking at it must not move the
glyphs around it.** A delta, a lap clock, a speed, a G reading, a gap — every
live readout keeps each digit in a cell of the same width, so only the digit
changes and nothing beside it shifts. A value the driver reads at the apex is
read by shape as much as by content, and text that dances is read twice.

`font-variant-numeric: tabular-nums` does **not** solve this here: `$font-widget`
is Rajdhani, which ships no tabular figures, so the browser has nothing to switch
to and silently keeps the proportional ones. Use one of the two grids instead:

| where  | use                                                               |
| ------ | ----------------------------------------------------------------- |
| DOM    | `FixedDigits` (`shared/ui/FixedDigits/`) — digits in cells        |
| canvas | `fillFixedDigits` / `measureFixedDigits` (`shared/lib/canvas.ts`) |

Two things follow from it. Measure the block with `measureFixedDigits`, never
`measureText`, or an arc or plate sized from the text breathes with the value
even though the glyphs hold still. And keep the **string length** fixed too — a
`toFixed(2)` that becomes `toFixed(1)` past a threshold, or a sign that appears
only when negative, re-centres the whole readout; pad the slot instead.

Fixed cells are for values that move. A static label, a class badge or a heading
is set normally.

---

## `ws()` scaling

_Held by: review._

`WidgetContainer` sets `--wfs = currentWidth / designWidth`. All sizing scales proportionally.

```scss
ws($px)     // raw geometry: grid columns, canvas/SVG sizes, icon sizes
fs($step)   // font — xxxs(10) xxs(11) xs(12) sm(13) md(15) lg(18) xl(22) xxl(28) xxxl(32)
sp($step)   // spacing (2px grid) — xxxs(2) xxs(4) xs(6) sm(8) md(10) lg(12) xl(16) xxl(20)
radius($step) // sm(3) md(4) lg(6)
wfs($px)    // font size off the scale — ws() × --font-scale, like fs()
plate($color) // a plate the widget paints itself, faded by its background opacity
```

Use `fs()`/`sp()`/`radius()` for typography/spacing/radius; `ws()` only for layout geometry not on a scale; `wfs()` for a font size the scale lacks — never `ws()` for a font, it ignores the user's font scale. Never use `rem` (doesn't scale), `vw`/`vh` (= screen size in overlay), or `ws()` for borders (always plain `px`).

For **toggleable-column widgets** (Standings, Relative): `designWidth` tracks the visible column set via `colSpecs` in `*-utils.ts`. `makeColumnLayoutResolver` in `src/widgets/widget-manifest.ts` keeps `--wfs` constant while the widget resizes.

A `designWidth` a widget's own settings can compute — a column set, or an
orientation switch with one width each — needs **both** manifest fields:
`resolveLayoutChange` rescales `currentWidth` on the toggle, `deriveDesignWidth`
recomputes the width on every install (file load, layout switch, cross-window
sync). The stored width is a cache, and with only the resolver it drifts: the
widget renders at the wrong `--wfs` and crops, and each further toggle reads that
ratio back as `scale` and grows `currentWidth` again.

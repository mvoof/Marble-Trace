# Widget design guide

How a widget uses color and type. The values live in
`src/styles/_widget-tokens.scss` and `src/shared/ui/StatChip/`; this page says
**when** to use which. [colors.html](colors.html) shows every color named here —
open it in a browser.

_Held by: review._

---

## The one rule

**Color names the kind of thing; brightness says how much it matters right
now.** A widget is mostly quiet. Bright color is spent on the one figure the
driver must find without reading, and full fills on the rare call to act.

Three levels, quietest first:

| level      | how it is drawn                                      | `StatChip` look              | share of a widget    |
| ---------- | ---------------------------------------------------- | ---------------------------- | -------------------- |
| **Quiet**  | light text on a deep shade of the color              | `reading`, `state`           | almost everything    |
| **Bright** | the text itself in the color, on a dark ground of it | `plain` (lead alone), `mark` | one per row or block |
| **Vivid**  | the full color as a fill, dark or white text on it   | `vivid`                      | one per widget, rare |

---

## Quiet — the default

A deep shade of the tone (the tone's fill at 40 % over the chip ground) with
the label in `$chip-text` at weight 500. The color tells the driver what family
the chip belongs to; the text carries the content.

Use it for:

- **a label beside its value** — `SOF 2.4k`, `LAPS 12/30`, `AIR 24°`, `BEST 1:32.415`, `PRED`, `EST`;
- **a status** — `PIT`, `IN`, `OUT`, `TOW`, `DNF`, `RUN`, `INV`, `LIVE`;
- **a widget's or a block's name** — `RACE`, `FUEL`, `PIT WINDOW`, the lap a sector counts (`state`: unframed);
- **a figure that repeats down a column** — each lap's delta in Lap Log, the SR change. A column of bright chips is a column of alarms; the tone alone already says gain or loss.

A quiet chip never needs its text colored. If the value beside the label has to
warn, color the value (`valueDanger`), not the label.

## Bright — the figure that stands out

The figure written in the tone's own color, on the tone's dark ground, framed
in it. Nothing else in its row or block is bright.

Use it for:

- **a record** — the class best lap (purple), a personal best (green frame);
- **a place in the order** — `LEADER`, laps down;
- **the widget's headline reading, colored by urgency** — LAPS LEFT in Fuel (green → yellow → red), spare fuel or a shortfall, a consumption above or below the average;
- **an order that is set** — `FAST REP` once ordered (`mark`).

Before making something bright, ask: _would the driver look for this figure
first?_ If two things in the same block answer yes, one of them is wrong.

## Vivid — a call or a color that is the data

The full color as a fill.

Use it only for:

- **a call to act now** — `PIT NOW`, `TOW TIME`;
- **a color that is itself the reading** — a license class, a flag, a car class.

Never for a label, a status or a heading, however important the widget.

---

## What each tone means

One meaning per tone, in every widget. A tone is never picked because it looks
good beside its neighbours.

| tone       | color       | means                                                                                    | never                                      |
| ---------- | ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| `positive` | green       | a gain, a margin, faster than the reference; the running lap                             | decoration                                 |
| `accent`   | yellow      | worth a look, no judgement: the leader, SOF, a small loss, a warning one step before red | a loss past the threshold                  |
| `danger`   | red         | a loss, a limit about to be crossed, a stop, an invalid lap                              | a plain count that is not close to a limit |
| `info`     | blue        | a neutral fact: the field size, track temperature, pit entry                             | good or bad news                           |
| `special`  | purple      | **the best lap, and nothing else**                                                       | any other highlight                        |
| `lapped`   | amber-brown | a lap down, a tow — out of the fight                                                     | a warning                                  |
| `neutral`  | light grey  | a value with nothing to say about it                                                     |                                            |
| `muted`    | grey        | inactive, ended, not set, not applicable                                                 | a live reading                             |
| `license*` | A B C D R   | the license class                                                                        | anything that is not a license             |

Green and red are always a pair around a reference — a delta, a margin, a
limit. Yellow sits between them, never beside purple as a second "best".

---

## Text

| role                                | face                      | size                        | weight  | color                                  |
| ----------------------------------- | ------------------------- | --------------------------- | ------- | -------------------------------------- |
| value — the figure the driver reads | `$font-mono`              | `fs(xxs)`, `fs(sm)` in rows | 800     | `$widget-text-primary`                 |
| quiet chip label                    | `$font-widget`, uppercase | `fs(xxxs)`                  | 500     | `$chip-text`                           |
| bright chip figure                  | `$font-mono`              | `fs(xxs)`                   | 700     | the tone's color                       |
| vivid chip label                    | `$font-widget`, uppercase | `fs(xxxs)`                  | 800     | the tone's on-fill color               |
| caption, column head                | `$font-mono`              | `wfs(9)`–`fs(xxxs)`         | 600–700 | `$chip-text-muted`, `$table-head-text` |
| supporting figure — a limit, a unit | `$font-mono`              | a step under its value      | 600     | `$chip-text-muted`                     |
| nothing to show                     | `$font-mono`              | as the value it replaces    | —       | `$table-empty-text`                    |

- **White is the value.** The primary figure of a row is white and the heaviest
  thing in it; a color on it is an event (a best lap turns purple, a personal
  best green).
- Words in `$font-widget`, figures in `$font-mono`; a live figure through
  `FixedDigits` ([frontend-style.md → Numbers must not shuffle](../rules/frontend-style.md#numbers-must-not-shuffle)).
- Three steps of emphasis are enough: value, label, caption. A fourth is a sign
  the block holds too much.

---

## Grounds

Color on a ground follows the same scale as chips: the larger the area, the
fainter the color.

| area                          | strength                   | example                                    |
| ----------------------------- | -------------------------- | ------------------------------------------ |
| a whole widget or block       | 5–8 % of the color         | the pit window block, an invalid lap's row |
| a row that is special         | 16–32 %                    | the best lap's row, the lap being driven   |
| a chip, quiet                 | 40 % over `$chip-bg`       | every `reading` / `state` chip             |
| a chip, bright                | the tone's own `-bg` token | the class best lap                         |
| a bar or a fill that measures | the full color             | the tank bar, a pace-loss bar at 25 %      |

Table grounds (`$table-*`) are shades of black and white laid over the widget's
background, never a color of their own, so the background the user picked
carries through.

---

## In code

- Pick a `tone` and a `look` on `StatChip`; never restyle a chip in a widget's
  SCSS. Sizes and paddings go through the chip's variables
  (`--chip-lead-size`, `--chip-value-text`, …).
- A color outside a chip comes from the same `$chip-*` tokens, so a figure and
  the chip beside it are one green.
- No hex in a widget. A missing tone is added to `_widget-tokens.scss`, to
  `StatChip`, to the table above and to `colors.html` together.
- `$race-*` (the Tailwind 500 band) is for graphics — traces, gauges, maps,
  canvas — where a line has to carry on its own. Text and chips in the timing
  widgets use `$chip-*`.
- `$led-*` and `$flag-band-*` imitate real marshalling lights and stay fully
  saturated; they are not UI accents and are used nowhere else.

## Checklist for a new widget

1. Is every label and status quiet?
2. Is there at most one bright figure per row or block — and is it the one the
   driver looks for first?
3. Is anything vivid? Then it is a call to act or a license / flag / class color.
4. Does each tone mean what the table says?
5. Is the main value white, mono, weight 800?

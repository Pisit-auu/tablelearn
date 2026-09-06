---
name: TableLearn
description: A KMUTNB registration planner that wears the registrar console's own theme — white cards on #f8f8f8, one teal working colour, one red reserved for a time clash.
colors:
  primary: "#00aa9f"
  primary-hover: "#009187"
  primary-deep: "#00776f"
  primary-tint: "rgba(0, 170, 159, 0.12)"
  primary-tint-strong: "rgba(0, 170, 159, 0.2)"
  ground: "#f8f8f8"
  surface: "#ffffff"
  surface-sunk: "#fafafc"
  heading: "#5e5873"
  ink: "#6e6b7b"
  ink-quiet: "#71757c"
  muted: "#b9b9c3"
  disabled: "#a8a6b3"
  disabled-ground: "#f1f1f4"
  line: "#ebe9f1"
  line-soft: "#f2f0f7"
  field-line: "#d8d6de"
  danger: "#ea5455"
  danger-deep: "#c33e3f"
  danger-tint: "rgba(234, 84, 85, 0.12)"
  danger-line: "#f5b4b5"
  danger-field: "#fdeced"
  destructive-line: "#e0c6c7"
  destructive-line-hover: "#d3adae"
  warning: "#ff9f43"
  warning-deep: "#cf7a26"
  warning-tint: "rgba(255, 159, 67, 0.14)"
  band: "#fcfcfd"
  scroll-thumb: "#cfcdd8"
  pigment-teal: "#0a7d75"
  pigment-violet: "#5847c7"
  pigment-blue: "#0f6f96"
  pigment-green: "#1c7d47"
  pigment-amber: "#a35c12"
  pigment-slate: "#4f5b6b"
  pigment-purple: "#7b3fa0"
typography:
  display:
    fontFamily: "Montserrat, Prompt, Segoe UI, sans-serif"
    fontSize: "clamp(26px, 3vw, 34px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.16em"
  wordmark:
    fontFamily: "Montserrat, Prompt, Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Prompt, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "clamp(19px, 1.4vw, 22px)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  dialog-title:
    fontFamily: "Prompt, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  metric:
    fontFamily: "Montserrat, Prompt, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
  score:
    fontFamily: "Montserrat, Prompt, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
  title:
    fontFamily: "Prompt, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Prompt, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-dense:
    fontFamily: "Prompt, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  control:
    fontFamily: "Prompt, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
  label:
    fontFamily: "Prompt, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  numeral:
    fontFamily: "Montserrat, Prompt, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
    fontFeature: "tabular-nums"
  micro:
    fontFamily: "Prompt, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  unit:
    fontFamily: "Prompt, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  unit-floor:
    fontFamily: "Montserrat, Prompt, Segoe UI, sans-serif"
    fontSize: "9.5px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  ring: "2px"
  check: "3px"
  pill: "4px"
  ctl: "5px"
  card: "6px"
  scroll: "8px"
  status: "20px"
  circle: "50%"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  gap: "20px"
  gap-dense: "14px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.control}"
    rounded: "{rounded.ctl}"
    padding: "9px 16px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#ffffff"
  button-primary-active:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.control}"
    rounded: "{rounded.ctl}"
    padding: "9px 16px"
    height: "38px"
  button-line-hover:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary}"
  button-quiet:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.ctl}"
    padding: "6px 12px"
    height: "32px"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.danger-deep}"
    typography: "{typography.control}"
    rounded: "{rounded.ctl}"
    padding: "9px 16px"
    height: "38px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink-quiet}"
    rounded: "{rounded.circle}"
    width: "36px"
    height: "36px"
  button-disabled:
    backgroundColor: "{colors.disabled-ground}"
    textColor: "{colors.disabled}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-dense}"
    rounded: "{rounded.ctl}"
    padding: "6px 14px"
    height: "38px"
  nav-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-dense}"
    rounded: "{rounded.pill}"
    padding: "10px 12px"
  nav-tab-active:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "10px 12px"
  zone-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "22px 24px 24px"
  course-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "15px 16px 13px"
  class-block:
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "9px 11px 9px 13px"
    height: "130px"
  class-block-clash:
    backgroundColor: "{colors.danger-field}"
    textColor: "{colors.ink}"
  day-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-quiet}"
    rounded: "{rounded.ctl}"
    padding: "0 8px"
    height: "34px"
  day-chip-on:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
  tag-clash:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger}"
    rounded: "{rounded.status}"
    padding: "2px 9px"
  alert-clash:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-deep}"
    typography: "{typography.body-dense}"
    rounded: "{rounded.ctl}"
    padding: "11px 14px"
---

# Design System: TableLearn

## Overview

**Creative North Star: "The Registrar's Desk"**

TableLearn wears the KMUTNB registrar console's own theme. A student plans their week in one browser tab and checks section seats at `reg.kmutnb.ac.th` in the next; the two tabs are meant to feel like the same desk. This is not a mood board interpretation of that system — the palette, radii, shadows, control metrics, and the active-nav gradient were read off the registrar's live stylesheet (a Vision Net / Vuexy admin theme) and reproduced, because the user pinned that system as the standard rather than as a one-time decision.

Continuity is the whole point; impersonation is forbidden. The system may look like the registrar's desk and may never claim to be it: no university mark, no crest, no claim of affiliation or endorsement, and the footer disclaimer stays on the page and on every exported sheet. Everything the product asserts about itself must be true of a planning tool that reads public course data.

The world is a light administrative console, not a calendar app. A near-white ground (`#f8f8f8`) holds white cards with a 6px radius under one diffuse shadow. Teal `#00aa9f` is the only colour that means *you can act here*; it appears as a solid fill on primary buttons, as a 12% tint behind quiet controls and status pills, and as a 118° gradient pill with a matching glow behind the active nav item. Text runs purple-grey — `#5e5873` headings over `#6e6b7b` body — never black. Type is Prompt for Thai and Montserrat for numerals; icons are Feather-weight 2px strokes. Two more colours exist and mean exactly one thing each: red `#ea5455` is a time clash, amber `#ff9f43` is exam risk. It refuses the dark industrial world it replaced, and it refuses the pastel, heavily rounded calendar app.

The system has **two surfaces**, not one. The screen is the first. The second is the 2× PNG the student exports and posts to a group chat, painted onto a canvas by `exportTimetableImage` in `app/page.tsx` — same palette, same type roles, same block anatomy, same disclaimer. It is a surface of this design system, not an output format.

**Key Characteristics:**
- Near-white ground, white cards, one diffuse shadow — depth by shadow, never by border weight.
- Exactly one working colour (teal), one clash colour (red), one risk colour (amber).
- A course's colour is user data with a passport: the same pigment on every surface.
- Purple-grey ink ladder; pure black and pure grey text do not appear.
- Thai-first typography that never tracks and never shouts in uppercase.
- 6px cards / 5px controls: tight, administrative geometry.
- Dense but never cramped — 13.5px is the workhorse size, 38px the control height.

## Colors

A light registrar console: one saturated teal doing all the work over a purple-grey neutral ladder, with two single-purpose status hues held in reserve.

### Primary
- **Registrar Teal** (`#00aa9f`): the only working colour. Solid on primary buttons, day-number circles, chips in their on state, checkbox fills, focus outlines, links, and every numeric readout that is a *result*. Its darker hover (`#009187`) and pressed (`#00776f`) steps are the only other teals on a control.
- **Teal Tint** (12% alpha) and **Teal Tint Strong** (20% alpha): the quiet register of the same colour. Backgrounds for status pills, plan-score discs, tags, quiet buttons, agenda gap notes, and the live shared-room panel. `--primary-deep` is the text colour on any tinted field, never `--primary` itself.
- **Teal Gradient** (`linear-gradient(118deg, #00aa9f, rgba(0,170,159,0.7))`) with **Teal Glow** (`0 0 10px 1px rgba(0,170,159,0.55)`): reserved for exactly two elements — the brand glyph and the active desktop nav pill. This pair is the registrar theme's signature; using it anywhere else spends it.

### Tertiary — course pigments
Seven hues assigned to courses in rotation, each darkened until it clears 4.5:1 on white so a course code stays readable at 12.5px: **Pigment Teal** (`#0a7d75`), **Violet** (`#5847c7`), **Blue** (`#0f6f96`), **Green** (`#1c7d47`), **Amber** (`#a35c12`), **Slate** (`#4f5b6b`), **Purple** (`#7b3fa0`). The set deliberately contains no red and no orange: those families belong to clash and exam risk. A pigment is user data — the student can change it — so the system owns the set, not the assignment.

### Neutral
- **Ground** (`#f8f8f8`): the page behind every card. The only background at page level.
- **Surface** (`#ffffff`): cards, zones, blocks, the rail, dialogs, and the exported sheet.
- **Sunk Surface** (`#fafafc`): a panel *inside* a card — benches, agenda cards, the grid's header row and time column, exam and free-time rows, empty states. It marks "this is nested", not "this is dimmer".
- **Heading** (`#5e5873`): every heading, every course name, every hard number.
- **Ink** (`#6e6b7b`, 5.18:1 on white): body text and default control labels.
- **Quiet Ink** (`#71757c`, 4.63:1 on white): metadata, hints, table headers, placeholders, times inside a block. The floor of the text ladder.
- **Muted** (`#b9b9c3`): decoration only — scrollbar thumb hover and hairline furniture.
- **Line** (`#ebe9f1`) / **Soft Line** (`#f2f0f7`) / **Field Line** (`#d8d6de`): card dividers and grid lines; the inner hour rules of the week; input and dashed-outline borders respectively.
- **Band** (`#fcfcfd`): the alternating hour column in the week grid and in the exported sheet. It is a rhythm, not a surface.
- **Scroll Thumb** (`#cfcdd8`): browser chrome only — the custom scrollbar thumb, sitting between `--line` and `--muted` so a scrollbar reads on both white and sunk surfaces. It hovers to `--muted`. It never touches content.

### States
- **Clash Red** (`#ea5455`) with **Clash Field** (`#fdeced`), 12% tint, and line (`#f5b4b5`): a time clash, and nothing else.
- **Deep Red** (`#c33e3f`): text weight for red — alert copy, destructive control labels, clash table headings.
- **Destructive Line** (`#e0c6c7`) and its hover (`#d3adae`): a muted, desaturated red-grey pair used only as the border of a destructive button, over white or a `#faf1f1` wash. This is what lets "delete" read as destructive without borrowing the clash field — the desaturation is the whole point, and neither value may be used as a fill or as text.
- **Exam Amber** (`#ff9f43`) with its 14% tint and **Deep Amber** (`#cf7a26`) for text: exam risk and the shared-room version conflict.

### Named Rules
**The One Working Colour Rule.** Teal is the only colour that means *you can act here*. If an element is not actionable, not a live result, and not the active location, it is not teal.

**The Reserved Red Rule.** `#ea5455` is a time clash. Destructive controls wear `--danger-deep` (`#c33e3f`) on a pale outline over white — never a red field, never the clash tint. If a delete button and a clash badge look alike, the clash has stopped being legible.

**The Pigment Passport Rule.** A course's colour is user data and keeps one identity on every surface — the week grid, the saved-course card, the day agenda, the compare diff, the exam list, and the exported PNG. It appears as a 9% tinted field with a 26% border on the week grid, and as an 8px round dot beside the course code everywhere else. It is never a thick edge stripe on any side.

**The Muted-Is-Not-Ink Rule.** `--muted` (`#b9b9c3`) draws rules and decoration. Text stops at `--ink-quiet` (`#71757c`). No copy, label, or hint is ever set in `--muted` or lighter.

**The Never-Colour-Alone Rule.** A clash is a red field *plus* a red border *plus* the word `ชนกัน` on a pill — on screen and in the raster. Exam risk is an amber field *plus* the warning icon *plus* the sentence. Colour never carries a state by itself.

## Typography

**Display / Numeral Font:** Montserrat (500/600/700, with Prompt and Segoe UI as fallbacks)
**Body Font:** Prompt (300–700, with Leelawadee UI and Segoe UI as fallbacks)

**Character:** Prompt is a Thai/Latin humanist sans that keeps Thai clusters open at 13px on a phone; Montserrat is used only where digits are compared — times, credits, scores, codes, room codes — always with `font-variant-numeric: tabular-nums` so a column of numbers doesn't shift as it updates. The pairing reads as an administrative form that respects Thai as the primary language rather than as an afterthought.

### Hierarchy
- **Display** (Montserrat 700, `clamp(26px, 3vw, 34px)`, 1.1, `0.16em`): one use only — the shared-room code, spaced so it can be read aloud or copied off a phone screen.
- **Wordmark** (Montserrat 700, 21px, 1.1, `-0.01em`): the brand name in the rail, dropping to 19px under 900px. Its Thai subtitle sits under it at 12px in quiet ink.
- **Headline** (Prompt 600, `clamp(19px, 1.4vw, 22px)`, 1.3, heading colour): zone titles. One `h1` (the week), the rest `h2`.
- **Dialog title** (Prompt 600, 17px): the head of a modal, above a 13px quiet-ink description.
- **Metric** (Montserrat 600, 18px, 1.1, tabular): the plan readout's numerals in the rail — the largest number on the page and the one a student reads first.
- **Score** (Montserrat 700, 17px, 1, tabular): the number inside a plan-score disc, with its 9.5px unit under it.
- **Title** (Prompt 600, 15px): footer heading and plan readout (15px), sub-headings inside a zone (14px). Always heading colour.
- **Body** (Prompt 400, 15px, 1.55): the document default set on `<body>`.
- **Body-dense** (Prompt 400, 13.5px, 1.6): the real workhorse — zone descriptions, alerts, card metadata, hints. Zone prose caps at `70ch`.
- **Control** (Prompt 500, 13.5px, 1.2): every button, toggle, and chip label.
- **Label** (Prompt 500, 12–12.5px, quiet ink): field labels, table headers, metadata keys, the mobile dock's tab names. Sentence case, always.
- **Numeral** (Montserrat 600, 12.5–18px, tabular): times, credits, hour headers, plan scores, measures, compare figures, course codes.
- **Micro** (Prompt 500, 11.5px): the two status pills that carry a word rather than a number — `tag`/`tag-lock`/`tag-clash` and the shared-room section badge.
- **Unit** (Prompt 400, 11px): the floor tier — see the rule below.
- **Unit floor** (Montserrat 500, 9.5px): the single smallest step, the unit label under a plan score.

### Named Rules

**The Unit-Suffix Floor Rule.** Nothing below 12px is ever body copy, a standalone label, or a link. The tier exists for exactly four jobs, and each is legible because of what it sits against: a unit suffix attached to a numeral it belongs to (`หน่วยกิต`, `ชม.`, `วิชา` at 11px beside an 18px, 15px or 13px number; 9.5px under a 17px score); white-on-solid-`#ea5455` pill text (the 11px `ชนกัน` badge, where the field carries the contrast); the 11px labels in the mobile dock, each under its own 20px icon; and the 11.5px word pills. A fifth use is a new size, not a new instance.
**The Thai-Never-Tracks Rule.** Thai text takes no `letter-spacing` and no `text-transform: uppercase` — both break cluster rendering and neither is a Thai typographic convention. Tracking exists only on Latin and numeral runs: the room code (`0.16em`), a room label pill (`0.08em`), a course code (`0.01em`), the wordmark (`-0.01em`).

**The Two-Face Rule.** If the value is a number the student compares — a time, a credit count, a score, a code — it is Montserrat with tabular figures. Everything else is Prompt. A number set in Prompt inside a comparison column is a bug.

**The Heading-Is-Purple Rule.** Headings and hard values take `#5e5873`; supporting copy takes `#6e6b7b`; metadata takes `#71757c`. Weight, not colour, separates a heading from its body — the ladder never reaches black.

## Layout

**Page shell.** A CSS grid of `260px minmax(0, 1fr)` with a `20px` gap and `20px` page padding: a sticky white menu rail beside a single content column. The rail narrows to `232px` under 1180px. Under 900px the shell becomes a block: the rail's brand and plan readout sit at the top of the page, and its nav detaches into a fixed bottom dock (`padding-bottom: env(safe-area-inset-bottom)`), with the content column reserving `78px` for it.

**Content column.** A vertical stack of white "zones" at the same `20px` rhythm, each `22px 24px 24px` of padding, each with a `zone-head` grid of `title/description | actions`. Two zones can pair into a row via `repeat(auto-fit, minmax(min(340px, 100%), 1fr))`. Inside a zone, panels sit on `--surface-sunk` at `14px` gaps; cards, benches and diff blocks use `auto-fill`/`auto-fit` tracks at 280–340px.

**Spacing rhythm.** `20px` between zones (`14px` under 900px, via `--gap`), `14px` between cards in a grid, `12px` between fields, `8px` between buttons in a group, `6px` between hairline items. Controls are `38px` tall (`32px` for quiet, `34px` for chips), rising to `42–44px` under 900px so they stay thumb-sized.

**The week grid.** `88px` time gutter plus `repeat(14, minmax(66px, 1fr))` for 07:00–20:00, `min-width: 1030px`, 1px gaps rendered as `--line` showing through the grid's own background. Each day is one full-width timeline row with absolutely positioned 130px blocks packed into lanes, so overlapping classes stack instead of painting over each other. It fits without horizontal scrolling at 1440px; below that it scrolls inside `.grid-scroll`, never taking the page with it. Mobile defaults to the day-agenda list instead.

**Breakpoints:** 1180px (rail narrows), 900px (dock, folds, full-screen dialogs, larger touch targets), 560px (every multi-column grid collapses to one).

### Named Rules
**The Shrinkable Track Rule.** Every `auto-fit`/`auto-fill` track is written `repeat(auto-fit, minmax(min(Npx, 100%), 1fr))`. The bare `minmax(Npx, 1fr)` form cannot shrink below N and overflows a 320px phone.

**The One Exception Rule.** `.timetable` is the single deliberate violation: `repeat(14, minmax(66px, 1fr))` with `min-width: 1030px`. A week compressed to fit a phone stops being readable, so the week scrolls inside its own container instead. No other component may claim this exception.

**The Fold-Below-900 Rule.** Under 900px every zone except the week folds by default — `data-folded="true"` plus a round chevron disclosure button pinned to the zone's top-right, with the zone reserving `52px` of right padding for it. The bottom dock unfolds the zone it links to. This is what keeps the phone's first load near 3,600 CSS px instead of 9,700.

## Elevation & Depth

Depth is carried by three diffuse shadows in a purple-grey ink (`rgba(34, 41, 47, …)`), never by border weight and never by a hard offset. A card is white on near-white; the shadow is the only thing separating them, which is why the ground can never be white.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 4px 24px rgba(34, 41, 47, 0.1)`): a page-level surface — the rail, every zone, the footer note. One value, used everywhere at that level.
- **Soft** (`box-shadow: 0 2px 8px rgba(34, 41, 47, 0.07)`): a thing *inside* a surface — class blocks, course cards, the selected segment of the view toggle.
- **Pop** (`box-shadow: 0 10px 34px rgba(34, 41, 47, 0.16)`): the dialog only.
- **Teal Glow** (`box-shadow: 0 0 10px 1px rgba(0, 170, 159, 0.55)`): the brand glyph and the active desktop nav pill only.
- **Primary lift** (`box-shadow: 0 6px 16px rgba(0, 170, 159, 0.36)`): a hovered primary button, removed again on `:active`.
- **Field focus** (`box-shadow: 0 3px 10px 0 rgba(34, 41, 47, 0.1)` with a teal border): an input under the cursor's attention — a lift, not a ring.
- Two edge shadows exist for detached bars: `0 2px 12px rgba(34,41,47,0.08)` on the mobile top rail and `0 -4px 20px rgba(34,41,47,0.08)` on the bottom dock.

### Named Rules
**The Level-Not-Loudness Rule.** A shadow states which level a thing lives on: page surface → Card, nested object → Soft, modal → Pop. It never states importance, and it never appears on hover for an element that has no elevation at rest.

**The Sunk-Instead-Of-Shadow Rule.** Inside a card, nesting is shown by `--surface-sunk` plus a 1px `--line` border, not by another shadow. Two stacked shadows inside one card is the failure mode this rule exists to prevent.

## Shapes

Tight administrative geometry. Rectangles carry one of three radii: `6px` for anything card-shaped (zones, cards, panels, dialogs, the grid, the brand glyph), `5px` for anything control-shaped (buttons, inputs, chips, blocks, alerts, rows), `4px` for the nav pill. Nothing on a rectangle goes above 6px — a larger radius reads as a consumer calendar app and is out of world.

Below the control tier sits a **chrome tier** for objects smaller than a control, sized to the object rather than to the ladder: `3px` on the 18px checkbox and on the inner pill of the view toggle, `2px` on the global `:focus-visible` ring so it hugs a small target without reading as a lozenge, and `8px` on the 10px scrollbar thumb (drawn with a 3px transparent border and `background-clip: padding-box`, which is what makes a 10px track render as a 4px thumb). These are chrome, not surfaces, and they do not extend the card/control ladder.

Full rounding is reserved for two shapes that are not rectangles: `20px`/`999`-style **status pills** (tags, the `ชนกัน` badge, free-time durations, section badges) and **circles** (`50%`) for day numbers, plan-score discs, icon buttons, and the fold chevron.

Borders are 1px and hairline-coloured: `--line` for structure, `--field-line` for a control's own edge, and a **1px dashed `--field-line`** for a container that is empty or not yet live — empty states, free-day notes, the shared-room panel before a room exists. The dash going solid teal is how "this is now live" is shown.

Icons are a single hand-drawn Feather-weight set: `24` viewBox, `fill: none`, `stroke: currentColor`, `stroke-width: 2`, round caps and joins, rendered at 12/14/17/18/20/22px and always `aria-hidden`. They inherit their colour from the text beside them.

### Named Rules
**The Three-Radius Rule.** Anything card- or control-shaped takes one of exactly three radii: 6px card, 5px control, 4px nav pill. A fourth radius *in that range* is a drift, not a decision. The chrome tier (3px / 2px / 8px) and the pill and circle are outside the ladder, chosen by what the element *is*, not by how large its container is.

## Components

### Buttons
- **Shape:** control radius (5px), 38px tall, `9px 16px`, 8px gap to a 17px icon, `0.16s ease` on colour and shadow.
- **Primary:** solid teal on white text; hover deepens to `#009187` and lifts on a teal shadow; `:active` presses to `#00776f` and drops the shadow.
- **Line (secondary):** teal text on a teal 1px border over transparent; hover fills with the 12% tint. Its `is-on` state inverts to solid teal — this is how a toggle button shows it is engaged.
- **Quiet:** teal on a 12% tint field, 32px tall at 12.5px — for in-card actions that shouldn't compete with the zone's primary.
- **Destructive:** deep red text (`#c33e3f`) on a muted red-grey border (`#e0c6c7`); hover washes the field to `#faf1f1` and deepens the border to `#d3adae`. Never a red field.
- **Icon:** 36px circle, quiet ink, hover darkens to heading colour on a light grey wash.
- **Disabled:** flat `--disabled-ground` field with `--disabled` text, no shadow, `cursor: not-allowed`. Outline variants keep a transparent field and drop to a `--line` border instead.
- **Focus:** the global `:focus-visible` — 2px solid teal, 2px offset. Never removed.

### Chips
- **Day chip** (planner constraints): a 34px-tall, 38px-min-width control-radius box, quiet ink on white with a `--field-line` border. Hover turns border and text teal; checked inverts to solid teal on white. The real `<input>` is visually hidden but still receives focus, which draws the same 2px teal outline on the box.
- **Status pill / tag:** `2px 9px` at 11.5px on a 20px radius. Only two exist — `tag-lock` (teal on 12% tint) and `tag-clash` (red on 12% red tint) — each always paired with its icon or word.

### Cards / Containers
- **Zone:** white, 6px, Card shadow, `22px 24px 24px`. The unit of the content column; carries an `h1`/`h2`, an optional description capped at 70ch, and right-aligned actions.
- **Course card:** white, 6px, `--line` border, Soft shadow; header row of pigment-dotted code plus tags, then the course name at 14.5px, then a two-column definition list of metadata at 12/13px, then a footer of equal-width tinted action buttons above a `--line` rule. In a clash it turns to the red tint with a `--danger-line` border, and its footer buttons switch to white fields with an inset red hairline so they stay legible on the tint.
- **Bench / agenda / sunk panel:** `--surface-sunk`, 6px, 1px `--line`, `14–18px` padding. The nested level.
- **Empty state:** sunk field, 1px dashed `--field-line`, 20px of padding, quiet ink at 13.5px.

### Inputs / Fields
- **Style:** 38px tall, white, 1px `--field-line`, 5px radius, `6px 14px`, 14px Prompt. Label above at 13px/500 in heading colour, hint below at 13px in quiet ink.
- **Hover:** border darkens to `#c3c1cd`. **Focus:** border turns teal and the field lifts on the field-focus shadow; the native outline is removed only because that pair replaces it.
- **Select:** native chevron suppressed, replaced by an inline 18px Feather chevron data-URI at `right 11px center` with `36px` of right padding.
- **Checkbox:** an 18px custom box (3px radius) beside a visually hidden input; checked fills teal and fades in a white check data-URI over `0.12s`.
- **Disabled:** `#f4f4f7` field, quiet ink, `not-allowed`.

### Navigation
- **Desktop rail:** a sticky white card holding the brand lockup (a 40px teal-gradient glyph with the glow, beside the Montserrat wordmark and its Thai subtitle) above a `--line` rule, a full-width primary CTA, seven zone links, and a live plan readout.
- **Tab states:** rest is 14px `--ink` with quiet-ink 18px icon; hover washes `#f6f6f9` and darkens the label; **active** is the signature — white text and icon on the 118° teal gradient with the teal glow, at weight 500. Exactly one tab is active, driven by an IntersectionObserver over the zones.
- **Mobile dock (<900px):** the same list, fixed to the bottom, one tab per zone, icon over an abbreviated label at 11px. The active tab drops the gradient and glow for teal-on-12%-tint — a glowing gradient at 60px wide reads as an error, and the dock sits over content where a glow would smear.

### Signature: the class block
The one component that carries the product's whole promise. Absolutely positioned in its day's timeline, 130px tall, control radius, Soft shadow, and a field of `color-mix(in srgb, var(--course) 9%, #ffffff)` inside a 26% border of the same pigment. Inside: the course code in Montserrat 600 at the full pigment, the name at 13px/500 heading colour clamped to two lines, then the time in tabular Montserrat beside the room, both in quiet ink. It enters on `block-in` — 4px rise and fade over `0.32s cubic-bezier(0.16, 1, 0.3, 1)`.

In a clash it becomes the flat clash field `#fdeced` with a full `--danger` border, and the code line gains a white-on-red `ชนกัน` pill. Overlapping classes are packed into lanes and stacked, never overprinted, so the block layout itself tells the truth about the clash.

### Signature: the exported sheet
`exportTimetableImage` repaints this same system onto a 2× canvas: white ground, the plan name at 27px/600 heading colour over a quiet-ink summary line and a `--line` rule; the grid with a `--surface-sunk` header row and day column, `#fcfcfd` alternating hour bands, `--line` row rules and `--line-soft` hour rules; the same lane packing; blocks at 5px radius with the same 9% field, 26% border, `rgba(34,41,47,0.1)` shadow, pigment code, heading-colour name, quiet-ink teacher/time/room; the same red field, red border and `ชนกัน` pill for a clash; and the two-line disclaimer at the foot. Fonts are read live off `<body>` so the raster uses the same Prompt and Montserrat faces.

### Named Rules
**The Two-Surface Rule.** The screen and the exported PNG are two surfaces of one system. Any change to a token, a type role, or the block's anatomy must be made in both `app/globals.css` and `exportTimetableImage`. A raster that disagrees with the screen is a broken build, not a stale export.

**The Provenance Rule.** Every shipping raster carries the disclaimer: this is a planning tool, not a university system, and the course data comes from reg.kmutnb.ac.th. The sheet travels through group chats without the page around it, so it has to say what it is on its own.

## Do's and Don'ts

### Do:
- **Do** keep teal as the only working colour: action, active location, live result. Everything else is the neutral ladder.
- **Do** state every state in words as well as colour — `ชนกัน` on the clash pill, the sentence in the amber alert.
- **Do** give a course pigment the same identity on every surface: a 9% field on the week grid, an 8px dot beside the code everywhere else, including the PNG.
- **Do** set numbers a student compares in Montserrat with `font-variant-numeric: tabular-nums`.
- **Do** write every `auto-fit`/`auto-fill` track as `minmax(min(Npx, 100%), 1fr)`.
- **Do** nest with `--surface-sunk` plus a 1px `--line`, and keep the shadow for the level above.
- **Do** raise controls to 42–44px under 900px and fold every zone but the week by default.
- **Do** honour `prefers-reduced-motion` — the global rule collapses every animation and transition to `0.001ms`, so any new motion must be a `transition`/`animation`, not a JS tween.
- **Do** keep the disclaimer and the reg.kmutnb.ac.th attribution on the page and in every export.

### Don't:
- **Don't** put `letter-spacing` or `text-transform: uppercase` on Thai text. Tracking belongs to Latin codes and numerals only.
- **Don't** set text in `--muted` (`#b9b9c3`) or lighter. The ladder ends at `--ink-quiet`.
- **Don't** use red for anything but a time clash, or amber for anything but exam risk. A destructive control gets `--danger-deep` on a pale outline, never a red field.
- **Don't** let a course pigment enter the red or orange family, and don't render it as a thick edge stripe on any side of a block or card.
- **Don't** spend the teal gradient or the teal glow outside the brand glyph and the active desktop nav pill.
- **Don't** introduce a fourth card/control radius, or round a card past 6px. The 3px checkbox, 2px focus ring and 8px scrollbar thumb are chrome and are not licence to add a fifth.
- **Don't** set anything below 12px unless it is a unit suffix beside its numeral, white text on the solid clash red, a dock label under its icon, or an 11.5px word pill.
- **Don't** invent another neutral wash. Four near-identical greys (`#f6f6f9`, `#f2f2f5`, `#f3f2f5`, `#eceaef`) already sit in the build as hover states; that is drift to be consolidated onto `--surface-sunk` and `--line`, not a scale to extend.
- **Don't** use a hard offset shadow, a coloured shadow other than the two teal ones, or a border to fake elevation.
- **Don't** let any component but `.timetable` claim a non-shrinkable track or a `min-width` that pushes the page into horizontal scroll.
- **Don't** add a university mark, crest, seal, or any wording that implies TableLearn is an official KMUTNB system or an endorsed partner.
- **Don't** change a colour, radius, or type role on screen without making the same change in `exportTimetableImage`.

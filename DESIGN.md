---
name: TableLearn
description: A KMUTNB registration planner where a week of classes is a quarry face cut out of the sky.
colors:
  depth: "#0d2e5e"
  depth-deep: "#071d3f"
  depth-lift: "#14417e"
  depth-line: "#23528f"
  depth-ink: "#06203f"
  cumulus: "#f5f7f9"
  mist: "#e9edf1"
  saw: "#d6dadf"
  saw-line: "#c3cad2"
  thunder: "#7c828b"
  white: "#ffffff"
  stone-base: "#eef1f5"
  stone-face: "#e7ecf1"
  sky: "#4da7e6"
  sky-pale: "#dceefb"
  quarry: "#1d5aa8"
  quarry-lift: "#2269c0"
  quarry-press: "#14406f"
  fracture: "#c2381f"
  fracture-pale: "#fae7e2"
  fracture-ink: "#8f2412"
  fracture-lift: "#ff8f76"
  storm: "#3f5364"
  storm-pale: "#e2e7ec"
  storm-ink: "#2c3e4d"
  sky-lift: "#5fb2e9"
  sky-deep: "#3d97d8"
  sky-soft: "#7cc2ee"
  fracture-ink-soft: "#94331c"
  fracture-ink-deep: "#7c2412"
  on-depth-soft: "#b9cde6"
  on-depth-quiet: "#8fa9c8"
  on-depth-note: "#c6d6ea"
  on-depth-off: "#9fb3cc"
  ink: "#0d2e5e"
  ink-soft: "#4a5f7d"
  ink-quiet: "#5a6e88"
  placeholder-ink: "#64758d"
  on-depth: "#e6edf6"
  disabled-ink: "#565d66"
  disabled-ink-quiet: "#5f6670"
  cut-ink: "#08203c"
  cut-quarry: "#1d5aa8"
  cut-verdigris: "#14746a"
  cut-oxide: "#a8471d"
  cut-amethyst: "#5b3fa8"
  cut-cobalt: "#0f6ba8"
  cut-brass: "#7a6a1f"
  cut-garnet: "#a83d63"
typography:
  display:
    fontFamily: "Saira Stencil One, Chakra Petch, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Chakra Petch, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "clamp(19px, 1.5vw, 24px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Chakra Petch, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Anuphan, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-small:
    fontFamily: "Anuphan, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Chakra Petch, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.12em"
  numeric:
    fontFamily: "Azeret Mono, ui-monospace, Cascadia Mono, monospace"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.02em"
    fontFeature: "tabular-nums"
  numeric-lead:
    fontFamily: "Azeret Mono, ui-monospace, Cascadia Mono, monospace"
    fontSize: "clamp(22px, 3vw, 30px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.12em"
    fontFeature: "tabular-nums"
  mark-mobile:
    fontFamily: "Saira Stencil One, Chakra Petch, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.025em"
  dialog-title:
    fontFamily: "Chakra Petch, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
  section-label:
    fontFamily: "Chakra Petch, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.14em"
  meta:
    fontFamily: "Anuphan, Leelawadee UI, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0px"
  chamfer-field: "8px"
  chamfer-control: "9px"
  chamfer-card: "12px"
  chamfer-default: "14px"
  chamfer-zone: "16px"
spacing:
  seam: "1px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.quarry}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.chamfer-control}"
    padding: "9px 14px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.quarry-lift}"
    textColor: "{colors.white}"
  button-primary-active:
    backgroundColor: "{colors.quarry-press}"
    textColor: "{colors.white}"
  button-primary-disabled:
    backgroundColor: "{colors.saw}"
    textColor: "{colors.disabled-ink}"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.quarry}"
    rounded: "{rounded.chamfer-control}"
    padding: "9px 14px"
    height: "38px"
  button-line-hover:
    backgroundColor: "{colors.sky-pale}"
    textColor: "{colors.quarry}"
  button-line-on:
    backgroundColor: "{colors.quarry}"
    textColor: "{colors.white}"
  button-line-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.disabled-ink-quiet}"
  button-fracture:
    backgroundColor: "transparent"
    textColor: "{colors.fracture}"
    rounded: "{rounded.chamfer-control}"
    padding: "9px 14px"
  button-quiet:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.quarry}"
    rounded: "{rounded.chamfer-control}"
    padding: "6px 10px"
    height: "30px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.none}"
    size: "34px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chamfer-field}"
    padding: "9px 11px"
  input-disabled:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink-quiet}"
  chip-day:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-soft}"
    rounded: "5px"
    padding: "0 8px"
    height: "34px"
  chip-day-selected:
    backgroundColor: "{colors.fracture}"
    textColor: "{colors.white}"
  tag-anchor:
    backgroundColor: "{colors.quarry}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "2px 7px"
  tag-fracture:
    backgroundColor: "{colors.fracture}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "2px 7px"
  zone:
    backgroundColor: "{colors.cumulus}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chamfer-zone}"
    padding: "22px 24px 24px"
  cut-block:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chamfer-card}"
    padding: "13px 15px 13px 22px"
  cut-block-fracture:
    backgroundColor: "{colors.fracture-pale}"
    textColor: "{colors.fracture-ink}"
  face-block:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chamfer-control}"
    padding: "7px 9px 8px 16px"
    height: "88px"
  rail-tab:
    backgroundColor: "transparent"
    textColor: "{colors.on-depth}"
    rounded: "{rounded.none}"
    padding: "9px 12px"
  rail-tab-active:
    backgroundColor: "{colors.quarry}"
    textColor: "{colors.white}"
  readout:
    backgroundColor: "{colors.depth-deep}"
    textColor: "{colors.on-depth}"
    rounded: "10px"
    padding: "14px"
  dialog:
    backgroundColor: "{colors.cumulus}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chamfer-zone}"
    padding: "18px 20px"
---

# Design System: TableLearn

## Overview

**Creative North Star: "Cloud Quarry"**

A week of classes is a quarry face. Every section the student takes is a block cut out of the sky; every hour they keep is the blue void the cut leaves behind; a time collision is a bad cut, and it fractures. The whole interface is built from that one physical claim, and it is why nothing here looks like a calendar app: no rounded cards, no pastel chips, no soft ambient shadows, no gradient-happy dashboard. Panels are cumulus-white stone laid on a depth-blue ground; every corner is a 45° saw cut; the seams between things are 1px hairlines, not gaps.

The system is dense and industrial without being cold. It runs at 15px body text with 12–14px secondary copy, uses 1px seams instead of whitespace to divide lists, and packs a full 07:00–20:00 week onto one screen at 1440px. That density is deliberate: the surface is used under deadline pressure during registration week, so the operator's read — what collides, what is free, what is committed — must be available without scrolling or hunting. Expression carries the information; it never sits on top of it. Where the world and the task disagree, the task wins.

The palette is dichromatic by discipline. Blue does the work — depth-blue ground, sky-blue void, quarry-blue for every affordance — and colour is then spent exactly twice, on the two hazards the product exists to surface: fracture red for a time collision, thunder-gray for exam weather. Course pigments are user data and are deliberately starved: a course's colour appears only on the cut face of its block and in its code glyph, never as a fill. The result is a screen where saturated red means one thing and one thing only.

**Key Characteristics:**
- Chamfered cut corners everywhere; `border-radius` is `0` on every element in the build
- Cumulus-white stone panels on a depth-blue gradient ground with a fixed grain overlay
- Sky blue (#4da7e6) is a material meaning "free time", never a decorative accent
- Course colour survives only as a block's cut face and its code glyph
- Two hazard channels, never crossed: fracture red for collisions, thunder-gray for exams
- 1px hairline seams instead of gutters between list rows and grid cells
- Latin stencil for the mark, industrial sans for labels, Thai humanist for prose, mono for numerals only
- One authored motion moment (the cut), and colour-only transitions everywhere else

## Colors

A dichromatic blue world — depth, void, and working blue — with saturated colour reserved almost entirely for the two hazard states.

### Primary
- **Quarry Blue** (`{colors.quarry}`): Every affordance. Primary button fills, outlined-button ink, active rail tab, field focus ring, checkbox fill, section eyebrows, plan-score badges, the day-label numerals in the week header. If something can be pressed or is currently on, it is quarry blue.
- **Quarry Lift** (`{colors.quarry-lift}`): Primary button hover only.
- **Quarry Press** (`{colors.quarry-press}`): Primary button active only.

### Secondary
- **Sky** (`{colors.sky}`): The void. It is the ground of the week grid's day timelines, the fill of every free-time row and gap strip, and the label ink for headings sitting on the depth ground.
- **Sky Lift** (`{colors.sky-lift}`) / **Sky Deep** (`{colors.sky-deep}`) / **Sky Soft** (`{colors.sky-soft}`): The void's three gradient stops. A day timeline runs lift → sky → deep vertically so the face reads as open air with depth; a free-time row runs deep → sky → soft horizontally so the void brightens as it opens out. The hour divisions inside the void are `rgba(255,255,255,0.34)` rules, never dark lines.
- **Sky Pale** (`{colors.sky-pale}`): The quiet hover wash under outlined and quiet buttons, the hovered row in the compare table, the ground of an informational weather row, and the base of the empty-state hatch.

### Tertiary — the cut pigments
Seven strata pigments are the default course colours (`cut-quarry`, `cut-verdigris`, `cut-oxide`, `cut-amethyst`, `cut-cobalt`, `cut-brass`, `cut-garnet`). They are assigned round-robin and are user-editable, so they are data, not decoration. They appear in exactly two places: the block's cut face (a 7–10px edge), and the course code, which is darkened into legibility against **Cut Ink** (`{colors.cut-ink}`) — the near-black the pigment is mixed toward at five call sites, `color-mix(in srgb, var(--cut) 70–82%, var(--cut-ink))`. Cut ink is the load-bearing token of the whole pigment system: it is what holds a light user-chosen colour at readable contrast on white stone, so the mix ratio and the ink move together or not at all.

### Neutral
- **Depth** (`{colors.depth}`) / **Depth Deep** (`{colors.depth-deep}`) / **Depth Lift** (`{colors.depth-lift}`): The ground. The page is a vertical `depth-lift → depth → depth-deep` gradient with a sky-tinted radial bloom at 78% -14%; `depth` also fills the week grid's header band and the mobile dock; `depth-deep` is the html background and the scrim base.
- **Depth Line** (`{colors.depth-line}`): The only divider that exists on the dark ground — rail rule, readout border, dock top edge, scrollbar thumb.
- **Cumulus** (`{colors.cumulus}`): Panel stone. Every zone and dialog body.
- **Mist** (`{colors.mist}`): The recessed tone inside a panel — control strips, planner benches, day-strata cards, the week grid's day-label column, icon-button hover.
- **Saw** (`{colors.saw}`) / **Saw Line** (`{colors.saw-line}`): Cut edges. `saw-line` is the 1px seam colour for grid gaps, list separators, table rules, and field strokes; `saw` is the disabled button fill and the bright edge in the saw-pass sweep.
- **Thunder** (`{colors.thunder}`): Field hover stroke, table head rule, and the crosshair registration marks stamped into each panel's corners.
- **Stone Base** (`{colors.stone-base}`) / **Stone Face** (`{colors.stone-face}`): The bottom stops of the two stone gradients — a cut block runs white → stone-base at 176°, a week-face block white → stone-face at 178°. The block on the sky face is a shade cooler and darker than the one on a panel, because it is lit against open air rather than against cumulus.
- **White** (`{colors.white}`): The topmost surface — fields, plan results, raw blocks, the top stop of both stone gradients, and the lit inset edge of a cut. It is the one colour left as a literal in the stylesheet rather than routed through a custom property: pure white is self-describing, and the two `inset 0 1px 0 #ffffff` cut highlights read as exact CSS that way.
- **Ink** (`{colors.ink}`) / **Ink Soft** (`{colors.ink-soft}`) / **Ink Quiet** (`{colors.ink-quiet}`) / **Placeholder Ink** (`{colors.placeholder-ink}`): Primary, secondary, and tertiary text on stone, then the field placeholder. Ink is the same value as depth — the text is the ground. Placeholder ink is cooler and lighter than ink-quiet so an unfilled field reads as empty rather than as filled-but-dim.
- **On Depth** (`{colors.on-depth}`) / **On Depth Note** (`{colors.on-depth-note}`) / **On Depth Soft** (`{colors.on-depth-soft}`) / **On Depth Quiet** (`{colors.on-depth-quiet}`): The four-step ink ramp for the dark ground, in descending loudness — primary text, the site-note footnote, the shared-room caption, and the faintest room note. Headings on depth are sky, and the loudest values are pure white.
- **On Depth Off** (`{colors.on-depth-off}`): Outside that ramp, and a state rather than a step — the disabled label on a rail button. It sits between soft and quiet in lightness, so it reads as withdrawn rather than merely quiet.
- **Disabled Ink** (`{colors.disabled-ink}`) / **Disabled Ink Quiet** (`{colors.disabled-ink-quiet}`): The designed disabled state — see The Designed-Disabled Rule. `disabled-ink-quiet` doubles as the neutral fill of the section badge in the course browser.

### Hazard
- **Fracture** (`{colors.fracture}`): A time collision, and nothing else. It is the cut face and 1px inset ring of a colliding block, the fill of the "ชนกัน" tag, the ink of destructive buttons, the selected state of an avoid-this-day chip, and the ring around the shared-room conflict panel.
- **Fracture Pale** (`{colors.fracture-pale}`) / **Fracture Ink** (`{colors.fracture-ink}`) / **Fracture Ink Soft** (`{colors.fracture-ink-soft}`) / **Fracture Ink Deep** (`{colors.fracture-ink-deep}`): The hazard surface and its three inks — headings and codes, the secondary metadata inside a fractured block, and body copy on a fracture ground. Fracture surfaces are always the pale ground *plus* a −45° hatch at 9–18% opacity, never a flat tint.
- **Fracture Lift** (`{colors.fracture-lift}`): The collision count in the rail readout — fracture red is unreadable on the depth ground, so the hazard lifts to a light coral there.
- **Storm** (`{colors.storm}`) / **Storm Pale** (`{colors.storm-pale}`) / **Storm Ink** (`{colors.storm-ink}`): Exam weather. Both storm surfaces — the weather row above the grid and the exam-warning list — are one treatment: storm ink on storm pale under the same fine 74° rain hatch, with the icon at full storm. They read as a forecast rather than a failure.

### Named Rules

**The Sky-Void Rule.** Sky blue is a material, not an accent. It means unclaimed time. Any surface painted sky must be empty time (a timeline ground, a free-time row, a between-class gap); nothing that represents a course, a control, or a piece of chrome may be painted sky, and no block may sit on the void without being cut out of it.

**The Cut-Face Rule.** A course's colour reaches the screen through the cut face (a 7–10px edge on the leading side) and the code glyph, and through nothing else. Blocks are cumulus-white stone. Never fill a block with the course colour, never tint its background, never make a pastel chip of it.

**The Two-Hazard Rule.** Fracture red is a time collision. Thunder-gray is exam weather. The two never swap and never blend, and neither is available for ordinary emphasis. Colour is not the only carrier: every hazard state also ships a hatch pattern, an icon, and Thai text.

## Typography

**Display Font:** Saira Stencil One (Latin only; falls back to Chakra Petch, then system-ui)
**UI Font:** Chakra Petch (with Leelawadee UI, Segoe UI)
**Body Font:** Anuphan (with Leelawadee UI, Segoe UI)
**Numeric Font:** Azeret Mono (with ui-monospace, Cascadia Mono)

**Character:** A stencilled Latin mark over an industrial Thai-capable sans, softened by a humanist Thai text face and measured out in a squared mono. Chakra Petch does the shouting — squared terminals, tight tracking, heavy weights for headings and wide tracking for eyebrows — while Anuphan keeps the Thai prose readable at 12–15px. The four aliases (`--font-display`, `--font-ui`, `--font-body`, `--font-num`) are declared on `body`, not `:root`, because `next/font` puts its variables on `<body>`; declaring them on `:root` silently breaks the whole ramp.

### Hierarchy
- **Display** (Saira Stencil One 400, 30px, line-height 1, -0.025em): The wordmark only. One instance per page, in the rail head, in white on the depth ground.
- **Mark Mobile** (Saira Stencil One 400, 26px): The same wordmark below 900px. The only responsive step in the type ramp.
- **Headline** (Chakra Petch 700, clamp(19px, 1.5vw, 24px), 1.2, -0.01em): Zone titles. The page's only `h1` is the face zone.
- **Dialog Title** (Chakra Petch 700, 18px): The head of a modal. Heavier than a zone title at a smaller size, because a dialog has no rail to anchor it.
- **Title** (Chakra Petch 600, 14.5px, 1.3): Course names on cut blocks. The readout plan name runs 17px/600; block names inside the week grid 12.5px/600, clamped to two lines.
- **Body** (Anuphan 400, 15px, 1.55): The base. Line length in the site note is capped at 78ch.
- **Body Small** (Anuphan 400, 13.5px): Descriptive prose under a zone title, capped at 68ch.
- **Meta** (Anuphan 400, 12.5px): Measures, hints, and footnotes. The floor for Thai prose; below this the ramp is labels only.
- **Label** (Chakra Petch 600, 11px, 0.12em): Field labels and bench labels.
- **Section Label** (Chakra Petch 600, 12px, 0.14em): The eyebrow over a subsection, in quarry blue on stone or sky on depth. Its 10.5px sibling runs the same tracking inside cards and the readout.
- **Numeric** (Azeret Mono 500, tabular-nums): Every digit read as a measurement — readout figures at 17px, compare-table cells at 15px, course codes at 12–13px/700, times at 11–12.5px.
- **Numeric Lead** (Azeret Mono 700, clamp(22px, 3vw, 30px), 0.12em): The one numeral that is a headline — the shared-room code, tracked out so it can be read aloud and typed by a friend.

Two 19px/700 steps sit outside the ramp on purpose: the plan score (mono) and the week grid's day numeral (Chakra Petch). Both are single-instance display figures inside their own components.

### Named Rules

**The Mono-Numerals Rule.** Azeret Mono carries no Thai glyphs. `--font-num` is permitted only on numerals, times, course codes, room codes, and section numbers. Any Thai character that lands in a mono run falls into an ugly system fallback and is a bug, not a style — put the Thai in a sibling element on `--font-ui` and keep the mono run to the digits.

**The Stencil-Once Rule.** The stencil face appears exactly once per page, on the wordmark. It is Latin-only, so it can never carry Thai copy, and it must never be recruited for headings, numbers, or emphasis.

**The Tabular Rule.** Anything that stacks or compares — readout measures, compare table, exam times, free-time spans — is `font-variant-numeric: tabular-nums`. Numbers that sit in a column must not shimmy as they change.

## Layout

**The frame.** Desktop is a two-column grid: a 268px sticky rail (232px under 1180px) and a fluid work column, separated and inset by `--gap` (18px, dropping to 12px under 900px). The rail carries the mark, the primary action, the seven-zone index, and a live readout of the active plan; the work column is a vertical stack of zones at the same gap.

**The zone.** Every section of the page is a cumulus panel with 22px/24px padding, a 16px chamfer, and thunder-gray crosshair registration marks stamped 11px into its top-right and bottom-left corners. Paired zones (free time + exams) sit in an `auto-fit minmax(320px, 1fr)` grid so they split on desktop and stack when narrow.

**Within a zone**, the rhythm is: a `zone-head` (title, one line of prose at 68ch, actions right-aligned at 20px gap), an optional mist control strip at 12px/14px padding, then the content. Card collections are `auto-fill`/`auto-fit` grids with a 260–276px minimum and a 12px gap. Lists are not gapped — they are a 1px `saw-line` background showing through a 1px flex gap, so rows read as strata separated by a cut line.

**The week face.** A 15-column grid: an 88px time gutter plus 14 hour columns at `minmax(66px, 1fr)`, `min-width: 1030px`, with 1px seams. Each day's timeline is one full-width sky-gradient row spanned across all hour columns, with hour divisions painted as translucent white rules; blocks are absolutely positioned over it at a fixed 88px height. The face scrolls horizontally inside its own container rather than letting the page scroll.

**Spacing rhythm.** 1px (seam) · 6px · 8px · 12px · 18px (`--gap`) · 24px. Component internals stay on that ladder; the only values off it are the optical ones inside cut blocks, where the left padding is enlarged (16px, 22px) to clear the cut face.

**Responsive.** At 1180px the rail narrows. At 900px the page goes single-column: the rail becomes a horizontal band above the work column and its nav detaches into a fixed bottom dock carrying all seven destinations, using mobile-only short labels stacked under 20px icons, with `env(safe-area-inset-bottom)` padding and 74px of bottom padding on the work column to clear it. Mobile defaults to the day-list view rather than the grid. At 560px, card grids collapse to one column and control groups go full width.

### Named Rules

**The Static Rail Rule.** Under 900px the rail must be `position: static`. As `sticky` it creates a stacking context that traps the fixed bottom dock beneath the work column, and the dock disappears behind the page. This is a load-bearing declaration; do not "tidy" it.

**The Face-First Rule.** Collisions and exam weather are rendered above the week grid, never below it and never only inside the blocks. They are the reason the student opened the page.

**The Seam Rule.** Related rows are separated by a 1px `saw-line` seam, not by a gutter. Reach for whitespace between zones; reach for a cut line within one.

## Elevation & Depth

The system is not flat, but it has no ambient card shadows. Depth is carried three ways, in order of how much of the screen they cover.

First, **tonal strata**: the dark ground gradient recedes, cumulus panels sit on it, mist recesses inside them, and pure white is the topmost surface (fields, cut blocks, plan results). Second, **the seam and the inset stroke**: separation is a 1px `saw-line` seam or an `inset 0 0 0 1px` box-shadow, never a border on a chamfered element. Third, **the cut relief**: a block on the week face is the only element that casts — a `drop-shadow(0 2px 5px rgba(6,32,63,0.32))` filter (not a box-shadow, so the shadow follows the notched silhouette) plus an `inset 0 1px 0 #ffffff` top highlight, which together make it read as stone standing proud of the sky it was cut from.

A fixed fractal-noise grain sits over the whole page at 16% opacity in `overlay` blend mode, and the dialog scrim is an 82% depth-deep wash with a 3px backdrop blur.

### Shadow Vocabulary
- **Cut relief** (`filter: drop-shadow(0 2px 5px rgba(6, 32, 63, 0.32))`): Only on a course block sitting on the sky void. It is what makes the block look cut rather than drawn.
- **Cut highlight** (`box-shadow: inset 0 1px 0 #ffffff`): The lit top edge of a block or cut-block card.
- **Hairline stroke** (`box-shadow: inset 0 0 0 1px <colour>`): The universal edge — fields (`saw-line`), field focus (2px `quarry`), fracture blocks (`fracture`), plan results and raw blocks (`saw-line`).

### Named Rules

**The Cut-Relief Rule.** One drop shadow exists in this system, and it belongs to a block cut out of the sky. Everywhere else, depth is tone and a 1px line. Never add a soft ambient shadow to a panel, a card, a dialog, or a button.

**The Inset-Stroke Rule.** A chamfered element is never given a `border`. Use an inset box-shadow, a 1px seam, or the evenodd ring — a border draws a rectangle and leaves the diagonal corner open.

## Shapes

**Radius is zero.** There is no rounding anywhere in the build. The single corner language is the chamfer: a 45° cut of length `--c`, taken off the **top-left and bottom-right** of a panel, so every rectangle reads as a piece that came off a larger face. The chamfer is parametric — `--c` is set per component and scales with the element: 16px on zones and dialogs, 14px default, 12px on cards and the room code, 10px on the readout, 9px on buttons, blocks, and rail tabs, 8px on fields, and 4–6px on elements under 40px (checkbox, day chip, in-card footer buttons). Icon buttons set `--c: 0` and stay square.

**Blocks cut a different silhouette.** Anything that represents a course cut off the face — the week block, the strata row in day view, the saved-course card — takes a *single* notch off the **top-right** corner only, keeping three square corners. The direction of the notch is what distinguishes a piece of stone from a panel.

**The cut face.** Off the week grid, a course's colour is drawn as a `::before` trapezoid pinned to the left edge (`clip-path: polygon(0 0, 100% 7px, 100% calc(100% - 7px), 0 100%)`), 8–10px wide, with a 1px white highlight on its inner edge. It is a cut face, not a `border-left`; a straight rule reads as a status bar and loses the geometry. On the week face itself the colour is instead a 7px hard stop in the block's background gradient, because the block is clipped.

**Hatching is the world's texture.** Diagonal −45° repeating gradients at 8–18% opacity mark every state that is not solid: fracture surfaces, sky voids and gaps, empty states, the room-code placeholder slots. Exam weather uses a distinct fine 74° hatch so the two hazard textures are separable at a glance.

**Icons** are a hand-authored 24px stroke set drawn on the same geometry: `stroke-width: 1.6`, `stroke-linecap: square`, `stroke-linejoin: miter`, no fills, no curves except where a form demands one (the storm cloud). They are square-cut and mitered to match the chamfer.

### Named Rules

**The Chamfer-Only Rule.** `border-radius` is `0` on every element. The chamfer is the only corner treatment in the system. A rounded corner anywhere is a defect, including on images, avatars, and third-party embeds.

**The Notch-Direction Rule.** Panels chamfer top-left and bottom-right. Course blocks notch top-right only. Never mix the two silhouettes; the difference is how the eye separates chrome from material.

**The Ring Rule.** An outlined chamfered element draws its 1px outline as an absolutely positioned pseudo-element filled with the ring colour and clipped by an `evenodd` polygon whose inner ring is inset 1px. This is the only way to get an outline that follows the diagonal; `clip-path` on the element itself would clip a border and leave the corner open.

## Components

### Buttons
- **Shape:** Chamfered (`{rounded.chamfer-control}`), 38px minimum height, 9px/14px padding, Chakra Petch 600 at 13px with 0.03em tracking, 17px icons, `transition: background-color 0.14s linear, color 0.14s linear`.
- **Primary:** Quarry fill, white text. Hover lifts to quarry-lift, active presses to quarry-press. On the depth ground (the rail CTA) the hover inverts instead: sky fill with `{colors.depth-ink}` text.
- **Line:** Transparent with a quarry evenodd ring and quarry text; hover washes sky-pale; the `is-on` state fills quarry and hides its ring.
- **Fracture:** Quarry's destructive sibling — fracture text, fracture-pale hover wash. Used for delete and clear-all.
- **Quiet:** A mist-filled 30px button at 12px for in-strip secondary actions.
- **Icon:** 34px square (`--c: 0`), ink-soft, mist hover.
- **Disabled:** See The Designed-Disabled Rule.

### Chips
- **Day chip** (planner "avoid this day"): 38×34px white cell with a `saw-line` inset stroke and a 5px chamfer; hover shifts the text to quarry; **selected fills fracture red**, because selecting a day is declaring it hazardous.
- **Tags** (on cut blocks): square, unchamfered, 2px/7px, 10.5px/600 at 0.08em, white on quarry for "locked", white on fracture for "collides". Tags always carry Thai text alongside the colour.

### Cards / Containers
- **Zone:** Cumulus stone, 16px chamfer, 22–24px padding, crosshair marks in two corners. No shadow, no border.
- **Cut block** (a saved course): A white-to-`{colors.stone-base}` vertical gradient, 12px top-right notch, cut face on the left, inset white top highlight, 22px left padding to clear the face. Header (code + tags), title, a 112px-minimum `auto-fit` measures grid, and a footer of ring-outlined text buttons above a `saw-line` rule. Its fracture variant swaps the ground for the pale hatch and the cut face for fracture red.
- **Bench / strip:** Mist recess, no chamfer, 12–16px padding. The workspace inside a panel.

### Inputs / Fields
- **Style:** White, 8px chamfer, 9px/11px padding, 14px Anuphan, edged with `inset 0 0 0 1px saw-line` (never a border). The label above is 11px/600 at 0.12em in ink-soft. Selects get an authored quarry chevron and 30px right padding; time, date, and number inputs switch to `--font-num` with tabular figures; the placeholder sits at `{colors.placeholder-ink}`.
- **Hover:** Stroke darkens to thunder. **Focus:** stroke doubles to 2px quarry, native outline removed, caret quarry.
- **Disabled:** Mist fill, ink-quiet text, `not-allowed` cursor.
- **Checkbox:** A 17px white square with a 4px chamfer and a thunder stroke; checked fills quarry with an authored white tick. Focus draws a 2px quarry outline offset 2px.

### Navigation
- **Rail (desktop):** A sticky column of tabs at 13.5px/500 with 18px sky icons, separated by translucent depth-line rules. Hover washes 16% sky. The active tab fills quarry, turns its icon white, and takes a notch off its **top-right** corner — the tab is itself a block cut into the rail. Exactly one tab is active, driven by an IntersectionObserver.
- **Dock (mobile, ≤900px):** The same nav, fixed to the bottom on a depth gradient with a depth-line top edge. All seven destinations stay visible by switching to a stacked 20px icon over an 11px short label; the long labels are hidden, not truncated. Safe-area padding at the bottom, z-index 30.

### The Week Face (signature)
The centrepiece. Sky-gradient day rows are the void; blocks are absolutely positioned stone at 88px tall with a 9px top-right notch, a 7px cut face, a white-to-`{colors.stone-face}` gradient, cut relief, and four stacked lines: code (mono 700, darkened course colour), name (Chakra Petch 600, two-line clamp), teacher, and a bottom-anchored time/room row. A colliding block turns into a fracture block: fracture cut face, −45% hatch over a pale ground, a 1px fracture inset ring, and every ink shifted into the fracture family.

**Motion — the cut.** Blocks animate in on mount with `cut-in` (0.42s `cubic-bezier(0.16, 1, 0.3, 1)`: 3px drop and fade) while a `saw-pass` sweep (0.52s `cubic-bezier(0.5, 0, 0.2, 1)`) runs a saw-silver light band across the face and out. Because it fires on mount, switching plans visibly re-cuts the whole week. Dialogs get a matching 0.24s snap-and-settle; the scrim a 0.18s fade. Everything else in the system is a 0.14s linear colour change. Under `prefers-reduced-motion: reduce`, all animations and transitions collapse to 0.001ms and the saw sweep is removed entirely.

### Exported PNG (signature)
`บันทึกเป็นรูป` paints a second surface of the same world onto a 2× canvas: depth ground, cumulus grid, the same three-stop sky gradient for the day rows, translucent white hour rules, notched white blocks with a `rgba(6,32,63,0.34)` shadow and a 7px cut face, and the same type roles (Chakra Petch for the plan title, names, and teacher; Azeret Mono for the code and the time). It is not a screenshot — the palette is hard-coded in the painter.

### Named Rules

**The Designed-Disabled Rule.** Disabled is a colour decision, never a blanket `opacity`. A filled button goes `disabled-ink` on a `saw` fill; an outlined or quiet button goes `disabled-ink-quiet` on transparent with its ring dropped to `saw-line`; a primary button on the depth ground goes `{colors.on-depth-off}` on a 55% depth-line wash. Only the icon inside dims (to 0.7).

**The One Cut Rule.** The system gets one authored motion moment — the cut — and it belongs to the course block. Everything else is a 0.14s linear colour transition. Do not add entrance animations, parallax, hover lifts, or scroll effects to anything else.

**The Second Surface Rule.** The exported PNG is part of the design system, not an output format. Any change to the ground, sky, stone, cut face, or type roles must be made in the canvas painter in the same change as the CSS, or the two surfaces drift.

## Do's and Don'ts

### Do:
- **Do** cut every corner with the chamfer at a `--c` scaled to the element (16px zones → 4px checkboxes), and take the notch off the top-right for anything that represents a course.
- **Do** paint a course's colour only as a cut face and a code glyph, darkening the glyph with `color-mix(in srgb, var(--cut) 70–82%, var(--cut-ink))` so a light user pigment stays legible.
- **Do** keep sky blue meaning "free time" — a timeline ground, a gap strip, a free-time row.
- **Do** pair every hazard colour with a hatch, an icon, and Thai text, so the state survives colour-blindness and a black-and-white print.
- **Do** put digits, times, and codes in `--font-num` with tabular figures, and the Thai next to them in `--font-ui`.
- **Do** separate rows with a 1px `saw-line` seam and edge surfaces with an inset stroke.
- **Do** keep `.rail` `position: static` below 900px, and keep all seven dock destinations visible by shortening labels rather than dropping them.
- **Do** update the canvas painter in `app/page.tsx` whenever the palette, sky gradient, or block geometry changes.
- **Do** give disabled controls their designed inks, and keep the whole system's transitions at 0.14s linear.

### Don't:
- **Don't** use `border-radius` anywhere, or add a second corner language (soft, cut-all-four, or asymmetric-rounded).
- **Don't** put a `border` on a chamfered element — the diagonal corner stays open. Use the evenodd ring or an inset stroke.
- **Don't** fill a course block with its course colour, or render a course as a pastel chip.
- **Don't** spend fracture red on anything but a time collision, or thunder-gray on anything but exam weather.
- **Don't** let Thai text into a `--font-num` run, and don't use the stencil display face for anything but the wordmark.
- **Don't** add soft ambient drop shadows to panels, cards, dialogs, or buttons; the only cast shadow belongs to a block on the sky.
- **Don't** signal disabled with `opacity`.
- **Don't** add new motion. The cut is the one authored moment.
- **Don't** let the page scroll horizontally to show the week — the face scrolls inside its own container.

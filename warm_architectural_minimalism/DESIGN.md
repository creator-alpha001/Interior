# Warm Architectural Minimalism

> **Provenance.** This file was reconstructed from `MOBILE.md` section 3, which
> derived its resolutions by counting pixels off the five reference renders and
> reconciling this document's two internal descriptions of itself. The original
> Stitch export was never committed. Everything below that `MOBILE.md` states or
> measures directly is marked plain; everything inferred to fill a gap it only
> alludes to is marked _(reconstructed)_. Where the front matter and the prose
> disagree, both are kept — the disagreement is the point, and `MOBILE.md`
> section 3.1 is the tie-breaker of record.

A theme for a coordinated marketplace: lime-washed plaster, dressed stone, daylight.
It reads as editorial architecture, not as a consumer app. The emotional argument
is **daylight on stone** — warm, quiet, unhurried, and honest about weight.

## The prototype it was drawn on

The five reference screens are drawn around an **escrow service**: money held in
a vault, tranches released by the client, a mediator on call. That product is not
this product, so the screens do not transfer one-for-one — but the *look* does.

| Screen | The treatment it carries |
| --- | --- |
| `scope_escrow_builder` | The vault block — a large tabular figure, an allocation bar, numbered tranche rows |
| `deliverables_escrow_approval` | A photo carousel, a checklist, and the visual weight given to a single decision |
| `mediated_project_hub` | A stepped milestone roadmap with lock glyphs; a contact card at the foot of the screen |
| `studio_profile_packages` | A hero, a stats strip, tiered package cards, case studies |
| `discovery_matching` | A vetted-directory rhythm, a badge row, a style-questionnaire card |

Recurring devices across the set: an **escrow status pill** in the app bar; a
peach **"action required"** panel; a **guarantee panel** (icon, rule, two stacked
promises); `$` figures set as large tabular numerals.

---

## 1. Colour

This theme ships **two descriptions of itself that do not agree** — a Material 3
role set as YAML front matter, and prose that names colours by hand. Keep both.
The front matter is what was actually drawn in the renders; the prose contributes
two things the front matter has no slot for (a softened ink, a warmer hairline)
and one colour — warm ochre — used nowhere in the five screens but needed by a
state the prototype never had to show.

### 1.1 Front matter — the Material 3 role set _(reconstructed layout; values per `MOBILE.md` 3.1–3.2)_

Loaded verbatim into Flutter, this comes out wrong: `primary` is ink, so every
`FilledButton` renders black, and the action colour sits in `secondary`. The
consuming app is expected to remap terracotta onto `primary` on the way in. The
front matter itself is left as drawn.

```yaml
theme:
  name: Warm Architectural Minimalism
  reference-device: 1440   # desktop-first; see -mobile overrides in §2
  scheme:
    light:
      # Action lives in secondary here — this is the remap MOBILE.md §3.2 undoes
      primary:                  "#000000"   # ink
      on-primary:               "#FFFFFF"
      primary-container:        "#1E1B18"   # softened ink
      on-primary-container:     "#FBF9F6"

      secondary:                "#944927"   # terracotta — the action colour
      on-secondary:             "#FFFFFF"
      secondary-container:      "#FFDBCD"   # the "action required" panel
      on-secondary-container:   "#360F00"

      tertiary:                 "#000000"
      on-tertiary:              "#FFFFFF"
      tertiary-container:       "#EBF3EF"
      on-tertiary-container:    "#0E5138"

      # Trust green is parked in the *-fixed slots, only ever drawn at icon scale
      secondary-fixed:          "#007E53"
      tertiary-fixed:           "#007E53"
      on-tertiary-fixed:        "#00251A"

      error:                    "#BA1A1A"
      on-error:                 "#FFFFFF"
      error-container:          "#FFDAD6"
      on-error-container:       "#410002"

      surface:                  "#FBF9F6"   # pale limestone — the ground
      on-surface:               "#1B1C1A"
      on-surface-variant:       "#4C4640"

      surface-container-lowest:  "#FFFFFF"  # pure chalk — overlays only
      surface-container-low:     "#F5F3F0"  # the card fill, most often
      surface-container:         "#EFEEEB"  # a panel inside a card
      surface-container-high:    "#EAE8E5"
      surface-container-highest: "#E4E2DF"  # chips, muted fills

      outline:                  "#7D766F"   # non-text only — 3.4:1 on limestone
      outline-variant:          "#CEC5BD"   # hairline (rarely drawn at this value)

      inverse-surface:          "#30312F"
      inverse-on-surface:       "#F2F0ED"
      inverse-primary:          "#CCC5C0"
      surface-tint:             "transparent"   # deliberate — see §4
```

### 1.2 Prose — the colours named by hand

The design's own words for its palette. Two of these values exist nowhere in the
front matter.

| Hand name | Hex | Note in the prose |
| --- | --- | --- |
| Terracotta | `#C06C47` | "The human, artisanal touch." The action colour. |
| Carbonized-oak ink | `#1E1B18` | "Carbonized oak warmth." Pure black is explicitly wrong for type. |
| Pale limestone | `#FAF8F5` | The ground. |
| Bone card | `#F3EFEA` | Raised surfaces. |
| Travertine | `#EAE4DC` | Trade tags, material source, spec chips — neutral metadata. |
| Mortar line | `#E6E0D8` | Hairline rules. |
| Deep sage | `#2D6A4F` | "Verification, signature, approval. Never decoration." |
| Warm ochre | `#D97706` | "Waiting on someone else." Used in no render; needed by a real state. |
| Burnt iron | `#991B1B` | "Wrong" — overdue, lost, declined, suspended. |

### 1.3 Where they disagree — the resolutions of record

Every pixel of the five renders was counted. **The front matter is what was drawn**,
with three corrections the prose is right about.

| Role | Measured in the renders | Front matter | Prose | Resolution |
| --- | --- | --- | --- | --- |
| Action | `#944927`, in all five renders | `#944927` | `#C06C47` | **`#944927`.** `#C06C47` appears in no render and is 3.9:1 on white — below AA for the label text these buttons carry. |
| Ground | `#FBF9F6`, dominant on every screen | `#FBF9F6` | `#FAF8F5` | **`#FBF9F6`.** `#FAF8F5` occurs only as anti-aliasing. |
| Card | `#F5F3F0`, then `#EFEEEB` | both present | `#F3EFEA` | **The two front-matter greys.** `#F3EFEA` appears nowhere. |
| Chip / muted | `#E4E2DF`, `#EAE8E5` | both present | `#EAE4DC` | **Front matter.** |
| Hairline | `#E6E0DB` | `#CEC5BD` (barely drawn) | `#E6E0D8` | **The prose — the only place it wins.** Resolved to `#E6E0DB` as measured. |
| Ink | `#1E1B18`, and `#000000` on the darkest CTA | `#000000` | `#1E1B18` | **`#1E1B18` for type.** The prose is right that pure black is wrong. |
| Attention | `#FFDBCD` — the whole "action required" panel | `#FFDBCD` | — | **Front matter.** The prose has no name for one of the strongest devices in the design. |
| Trust | ~`#007E53`, at icon scale only | greens in `*-fixed`; `tertiary: #000000` | `#2D6A4F` | **`#2D6A4F`.** Nothing renders it at text size; `#2D6A4F` is 5.9:1 on white where `#007E53` is 4.8:1. |
| Error | ~`#8A1800` | `#BA1A1A` | `#991B1B` | **`#991B1B`.** |

**Net:** take the front matter wholesale, with three swaps — `#1E1B18` for ink,
`#E6E0DB` for hairlines, `#2D6A4F` for the trust green — and carry warm ochre
`#D97706` across from the prose.

### 1.4 Colour carries meaning

The prototype is disciplined about this; anything built on it must be, because
here the greens and ambers are load-bearing.

| Colour | Means | Appears on |
| --- | --- | --- |
| Sage `#2D6A4F` | **Verified, signed, or approved by a person** | Verified seal, signed agreement, approved stage, paid invoice, released detail |
| Terracotta `#944927` | **Your turn** | Primary CTA, active step, the one thing on the screen to act on |
| Ochre `#D97706` | **Waiting on someone else** | Pending review, submitted-and-awaiting, amount due |
| Burnt iron `#991B1B` | **Wrong** | Overdue, lost, declined, suspended |
| Travertine `#EAE4DC` | Neutral metadata | Trade tags, material source, spec chips |

**The rule that keeps it meaningful: sage is never decorative.** If sage is on
screen, a human checked something. A thing that has been *submitted* is ochre; it
turns sage only when someone approves it. That single transition is the most
important piece of colour in the system.

---

## 2. Typography

Two families, no overlap in job. Both are bundled as assets, never fetched at
runtime — a first paint must never fall back.

- **Newsreader** — the editorial serif. Headings and display only. One display
  line per screen at most.
- **Manrope** — everything else: UI, body, labels, numerals.

Neither family carries Devanagari. If a Devanagari locale is ever a target, pair
Noto Serif Devanagari with Newsreader and Noto Sans Devanagari with Manrope and
check the pairing optically at heading sizes.

### 2.1 The scale

This document is **desktop-first** (1440 px reference) and ships a `-mobile`
override set. Use the mobile column on any viewport below ~600 px — `display-lg`
at 56 px is a 1440 px figure and will not fit a 360 dp screen.

| Token | Family | Desktop `px / lh / wght` _(reconstructed; only display-lg is fixed by MOBILE.md at 56)_ | **Mobile `px / lh / wght`** | Job |
| --- | --- | --- | --- | --- |
| `display-lg` | Newsreader | 56 / 64 / 400 | **38 / 46 / 400** | One per screen, at most |
| `headline-lg` | Newsreader | 40 / 48 / 400 | **30 / 38 / 400** | Screen titles |
| `headline-md` | Newsreader | 32 / 40 / 500 | **28 / 36 / 500** | Section heads |
| `headline-sm` | Newsreader | 24 / 32 / 500 | **22 / 28 / 500** | Card titles, names, project names |
| `title-lg` | Manrope | 18 / 24 / 600 | **18 / 24 / 600** | List row titles |
| `title-md` | Manrope | 16 / 22 / 600 | **16 / 22 / 600** | Buttons, tab labels |
| `body-lg` | Manrope | 16 / 26 / 400 | **16 / 26 / 400** | Long prose — briefs, terms, articles |
| `body-md` | Manrope | 14 / 22 / 400 | **14 / 22 / 400** | Default |
| `body-sm` | Manrope | 12 / 18 / 400 | **12 / 18 / 400** | Meta, timestamps, captions |
| `label-md` | Manrope | 12 / 16 / 600, +0.04em | **12 / 16 / 600, +0.04em** | Field labels |
| `label-sm` | Manrope | 10 / 14 / 700, +0.06em, uppercase | **10 / 14 / 700, +0.06em, uppercase** | Status pills, eyebrows |
| `financial-num` | Manrope | 24 / 30 / 500, tabular, -0.48 tracking | **24 / 30 / 500, tabular, -0.48 tracking** | Every currency figure |

`financial-num` **must** carry tabular figures — a column of amounts will not
align otherwise — and currency is set with locale grouping (e.g. Indian
grouping: `₹4,50,000`, whole units, no minor unit).

---

## 3. Spacing, layout and shape

### 3.1 Spacing scale

```
4   8   12   16   24   32   48   64
```

- **Screen gutter:** 24 desktop, **20 mobile** (`margin-mobile`).
- **Card padding:** 16 or 24.
- **Macro rhythm:** 32–48 above a section head; dense 4–12 inside a figures
  block. That contrast is what makes the design read as editorial rather than as
  a dashboard. It is the first thing lost under pressure. Hold it.

### 3.2 Shape

| Radius | Applied to |
| --- | --- |
| **4 px** | Buttons, inputs, images, small cards |
| **6 px** | Large panels, dossiers |
| **9999 px** | **Status chips and badges only** — nothing else |

The pill is reserved exclusively for metadata. A pill-shaped button destroys the
system's one strong signal that a thing is a label rather than a control. Nothing
goes above 6 px otherwise — this is dressed stone, not a rounded consumer app.

### 3.3 Tap targets _(mobile correction; not in the desktop source)_

The 44 px input height in the renders is a web figure. On touch, inputs and
buttons go to **48 dp**; icon buttons get a 48 dp hit box even where the glyph is
20. Dividers respect the card's inset — never edge to edge.

---

## 4. Elevation — there isn't any

**Artificial drop shadows are strictly avoided.** Depth is tonal layering plus
hairline borders. Three levels only:

| Level | Fill | Border | What |
| --- | --- | --- | --- |
| **0 · Ground** | `#FBF9F6` | — | Scaffold |
| **1 · Raised** | `#F5F3F0` (or `#EFEEEB` for a panel nested in a card) | 1 px `#E6E0DB` | Cards, panels, dossiers |
| **2 · Overlay** | `#FFFFFF` | 1 px `#D8D1C7` + a 6% mineral diffusion | Sheets, dialogs, the signing prompt |

- `surface-tint` is `transparent` on purpose — Material's elevation tinting is
  switched off wholesale, and every surfaced component must have its own tint and
  shadow explicitly cleared.
- The **only** permitted shadow is level 2, and it is a diffusion, not a drop
  shadow: `blur 48, y-offset 24, spread -12, colour #1E1B18 at 6%`.
- **Frosted header:** `rgba(251, 249, 246, 0.88)`, 12 px backdrop blur, `#E6E0DB`
  bottom border. Scrolling-content screens only — it costs a full-screen blur per
  frame and earns nothing on a form.

`#D8D1C7` (the overlay input border) and warm ochre `#D97706` are the two values
with no Material role. They travel with the theme as named extras.

---

## 5. The reference screens in detail

### `scope_escrow_builder` — the vault
A single large `financial-num` total, an allocation bar beneath it, then numbered
rows — one per tranche — each with a secondary figure and a short label. Dense
internal spacing (4–12). This is the money screen; it is quiet and exact.

### `deliverables_escrow_approval` — the decision
A horizontal photo carousel at the top, a checklist below it, and one weighted
decision at the foot inside a peach `#FFDBCD` panel. The layout gives a single
action almost the whole lower third of the screen.

### `mediated_project_hub` — the roadmap
A vertical stepped roadmap: each step a row with a state glyph (lock / in-progress
/ check), a title, and a sub-line. Ochre while a step is submitted, sage once
approved. A contact card sits at the very foot — an avatar, a name, a role, and a
line of plain copy about how contact works.

### `studio_profile_packages` — the profile
An editorial hero (`display-lg` in Newsreader over a wide image), a horizontal
stats strip in `financial-num`, then tiered package cards, then case-study
entries. The closest thing in the set to a marketing page.

### `discovery_matching` — the directory
A vetted-directory list: each entry a card with a name in `headline-sm`, a badge
row (`label-sm` pills — verified / rated / signed), and a short descriptor. A
style-questionnaire card is interleaved into the list as a prompt.

---

## 6. Currency and numerals

- Whole units, integer-valued, no minor unit shown.
- Locale grouping — Indian grouping where the locale calls for it: `₹4,50,000`,
  never `₹450,000`.
- Every figure in `financial-num` with tabular figures. One formatter, used
  everywhere — a screen that formats its own is how a wrongly-grouped amount
  ships.

---

## 7. Motion _(reconstructed — MOBILE.md does not carry the source's motion spec)_

In keeping with the rest: restrained. Short, near-linear easing (150–200 ms for
state, 240–280 ms for a sheet or an overlay). No bounce, no overshoot, no
parallax. The frosted header is the only continuously-animated surface, and only
while content scrolls beneath it.

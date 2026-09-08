# Aangan mobile — the plan

One Flutter application carrying **two audiences**: the customer and the
professional. Admin stays on the web, where it is, and stays a separate
deployment for the reason it always was — it holds commission figures, vendor
margins and customer phone numbers.

## What this document is, and what it is not

**`apps/web` is the specification for functionality.** Anything a customer or a
professional can do in the web app must be doable in this one. That is the
requirement, it is not negotiable per-screen, and it is not restated here
feature by feature — the web app *is* the statement, and it is executable.

**This document describes how those things should look and behave on a phone.**
The palette, the type scale, the navigation shape, the mechanics that only exist
on mobile — uploads from a camera, push, biometric resume, offline reads. Where
it lists screens, it is describing a *design treatment for a surface the web
already has*, never deciding which surfaces exist.

That distinction is written this plainly because getting it wrong has already
cost a rebuild — and the record should be accurate about how. Section 6 listed
the catalogue, product detail, packages, the professional profile, search,
notifications, support and referrals from the beginning. **They were specified
and simply not built**, while every milestone in section 9 reported complete,
because the milestones were treated as the definition of done and they do not
cover section 6's table. Nobody was misled by this document; the yardstick was
wrong.

So section 1 is now the yardstick, it is derived from `apps/web/src/app`, and it
carries a state column. A milestone cannot be complete while a row in it says
missing.

Read `CONTEXT.md` first for what the platform is and why. `API.md` is the
contract this app consumes.

The design language comes from the **Warm Architectural Minimalism** theme
supplied as a Stitch prototype. It is adopted as a *look* — palette, type,
layering, framing, the shape of a card and a status chip. **It carries no
functional weight whatsoever**: its screens are drawn around a different
product's mechanics, and section 3.7 maps each of its treatments onto an Aangan
screen that exists for reasons the prototype knows nothing about.

---

## 1. Scope — measured against the web app

Every page under `apps/web/src/app`, and where it stands on mobile. **This table
is the definition of done.** A surface is not out of scope because it is absent
from this document; it is out of scope only if this table says so and gives a
reason.

Staff and admin are the one genuine exclusion: `apps/admin` is web only, now and
planned, because it holds commission figures, vendor margins and every
customer's phone number.

### The customer's surfaces

| Web page | Mobile | State |
| --- | --- | --- |
| `/` | Home tab | **Done.** Banners, trades, testimonials and the platform figures |
| `/catalogue` | Explore → Catalogue | **Done.** Grid, four sorts, filter sheet |
| `/catalogue/[domain]` | Explore → Catalogue | **Done**, via the trade filter rather than as its own route |
| `/product/[slug]` | Product detail | **Done.** Names the city beside every price |
| `/packages` | Explore → Packages | **Done** |
| `/packages/[slug]` | Package detail | **Done.** Exclusions given the same room as inclusions |
| `/professionals` | Explore tab | **Done.** Trade and city filters, verified only, and the profile behind each card |
| `/professionals/[id]` | Professional profile | **Done.** Per-trade ratings, portfolio, "Request this professional" |
| `/our-work` | Explore → Our work | **Done** |
| `/search` | Explore → search | **Done.** Debounced, with stale responses discarded |
| `/blog`, `/blog/[slug]` | Guides | **Done.** No cover images in the *list*, deliberately — see 6.3A |
| `/estimate` | Rough cost | **Done** |
| `/how-it-works` | Account → How it works | **Done** |
| `/join-as-professional` | Account → Work with us | **Done** |
| `/submit-requirement` | Requirement flow | **Done** |
| `/login` | Sign in | **Done** |
| `/account` | Account tab | **Done** |
| `/account/requirements`, `/[id]` | Jobs tab | **Done.** Visits listed, with a reschedule request |
| `/account/agreements` | Agreements | **Done** |
| `/account/projects` | Progress | **Done.** Proof photographs, and a review when every stage is approved |
| `/account/notifications` | Account → Notifications | **Done** |
| `/account/referrals` | Account → Invite a friend | **Done** |
| `/account/support` | Account → Help | **Done.** Tickets and replies |

### The professional's surfaces

| Web page | Mobile | State |
| --- | --- | --- |
| `/partner` | Dashboard | **Done** |
| `/partner/leads`, `/[id]` | Leads | **Done** |
| `/partner/onboarding` | Onboarding gate | **Done** |
| `/partner/projects` | Projects | **Done** |
| `/partner/projects/[id]` | Stage proof | **Done.** Submitted photographs are shown back on both sides |
| `/partner/payments` | More → Commission | **Done** |
| `/partner/profile` | More → Performance, Portfolio, Your profile | **Done.** The record, the per-trade figures, the reviews and the business details. Neither side edits — see below |

### What the contract offers that nothing calls

Two methods, down from twenty-one, and both are meant to be here:

`staffLogin` — staff have no mobile surface, by design, and the app refuses
them on the sign-in path with somewhere to go.

`getDomain` — one trade by slug. The catalogue filters by trade rather than
routing to it, so nothing needs the single fetch. Worth revisiting only if a
deep link ever has to open a trade cold.

**An unused client method is the cheapest signal that a surface is missing**,
and it found every one of the thirteen this list used to carry. Run
`grep`-style coverage over the generated clients before declaring a phase
finished, and treat a new entry as a screen somebody forgot.

The app talks to `apps/api` and to nothing else. It reimplements no rule:
assignment, masking, commission, agreement signing and stage approval are all
server-owned and stay that way. The mobile client's job is to render view models
and post inputs.

**It shares no code with the web frontends.** Those share `packages/types`; this
one cannot import TypeScript. Section 4.3 is how the contract is kept honest
anyway, and it is the most consequential architectural decision in this document.

---

## 2. One app or two

**One binary, two shells, role resolved at launch.**

The web already works this way — the professional portal is `/partner` on the
customer site — and the reasoning carries over. A phone number is one identity.
`GET /me` returns an `Actor` whose role is `client` or `professional`, and the
router picks a shell from it. A vendor who is also having their own flat done is
one account today; two apps would make them two.

The counter-argument is real and should be recorded: a professional-only store
listing markets better to tradespeople, and neither audience wants the other's
release notes. The mitigation is structural rather than deferred — the two
shells are separate Dart packages (`feature_customer`, `feature_vendor`) over a
shared core, so splitting into two binaries later is a build flavour and an
entrypoint, not a rewrite. Do not let those two packages start importing each
other "temporarily".

**Vendor-first is the recommended build order.** The customer already has a
decent mobile web experience. The vendor is a person standing in somebody's
half-built kitchen holding a phone, and stage proof is a camera task the web
does badly. The vendor app is where the platform gains something it does not
have today.

---

## 3. The design system

Everything below derives from `warm_architectural_minimalism/DESIGN.md`. The
five prototype screens are the reference renders.

### 3.1 The palette, measured off the renders

The theme ships two descriptions of itself — a YAML front matter that is a
Material 3 role set, and prose that names colours by hand — and they do not
agree. Rather than pick by argument, every pixel of the five reference renders
was counted. **The front matter is what was actually drawn.** The prose
contributed two things the front matter has no slot for.

| Role | Measured in the renders | Front matter | Prose | Verdict |
| --- | --- | --- | --- | --- |
| Action | **`#944927`** — in all five renders | `#944927` | `#C06C47` | `#944927`. `#C06C47` appears **nowhere**, in any render. It is also 3.9:1 on white against `#944927`'s 6.4:1, below AA for the small label text these buttons carry |
| Ground | **`#FBF9F6`** — the dominant colour of every screen | `#FBF9F6` | `#FAF8F5` | `#FBF9F6`. `#FAF8F5` occurs only as anti-aliasing |
| Card | **`#F5F3F0`**, then `#EFEEEB` | both present | `#F3EFEA` | The two front-matter greys. `#F3EFEA` appears nowhere |
| Chip / muted | **`#E4E2DF`**, `#EAE8E5` | both present | `#EAE4DC` | Front matter |
| Hairline | **`#E6E0DB`** | `#CEC5BD` (rare) | `#E6E0D8` | The **prose** wins here — this is the only place it does. `#CEC5BD` is barely drawn |
| Ink | **`#1E1B18`**, and `#000000` on the darkest CTA | `#000000`, with `#1E1B18` in `primary-container` | `#1E1B18` | `#1E1B18` for type. The prose is right that pure black is wrong — "carbonized oak warmth" |
| Attention | **`#FFDBCD`** — the whole "action required" panel | `#FFDBCD` | — | Front matter. The prose has no name for this and it is one of the strongest devices in the design |
| Trust | ~`#007E53` at icon scale only | greens in the `*-fixed` slots; `tertiary: #000000` | `#2D6A4F` | `#2D6A4F`. Nothing renders it at text size, and `#2D6A4F` is 5.9:1 on white where `#007E53` is 4.8:1 |
| Error | ~`#8A1800` | `#BA1A1A` | `#991B1B` | `#991B1B` |

So: **take the front matter wholesale**, with three corrections — `#1E1B18`
rather than `#000000` for ink, `#E6E0DB` for hairlines, and `#2D6A4F` for the
trust green. Warm ochre `#D97706` comes from the prose too; nothing in the five
renders needed it, but the "waiting on somebody" state in 3.3 does.

Write that resolution once, in `packages/design/lib/src/tokens.dart`, and treat
it as the only place in the app a hex value appears.

### 3.2 The Flutter ColorScheme

Flutter's Material 3 components colour themselves from `ColorScheme` roles. Load
the front matter verbatim and every `FilledButton` comes out black, because the
theme's `primary` is ink and its action colour sits in `secondary`. That is
backwards for Flutter.

**Remap on the way in.** Terracotta becomes `primary` so the framework defaults
land correctly, and espresso ink stays where it belongs — on text.

```dart
const aanganLight = ColorScheme(
  brightness: Brightness.light,

  // Action. Terracotta — the human, artisanal touch.
  primary:            Color(0xFF944927),
  onPrimary:          Color(0xFFFFFFFF),
  primaryContainer:   Color(0xFFFFDBCD), // The "action required" panel.
  onPrimaryContainer: Color(0xFF360F00),

  // Ink. Espresso noir — structural, typographic, never pure black.
  secondary:            Color(0xFF1E1B18),
  onSecondary:          Color(0xFFFBF9F6),
  secondaryContainer:   Color(0xFFE4E2DF),
  onSecondaryContainer: Color(0xFF4C4640),

  // Trust. Deep sage — verification, signature, approval. Never decoration.
  tertiary:            Color(0xFF2D6A4F),
  onTertiary:          Color(0xFFFFFFFF),
  tertiaryContainer:   Color(0xFFEBF3EF),
  onTertiaryContainer: Color(0xFF0E5138),

  error:            Color(0xFF991B1B),
  onError:          Color(0xFFFFFFFF),
  errorContainer:   Color(0xFFFDF2F2),
  onErrorContainer: Color(0xFF93000A),

  surface:          Color(0xFFFBF9F6), // Pale limestone. The ground.
  onSurface:        Color(0xFF1B1C1A),
  onSurfaceVariant: Color(0xFF4C4640),

  surfaceContainerLowest:  Color(0xFFFFFFFF), // Pure chalk — overlays only
  surfaceContainerLow:     Color(0xFFF5F3F0), // The card fill, most often
  surfaceContainer:        Color(0xFFEFEEEB),
  surfaceContainerHigh:    Color(0xFFEAE8E5),
  surfaceContainerHighest: Color(0xFFE4E2DF),

  outline:        Color(0xFF7D766F), // Non-text only: 3.4:1 on limestone
  outlineVariant: Color(0xFFE6E0DB), // Mortar line — hairline rules

  inverseSurface:   Color(0xFF30312F),
  onInverseSurface: Color(0xFFF2F0ED),
  inversePrimary:   Color(0xFFCCC5C0),
  surfaceTint:      Colors.transparent, // See 3.5 — this one matters
);
```

Two values have no Material role: warm ochre `#D97706` and the input border
`#D8D1C7`. Those go on an `AanganPalette extends ThemeExtension<AanganPalette>`
alongside the semantic colours in 3.3 and `financialNum` in 3.4.

### 3.3 Colour carries meaning — write the rule down

The prototype is disciplined about this and the app must be, because here the
greens and ambers are load-bearing.

| Colour | Means | Appears on |
| --- | --- | --- |
| Sage `#2D6A4F` | **Verified, signed, or approved by a person at Aangan** | Verified-vendor seal, signed agreement, ops-approved stage, paid invoice, released address |
| Terracotta `#944927` | **Your turn** | Primary CTA, active step, the one thing on the screen to tap |
| Ochre `#D97706` | **Waiting on somebody else** | Quote pending, stage submitted and awaiting ops, invoice due |
| Burnt iron `#991B1B` | **Wrong** | Invoice overdue, lead lost, declined, suspended |
| Travertine `#EAE4DC` | Neutral metadata | Trade tags, material source, spec chips |

The rule that keeps it meaningful: **sage is never decorative.** If sage is on
screen, something was checked by a human. A stage the vendor has uploaded proof
for is ochre, not sage; it turns sage the moment ops approve it. That single
transition is the most important piece of colour in the product, because it is
"a stage is done when somebody checked" made visible.

### 3.4 Typography

Two families, no overlap in job.

| Style | Family | Size / line / weight | Job |
| --- | --- | --- | --- |
| `displayLarge` | Newsreader | 38 / 46 / 400 | One per screen, at most |
| `headlineLarge` | Newsreader | 30 / 38 / 400 | Screen titles |
| `headlineMedium` | Newsreader | 28 / 36 / 500 | Section heads — "Milestone Roadmap" |
| `headlineSmall` | Newsreader | 22 / 28 / 500 | Card titles, professional names, project names |
| `titleLarge` | Manrope | 18 / 24 / 600 | List row titles |
| `titleMedium` | Manrope | 16 / 22 / 600 | Buttons, tab labels |
| `bodyLarge` | Manrope | 16 / 26 / 400 | Long prose — briefs, terms, blog |
| `bodyMedium` | Manrope | 14 / 22 / 400 | Default |
| `bodySmall` | Manrope | 12 / 18 / 400 | Meta, timestamps, captions |
| `labelMedium` | Manrope | 12 / 16 / 600, +0.04em | Field labels |
| `labelSmall` | Manrope | 10 / 14 / 700, +0.06em, uppercase | Status pills, eyebrows |
| `financialNum` | Manrope | 24 / 30 / 500, tabular | Every rupee figure |

Use the theme's `-mobile` sizes, not the desktop ones: `display-lg` at 56px is a
1440px figure and will not fit a 360dp screen.

`financialNum` is not a Material role, so it lives on the theme extension. It
**must** carry tabular figures or a column of quotes will not align:

```dart
static const financialNum = TextStyle(
  fontFamily: 'Manrope', fontSize: 24, height: 30 / 24,
  fontWeight: FontWeight.w500, letterSpacing: -0.48,
  fontFeatures: [FontFeature.tabularFigures()],
);
```

**Newsreader and Manrope have no Devanagari.** If Hindi is ever a target — and
for home services in India it will be — Hindi headings fall back silently to the
platform default serif, which is Noto on Android and Devanagari Sangam MN on
iOS, and the editorial character of the design is gone in that locale.

**Decided: Hindi ships at v1.** Noto Serif Devanagari is paired with Newsreader
and Noto Sans Devanagari with Manrope, in `AanganFonts.serifFallback` and
`sansFallback`, and every role in the scale carries the right one. Naming a
family that is not bundled costs nothing — Flutter falls through to the platform
— so the code is complete and the four `.ttf` files are the outstanding half.
The optical check at heading sizes is still owed, and is a check of the
*pairing* rather than of whether the glyphs appear: Devanagari sits taller than
Latin, and the शिरोरेखा with a vowel mark above it wants more line height than
the same size in English.

Bundle both families as assets rather than fetching through `google_fonts`. A
vendor on a site with no signal should not get a fallback-font first paint.

### 3.5 Elevation: there isn't any

The theme is explicit — "artificial drop shadows are strictly avoided". Depth is
tonal layering plus hairline borders. Three levels:

| Level | Fill | Border | What |
| --- | --- | --- | --- |
| 0 Ground | `#FBF9F6` | — | Scaffold |
| 1 Raised | `#F5F3F0`, or `#EFEEEB` for a panel inside one | 1px `#E6E0DB` | Cards, panels, dossiers |
| 2 Overlay | `#FFFFFF` | 1px `#D8D1C7` + a 6% diffusion | Sheets, dialogs, the agreement signing prompt |

**Flutter fights this in three specific places. Handle them globally in the
theme, not per widget:**

1. Material 3 tints surfaces by elevation. `surfaceTint: Colors.transparent` in
   the scheme kills most of it; also set `surfaceTintColor: Colors.transparent`
   on `CardTheme`, `AppBarTheme`, `BottomSheetTheme`, `DialogTheme`,
   `NavigationBarTheme` and `PopupMenuTheme`, several of which read their own
   property before the scheme's.
2. `elevation: 0` and `shadowColor: Colors.transparent` on all of the above.
3. `Card` paints its own margin and radius regardless. Define one `AanganCard`
   — a `Container` with `BoxDecoration(color: surfaceContainer, border:
   Border.all(color: outlineVariant), borderRadius: BorderRadius.circular(6))`
   — and forbid raw `Card` in review.

The only permitted shadow is level 2, and it is a mineral diffusion rather than
a Material shadow: `BoxShadow(blurRadius: 48, offset: Offset(0, 24),
spreadRadius: -12, color: Color(0x0F1E1B18))`.

The frosted header — `rgba(251,249,246,0.88)`, 12px blur, `#E6E0DB` bottom
border — is a `BackdropFilter` inside a `SliverAppBar`. Use it on scrolling
content screens only; it costs a full-screen blur every frame and earns nothing
on a form.

### 3.6 Shape, spacing, and two mobile corrections

Radii: **4px** for buttons, inputs, images and small cards; **6px** for large
panels; **9999px pills reserved exclusively for status chips and badges.** That
reservation is the system's one strong signal that a thing is metadata rather
than structure, and it is destroyed the moment a pill-shaped button appears.
Nothing else goes above 6 — the design is dressed stone, not a consumer app.

Spacing is the theme's scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Screen gutter
20 (`margin-mobile`); card padding 16 or 24. The macro rhythm — 32 to 48 above a
section head, dense 4-to-12 inside a figures block — is what makes this read as
editorial rather than as a dashboard, and it is the first thing compressed under
delivery pressure. Hold it.

Two corrections the theme does not make, because it was drawn for the web:

- **44px input height is a web figure.** Minimum tap target is 48dp on Android,
  44pt on iOS. Inputs and buttons go to 48; icon buttons get a 48dp hit box even
  where the glyph is 20.
- **Dividers respect the card's inset**, never edge to edge:
  `Divider(indent: pad, endIndent: pad, thickness: 1, height: 1, color:
  outlineVariant)`. Note `height` defaults to 16, which will quietly break the
  vertical rhythm on every card if left alone.

### 3.7 Where each prototype treatment goes

The five renders are drawn around an escrow service: money held in a vault,
tranches released by the client, a mediator on call. Aangan's mechanics are
different — payments are off-platform, and every message has the platform on one
side of it — so the screens do not transfer one-for-one. The *design* does, and
it transfers well: nearly every device in the prototype has a natural home here.

This table is that mapping. It is about which Aangan screen wears which
treatment, not about the prototype's features.

| Prototype treatment | Wear it on | Note |
| --- | --- | --- |
| The vault block — a large tabular figure, an allocation bar, numbered tranche rows | **Quote comparison** and the **commission invoice** | These are the two money screens that exist. The numbered-row rhythm is exactly right for three quotes side by side, with each vendor's rating in that trade under the price |
| `deliverables_escrow_approval` — the photo carousel, the checklist, the weight given to a decision | **Twice.** The vendor's proof submission, and the customer's stage view | Same layout, different endings: the vendor's CTA reads "Submit for approval"; the customer's version is read-only, because ops approve stages, not the customer |
| The stepped milestone roadmap with lock glyphs | **Project detail**, both sides | Four stages instead of four tranches. Ochre while a stage is submitted, sage once ops approve — see 3.3 |
| The peach "action required" panel (`#FFDBCD`) | Anywhere the person is the blocker | The strongest device in the whole prototype and the one most worth keeping: a quote waiting to be chosen, an agreement ready to sign, a stage sent back for rework |
| The contact card at the foot of the project screen | **The relay** | Redrawn around an Aangan coordinator rather than the vendor, with a line saying plainly that we carry messages both ways. One thread per service |
| The guarantee panel — icon, rule, two stacked promises | **The platform guarantee** | Keep the panel exactly; fill it with what is actually true: verified vendors, per-trade ratings, one person who answers, stages checked against photographs |
| `studio_profile_packages` — the hero, the stats strip, the tiered cards, the case studies | **Professional profile**, nearly wholesale | The closest one-to-one in the set. The CTA becomes "Request this professional" — a preference ops try to honour — which means designing the **unmet-preference** state, the one screen here the prototype has no equivalent for |
| `discovery_matching` — the vetted-directory rhythm, the badge row, the style questionnaire card | **Catalogue and the professional directory** | Badges become verified / rating in this trade / signed |
| The escrow status pill in the app bar | **The service's stage** | Same geometry, same placement |
| `$` figures | `₹` with Indian grouping | `₹4,50,000`, never `₹450,000`. Whole rupees, no paise, tabular figures |

Two things in the renders have no Aangan equivalent and simply do not get drawn:
the escrow vault itself, and any control that puts the customer in direct
contact with a vendor. Everything else in the set has somewhere to go.

### 3.8 Dark mode

**Ship light-only at v1, deliberately and on the record.**

The palette is warm lime-washed plaster and the whole emotional argument is
daylight on stone. A mechanical inversion gives a muddy brown-grey app that
reads as a bug. Doing it properly is real design work: a warm charcoal ramp
(`#1B1917` ground, `#252220` raised, `#332E2A` borders), terracotta lifted to
about `#C06C47` to hold contrast, sage lifted to about `#4C9A7A`, and
Newsreader's 400 weight re-checked at every size because a light serif on dark
smears.

Deferring costs exactly one discipline: build every screen against
`Theme.of(context).colorScheme` and the theme extension, never a literal. One
screen reading a token directly breaks the promise that dark mode is later a
single file.

### 3.9 Golden tests, because this is a design-led build

The design system is as much the deliverable as the features, and an untested
design system drifts within a month. Two suites:

- **Token goldens** — every component in every state (button × 5, status pill ×
  6, card, input, milestone ledger, empty state, error state). A PR that changes
  a padding then shows up as an image diff.
- **Screen goldens** at 360×640 (a cheap Android), 390×844 and 430×932, each at
  `textScaleFactor` 1.0 and 1.3. Newsreader at 30px with 1.3 scaling is where a
  headline breaks its box, and without this it breaks on a customer's phone
  instead of in review.

---

## 4. Architecture

### 4.1 Layout

A melos-managed workspace, so the two shells cannot quietly fuse.

```
mobile/
  app/                    The runnable app. Entrypoint, DI, router, flavours.
  packages/
    design/               Tokens, theme, every shared widget. No business logic.
    core_api/             Generated models + typed client. No UI, no Flutter.
    core_auth/            Session, OTP, secure storage, role resolution.
    core_upload/          Ticket → PUT → assetId, with a resumable queue.
    feature_customer/     Customer shell and its screens.
    feature_vendor/       Vendor shell and its screens.
```

`design` depends on Flutter and nothing else. `core_api` depends on neither
Flutter nor `design` — that is what makes it generatable and testable without a
widget tree. Neither feature package may import the other; enforce it with a
dependency lint in CI rather than by asking.

### 4.2 The stack

| Concern | Choice | Why |
| --- | --- | --- |
| Flutter | 3.35+ / Dart 3.9+, Material 3 | Current stable |
| State | **Riverpod 3 with codegen** | Async providers match this app's shape — nearly every screen is one or two remote reads. Provider invalidation is how a mutation refreshes the lists behind it, which is most of the app's state work |
| Models | `freezed` + `json_serializable` | Unions give the four-way lead status a compiler-checked `switch` in the UI |
| HTTP | `dio` + interceptors | Interceptors are where session, request id, retry and 401 handling live once |
| Routing | `go_router` | Typed routes, deep links, and one `redirect` that owns the auth and onboarding gates |
| Storage | `flutter_secure_storage` for the session token, `shared_preferences` for preferences, `drift` **only if** offline reads get built | Do not add a database before there is a screen that needs one |
| Images | `cached_network_image` | The catalogue is image-heavy |
| Camera | `image_picker` + `flutter_image_compress` | Stage proof is the vendor's core action |
| Push | `firebase_messaging` | Section 7.2 |
| Analytics / crash | Sentry, matching the API's `sentry` setup | One incident, one request id, both halves |

Riverpod over BLoC is a judgement call, not a law: BLoC is defensible if the
team already has it. Do not mix them.

### 4.3 Keeping the contract — the decision that matters

The whole repository rests on one property: **a response that drifts from what a
screen renders is a compile error**, because both sides import
`packages/types`. Dart cannot import those types, so that property is lost the
moment somebody hand-writes a Dart model — and it is lost silently, months
later, when a field is renamed on the server and a mobile screen starts showing
a blank.

Do not hand-write the models. In order of preference:

1. **Emit OpenAPI from the API and generate Dart from it.** Fastify already has
   Zod schemas and the stack notes say "Zod validation and OpenAPI from one
   schema". Wire `@fastify/swagger` over the existing `packages/contract`
   schemas, commit `openapi.json`, and generate `core_api` from it in CI. One
   command, and a schema change that breaks a Dart model fails the mobile build
   rather than a customer's screen.
2. If response types are not fully described by Zod today, write a small
   TypeScript emitter over `packages/types/src/views.ts` that produces Dart
   `freezed` classes. Less general, still generated.
3. Hand-written models are acceptable for a two-week spike and for nothing else.

Whichever route, **generated code is committed** and CI fails when regeneration
produces a diff. A generator nobody runs is worse than no generator.

Two things the generator will not give you and that must be added by hand:

- `MaskedClientSummary` must be generated **without** phone or email fields, the
  same way it is defined in TypeScript. Add a mobile test that asserts the
  vendor-facing models have no such field, so a schema change on the server
  cannot introduce one by accident.
- `Rupees` is an `int`. Make it a Dart `int`, never a `double`. Money in a
  floating-point type is how ₹1 goes missing.

---

## 5. Session and authentication on mobile

### 5.1 The one change the API needs

Sessions are **rows in Postgres**, not JWTs, deliberately: suspending a vendor
has to log them out of the portal they are looking at, immediately. That
decision is correct and mobile keeps it — nothing here needs a token that
outlives a revocation.

What does not carry over is the delivery mechanism. `/auth/otp/verify` sets a
session **cookie**. A Flutter client can hold a cookie jar (`dio_cookie_manager`
plus a persistent store), and that works, but it inherits every cookie-attribute
question — `SameSite`, `Secure`, domain, expiry — for no benefit, and it makes
"am I signed in" a property of a jar rather than of a value the app owns.

**Add a bearer path to the existing session table.** Two small changes, no new
concept:

- `POST /auth/otp/verify` returns `{ actor, sessionToken, expiresAt }` in the
  body when the caller asks for it (an `X-Client: mobile` header, or a
  `?mode=token` parameter — pick one and document it in `API.md`).
- Every authenticated route accepts `Authorization: Bearer <token>` as an
  alternative to the cookie, resolving against the same `sessions` row.

Revocation, the row-level-security identity, `aangan_app` vs `aangan_ops`, the
sweep job — all unchanged. Only the place the token is read from changes.

Store the token in `flutter_secure_storage` (Keychain / Keystore). Never in
`shared_preferences`.

### 5.2 The sign-in flow

```
Splash → GET /me
  401         → Phone entry → POST /auth/otp/request → OTP → POST /auth/otp/verify
  actor.role  → 'client'       → customer shell
                'professional' → vendor shell (→ onboarding gate, 6.2)
                'sales_agent' | 'admin' → refuse, with "staff sign in on the web"
```

Points that are easy to get wrong, each of which the web has already been bitten
by or has a rule about:

- **An unrecognised number creates a customer account.** Signing up and signing
  in are one action. The screen must not have a "Sign up" button; it has a name
  and city field that appear only after the code verifies for a new number,
  matching `POST /auth/otp/verify`'s optional `name` and `cityId`.
- **The six-digit input must accept a whole-code paste.** The web hit exactly
  this: SMS autofill drops all six digits into the first field and five vanish.
  Use one field with `autofillHints: [AutofillHints.oneTimeCode]` and draw six
  boxes over it, rather than six real fields. On Android, `sms_autofill` with
  the SMS Retriever API needs the app hash embedded in the MSG91 template — a
  DLT template change, so raise it with that registration, not after it.
- **Rate limits are the server's** — five per mobile per hour, twenty per IP.
  Render the 429 honestly with the retry time; do not add a client-side counter
  that disagrees.
- **Staff are refused on the OTP path.** Say why, and link to the admin URL.
- **A 401 mid-session means suspended or signed out elsewhere.** The dio
  interceptor clears secure storage and routes to sign-in with a message. It
  must not retry, and it must not silently drop the user on a blank screen.

### 5.3 Biometric re-entry

A vendor opens the app twenty times a day. `local_auth` behind a preference,
gating app resume rather than the session itself: the session token stays valid,
biometrics only unlock the UI. Do not tie the session's lifetime to it.

---

## 6. Navigation and screens

### 6.1 Customer shell

Five tabs. The prototype's bottom bar — thin outline glyphs, terracotta only on
the active item, `labelSmall` uppercase — carries over directly.

`Home · Explore · Jobs · Messages · Account`

Every row carries its state. **A row that says "to build" is work, not an
idea** — this table was written before any of it existed and read afterwards as
though it described what did, which is how the browse half went missing for a
whole phase.

| Screen | Endpoints | State | Notes |
| --- | --- | --- | --- |
| Home | `/domains`, `/catalogue/counts`, `/banners`, `/stats`, `/testimonials`, `/packages` | built | The `discovery_matching` render, with the four trades as the entry. Editorial hero in Newsreader; do not turn it into a tile grid |
| Explore — catalogue | `/products` (paged), `/categories`, `/cities` | built | Domain tabs, filter sheet (category, city, price, tags, sort), infinite scroll on `nextCursor` |
| Product detail | `/products/:slug`, `/products/:slug/related` | built | `effectivePrice` follows the selected city — show the city, or the price looks arbitrary |
| Packages, package detail | `/packages`, `/packages/:slug` | built | |
| Professionals directory | `/professionals` (paged), filters incl. `verifiedOnly` | built | Ranked by rating **in the trade being browsed** — say which trade the rating is for, on the card. Setting the trade is what makes the API return `domainRating` at all, so the filter is the feature, not a convenience |
| Professional profile | `/professionals/:id`, `/portfolio` | built | The `studio_profile_packages` render. CTA is "Request this professional" — a preference, not a booking |
| Search | `/search`, `/search/suggest` | built | Type-ahead must stay fast; debounce 250ms and cancel in flight |
| Blog | `/posts` (paged), `/posts/:slug` | built | Native list, native reader. It exists to rank, so keep deep links working |
| Estimator | client-side | built | Port from web |
| **Submit requirement** | `/uploads/tickets`, `POST /me/requirements` | built | See 6.3 |
| Requirements list / detail | `/me/requirements`, `/me/requirements/:id` | built | A requirement is **N service tracks**, not one thing. The detail screen is a stack of per-domain cards, each with its own status, quotes, visits and unread count |
| Quote comparison | `LeadDomainView.quotes`, `POST /me/services/:id/select-quote` | built | The `scope_escrow_builder` treatment minus the vault: numbered rows, tabular figures, the vendor's rating in that trade beside each price |
| Agreements | `/me/agreements`, `POST /me/requirements/:id/agreements` | built | Explain combined agreements where they occur — one contract per professional, not per service, and customers will ask |
| **Sign agreement** | `POST /me/agreements/:id/sign` | built | Level-2 overlay, pure chalk. See 7.5 — this is the one screen where a double tap is expensive |
| Projects list | `/me/projects` | built | |
| Project detail | `ProjectView.project.milestones` | built | The `mediated_project_hub` roadmap, redrawn read-only. Four stages, proof photographs, ochre while submitted, sage on approval. **No approve button** |
| Review | `POST /me/reviews` | built | Offered on completion; ratings are per trade |
| Messages | `/me/services/:id/messages` | built | One thread per service, **with Aangan**. Header names the coordinator and states the relay plainly |
| Visits | `POST /me/visits/:id/reschedule` | built | Confirming a visit is what releases the address to that vendor — worth a line of copy |
| Notifications | `/me/notifications`, `POST /me/notifications/read` | built | |
| Support | `/me/tickets`, `POST /me/tickets`, `POST /me/tickets/:id/replies` | built | |
| Referrals | `/me/referrals` | built | Share sheet |
| Account | `GET /me`, `POST /auth/logout` | built | |
| Our work | `/portfolio`, `/professionals` | built | The portfolio gallery. The web's `/our-work` |
| How it works | static | built | |
| Join as a professional | static | built | The recruiting surface. A vendor who installs the customer app has to be able to find it |

### 6.2 Vendor shell

`Dashboard · Leads · Projects · Visits · More`

**The onboarding gate comes before all of it.** An unsigned professional is in
no pool, however verified — so the shell renders the gate, not an empty
dashboard. `GET /vendor/onboarding` returns six steps (`profile`, `identity`,
`trades`, `service_areas`, `portfolio`, `agreement` — there is deliberately no
`bank` step; see question 5); render them as the
prototype's stepped ledger, with the partner agreement as the terminal step and
`POST /vendor/onboarding/agreement` behind a clause-by-clause acknowledgement.
An unsigned vendor seeing "0 leads" is the single worst first impression this
app can make; they must see what is missing and how to finish it.

| Screen | Endpoints | State | Notes |
| --- | --- | --- | --- |
| Dashboard | `/vendor/dashboard` | built | Counters — new, awaiting quote, quotes out, won, live projects, visits today, commission due/overdue, unread. The prototype's figures block, dense, tabular |
| Leads | `/vendor/leads?filter=new\|quoting\|won\|lost` | built | Tabs. Card shows the masked client, locality, trade, urgency, budget ceiling |
| Lead detail | `/vendor/leads/:id` | built | The customer's own words *and* the brief ops captured on the call — the brief is the real scope, so give it the weight. `competingQuotes` shown plainly; do not soften it |
| Respond | `POST /vendor/leads/:id/respond` | built | Accept or decline, with a reason |
| Quote builder | `POST /vendor/leads/:id/quotes` | built | Versioned server-side; one live quote per vendor is a database constraint. Show "this replaces quote v2" before submitting, not after the 409 |
| Lead messages | `/vendor/leads/:id/messages` | built | Their thread **with Aangan**. Never with the customer |
| Visits | `/vendor/visits` | built, partial | **The address-release state is a first-class UI state**: locality only until the visit for *that service* is confirmed, then the full address with a maps launcher. Two distinct designs, not one with an empty line |
| Projects | `/vendor/projects` | built | |
| **Stage proof** | `POST /vendor/projects/:id/stages/:stageId/proof` | built, partial | The core action. Camera or gallery, multi-photo, compress, upload tickets, note, submit. The CTA says **"Submit for approval"** — evidence is not completion, and the screen must not imply it is |
| Agreements | `/vendor/agreements` | built | Combined agreements collapse; execution stays per service. The card says so on itself — a vendor who reads one combined contract as two will invoice twice |
| Commission | `/vendor/invoices` | built | Ochre when due, burnt iron when overdue. Vendor-side only — this figure never appears on a customer screen |
| Performance | `/vendor/performance` | built | Per-trade rating, win rate, response time, reviews. Per-trade is the point: excellent at painting, average at carpentry, shown as exactly that |
| Portfolio | `/vendor/portfolio`, upload purpose `portfolio_item` | built, partial | Approved items only are public |
| Profile | `GET /me` | built | Approved trades, the figures customers see, and the business details on file. **Read-only, and that is parity** — see the note under this table |

**Where "partial" is doing real work above.** Stage proof and portfolio are
partial only in that neither can *delete* an item once sent — the photographs
themselves now render on both sides, which is what the platform's central claim
needs: work counts as done when somebody has looked at the evidence. Visits are
partial because the address-release state is built and the maps launcher is not
yet wired on every path.

**The profile is not one of them, and this document was wrong about why.** An
earlier draft of the row above read *"the web's `/partner/profile` also edits.
Read-only here is not parity"*, and the mobile screen was built to apologise for
a gap that does not exist: `apps/web/src/app/partner/profile/page.tsx` renders
four read-only panels and no form, and the API has no vendor profile write —
`/vendor/*` has fifteen paths and not one of them updates the professional.

Editing is not self-service **anywhere**, on purpose, and it is the same rule as
trade approval: what a customer sees about a professional is changed by a person
at Aangan. The screen now says that, instead of "not built yet".

The lesson is the one this document's own preamble states. A row asserting what
another surface does is a claim about code, and it is checkable — check it.

### 6.3A Images, and the honesty the web keeps about them

*Built.* `AanganMedia` lives in `packages/design/lib/src/media.dart` and is a
line-for-line port of `packages/ui/src/media.tsx`, `mediaHash` included — down
to JavaScript's int32 narrowing, so the same seed produces the same colour on
both platforms. `MediaStrip` and `showMediaViewer` carry the photograph sets.
This section stays because the *rule* is what matters, not the widget.

**Match the web's honesty about this.** `packages/ui/src/media.tsx` renders a
real `<img>` when there is a photograph and a *generated gradient* when the
source begins with `ph:` — because most of the seed catalogue has no
photographs, and the web's own home page says why in a comment worth repeating:

> Ruled cells rather than four image cards. The images here were placeholders
> standing in for photographs nobody has taken, and a trade is better identified
> by its name and a colour than by a gradient pretending to be a room.

So a mobile `AanganMedia` should behave exactly as `Media` does: a photograph
when one exists, a deterministic tinted placeholder when the value is a `ph:`
sentinel, and never a broken-image glyph or a grey box. The tint derives from
the domain, so the same product is the same colour on both platforms.

Three places carry **real** photographs rather than placeholders, and all three
render them now:

| | Where | State |
| --- | --- | --- |
| Stage proof | Vendor's submission, customer's progress | Built on both sides. The evidence the whole platform rests on, and for a while the one thing neither side could see |
| Portfolio | Professional profile, `/our-work`, the vendor's own portfolio | Built. Approved items only, which is the moderation rule showing through |
| Blog covers | Post header | Built on the post. Omitted from the *list* on purpose — twenty covers is the most expensive screen here, and a column of headlines reads better |

Everything else — products, packages, banners, avatars — is a `ph:` placeholder
until somebody photographs it, and should render as one rather than as nothing.

---

### 6.3 The requirement flow, which is the app's most important screen

Six steps, and the order is not arbitrary — it is what the web learned:

```
1  Which trades?            multi-select; each becomes a lead_domain
2  What, roughly            per trade: items, material source, description
3  Photographs              anonymous POST /uploads/tickets, purpose=requirement_photo
4  Where                    city, locality
5  When and how much        urgency, budget ceiling
6  Verify this number       OTP → account + requirement created in one action
```

**Verification is last, and everything before it stays on the device.** Asking
for an account first is how a form loses the people who opened it. The API
supports this explicitly: `/uploads/tickets` accepts an anonymous caller for
`requirement_photo` and rate-limits by address.

That makes step 6 the risky moment. Persist the draft locally after every step,
and if `POST /me/requirements` fails after the code verifies, the user is now
signed in with an unsaved form — retry against the saved draft rather than
losing it. Test that path deliberately, on a bad connection.

---

## 7. Cross-cutting mechanics

### 7.1 Uploads

`POST /uploads/tickets` returns `{ uploadUrl, headers, assetId, publicUrl }`;
the client PUTs the bytes straight at `uploadUrl` and submits `assetId` with the
form. Photographs never pass through the API — which matters far more on mobile
than it did on the web, since the vendor uploading eight site photos is on
mobile data in somebody's basement.

The mobile client owes three things the web did not:

- **Compress before uploading.** A modern phone camera produces 4–8MB per frame.
  Target the long edge at 2048px and JPEG quality 80 — roughly 400KB, ample for
  proof — and show the saving, because vendors watch their data.
- **A queue that survives the app closing.** Uploads are enqueued with the
  project and stage they belong to, retried with backoff, and resumed on next
  launch. A stage submission that dies in a lift and takes eight photos with it
  is the failure that loses vendor trust fastest.
- **Client-side size and type limits, and no faith in them.** Mirror
  `packages/data/src/uploads.ts`; the backend enforces them again. The client's
  check is a courtesy, not a control.

Four purposes exist, and each decides storage and read-back:
`requirement_photo`, `milestone_proof`, `portfolio_item`, `vendor_document`.

**Blocking:** no bucket is configured yet. Object storage (Cloudflare R2) has to
land before the vendor app's central action works at all.

### 7.2 Push notifications

The API already writes an **outbox** — a notification row inside the transaction
that caused it, drained by `notification.dispatch` every two minutes. Push
extends that, it does not replace it.

What is needed:

- A `device_tokens` table: user, token, platform, app version, last seen.
- `POST /me/devices` and `DELETE /me/devices/:token`. **Delete on sign-out**, or
  the next person to hold that phone gets somebody else's job alerts.
- FCM (and APNs via FCM) dispatch in the existing job, beside SMS. Keep the
  idempotence property the other jobs have — a redelivered push is a bug.
- Deep links per notification type, so a tap lands on the record, not the home
  screen.

The notifications worth pushing, and to whom:

| Event | To | Why it earns an interruption |
| --- | --- | --- |
| New lead assigned | Vendor | Time-critical; first quote in often wins |
| Quote selected / lost | Vendor | Ends their waiting either way |
| Visit scheduled or rescheduled | Both | Someone is travelling |
| Stage approved or rejected | Vendor | Rejection needs re-work now |
| Stage approved | Customer | The progress they are actually waiting on |
| New relay message | Both | |
| Invoice due / overdue | Vendor | |
| Agreement ready to sign | Customer | |

Two rates the platform will have to hold itself to: no push for anything the
person can see next time they open the app, and a quiet-hours window in
`Asia/Kolkata`, matching the crons. A vendor woken at 2am unsubscribes.

### 7.3 Pagination

Every list marked *paged* returns `{ items, nextCursor, total }`. The cursor is
opaque — pass back exactly what was given and never parse it, or moving to
keyset paging server-side breaks the app. `limit` defaults to 24.

Note that the web has **no paging controls at all** — current page sizes cover
seed data, not fifty thousand rows. Mobile infinite scroll therefore ships
first, and is the first real exercise of that cursor. Expect to find bugs there
that the web never had the chance to.

### 7.4 Offline

Online-first, with three deliberate exceptions:

- **Read cache** for catalogue, packages, professionals and the current
  dashboard, so a cold launch on bad signal shows the last state with an
  explicit "as of" timestamp rather than a spinner.
- **The requirement draft** (6.3), persisted per step.
- **The upload queue** (7.1).

Nothing that writes money or state is queued offline. A quote submitted from a
basement two hours ago and delivered now is worse than a quote that failed
loudly at the time — versioning, ordering and the one-live-quote constraint are
all serialised server-side and cannot absorb a time traveller.

### 7.5 Errors, retries and the signing screen

`{ code, message, details? }` on every error. Map, at the interceptor:

| | |
| --- | --- |
| 401 | Clear the session, route to sign-in, say why. No retry |
| 403 | Permission — real for staff-only routes; should never reach a customer |
| 404 | **May mean "belongs to somebody else"**, by design; a 403 would confirm the record exists. Render as not found, never as "no access" |
| 409 | A constraint refused it. Re-read and show the current state — a stale quote version is the common one |
| 429 | Show the retry time |
| 5xx | Retry idempotent GETs twice with backoff; never retry a POST automatically |

**`POST /me/agreements/:id/sign` deserves its own treatment.** It is the largest
transaction in the system — five tables, a locked row, one commission invoice —
and mobile connections drop mid-request in a way desktop ones mostly do not. The
server already guards against two sets of projects. The client must not make it
work harder: disable the control on first tap, send an idempotency key, and on a
timeout **re-read the agreement** rather than resending. If it signed, show the
projects; if not, offer the button again. Never a blind retry.

`X-Request-Id` on every request, echoed in logs and attached to Sentry — the API
already carries this end to end, and it is what makes a customer's screenshot
and a server log the same story.

### 7.6 Masking, on the client side too

The rule is enforced server-side and structurally: `MaskedClientSummary` has no
field for a phone or an email, and no vendor query selects `users.mobile`. The
mobile app should not weaken that, and there are two ways it might:

- **No dialer or SMS launcher anywhere in `feature_vendor`.** Not for the
  customer, not "just for the coordinator". Add a lint or a grep test for
  `tel:` and `url_launcher` inside that package.
- **The address maps launcher is gated on `address != null`**, which the server
  computes per service beside the query. Do not cache an address across
  services; the same customer can be sealed on one and released on another, and
  that is correct.

Port the web's automated masking sweep: walk every `/vendor` response in an
integration test and assert no seed phone number or email appears in any body
the app receives. It found three real leaks on the web.

### 7.7 Money

Whole rupees, integers, `NumberFormat.currency(locale: 'en_IN', symbol: '₹',
decimalDigits: 0)` — Indian grouping, so `₹4,50,000`. Every figure in
`financialNum` with tabular figures. One formatter in `design`, used everywhere;
a screen that formats its own is how `₹450,000` gets shipped.

### 7.8 Store, permissions and compliance

- **Permissions**: camera and photos (vendor proof, requirement photos),
  notifications, and location **only** if a "near me" filter is actually built —
  do not request it speculatively, it costs a review question and a conversion.
  Request each in context, at the moment of use, with a sentence of why.
- **App Store**: two audiences in one binary needs a demo account for each in
  the review notes, or review will bounce it for hidden functionality. Give
  reviewers a seeded customer and a signed vendor.
- **Account deletion is mandatory** on both stores for an app with sign-in.
  There is no endpoint for it today — see 8.
- Privacy manifests (iOS) and a Data Safety form (Play) covering phone number,
  photos, and address.

---

## 8. The backend — done

None of this was large, and all of it was blocking. It is built, and the shape
it took follows one rule: **an account with a lead time must not be able to stop
the platform running.** An SMS gateway needs DLT registration, a bucket needs a
Cloudflare account, push needs a Firebase project — weeks each, outside anyone's
control, and previously each one was a hard stop. Every one now has a working
local path, chosen by `auto` and stated in the startup log.

| | What | Where |
| --- | --- | --- |
| 1 | **Bearer sessions.** `X-Client: mobile` returns `sessionToken` on both sign-in endpoints; every route accepts `Authorization: Bearer`. Same session row, same SHA-256 storage, same immediate revocation — not a JWT | `modules/auth/sessions.ts`, `lib/guard.ts` |
| 2 | **Storage drivers.** `r2` presigns at Cloudflare; `local` presigns at this API and serves the files back. Uploads now work with no bucket at all | `lib/storage.ts`, `routes/media.ts` |
| 3 | **SMS drivers.** `msg91`, `console` (code to the log), `file` (an outbox somebody tails and sends by hand). Sign-in works before DLT registration lands | `lib/sms.ts` |
| 4 | **Push.** `device_tokens` extended and read for the first time, FCM v1 with a `log` driver, `POST /me/devices`, dispatch folded into the existing outbox job | `lib/push.ts`, `modules/auth/devices.ts`, `jobs/tasks.ts` |
| 5 | **Account closure.** `POST /me/account/delete`, with a retention rule written down | `modules/auth/closure.ts` |
| 6 | **Version gate.** `GET /app/version` and `MOBILE_MIN_BUILD` | `routes/auth.ts` |
| 7 | Migrations `0008_mobile_devices.sql` and `0009_scoped_writes.sql` | `drizzle/` |
| 8 | `tests/mobile.test.ts` and `tests/scoped-writes.test.ts` — 25 tests | `tests/` |

Four decisions inside that are worth knowing, because each was a fork:

**Storage may be local in production, but never by accident.** `auto` refuses to
fall back there. Silently writing customer photographs to a container's
ephemeral disk is a data loss with no error and no log line; choosing
`STORAGE_DRIVER=local` explicitly means a mounted volume, which is a perfectly
good way to run this.

**SMS became a warning rather than a boot failure.** The API used to refuse to
start without MSG91, reasoning that nobody could sign in. True, and the wrong
response — a pending DLT registration should leave a running platform an
operator can work through, not a service that will not start.

**One-time codes go to the log, never to a queue staff can read.** `console` is
readable by somebody with server access, who already has the database, so it
grants no new capability. A staff-visible OTP queue would grant a real one:
sign-in as any customer. That line is why there is no `manual` driver.

**Device registration writes on the unscoped pool.** Under row-level security
the row belonging to the handset's previous owner is invisible to its new one,
but the unique index still refuses the insert — so the phone-changes-hands case
would fail. The user id still comes from the session and is never a parameter.

### Three bugs this turned up, two of them serious

**No multi-table write on `/me` or `/vendor` worked at all.** A scoped request
runs on a connection from `postgres.reserve()`, and a reservation does not carry
`begin` — that lives on the pool — so drizzle's `transaction` threw
`this.client.begin is not a function` on every scoped write. `POST
/me/agreements/:id/sign`, the largest transaction in the system, answered 500
for every customer, and had done since row-level security landed. The existing
suite missed it because it exercised the policies through *reads*.

**And signing failed a second time underneath that.** Every policy was written
`FOR ALL USING (...)` with no `WITH CHECK`, so Postgres applied the read rule to
writes — and signing raises the **vendor's** commission invoice inside the
customer's transaction. "No customer sees a commission figure" is correct and
was standing in for a write rule it was never meant to be. Migration 0009 splits
them.



**The write rate limiter read the cookie directly.** Every mobile write would
have been keyed by IP and charged the *anonymous* 40-per-five-minutes allowance
rather than 300 — behind a mobile carrier's NAT, one allowance shared across a
great many customers, surfacing as sporadic 429s nobody could reproduce on a
laptop. It now reads through `sessionTokenFrom` like everything else.

**The storage path guard sanitised instead of refusing.** `../../../etc/passwd`
became `etc/passwd` — safely inside the media directory, and therefore silent
about having been asked for something else. Caught by the test that asserted the
behaviour its own comment claimed.

### What is left, and none of it blocks

- **DLT registration, an R2 bucket and a Firebase project.** Still worth
  starting now — they are still weeks — but nothing waits on them any more. Each
  is one environment variable when it arrives
- **Signed read URLs.** Reads are public under both drivers, which is right for
  a photograph behind an unguessable uuid and wrong for `vendor_document`

`npm test` from `apps/api`: **111 passed, 9 files, nothing skipped.**

## 9. Phasing

Continuing the milestone numbering in `CONTEXT.md`, which ends at M7.

| | Phase | Contents | Done when |
| --- | --- | --- | --- |
| **M8** | Foundation | Workspace, flavours, design package with tokens/theme/components, token goldens, generated `core_api`, dio + interceptors, go_router skeleton, CI (analyze, test, golden, build both platforms) | The component gallery renders every state, and goldens pass |
| **M9** | Identity | Bearer session, OTP screens with whole-code paste, secure storage, role routing, 401 handling, biometric resume | All three sign-in paths work on device, including a new number creating a customer |
| **M10** | Vendor app | Onboarding gate and partner agreement, dashboard, leads, quote builder, relay messages, visits with address release, **stage proof with the upload queue**, invoices, performance, portfolio | A vendor completes a real job end to end on a phone, and the masking sweep is green |
| **M11** | Customer app | Home, catalogue, professionals, search, blog, the requirement flow, requirements and quote comparison, agreements and signing, projects, messages, notifications, support, referrals | **Every customer row in section 1 reads "done"**, and one requirement runs from submission to a signed agreement on a phone |
| **M12** | Notifications and polish | Push end to end, deep links, offline read cache, empty and error states, accessibility pass, `textScale` 1.3 goldens, Hindi decision from 3.4 | Every push in 7.2 lands on the right screen |
| **M13** | Release | Store listings, screenshots in the design language, review demo accounts, privacy manifests, account deletion, forced upgrade, staged rollout, Sentry release tagging | Both stores approve; crash-free sessions measured |

**Read the "Done when" column as a floor, never as the definition.** M11's used
to say only *"one requirement runs from submission to a signed agreement on a
phone"* — which a build can satisfy while skipping the catalogue, product
detail, packages, the professional profile, search, notifications, support and
referrals, all of which are named two columns to its left. That is exactly what
happened: M11 was declared complete, and the browse half of the customer app did
not exist. A phase is finished when section 1 says so.

The API side of section 8 is done, so M8 starts against a backend that already
speaks bearer sessions, stores uploads, and has somewhere to send a push. The
three third-party accounts still have their lead times and are still worth
starting today — but none of them blocks a phase any more, which is the point of
having built the local drivers rather than waiting.

M10 before M11 for the reason in section 2: the vendor gains the most from being
native, and the vendor surface exercises uploads, masking and the relay — the
three mechanics most likely to surface a design or contract problem. Finding
those in M10 is much cheaper than finding them in M12.

Rough sizing, for a team of two Flutter engineers with the API side staffed
separately: M8 3–4 weeks, M9 2 weeks, M10 7–9 weeks, M11 8–10 weeks, M12 3–4
weeks, M13 2–3 weeks. Call it six to eight months of two-engineer time, which is
consistent with `CONTEXT.md`'s note that the mobile apps are "comparable in size
to everything done so far". Treat these as sizes, not as a commitment.

---

## 10. Open questions

Each of these changes what gets built, and each needs an answer from the client
rather than a default.

**"Should mobile have X?" is not an open question and does not belong here.** If
the web app has X, mobile has X — that is section 1, and it is settled. Question
3 below was asked in that shape, sat unanswered for a phase, and the browse half
of the app was quietly deferred behind it. What belongs here is a genuine
product decision: a platform behaviour, a regulatory boundary, an ownership
question. Not a scope negotiation the web already won.

1. ~~**Hindi at v1?**~~ **Answered: yes.** Both shells are fully translated —
   `packages/design/lib/src/l10n/` holds the tables, and `app/test/l10n_test.dart`
   fails the build on an untranslated string or an orphaned entry. The
   Devanagari fallbacks are named in `AanganFonts`; the `.ttf` files are still
   outstanding alongside Newsreader and Manrope, and RELEASE.md tracks all four
   together. Copy the *server* writes — error messages, onboarding step labels,
   `blockedReason` — is still English, and translating it is a server change.
2. **Dark mode at v1?** (3.8) Recommendation is no, deliberately.
3. ~~**Does the customer app need the blog and the estimator?**~~ **Answered:
   yes, both — and the question should never have been asked.** The web has
   `/blog` and `/estimate`, so the answer was determined before anybody asked
   it. Built as `blog_screen.dart` and `estimator_screen.dart`, reached from the
   Explore tab rather than from tabs of their own — five tabs is the ceiling 6.1
   sets. The estimator's rate table is compiled into the app so it answers with
   no network at all, which is the point of it; the cost is that the rates now
   live in two repositories, and `estimator.dart` says so.
4. **Payments.** The whole prototype is built on escrow, and the platform
   deliberately has none. If off-platform payments are ever revisited, it is its
   own phase with the most regulatory weight — and it changes several screens
   here. Confirm it stays out.
5. ~~**Vendor bank details** (`bank` onboarding step).~~ **Answered: not
   required, and the step is gone.** Aangan handles no money — a customer pays
   their professional directly, and the platform's only invoice is for
   commission — so there was nothing to send a vendor and no account number
   worth the liability of storing. The step also asked for "payment details" and
   then quietly checked whether a GST number was present, which no screen in the
   product could set. Removed from `onboardingStepKeySchema`, from the API and
   from the mock; there are six steps now, not seven.
6. **Who owns the design system after M8?** These tokens will be asked to cover
   screens nobody has drawn yet. Someone has to decide what a new component
   looks like, or the second engineer invents a second system.

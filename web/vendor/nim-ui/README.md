# nim

The front-end design system and UI kit shared across nim products.

nim is two things in one package: a **token contract** that defines the vocabulary
a product interface is allowed to speak, and a **React kit** that speaks only that
vocabulary. Swapping the theme changes every screen at once, because nothing
downstream of the contract holds a literal value.

## Install

```bash
npm install @nim.zone/ui react react-dom
```

```tsx
import { NimProvider, Button } from '@nim.zone/ui'
```

The stylesheet ships with the import, so nothing else is required. Consumers that
need the raw token contract without the React kit can import
`@nim.zone/ui/styles.css`, `@nim.zone/ui/src/theme/index.css` or
`@nim.zone/ui/fonts.css` directly. `react` / `react-dom` >= 18 are peers.

Published from `nim-ui/` in this repo (`npm publish`, which runs `npm run build`
first). Repo-local development uses the scripts below.

---

Reference implementation: `../vlora-app` — its architecture (flat CSS-variable
tokens, thin components that compose semantic class names, all styling in
`@layer components`, RTL- and mobile-first) is the shape nim generalises.

```bash
npm install
npm run dev         # the docs gallery — every token, component, variant, state
npm run build       # the distributable kit  → dist/nim.js + dist/nim.css
npm run build:docs  # the gallery, published to the site → nim.zone/uikit
npm run typecheck
```

The gallery covers three pages: **Foundations** documents colour,
type, space and fixed sizes, shape, elevation, focus, density and motion — the
motion section runs the three easing curves side by side and reports whether
your own OS is asking for reduced motion — and **Components** shows every
variant, size and state; **Flows** runs the ten screens a product is judged on
before it is used — the intro carousel, the sign-in, a wizard, a conversation
with voice, video and file messages, a checkout, a long-running job, the plan
picker, the profile, the app shell and an operator console — each mounted and
working, the phone ones in a 390pt frame. The language switch puts the whole thing into Farsi and RTL rather
than mirroring English.

The gallery is published as part of the personal site: `build:docs` emits into
`../apps/nim/public/uikit`, which the site serves at `/uikit/` and
ships in its Docker image. That output is committed, so a site deploy needs no
knowledge of this package; rerun `npm run uikit` from the site (or `build:docs`
here) whenever the kit changes.

---

## What changed in 0.7

0.7 is a **completeness and finish** pass rather than a new layer: the kit was
measured against what Material and Ant Design consider table stakes, the gaps
that were real were filled, and the states the kit was drawing with colour
alone were taught to survive without it. No token was removed and no component
changed shape.

**The gaps that were real**

- `RadioGroup` + `Radio` — the one form primitive the kit did not have. A
  `<fieldset>` with a real `<legend>`, because the question a radio set asks
  has to be announced *before* the answers; a paragraph above the group is
  unrelated text to a screen reader. `Segmented` sets a value among three or
  four short ones — a radio group is for answers with descriptions, and for
  more of them than fit on a line.
- `Accordion` — disclosure built on `<button aria-expanded>` and a
  `grid-template-rows: 0fr → 1fr` panel, not on `<details>`: `<details>` cannot
  animate its own open state and cannot be driven from outside without fighting
  the element. The grid row is what lets a panel open to its *content's* height
  with nothing measured in JavaScript and no `max-height` guess to overshoot. A
  collapsed panel is `inert`, so its controls leave the tab order rather than
  staying reachable at zero pixels tall.
- `Chip` + `ChipInput` — a chip is an **object** (a filter in force, a
  recipient, a tag); a badge is a **label about** an object. That is why a chip
  can be pressed and removed and a badge never is, and a badge with an × in it
  is a chip wearing the wrong name. The remove control is a *sibling* button,
  never nested — a button inside a button is invalid markup and the inner one
  stops being reachable.
- `Timeline` — an ordered list, because the claim a timeline makes is the
  order. The rail is drawn by each entry and skipped on the last, so it stops
  at the final marker instead of trailing into the whitespace below.
- `DataList` — a `<dl>`, the one element the platform has for "these labels
  describe these values". A row whose value is missing still renders: an empty
  field is information, and hiding it makes two records with different data
  look alike.
- `Rating` — radios behind stars, so arrow keys, form submission and "3 of 5
  selected" come from the platform. A partial star is *clipped*, not faded:
  4.3 has to look like 4.3 rather than like four pale ones.
- `FileDrop` — the dropzone **is** a `<label>` around a real
  `<input type="file">`, so click, Enter, Space and the platform picker work
  with no key handlers of our own. The highlight is driven by a depth counter,
  because `dragenter`/`dragleave` fire for every child the pointer crosses —
  toggling a boolean is why most dropzones flicker over their own icon. It
  takes files and nothing else: uploading, progress and retries belong to the
  product, which has already chosen a transport and an error vocabulary.
- `Inline` now speaks `Stack`'s `gap` vocabulary (`tight` · `md` · `loose`)
  and a `wrap` escape. A page that says `tight` one way and writes a style
  attribute the other has two spacing systems, not one.

**Finish**

- **Forced colours.** Windows High Contrast substitutes every colour and drops
  most backgrounds, which silences anything the kit says with fill alone — a
  checked box, a selected segment, a toggled chip, an elevated surface, the
  focus ring itself (box-shadows are removed outright). Each of those is now
  restated with a border, an outline, or a system colour, and the three
  components that *are* fill by nature keep `forced-color-adjust: none`.
- **The RTL slider.** `linear-gradient` takes physical directions, so the
  filled half of the rail was the one part of the control that mirroring did
  not fix for free. It is corrected once, on the track, rather than by flipping
  the whole control.
- **Six more contract tokens.** The checkbox, the switch and the slider handle
  were drawing themselves from literals inside `components.css` — outside the
  contract, so a style could not answer them. `--nim-size-check`,
  `--nim-size-switch-inline` / `-block` / `-thumb`, `--nim-size-rail` and
  `--nim-size-thumb` close that, and the switch's travel is now derived from
  its own geometry instead of being a hard-coded `18px` in two places.
- **Motion where a control had none.** The slider handle grows under the
  pointer and again while dragging — the only feedback a slider can give
  before the value has moved — and the radio's inner disc scales from nothing
  rather than appearing.

---

## What changed in 0.6

0.6 is a second sweep through the reference apps — `vlora-app` for the phone
flows, `vlora-admin` for the console — pulling out the screens the family kept
rebuilding. Nothing was removed and no token changed.

**From the app**

- `Wizard` + `ChoiceGrid` — the one-question-per-screen flow behind Vlora's
  daily reflection: step dots, a back control, a close control that is always
  present, and a CTA gated on the step's own `canContinue`. The step index is
  the wizard's; the answers stay the caller's, because every product's are
  shaped differently and a shell that owned them would have to know. The grid
  states "pick one" or "pick any" in ARIA rather than implying it, and a
  capped multi-select disables the rest instead of hiding them, so the grid
  does not reflow under a finger.
- `OrderSummary`, `OptionCard`, `ActionBar` — the checkout, in three parts.
  Every figure is a `ReactNode` the caller already formatted: money is the last
  thing a UI kit should be rounding, and a component taking numbers would have
  to guess a currency, a tax rule and a digit shape. `OptionCard` keeps a real
  radio inside the plate, so a set of payment methods or saved addresses is a
  real radio group with arrow-key movement and a name that submits.
- `TaskProgress` — a long job with named stages, from the scan pipeline. The
  stages are the point: a percentage tells someone how long to wait, a named
  stage tells them which part failed, which is the difference between "try
  again" and "try again in daylight". Failure is a state of a step, not a
  replacement for the list.

**From the admin**

- `AdminShell` — grouped sidebar, topbar, one scrolling workspace. The
  counterpart to `AppShell` rather than a variant of it: a console is
  desktop-first, two-column and deeply nested; a phone app is one column with
  five destinations, and sharing a component would make every screen carry the
  other's assumptions. Below 60rem the same sidebar becomes a drawer — the same
  markup, so the two cannot drift. The breakpoint is a **container** query, so
  a console embedded in a panel answers its own width rather than the window's.
- `DetailHeader` — where a record sits, what it is, and what can be done to it.
  The actions are at the top, because an operator working a queue acts without
  reading the whole record and a button under a thousand rows is a button
  nobody finds. The status badge sits beside the heading, never inside it: an
  `<h1>` that swallows a badge is a heading whose name is "Payment #48210
  Awaiting review".
- `FilterChips` — the filters narrowing a table, each removable, each naming
  what it removes. It renders nothing when there are none rather than reserving
  an empty strip.
- `ActivityFeed` — who did what, with absolute timestamps. An audit trail is
  read to reconstruct a sequence, and a relative time that keeps moving is
  exactly what you cannot compare two of.

---

## What changed in 0.5

0.5 does two things: it makes the flows **mountable** rather than composable-in-
principle, and it adds the one surface the kit had no answer for at all — a
conversation.

**Flows you can mount**

0.3 shipped the parts of a sign-in; a product still had to write the step
machine, the countdown and the error states itself, which is exactly the code
that gets written differently in every app and wrong in most of them. 0.5 ships
the assembled screens, each holding its own state:

- `SignInFlow` — phone → code, or email → password, with the resend countdown,
  the loading and error states and the step machine already wired. Hand it three
  async functions; `onVerifyCode` resolving *is* success, and routing stays the
  app's, made in one place instead of at five exits.
- `PlanPicker` — billing period, the tiers, one action. Keeps the cycle and the
  prices in step and hands `onSubmit` the pair a checkout needs. It takes no
  payment handler: a plan picker that also knows how to charge is two screens
  welded together, and only one of them is the same across products.
- `ProfileScreen` — the identity plate plus grouped rows declared as *data*: a
  label, an icon, and either somewhere to go or something to toggle.
- `AppShell` — sticky header, one scroll region, the tab bar, and content that
  reserves the room the floating bar covers.

The parts they are built from (`AuthScreen`, `PhoneField`, `OtpInput`,
`PasswordField`, `PlanCard`, `ProfileHeader`, `TabBar`) are unchanged and still
exported: use them directly when a product's flow differs — an invite-code step,
a captcha, a tenant picker. The assembled component is the common shape, not the
only one.

**Chat**

`Chat` + `ChatComposer` carry text, voice, video, images and files.

- Media plays in the platform's own elements. `<audio>` gives a voice message a
  decoder, the OS media keys and playback that survives a backgrounded tab;
  `<video controls>` brings picture-in-picture, captions and AirPlay. Only the
  transport around them is drawn — the waveform is a scrub bar over a real
  control, not a replacement for one.
- Voice is recorded in place with `MediaRecorder` over `getUserMedia`. Where
  either is missing — an old browser, an insecure origin — the button is not
  rendered rather than offered and then failing, and the stream's tracks are
  stopped on every exit path including unmount, so the microphone indicator
  never outlives the recording.
- The transcript follows the newest message *only when the viewer is already at
  the bottom*. Yanking someone back down while they read history is the single
  most common chat bug, and it is a scroll check rather than a scroll call.
- Nothing here uploads, transcodes, or holds a socket. `onSend` gets the draft
  and `onFiles` gets the original `File`s, because an object URL is for showing
  and a `File` is for uploading and the caller needs both.

---

## What changed in 0.4

0.4 answers the one limitation 0.2 and 0.3 both shipped with: the calendar was
Gregorian, and an Iranian product had to build its own. `Calendar`, `DateField`
and the new `DatePicker` now draw the **Jalali** calendar as readily as the
Gregorian one, following the locale unless told otherwise.

- `lib/calendars.ts` — calendar arithmetic for both systems, with no table and
  no leap rule: `Intl` is the source of truth and the inverse is corrected
  against it. See [the Jalali calendar](#the-jalali-calendar) for why, and for
  the range it was verified over.
- `Calendar` and `DateField` take `system="persian" | "gregory"`. The formatter
  no longer pins `gregory` — it could not before, because the grid was Gregorian
  and an `fa` label would have contradicted it. Now they agree either way.
- `DatePicker` — the compact form generalised from `iranianlawclub-web`'s Jalali
  picker: one field, the month behind a button, a clear control, and the other
  calendar's reading under it. Use it in a form; `DateField` is for the screen
  whose subject is the date.
- Typed entry stays platform-first where the platform has something to offer,
  and is a validated text field where it does not.

No token changed and nothing was removed, so 0.3 → 0.4 is a version bump. The
kit still has one runtime dependency: `react-aria-components` and
`@internationalized/date`, which the source picker used, are not part of it.

---

## What changed in 0.3

0.3 adds the **flows** layer: the screens every product in the family rebuilds
by hand on day one, generalised out of `vlora-app` and put behind the same
contract as everything else. No token changed, nothing was removed, and no
runtime dependency was added — upgrading from 0.2 is a version bump.

**Sign-in**

- `PhoneField` — a country picker welded to a number input, covering every ISO
  3166-1 country and territory. The table carries only the ISO code and the
  dialling code; the name comes from `Intl.DisplayNames` in the viewer's locale
  (so a Persian page lists «آلمان»), and the flag is derived from the code's
  regional indicators rather than shipped as 250 images. Country and national
  digits are separate props: a field owning one E.164 string has to re-parse it
  on every keystroke to know which flag to draw. `toE164(country, national)`
  does the joining.
- `OtpInput` — the boxed code. One `<input>` per digit but a single string in
  the caller's state, so a keystroke, a paste and an SMS autofill take the same
  path and cannot disagree. Pinned `dir="ltr"` even in a Persian page, and
  Persian and Arabic-Indic digits are normalised to ASCII on the way in.
- `PasswordField` — reveal toggle and an optional strength meter. Revealing is a
  real `type` swap, so a password manager still sees a password field. Scoring
  stays the caller's: a meter that disagrees with the server's policy is worse
  than none. `scorePassword` is the default for products without one.
- `AuthScreen` — the frame all three steps share, which is what makes them read
  as one screen changing rather than three screens, and puts the CTA in the
  place a thumb has already learned.

**The rest of the first session**

- `Onboarding` — the three-screen intro: art, a promise chip, a title that
  breaks where the copy says it does, dots that are also controls, and one CTA
  that advances. `onDone` fires from finish and from skip, so the caller routes
  in one place.
- `TabBar` — the floating bottom navigation, with an optional lifted centre
  action. It renders real links or buttons with `aria-current`; routing stays
  outside via `renderItem`, which is why the kit still ships no router.
- `PlanCard` — one subscription tier as the control itself, with included,
  pending and excluded features all shown. Prices are `ReactNode`: currency and
  digit shaping are the product's locale decision, and a kit that formatted them
  would be wrong in Persian first.
- `AvatarRing` and `ProfileHeader` — an avatar wearing a progress ring, and the
  identity plate above a profile's sections.

---

## What changed in 0.2

0.2 is a finish pass, not a new architecture: the token contract, the thin
components and the platform-first rule are unchanged. What it fixes is the
craft, plus the components a product runs out of on its first screen.

**Accessibility**

- Keyboard focus is now visible on every focusable surface. `--nim-shadow-focus`
  was defined by every theme and consumed by exactly one rule, so tabbing
  through a nim screen showed nothing.
- `IconButton` at 36px keeps a 44px target. The contract already said 44px is
  "never reduced, only visually inset"; the small variant did not honour it.
- `prefers-reduced-motion` is honoured — see the accessibility floor above for
  why three animations deliberately survive it.

**Contract**

- Nine sizing literals (`6px` dots, avatar sizes, the progress track, the sheet
  handle, spinner sizes, a `2px` subtitle margin) moved out of `components.css`
  and into `--nim-size-*`. A literal there is a decision a theme cannot answer.
- `--nim-accent-hover` and `--nim-danger-hover` are new rungs, so every emphasis
  hovers along its own tone ramp. `filter: brightness(0.92)` — the one hover no
  theme could answer, and which inverted in dark — is gone.
- `--nim-type-control-*` splits control text off the label role. A ledger button
  set in 12px tracked mono read as a caption; labels keep that voice, controls
  no longer borrow it.
- `--nim-leading-base` is new, and the leading rungs are now ordered in every
  preset. `vlora`'s `tight` (1.62) used to be looser than `ledger`'s `relaxed`
  (1.66), so a component asking for tight leading got opposite intent depending
  on the active theme.

**Craft**

- Press is one composite applied identically to buttons, icon buttons, rows and
  cards. Interactive cards previously applied `scale` only, which is `1` on the
  ledger presets — the largest tap target in the kit answered a press with
  nothing.
- Primary hovers to `--nim-ink-secondary` instead of jumping to the accent,
  which changed hue under the pointer and made primary and accent identical at
  the moment of choosing between them.
- The selected segment takes a border on four sides. `--nim-shadow-sm` is a
  bottom hairline on the ledger presets, so the selection read as an underline.
- Dark is rebuilt around visibility rather than symmetry with light: the line
  ramp lifts (this is a hairline theme — rules are load-bearing), offset shadows
  are drawn in true black rather than in the line colour, and
  `--nim-surface-muted` no longer equals `--nim-surface`, which had made a
  hovered row invisible. The root dark fallback also stopped relying on a
  hand-maintained theme exclusion list that had already fallen a theme behind.
- `Stat` and table figures set in tabular numerals.

**Two axes instead of four themes**

`data-nim-theme` is gone, replaced by `data-nim-style` (`ledger`, `vlora`) and
`data-nim-colorway` (`vermilion`, `oxblood`, `coral`, `teal`) — see the section
above for why. `NimProvider` takes `defaultStyle` and `defaultColorway`;
`useNim()` returns `style` / `colorway` / `setStyle` / `setColorway`. Every
palette value is unchanged; `oxblood` went from 220 lines to 6, and the
stylesheet lost 15% of its weight to the dark blocks that no longer need
duplicating.

**New**

Eleven components: `Dialog`, `Menu`, `Popover`, `Tooltip`, `Tabs`, `Table`,
`Combobox`, `DateField` / `Calendar`, `Stepper`, `Pagination`, `Breadcrumb`.
Plus `--nim-density`, and `forwardRef` on `Button` and `IconButton` — overlays
anchor to their trigger, and no component forwarded a ref before.

### Upgrading

One breaking change, mechanical:

```diff
- <NimProvider defaultTheme="vlora" defaultScheme="dark">
+ <NimProvider defaultStyle="vlora" defaultColorway="coral" defaultScheme="dark">
```

`ledger` → style `ledger` + colourway `vermilion`; `oxblood` → `ledger` +
`oxblood`; `vlora` → `vlora` + `coral`; `fatemifar` → `vlora` + `teal` plus the
font override shown above. Any markup setting `data-nim-theme` by hand sets the
two attributes instead. `useNim().theme` / `setTheme` become `style` /
`colorway` and their setters.

Nothing else was removed, so the rest is a visual review. Look at: buttons and segmented options (larger, set in
the sans rather than the mono on the ledger presets), anything relying on
primary's hover turning accent, and any app that set `--nim-leading-tight`
expecting `vlora`'s old 1.62.

A deliberate omission: the command palette shown in the 0.2 design review is not
in this release. It is app-shaped — it has to know the whole product's actions —
and composes from `Dialog` and `Combobox` in the meantime.

---

## Principles

1. **Tokens are the system.** A colour, radius, shadow, or type value may appear
   in exactly one place: a theme file. A literal in `components.css` is a bug —
   it is a decision that escaped the contract.
2. **Semantic names only.** `--nim-accent`, never `--nim-orange`. `--nim-surface`,
   never `--nim-gray-100`. Names describe the role, so a theme can answer them
   however it wants.
3. **Thin components.** A component maps props to class names and renders the
   right element. It does not hold styles, and it does not hold layout opinions
   about the page around it.
4. **The platform first.** Checkboxes are `<input>`, tabs are `role="tablist"`,
   a row that does something is a `<button>` or an `<a>`. Behaviour that the
   browser already gets right is never re-implemented.
5. **Logical properties only.** No `left`/`right`. RTL therefore needs no mirror
   stylesheet — direction is a single `dir` attribute.
6. **Spacing belongs to the page.** No component sets outer margin. `Stack` and
   `Inline` express rhythm at the call site.

---

## Architecture

```
src/
  theme/
    contract.css        the vocabulary — invariants, the scheme switch, and the
                        two checklists a style and a colourway must answer
    styles/ledger.css   style · square, hairline, hard offset, mono labels
    styles/vlora.css    style · rounded, soft elevation, sentence-case labels
    colorways/paper.css       neutrals shared by vermilion + oxblood
    colorways/vermilion.css   print vermilion   (default)
    colorways/oxblood.css     wax-seal red      (6 declarations)
    colorways/coral.css       warm cream + coral
    colorways/teal.css        clinical teal
    reset.css           scoped to .nim-root, never global
    components.css      the only file that draws anything
    index.css           import entry (order is load-bearing)
  components/           one file per component, thin by construction
  lib/                  cn() and useAnchor(), the kit's only helpers
  index.ts              the public surface
docs/                   the gallery — the kit's first consumer
```

Import order in `index.css` matters: contract → styles → colourways → reset →
components. The reset is applied inside `.nim-root` so nim can live beside
another design system.

---

## Two axes: style and colourway

nim separates **how an interface is shaped** from **how it is coloured**, and
they are set independently.

A **style** owns shape, elevation geometry, type voice and press. A
**colourway** owns surfaces, ink, lines, accent, status, and the tint the
style's shadows are drawn in. Neither knows anything about the other: a style
names no colour, and a colourway names no radius.

| Styles | `ledger` (default) | `vlora` |
|---|---|---|
| Shape | `0` — square | `6–24px` — rounded |
| Elevation | hard offset register mark | soft ambient shadow |
| Labels | mono, uppercase, wide-tracked | text face, sentence case |
| Leading | tight (1.45 base) | loose (1.84 base) — Persian needs the room |
| Press | shifts into its shadow | compresses |
| Default face | Geist / Geist Mono | Vazirmatn |

| Colourways | `vermilion` (default) | `oxblood` | `coral` | `teal` |
|---|---|---|---|---|
| Voice | print & record | law & institution | warm consumer product | clinical care |
| Canvas | warm paper `#f7f4ee` | warm paper `#f7f4ee` | warm cream `#faf9f6` | cool mist `#f6faf9` |
| Ink | near-black `#17150f` | near-black `#17150f` | slate `#131314` | near-black `#1d1d1f` |
| Accent | vermilion `#b82f18` | seal red `#6b1f2a` | coral `#d97757` | teal `#00baba` |

```tsx
import { NimProvider } from '@nim.zone/ui'   // the stylesheet comes with the import

<NimProvider defaultStyle="ledger" defaultColorway="oxblood">
  <App />
</NimProvider>
```

`NimProvider` writes `data-nim-style` / `data-nim-colorway` / `data-nim-scheme`
/ `dir` onto both its own wrapper and `<html>`, so portalled surfaces — sheets,
dialogs, menus, toasts — inherit them from outside the React tree.

The pairings that carry a product's identity are `ledger` + `vermilion` (nim
itself), `ledger` + `oxblood` (legal), `vlora` + `coral` (Vlora), and `vlora` +
`teal` (Fatemifar) — but the axes are genuinely orthogonal, so `ledger` + `teal`
is a legal thing to try rather than a mistake.

### Why two axes rather than more presets

Before 0.2 these were four self-contained themes. `oxblood` was 220 lines that
duplicated **98 identical tokens in order to change 6** — its accent family —
and `fatemifar` was mostly `vlora` with the neutrals rotated toward its accent.
Every new palette meant a new copy of the whole contract, and every structural
fix had to be applied four times or silently skip a preset. Splitting the axes
made `oxblood` six declarations.

### Schemes

Every colour in a colourway is a `light-dark()` pair, and `color-scheme` picks
a side. So a colourway is one block: no duplicated dark rule, no
`prefers-color-scheme` query per palette, and no hand-maintained exclusion list
to fall behind — which is exactly how a preset ended up inheriting another's
dark palette before 0.2.

`defaultScheme` takes `light`, `dark`, or `system`. `system` sets no attribute
at all and lets the OS decide.

### Fonts

The typeface belongs to the style, and an app with its own brand face overrides
it on the provider — the font file is a product asset the app already ships, so
nim owns the vocabulary rather than the face:

```tsx
<NimProvider defaultStyle="vlora" defaultColorway="teal"
  style={{ '--nim-font-sans': "'YekanBakh', 'Vazirmatn', system-ui, sans-serif" }}>
```

**Vazirmatn** — the Persian face this repo's Farsi products already use — ships
as an optional stylesheet, because a stylesheet that requests font files the
host does not serve produces 404s and a flash of fallback:

```tsx
import 'nim/fonts.css'   // then serve the three subsets at /fonts/
```

It declares one variable file per subset (arabic, latin-ext, latin) at weight
100–900, the same three files `vlora-app`, `vlora-web`, `vlora-admin` and
`iranianlawclub-web` already serve from `public/fonts/`. Both styles already
name `Vazirmatn` in their stack — `ledger` after Geist, `vlora` first — so
Persian text falls through to it as soon as it loads, and Latin text does not
move.

---

## RTL and Persian

Direction and language are separate settings, and nim treats them that way:
`dir` says which way the line runs, `lang` says which script is being set. Only
the second implies typographic corrections, because an RTL page of Latin text
wants none of them.

```tsx
<NimProvider direction="rtl" locale="fa-IR">
```

**Layout** needs nothing: the whole component layer is written in logical
properties, so there is no mirror stylesheet.

**Directional icons** mirror; the rest do not. A "forward" arrow points left in
Persian, but a checkmark and a plus mean the same thing in both directions.
Which glyphs are directional is decided once, in `components/icon.tsx`, rather
than per component — mirroring whole SVG subtrees per component is how RTL
interfaces end up with backwards checkmarks.

**Script corrections** live in `theme/persian.css` and key off `lang`, not
`dir`. Two of nim's type tokens are actively harmful to a joined script and
neither is a style's fault — they are correct for Latin:

- `--nim-label-tracking` is 0.12em on the ledger style. Tracking a Persian word
  does not space it out, it breaks the joins.
- negative tracking on display and title sizes does the same thing more subtly.

So under `lang="fa"` the tracking tokens go to zero, `text-transform` is
dropped, `font-feature-settings: 'calt' 1, 'kern' 1, 'ss01' 1` is turned on, and
the ledger style's Latin-tuned leading is loosened to the room Persian needs.
The `vlora` style already builds all of this in.

**Formatting.** `locale` reaches components through `useNim()`, so `Calendar`
takes its month names, weekday names, week start (Saturday for `fa`) and digits
from it rather than hardcoding English and `0–9`.

### The Jalali calendar

`Calendar`, `DateField` and `DatePicker` draw either calendar. Unset, the system
follows the locale — an `fa` interface gets Jalali months, Persian digits and a
week that starts on Saturday; everything else gets Gregorian — and `system` pins
it explicitly:

```tsx
<DatePicker label="تاریخ جلسه" value={hearing} onChange={setHearing} />        // Jalali under fa
<DatePicker label="Hearing" system="gregory" value={h} onChange={setH} />      // pinned
```

**The value never changes.** An `IsoDate` is the Gregorian `YYYY-MM-DD` in both
systems: the calendar is what the viewer reads, not what the API receives. A
picker on the Jalali calendar shows the Gregorian equivalent under the field —
the reconciliation an Iranian office does by hand all day — and it is the same
date, not a second value.

`lib/calendars.ts` holds no conversion table and no leap-year rule, because the
platform already ships one: `Intl` with `-u-ca-persian` is ICU's Persian
calendar. The hard direction (Gregorian to Jalali) is asked of `Intl`; the easy
one is a mean-year estimate corrected against that same answer until it
round-trips. Month lengths are *measured* — the distance to the first of the
next month — so an Esfand of 30 days needs no special case, and nothing here
goes stale in 1408. Every day from 1900 to 2100 round-trips exactly, and the
leap years it produces are the known Jalali set.

Typed entry differs by system on purpose. Gregorian is `<input type="date">`:
the mobile date keyboard, the locale's field order and form validation come
from the platform. No browser ships a Jalali date input, so that side is a text
field reading `۱۴۰۴/۰۶/۰۱` which accepts Persian digits and commits only what
round-trips through ICU.

### Adding a style or a colourway

Copy the nearest neighbour and answer its half of the checklist at the bottom of
`contract.css` — the list is split into "required of a style" and "required of a
colourway". Add the id to `NimStyle` or `NimColorway`. Nothing else changes: no
component, no class name, no markup. A colourway sharing an existing neutral set
adds itself to the grouped selector in `colorways/paper.css` and states only its
accent, which is all `oxblood` is.

---

## Components

| Group | Exports |
|---|---|
| Actions | `Button` · `IconButton` |
| Content | `Card` · `Badge` · `Chip` · `Stat` · `ResourceMeter` (measured or capacity-only) · `Avatar` · `SectionHeader` |
| Forms | `Input` · `Textarea` · `Select` · `Checkbox` · `Switch` · `RadioGroup` / `Radio` · `Slider` · `Segmented` · `Combobox` · `DateField` / `DatePicker` / `Calendar` · `Stepper` · `ChipInput` · `Rating` · `FileDrop` |
| Collections | `List` · `ListRow` · `Table` · `DataList` · `Timeline` · `Accordion` |
| Navigation | `Tabs` · `Breadcrumb` · `Pagination` · `TabBar` |
| Overlays | `Sheet` · `Dialog` · `Menu` · `Popover` · `Tooltip` |
| Feedback | `Banner` · `EmptyState` · `Spinner` · `Progress` · `Skeleton` · `ToastProvider` / `useToast` |
| Type | `Display` · `Title` · `Body` · `Label` · `Caption` · `Rule` |
| Layout | `AppFrame` · `Stack` · `Inline` · `AdminShell` · `DetailHeader` · `FilterChips` · `ActivityFeed` |
| Flows | `Onboarding` · `SignInFlow` · `Wizard` · `PlanPicker` · `ProfileScreen` · `AppShell` · `TaskProgress` |
| Flow parts | `AuthScreen` · `PhoneField` · `OtpInput` · `PasswordField` · `PlanCard` · `ProfileHeader` · `AvatarRing` · `ChoiceGrid` · `OptionCard` |
| Commerce | `OrderSummary` · `ActionBar` |
| Console | `AdminShell` · `DetailHeader` · `FilterChips` · `ActivityFeed` |
| Chat | `Chat` · `ChatComposer` |
| System | `NimProvider` · `useNim` · `useSchemeToggle` · `Icon` / `iconNames` · `cn` · `COUNTRIES` / `countryByIso2` / `countryByDial` / `countryNamer` / `toAsciiDigits` · `toE164` · `scorePassword` |

Picking between the near-neighbours:

- **`Chip` vs `Badge`** — a chip is an object you can press or drop; a badge
  is a label *about* something and is never interactive.
- **`RadioGroup` vs `Segmented`** — the segmented control sets a value among a
  few short ones and fits on a line; the radio group is for answers that carry
  descriptions, or more of them than a line holds.
- **`Accordion` vs `Tabs`** — the accordion lets a reader open two sections at
  once and compare them; tabs make that a choice.
- **`DataList` vs `Table`** — one record's fields against many records' rows. A
  table claims a grid, and a single record does not have one.
- **`Tabs` vs `Segmented`** — tabs switch a *region* of the page; a segmented
  control sets a *value*. They look alike and mean different things.
- **`Menu` vs `Popover`** — a menu holds actions and closes when one is chosen;
  a popover holds a form and does not close on a click inside it.
- **`AdminShell` vs `AppShell`** — a console and a phone app, not two sizes of
  one thing: two columns and a deep hierarchy against one column and five
  destinations.
- **`Wizard` vs `Onboarding`** — the wizard collects answers and gates its CTA
  on them; onboarding shows three slides and asks for nothing.
- **`OptionCard` vs `PlanCard`** — a row-shaped choice among several (payment
  method, address) against a tier with a price and a feature list.
- **`SignInFlow` vs `AuthScreen`** — the flow is the screen, mounted and
  stateful; `AuthScreen` is the frame one step is drawn in, for a product whose
  sign-in has more steps than these.
- **`DateField` vs `DatePicker`** — the field keeps the month open and belongs
  on a screen whose subject is the date; the picker hides it behind a button and
  belongs in a form where three other fields need the space.
- **`TabBar` vs `Tabs`** — the tab bar is the app's destinations and lives at
  the bottom of the frame; `Tabs` switches a region inside one screen.
- **`Dialog` vs `Sheet`** — the sheet is the mobile-first modal surface; the
  dialog is the centred one, and renders a real `<dialog>` so the top layer,
  the focus trap and Escape come from the platform.

Icons are addressed by **role**, not by vendor name (`<Icon name="trash" />`).
The registry in `components/icon.tsx` is the whole point: it keeps the set
finite and reviewable, stops two screens meaning "delete" with two glyphs, and
makes swapping icon libraries a one-file change.

### Accessibility floor

Every interactive element ships a hover, a press, a focus ring drawn outside its
box, a disabled state, and a 44px minimum target — including `IconButton` at its
36px size, which keeps the box and restores the target with a transparent
`::after`. `IconButton` requires a `label`. Overlays share one dismissal
contract: Escape closes, an outside pointer closes, and focus returns to
whatever opened them. Form controls wire label/hint/error ids to the control
automatically, and an invalid field focuses in danger so the ring never
contradicts the message under it.

Forced colours (Windows High Contrast) are honoured too. Everything the kit
says with **fill alone** — a checked box, a toggled chip, a selected segment, a
surface separated only by its shadow, and the focus ring, which is drawn as a
box-shadow and would be removed outright — is restated with a border, an
outline, or a system colour. The few components that *are* fill by nature
(progress, meters, the slider) keep `forced-color-adjust: none` so they can go
on drawing themselves.

`prefers-reduced-motion` is honoured, but not by stopping everything: the
spinner keeps turning more slowly and the indeterminate progress bar fills
instead of sliding, because those two are the only signal that work is
happening. Reduced motion is a vestibular accommodation, not a request for less
information.

### Density

`--nim-density` is one multiplier over the control scale and the block padding
of anything row-shaped, so a data-dense screen and a mobile flow stay the same
system:

```tsx
<div style={{ '--nim-density': 0.82 }}>…</div>   // compact  · 36px controls
<div>…</div>                                      // default  · 44px
<div style={{ '--nim-density': 1.18 }}>…</div>   // roomy    · 52px
```

It never scales type, and it never crosses `--nim-touch-min`. The multiplication
is applied where each height is *used* rather than folded into
`--nim-control-md`: a custom property that references another is substituted
where it is declared, so baking density into the token would freeze it at the
root and make a subtree override do nothing.

---

## Using it in an app

```tsx
import { Button, Card, Stack, Stat, Title, NimProvider, ToastProvider } from '@nim.zone/ui'

export function Screen() {
  return (
    <NimProvider defaultStyle="ledger" defaultColorway="vermilion">
      <ToastProvider>
        <Stack gap="loose">
          <Title>Today</Title>
          <Card variant="raised">
            <Stat value="18M" unit="/min" label="Events" delta="+12%" />
          </Card>
          <Button iconEnd="arrow-forward">Continue</Button>
        </Stack>
      </ToastProvider>
    </NimProvider>
  )
}
```

### Adopting nim in `vlora-app`

The `vlora` style and `coral` colourway carry that app's exact palette, radii,
shadows, and type voice, so adoption is mechanical rather than a restyle:

1. Wrap the tree in `<NimProvider defaultStyle="vlora" defaultColorway="coral"
   direction="rtl">` — the stylesheet arrives with the first `nim` import.
2. Repoint `src/components/ui/index.ts` at `nim` re-exports, one component at a
   time — the prop APIs were modelled on Vlora's own.
3. Delete the corresponding blocks from `src/theme/tailwind.css` as each
   component moves over.
4. Keep app-specific surfaces (scanner, mascot, reflect flow) in the app. nim
   owns the shared vocabulary, not the product's own domain UI.

Nothing in `vlora-app` has been modified by this package.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).

Free to use, modify and ship commercially. In exchange, attribution is
mandatory: any distribution of this kit, or of a product that bundles it, must
carry the contents of `NOTICE` — **nim — Copyright 2026 Nima Sarayan
(https://nim.zone)** — in its attribution notices, credits or documentation, and
must keep the copyright, patent and licence notices intact. Modified files must
say they were changed. The licence also grants, and terminates on patent
litigation, a patent licence covering the kit.

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

Both build commands take a short, process-safe lock around the shared TypeScript
and Vite output. This keeps file-linked consumers safe when their builds run in
parallel: a second build waits for the first to finish instead of emptying
`dist/` while it is generating declarations.

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

## What changed in 0.15

`CommandPalette` closes the one gap 0.2 left open on purpose. That omission
said a palette "has to know the whole product's actions" and is therefore
app-shaped — which is true of its CONTENTS and of nothing else. The surface is
the same in every console: one field, one ranked list, ↑↓ to move, Enter to
run, Escape to leave. So the kit owns the surface and the app hands it the
commands, which is what the `commands` prop is.

Two decisions inside it are worth knowing. It RANKS rather than filters —
where the match landed decides the order, so the row the viewer typed the
start of is the row Enter is already on. And the ⌘K that opens it is not the
kit's: a component binding a global chord would collide with every other
consumer on the page, and which chord a product spends is the product's call.
The palette is controlled by `open` / `onClose` like any other overlay.

`StatusHero` takes `actions`. A control room that states a verdict and offers
nothing has sent the reader off to find the screen themselves, which is where
an incident spends its first minutes. Keep it to the one recommended action;
a hero with a row of equal buttons has ranked nothing. Below 40rem of its own
container the action returns to the leading edge instead of being stranded on
the trailing edge of its own line.

`Columns` takes `align="start"`. A grid stretches by default, which is right
when two columns are halves of one object and wrong when they are independent
panels — a list that runs from zero to four rows beside a fixed set of four
becomes a tall box with its content stranded at the top. The default is
unchanged.

Two corrections to existing components, both the same mistake in two places.
A `ListRow` given an `href` no longer underlines its title and subtitle: a row
rendered as a link is still a ROW, and its affordance is the band lighting up,
not a rule under every line of it. And `AdminShell`'s toolbar, once it has
wrapped onto its own full-width row, now starts where the title starts — the
`margin-inline-start: auto` that held it on the trailing edge of a SHARED row
was stranding it away from the reading edge on its own. The `sections` variant
already corrected this for itself; the correction was never variant-specific.

---

## What changed in 0.14

0.14 locks the shared `console` voice to the geometry of a full-time operator
workspace: a 12rem navigation rail, a 52px masthead, compact 12–13px working
type, square hairline panels, and a 12px content rhythm. Tables, tabs, panel
headers, and charts now share that density instead of each spending a different
amount of the first viewport. Consumer and editorial styles are unchanged.

The active navigation row also carries a narrow leading rail in addition to
its tint and label colour. This keeps the selected destination explicit in a
dense dark sidebar without relying on colour alone.

`StatusHero` plus the ratio-based `Columns` templates provide large
first-glance health statements and stable 40/60 or one-third/two-thirds splits
for control-room overview screens.

`AdminShell` can now keep primary product sections in its masthead while a
separate contextual rail owns the workspaces inside the active section. The
context rail becomes a compact horizontal strip in narrower containers, so a
large console retains the same two-level information architecture without
duplicating its navigation for desktop and mobile.

For consoles whose primary areas must remain visible without spending another
label-width sidebar, `navigation="rail"` renders those icon-bearing areas as a
fixed first tier beside the contextual destination panel. Below 60rem the same
labelled primary navigation moves into the drawer and the contextual tier
becomes the existing horizontal strip.

---

## What changed in 0.13

0.13 teaches the console layer to run a procedure: a stage spine, a sticky plan
rail, and a sidebar that folds to its icons. Nothing was removed.

**`StageTrack` is the numbered spine of a long procedure** — connect, select,
scan, review, deploy. It is deliberately not `TaskProgress`: that component
reports a job the server is running and the viewer is waiting on; this one
reports where a PERSON is in work they are doing themselves. So there is no
percentage, and every stage is addressable.

**`Rail` and `RailSection` are the standing summary a procedure is committed
from, and the rail sticks.** A plan assembled over five sections is read from
the top but committed from one place, and that place has to state what it covers
without the operator scrolling back through the decisions that produced it.
`Panel` deliberately did not get a `sticky` flag — that would have let any
section of any page claim the same privilege.

**`CopyChip` is one machine value with its copy affordance beside it.**
`CodeBlock` already answered a block of output; wrapping a scrolling `<pre>`
around a single digest is why these values end up retyped by hand.

**`Panel` takes `marker`** — the disc before the heading, for a page whose
panels are the numbered steps of one procedure.

**`AdminShell` takes `collapsible`.** The sidebar narrows to its icons and every
label is hidden rather than truncated: a nav label clipped to four characters is
worse than the icon alone, which at least means one thing. It is opt-in, because
a console with five destinations has nothing to reclaim. The rail has one
collapse control at its foot; repeating the same control beside the brand made
the console chrome harder to scan and created two focus stops for one action.
When the topbar carries persistent scope selectors instead of the current page
name, `titleRole="scope"` leaves the workspace's `DetailHeader` as the single
page heading.

**`AdminShell` also supports a shallow section bar.** Set
`navigation="sections"` when a control plane has a small, stable set of primary
destinations instead of a deep hierarchy. Brand, operational scope, and actions
share the masthead; destinations remain visible in a horizontal bar and become
the same accessible drawer on narrow containers.

---

## What changed in 0.12

0.12 is two RTL fixes and one small addition. Nothing was removed.

**`IconButton`'s touch target is centred physically.** The 44px target the
contract requires is a pseudo-element, and it was placed with
`inset-inline-start: 50%` next to `translate: -50% -50%`. `translate` is always
physical, so the pair centres the target in LTR and throws it a full width off
the button in RTL. Against the edge of the page that is enough to overflow the
document, which is why a Persian screen with a sign-out button in its masthead
scrolled sideways by 28px for no visible reason. The inset is now `top`/`left`.

**`Tooltip`'s bubble had the same pairing** — `inset-inline-start: 50%` with
`translate: -50% 0` — and so the same defect: centred over its trigger in LTR,
hanging off to one side in RTL. Also now a physical `left`.

**`MediaPlayer` takes `onError`.** It is raised when the source will not load
and forwarded straight to the underlying `<audio>`/`<video>`. A caller that
holds more than one URL for the same media — a published copy and the local one
it rendered — can fall back to the next rather than leaving a dead frame on the
page. The player still owns no retry policy of its own; knowing which URL to
try next is the app's business.

---

## What changed in 0.10

0.10 adds the **editorial register**: the two sizes above `display` that a
marketing page needs and a product screen never does. Nothing was removed.

**Two roles, answered per style**

`display-lg` is the size a section that opens a long document is set at;
`display-xl` is a page's single claim. Every style answers both at its own
scale rather than borrowing another's — `ledger` reaches 96px and 168px,
`vlora` stops at 64px and 88px, and `console` deliberately stays near
`display`, because an empty-state title at 168px in a sidebar is a bug rather
than a design. They are separate roles rather than more of the display ramp
because type that large is optically a different medium: it needs its own
tracking and its own leading, and inheriting `display`'s would leave both
loose at 96px and slack at 168px.

```tsx
<Display size="xl">
  <Display.Line>Systems that</Display.Line>
  <Display.Line accent indent>stay fast</Display.Line>
  <Display.Line>under load.</Display.Line>
</Display>
```

**The break is authored**

Both editorial sizes drop `text-wrap: balance`. A balanced three-word line at
168px moves words between lines on every resize, and where a claim breaks is a
copy decision. `Display.Line` is that decision: `accent` inks one line in the
colourway's accent — the single ornament the system allows a headline — and
`indent` steps a line off the reading margin by `--nim-display-indent`, which
mirrors on its own in RTL because it is a logical property.

**Persian**

These are the sizes that needed the most correction. Persian carries a larger
x-height and deeper descenders than the Latin face, so a claim set at the Latin
size overruns its measure and its descenders collide across 0.84 leading. Both
roles step down under `:lang(fa)` and are given their leading back, alongside
the tracking corrections `persian.css` already made.

**New tokens** — a style must now also define
`--nim-type-display-lg-size · -line · -tracking`,
`--nim-type-display-xl-size · -line · -tracking`, and `--nim-display-indent`.

---

## What changed in 0.9

0.9 is the **conversation layer**, and the two things a conversation kept
needing that the kit could not draw: a chart and a map. Nothing was removed.
One token group was added.

**Rooms, not a thread**

`Messenger` is two panes — the rooms and the open one — and `ConversationList`
is what fills the first: channels with a `#`, groups with a face, people with
theirs. The responsive switch is a container query rather than a media query,
because a messenger is very often embedded in a console or a side panel, and
one that answers the window instead of its own box is wrong in exactly the case
it is embedded in. Which room is open is the CALLER's state, through `activeId`
— the same state that decides which transcript to fetch, held once.

**`Chat` reads like a conversation**

Consecutive messages from one person inside `runGap` are a RUN: one avatar, one
name, one timestamp, and a tail on the last bubble only. This is the whole
difference between a transcript and a log. Also new: day dividers computed from
the timestamps, room notices (`system`), quoted replies (`replyTo`, with
`onJump`), reactions (`reactions` + `onReact`), retraction (`deleted` — the
bubble stays and says so, because a message that vanishes leaves the reply above
it answering nothing), and a per-message menu through `actions`. What "delete"
or "forward" MEANS is the product's; the kit renders the list and calls back.

The viewer's own bubble is now a filled accent rather than a tint. It is the
strongest cue in a transcript — you can find your own messages in a scroll you
are not reading — and everything nested inside it borrows `--nim-on-accent`.

`ChatComposer` gained the matching half: a reply bar with `replyTo` and
`onCancelReply`, which focuses the input when it opens.

**`AssistantThread`**

Deliberately not `Chat`. A conversation between people is short lines
alternating quickly, which is what bubbles are for; an answer from a model is a
document — paragraphs, lists, code, tables — and a document does not go in a
bubble. So the assistant's turn is full measure on the canvas with a mark beside
it, and only the viewer's own turn keeps a surface. `content` is rendered as
given: the kit does not parse markdown or sanitise HTML, because what a model's
output may contain is a decision with a threat model behind it and it belongs to
the product, once.

**`Chart` and `Sparkline`**

An SVG drawn from the contract — no plotting library, no canvas, no new runtime
dependency. Line, area and bar over a shared scale. The picture is
`aria-hidden` and the numbers are exposed as a real table in the same figure:
that is the only arrangement that works for everyone, and it is also what makes
a chart printable and copy-pasteable. A bar is pinned to zero whatever `min`
says, because a truncated bar misstates the ratio it draws.

**`MapView`**

The kit ships no tile provider, holds no API key and bundles no mapping SDK —
all three are decisions about a vendor, a bill and a privacy policy. The picture
is passed in through `tiles`. What the kit owns is the part that is always
rebuilt badly: the frame, the Web Mercator projection, the pins, the selection,
the zoom affordance and the attribution slot a tile licence requires.

**`MediaPlayer`**

Built ON `<audio>` / `<video>`, never instead of one: the decoder, the OS media
keys and lock-screen artwork, picture-in-picture, AirPlay, captions and
background playback all come from the element. Only the transport is drawn. The
scrubber is a real `<input type="range">` — dragging a div is how a player loses
Home, End, the arrows and the page keys.

**New tokens: the series ramp**

`--nim-series-1` … `--nim-series-6`, defined by every colourway. Series 1 is the
accent, so a single-series chart is of a piece with the rest of the interface;
2–6 are ordered to put the greatest hue distance next to the accent. They are
CATEGORIES, not a scale: never interpolate between them, and never use one to
mean good or bad — that is what the status roles are for. This is the only
breaking-shaped change in 0.9: a colourway defined outside this package must add
the six names or its charts fall back to unstyled marks.

---

## What changed in 0.8

0.8 adds the layer an **admin panel** is actually built out of, and the style
it is drawn in. Nothing was removed and no existing component changed shape.

**The console style**

`console` is the third style, and it exists because the other two are wrong
for the one surface that had no answer. `ledger` is a print register — a voice,
and a voice is tiring to read for eight hours. `vlora` is a consumer app, and a
console that spends a fifth of its vertical budget on padding shows a fifth
fewer rows. Console is the style of a tool you keep open all day: small
consistent radii, elevation as a hairline plus a short shadow, type sized
*down* from the body scale (14px working size, 11px sentence-case labels
rather than tracked-out caps), tabular figures everywhere, and a press that is
barely there. It sets `--nim-density: 0.84` at rest and returns it to `1` under
`@media (pointer: coarse)` — density is a reading decision made for a mouse,
and a finger does not get smaller because the screen is showing a table.

**The console components**

`AdminShell` gave a console its chrome in 0.6 and stopped there, so every panel
built on it re-invented the same eight things below the topbar. Both consumers
had grown their own copy — SwarmOps in 450 lines of app CSS, vlora-admin in
6,000 — and the two copies did not agree on a single measurement.

- `Page` — the scrolling body of one screen: how wide it may get, and how far
  apart two sections sit.
- `Panel` — a titled section. Heading level is `h2` by construction: a console
  page has one `h1` and it is in the topbar.
- `Toolbar` — what narrows a collection on one side, what can be done to it on
  the other. Wraps rather than scrolls, because a toolbar that scrolls hides
  the filter an operator already applied.
- `Metric` / `MetricGrid` — one number, its name, and how it moved. `Metric`
  takes `deltaIntent`, because errors falling is success and revenue falling is
  not; a tile that colours every rise green lies on half its screens.
- `Facts` — a record's properties as a real `<dl>`.
- `Columns` — `halves` / `thirds` / `quarters` / `aside`, collapsing on a
  **container** query.
- `CodeBlock` — machine output in a box that scrolls at `--nim-scroller-max`
  instead of growing, with copy. A log that grows to its own length pushes
  every action below the fold exactly when something is wrong.
- `StatusDot` — six tones, always beside a word. Colour alone is not a status.
- `Mono` — an id, a host, a digest, inline, in tabular figures.
- `RecordLink` — the identity cell of a row. Both consumers had written it, and
  both had written it as a `<div onClick>`.
- `DetailLayout` — a record and the rail of facts beside it.
- `StageTrack` — the numbered spine of a long procedure: connect, select, scan,
  review, deploy. Not `TaskProgress`: that reports a job the server is running
  and the viewer is waiting on, this reports where a PERSON is in work they are
  doing themselves — so there is no percentage, and every stage is addressable.
- `Rail` / `RailSection` — the standing summary a long procedure is committed
  from. It sticks, because a plan assembled over five sections is read from the
  top and committed from one place, and that place has to say what it covers
  without scrolling back through the decisions that produced it. `Panel` did
  not get a `sticky` flag: that would let any section claim the privilege.
- `Metric` takes `layout="inline"` — the evidence chip, for a strip that
  reports what a scan FOUND rather than how a number moved: the icon beside the
  figure, the name and its qualifier to the side. `MetricGrid` takes `dense`
  for a row of them, because a chip holds its column count far below the width
  a counter tile needs and would otherwise fold to two-up inside any panel with
  a rail beside it.
- `Panel` takes `caption` — the status phrase on the heading's own line
  ("Scan completed just now"), as distinct from `description`, which is a
  sentence under it. `children` is optional, so a stage that cannot be answered
  yet keeps its place in the column as a head alone.
- `Body` and `Caption` take `tone` — the same six roles the dot and the tile
  speak, so a green word in a table and the green dot in its row cannot come
  from two different greens. A tone colours text and never carries the claim
  alone.
- `Brand` — a product's mark, wordmark and tagline, locked up. Every console in
  this family had written the same flex row, mark box, `<strong>` and `<small>`,
  and the copies disagreed on the gap, the tagline colour, and whether the name
  was a title or a body run. The wordmark is set in the display face with
  tracking pulled in and never wraps: a name read as one shape is the
  difference between a wordmark and a heading that happens to be a name. The
  mark is NOT rescaled by the lockup — it is geometry its owner tuned.
  `nameAccent` renders a second run tinted with `--nim-brand-accent`, so a
  two-tone wordmark costs the consumer one custom property instead of a literal
  colour in its stylesheet.
- `BrandMark` — the third-party marks a delivery console has to name: the forge
  a repository came from, the engine a dependency becomes, the stack a signal is
  reconciled into. Deliberately NOT part of `Icon`: that registry is addressed
  by ROLE and is closed precisely so two screens cannot mean "delete" with two
  glyphs, while a brand mark means one product and nothing else. A mark is only
  drawn beside the name it belongs to, never as decoration and never as a row's
  sole identifier; `brandFor(name)` returns `undefined` rather than guessing, so
  an unknown dependency falls back to a role icon.
- `CopyChip` — one machine value with its copy affordance. `CodeBlock` already
  does this for a block of output; wrapping a scrolling `<pre>` around a single
  digest is why these get retyped by hand instead.
- `Panel` takes `marker` — the stage disc before the heading, for a page whose
  panels are the numbered steps of one procedure.
- `DataTable` — a collection screen in one component. It resolves the four
  states a remote list is ever in — **error, first load, empty, rows**, in that
  order — which is the part every hand-rolled version got wrong by showing an
  empty state during the first load. A refetch dims the current rows rather
  than replacing them with skeletons.

**`sable`, the operator colourway**

The one palette chosen for a constraint rather than a mood. A console is a
screen full of status, and an accent drawn from the green/amber/red families is
not a brand colour there — it is a fourth status nobody defined. Cobalt is the
signal family that cannot be mistaken for any of the three. Its neutrals are
cooled graphite: the warm cast that makes a consumer app feel like paper makes
a table of numbers feel yellow by the afternoon.

Dark is its primary scheme, with a canvas darker than the kit's others so a
table's hairlines carry, and status comes from the `paper` ramp unchanged — a
control plane is the last place to have an opinion about what red means. Every
pair was measured rather than estimated: `ink-tertiary` is set at the darkest
value that still reads as tertiary, because it labels every column header at
11px and 11px is never large text.

**Smaller changes the migration forced**

- `Button` takes `href` and renders a real `<a>`. A control that navigates IS a
  link; consumers without this reach for an `asChild` escape hatch and
  hand-write the classes, which is how the focus ring drifts per call site.
  `loading` and `disabled` stay button-only — there is no such thing as a
  disabled link in HTML.
- `Field` is exported: the label/hint/error frame on its own, for a control the
  kit does not own. Every kit control still carries its own `label` and should
  use that instead.
- `ListRow` takes `rel` / `target`, and supplies `noreferrer` itself for
  `_blank`.
- `Stack` and `Inline` take `as`: they are rhythm, not semantics, and a form on
  the stack rhythm is still a `<form>`.
- `Checkbox`'s `children` is optional — a selection checkbox in a table has no
  visible label, and names itself with `aria-label`.
- Icons added: `activity` · `arrow-back` · `chart` · `cloud` · `database` ·
  `globe` · `key` · `layers` · `link` · `more` · `package` · `refresh` ·
  `server` · `shield` · `tag` · `terminal` · `users`.

**Container queries and specificity** — the console grids step down inside
`@container`, and every one of those rules carries the same `[data-…]`
attribute its base rule uses. A container query adds no specificity, so
`.nim-metric-grid { … }` inside one loses to `.nim-metric-grid[data-columns='4']`
outside it, and the grid silently never steps down.

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
  markup, so the two cannot drift. Below 38rem the topbar toolbar takes its own
  wrapping row instead of pushing session controls beyond the viewport. The
  breakpoints are **container** queries, so a console embedded in a panel
  answers its own width rather than the window's. The shell and its scrolling
  workspace are explicitly clamped to that container, so wide tabs, headers,
  and data surfaces cannot silently lay out beyond a narrow mobile viewport.
  `collapsible` adds the rail
  control: the sidebar narrows to its icons and every label is hidden rather
  than truncated, because a nav label clipped to four characters is worse than
  the icon alone. It is opt-in — a console with five destinations has nothing
  to reclaim and the control is then one more thing to explain.
  `navigation="rail"` is the persistent dual-tier variant: icon-bearing product
  areas form the narrow first rail while `contextualGroups` owns the labelled
  destinations beside it.
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
  reserves the room the floating bar covers. Past 64rem the frame widens and
  the tab bar becomes a side rail, so one shell serves the phone and the
  laptop; `frame="phone"` opts a phone-only product out.

The parts they are built from (`AuthScreen`, `PhoneField`, `OtpInput`,
`PasswordField`, `PlanCard`, `ProfileHeader`, `TabBar`) are unchanged and still
exported: use them directly when a product's flow differs — an invite-code step,
a captcha, a tenant picker. The assembled component is the common shape, not the
only one.

**Chat**

`Chat` + `ChatComposer` carry text, voice, video, images and files.

`ChatComposer.onTyping` is a notification only: the caller owns presence,
throttling and socket transport, so the kit never emits a network request on
its own.

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
and composes from `Dialog` and `Combobox` in the meantime. (Revisited in 0.15:
its CONTENTS are app-shaped, its surface is not. `CommandPalette` ships the
surface and takes the commands as a prop.)

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
    colorways/sable.css       graphite + cobalt, for consoles
    colorways/malachite.css   slate + emerald, for delivery consoles
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

| Styles | `ledger` (default) | `vlora` | `console` |
|---|---|---|---|
| For | print & record | a consumer app | a tool kept open all day |
| Shape | `0` — square | `6–24px` — rounded | `3–14px` — small and consistent |
| Elevation | hard offset register mark | soft ambient shadow | hairline + short contact shadow |
| Labels | mono, uppercase, wide-tracked | text face, sentence case | text face, sentence case, 11px |
| Body | 16px | 16px | **14px** — four more rows per screen |
| Leading | tight (1.45 base) | loose (1.84 base) — Persian needs the room | 1.4 |
| Density | `1` | `1` | **`0.84`**, back to `1` on coarse pointers |
| Press | shifts into its shadow | compresses | almost nothing |
| Default face | Geist / Geist Mono | Vazirmatn | Inter / Geist Mono |

| Colourways | `vermilion` (default) | `oxblood` | `coral` | `teal` | `sable` | `malachite` |
|---|---|---|---|---|---|---|
| Voice | print & record | law & institution | warm consumer product | clinical care | operator console | delivery console |
| Canvas | warm paper `#f7f4ee` | warm paper `#f7f4ee` | warm cream `#faf9f6` | cool mist `#f6faf9` | graphite `#f6f7f9` | slate `#f7f9f8` |
| Ink | near-black `#17150f` | near-black `#17150f` | slate `#131314` | near-black `#1d1d1f` | near-black `#12151a` | near-black `#111820` |
| Accent | vermilion `#b82f18` | seal red `#6b1f2a` | coral `#d97757` | teal `#00baba` | cobalt `#2f5bd7` | emerald `#0f8a63` |

`sable` and `malachite` are the two chosen for a constraint rather than a mood,
and they answer opposite halves of the same product. A FLEET screen is full of
green/amber/red node status, where an accent from those families is a fourth
status nobody defined — that is `sable`, and cobalt is the one signal family
that cannot be mistaken for the three. A DELIVERY screen's rows are decisions
rather than health, its remaining states are amber and red, and the colour it
needs to spend is on what has been settled — that is `malachite`. Taking
`malachite` onto a status-dense screen gives up the guarantee `sable` exists to
provide, so a status there must state itself in words beside the colour.

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
itself), `ledger` + `oxblood` (legal), `vlora` + `coral` (Vlora), `vlora` +
`teal` (Fatemifar) and `console` + `malachite` (SwarmOps) — but the axes are
genuinely orthogonal, so `ledger` + `teal` is a legal thing to try rather than
a mistake.

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
| Overlays | `Sheet` · `Dialog` · `CommandPalette` · `Menu` · `Popover` · `Tooltip` |
| Feedback | `Banner` · `EmptyState` · `Spinner` · `Progress` · `Skeleton` · `ToastProvider` / `useToast` |
| Type | `Display` · `Title` · `Body` · `Label` · `Caption` · `Rule` |
| Layout | `AppFrame` · `Stack` · `Inline` · `AdminShell` · `DetailHeader` · `FilterChips` · `ActivityFeed` |
| Identity | `Brand` · `BrandMark` / `brandFor` |
| Flows | `Onboarding` · `SignInFlow` · `Wizard` · `PlanPicker` · `ProfileScreen` · `AppShell` · `TaskProgress` |
| Flow parts | `AuthScreen` · `PhoneField` · `OtpInput` · `PasswordField` · `PlanCard` · `ProfileHeader` · `AvatarRing` · `ChoiceGrid` · `OptionCard` |
| Commerce | `OrderSummary` · `ActionBar` |
| Console | `AdminShell` · `DetailHeader` · `FilterChips` · `ActivityFeed` · `Page` · `Panel` · `Toolbar` · `Metric` / `MetricGrid` · `Facts` · `Columns` · `DetailLayout` · `StageTrack` · `Rail` / `RailSection` · `CopyChip` · `CodeBlock` · `StatusDot` · `Mono` · `RecordLink` · `DataTable` · `CommandPalette` |
| Conversations | `Messenger` · `ConversationList` · `RoomHeader` · `Chat` · `ChatComposer` |
| Assistant | `AssistantThread` |
| Data | `Chart` · `Sparkline` |
| Media | `MediaPlayer` · `MapView` |
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
- **`DataTable` vs `Table`** — `Table` is the primitive and is still right for
  a table that is just a table. `DataTable` is the collection *screen*: toolbar,
  selection, pagination, and the four states a remote list is ever in, resolved
  in one place.
- **`Panel` vs `Card`** — a panel is a titled section of a console page and
  always carries a heading; a card is a piece of content that may not.
- **`Metric` vs `Stat`** — `Stat` is a figure in a consumer layout; `Metric` is
  a console tile: fixed value size so a row of them can be compared, a tone rule
  on its leading edge, and `deltaIntent`.
- **`Mono` vs `CodeBlock`** — an id inline in a sentence against a log that
  scrolls in its own box.
- **`AdminShell` vs `AppShell`** — a console and a phone app, not two sizes of
  one thing: two columns and a deep hierarchy against one column and five
  destinations. `AppShell` growing a desktop rail does not make it a console:
  it still has five destinations and one scroll region.
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
- **`Dialog` vs `Sheet`** — the sheet is the mobile-first modal surface. It
  rises from the bottom on compact viewports and becomes a right-side review
  panel from 64rem, keeping long operational actions visible without moving the
  invoking page. The dialog is the centred surface and renders a real
  `<dialog>` so the top layer,
  the focus trap and Escape come from the platform. Its flex layout applies
  only while `[open]`, preserving the browser's closed-dialog behaviour.
  A caller that is waiting for an irreversible request may pass
  `dismissible={false}`: the close control and backdrop dismissal are removed
  and Escape is prevented until the caller makes the dialog dismissible again.

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

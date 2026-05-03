# Phase 41 – Help Improvements

## Context

We recently introduced per-tab help content. We should extend its capabilities to include basic text formatting, and use it more widely. The main help panels should highlight the primary goal for the player.

We also want to improve the use of tooltips across the project, making them more consistent, and more accessible.

## Goals

1. Add lightweight markdown-style formatting (**bold**, *italic*, __underline__) to help body text.
2. Add `{facility:id}` and `{technology:id}` inline tokens that render as tooltipped chips inside help text and any other rich-text surface.
3. Replace every remaining inline HTML `title="…"` attribute with the `Tooltip` component.
4. Make `Tooltip` keyboard- and screen-reader-accessible (focus-visible, `role="tooltip"`, `aria-describedby`, Escape to dismiss).
5. Highlight a "YOUR GOAL" line in each main help panel so the player always sees the next concrete objective for that view.

Out of scope: full CommonMark (no lists, links, headers, code blocks, blockquotes, line breaks via markdown), nested formatting beyond a single span, runtime authoring tools, localisation.

## Existing surface area

- `src/data/helpTopics.ts` — `HELP_TOPICS: Record<HelpTopicId, { title; body: string[] }>`. Body is plain strings rendered as `<p>` blocks in `HelpModal.svelte:43-45`.
- `src/lib/components/HelpModal.svelte` — modal that loops `topic.body` and prints each paragraph verbatim.
- `src/lib/components/Tooltip.svelte` — wrapper component (`text`, `direction`, `children`) used by HUD, MapContainer, SignalTrack. No aria, no focus handling, no Escape.
- `src/data/loader.ts` exposes `FACILITY_DEFS: Map<string, FacilityDef>` and `TECH_DEFS: Map<string, TechDef>` — these are the lookup sources for token resolution.
- 17 inline `title="…"` attributes survive across `BoardPanel`, `CardHand`, `CompletedProjectsPanel`, `HelpButton`, `HUD`, `OngoingActionsPanel`, `PlacementPromptCard`, `TechProgressSummary`, `TechTreeModal`, plus `routes/newgame/+page.svelte` (see "Tooltip migration" below).

## Plan

### 1. Markup parser (`src/lib/richText.ts`)

A tiny pure-TS tokenizer + parser. No regex sledgehammer; one left-to-right pass producing an array of nodes:

```ts
type RichNode =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; children: RichNode[] }
  | { kind: 'italic'; children: RichNode[] }
  | { kind: 'underline'; children: RichNode[] }
  | { kind: 'facility'; id: string }
  | { kind: 'tech'; id: string };

export function parseRichText(input: string): RichNode[];
```

Syntax rules:

- `**…**` → bold. Greedy match against the next `**`.
- `*…*` (single asterisk, not adjacent to another `*`) → italic.
- `__…__` → underline.
- `{facility:id}` and `{technology:id}` — id is `[a-zA-Z0-9_-]+`.
- Unknown braces and stray markers are emitted as plain text (graceful degradation — nothing in the help string should ever cause a render crash).
- No nesting of formatting marks initially. If `**foo *bar* baz**` appears, treat the inner `*` as literal text. We can revisit if a writer needs nested emphasis.

Tests in `src/lib/richText.test.ts` covering: plain text passthrough, each formatter individually, multiple formatters in one string, unknown token id, mismatched delimiters, empty input, `{facility:}` with empty id (treated as literal text).

### 2. `RichText.svelte`

Renders the parsed AST. One `{#each}` over nodes with an `{#if node.kind === '…'}` ladder.

```svelte
<RichText source={paragraph} />
```

- `text` → text node (no element).
- `bold/italic/underline` → `<strong>`, `<em>`, `<u>` recursing into a child `<RichText>`.
- `facility` → looks up `FACILITY_DEFS.get(id)`. If found, renders the facility name inside `<Tooltip text={facilityTooltip(def)}>`. If missing, renders `[?facility:id]` so authoring errors are loud in dev but not fatal.
- `tech` → same pattern with `TECH_DEFS`. Tooltip body uses `def.rumourText` when present, otherwise the tech name.

Tooltip body builders live next to the parser (`src/lib/richText.ts`):

```ts
export function facilityTooltipText(def: FacilityDef): string;
export function techTooltipText(def: TechDef): string;
```

Both return short single-string summaries (already supported by the existing `Tooltip` component — no API change needed for content). Format:

- Facility: `"{name} — {description}"` (description already exists on `FacilityDef`).
- Technology: `"{name} — {rumourText}"`.

### 3. Update `HelpModal.svelte`

Replace `<p class="help-paragraph">{paragraph}</p>` with `<p class="help-paragraph"><RichText source={paragraph} /></p>`. No other changes; the existing CSS keeps paragraph spacing.

### 4. "YOUR GOAL" lines in help topics

Update `src/data/helpTopics.ts` so each topic body's first paragraph leads with a bolded goal line. Examples:

- `earth`: `"**YOUR GOAL** Build a {facility:spaceLaunchCentre} so you can reach orbit. You'll need the {technology:orbitalMechanics} technology first."`
- `space`: `"**YOUR GOAL** Complete the Orbital Station landmark and start the Moon Colony programme to unlock the Asteroid Belt."`
- `belt`: `"**YOUR GOAL** Establish transit to the heliopause node and decode the alien signal."`
- `projects`: `"**YOUR GOAL** Initiate the next landmark project to advance to the next era."`
- `board`: `"**YOUR GOAL** Keep every role filled — empty slots leave cards greyed out and weaken your bloc."`
- `blocs`: `"**YOUR GOAL** Track rival blocs to anticipate diplomatic events and competitive pressure."`
- `techTree`: `"**YOUR GOAL** Build the facilities that feed the fields each tech recipe needs — research happens automatically."`

Goals are written by hand (not generated), but they should reference real def IDs that exist in the current data so the tooltip resolution doesn't fall through. Verify each ID against `src/data/facilities.json` / `src/data/technologies.json` before saving.

A small CSS tweak in `HelpModal.svelte` styles `<strong>` inside `.help-paragraph` to use `--text-accent` and slightly more letter-spacing — making the goal line read as a heading without it being a separate `<h3>`.

### 5. Tooltip component accessibility upgrade

Modify `src/lib/components/Tooltip.svelte`:

- Add a stable `tooltipId` (generated via `$props.id()` or an incrementing module counter) and set it on the bubble.
- Bubble gets `role="tooltip"` and `id={tooltipId}`.
- Host span receives `aria-describedby={tooltipId}` and `tabindex="0"` so keyboard users can focus it.
- Show on `focusin`, hide on `focusout` (mirror the existing mouse logic). Position recalculation runs on both enter paths.
- Window keydown listener: hide on `Escape` while visible.
- Track visibility in a `$state` boolean instead of relying solely on CSS `:hover`, so focus and Escape behave consistently. CSS reads `data-visible` for the visibility/opacity transitions.

This is a contained refactor — every existing call site already passes `text` + child snippet, so no caller needs to change.

### 6. Tooltip migration: replace `title="…"`

Mechanical sweep. For each occurrence below, wrap the relevant element in `<Tooltip text={…}>` and delete the `title` attribute. Where the title text is dynamic (template string), pass it through as the `text` prop expression unchanged.

| File | Line(s) | Notes |
| --- | --- | --- |
| `BoardPanel.svelte` | 221, 230, 278 | Notification badge, dismiss button, recruit button. Disabled-reason tooltips already conditional. |
| `CardHand.svelte` | 104, 154, 174, 183 | Counter tags (×2) plus play and bank buttons. The play-button title combines several gating reasons — keep that logic, just feed the result string into `Tooltip text`. |
| `CompletedProjectsPanel.svelte` | 149 | Image-glyph type label. |
| `HelpButton.svelte` | 11 | Already has `aria-label`. Drop `title`; the new `Tooltip` will provide hover text. The component is wrapped at every call site, so wrap inside this component once. |
| `HUD.svelte` | 189, 200 | Seed copy button and import-save label. |
| `OngoingActionsPanel.svelte` | 214, 249 | Initiate buttons (×2). |
| `PlacementPromptCard.svelte` | 29 | Defer count badge. |
| `TechProgressSummary.svelte` | 49 | Per-field progress bar. |
| `TechTreeModal.svelte` | 477 | Reset-zoom button. |
| `routes/newgame/+page.svelte` | 118 | Generate-new-seed button. |
| `FacilityPicker.svelte` | already migrated to `Tooltip` in WIP diff — review and merge | |

After the sweep, run `grep -rn 'title="' src/` and confirm no remaining hits in interactive elements (SVG `<title>` elements inside icons are fine and should stay).

### 7. Update tooltip styling for direction edge case

While we're touching `Tooltip.svelte`, the current implementation only supports `above` / `below`. The migration list does not introduce horizontal cases, so no API extension needed in this phase. (Note for future: if a sidebar use case demands left/right, add it then.)

### 8. Tests

- `src/lib/richText.test.ts` — parser unit tests (see Plan §1).
- `src/lib/components/RichText.test.ts` — render tests using `@testing-library/svelte`-style or a Vitest DOM environment, checking that `{facility:spaceLaunchCentre}` produces a tooltip host with the facility name and that an unknown id renders the fallback string. (If we don't have a Svelte component test harness yet, defer to playwright e2e — see below.)
- `e2e/help.spec.ts` — Playwright smoke: open the Earth help modal, assert the GOAL line renders, hover the facility chip, assert tooltip text contains the facility name. One spec per affected modal is overkill; one earth-tab case is enough.
- Existing test count baseline: 454. After Phase 41 expect +6 to +12 unit tests.

### 9. Manual verification checklist

- Open help on every tab (Earth, Space, Belt, Projects, Board, Blocs, Tech Tree). Confirm the GOAL line is visible and tooltipped chips resolve.
- Tab key reaches each migrated tooltip host and the bubble shows on focus; Escape dismisses it.
- Screen-reader smoke (VoiceOver or NVDA): announce text includes the tooltip body via `aria-describedby`.
- Compare a representative selection of components before/after the title→Tooltip swap to confirm no layout regressions (Card hand row spacing is the most likely casualty since `Tooltip` introduces an inline-block wrapper).

## File-touch summary

New:
- `src/lib/richText.ts`
- `src/lib/richText.test.ts`
- `src/lib/components/RichText.svelte`

Modified:
- `src/lib/components/HelpModal.svelte` — render via `RichText`, style strong tags.
- `src/lib/components/Tooltip.svelte` — aria, focus, Escape.
- `src/data/helpTopics.ts` — add GOAL lines, sprinkle facility/tech tokens where natural.
- All files in the migration table (§6) — title→Tooltip swap.
- `src/lib/components/FacilityPicker.svelte` — finalise the WIP diff (already imports Tooltip).

## Open questions

- _Should the GOAL line dynamically reflect the player's current state (e.g. switch from "build SLC" to "complete Orbital Station" once SLC is built)?_ For Phase 41 keep it static — dynamic goals are a bigger feature touching the engine and belong in a follow-up. - _Keep this static. We are just providing guidance to new players, not a dynamic help system_
- _Should `RichText` be reused outside HelpModal (event cards, narrative text, project descriptions)?_ Build it general so it can, but only adopt it in HelpModal this phase. Wider rollout is a separate task. - _Agreed, build the general component but only using it for Help now_
- _Tooltip on touch devices?_ Out of scope — current Tooltip is hover/focus only and the game is desktop-first. - _Agreed, out of scope_

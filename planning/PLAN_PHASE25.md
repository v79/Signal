# Design Discussion — Steering Committee Rework

_Discussion date: 2026-03-16_

---

## Context

The Board panel is too easy to ignore. Members age and retire silently, recruitment is optional with no downside to leaving slots vacant, and nothing ever demands the player open the panel. Before implementing Era Transitions (which rely on a board-proposal mechanic), the Committee needs to be functionally meaningful.

---

## Rename: Board → Steering Committee

- Full name: **Steering Committee** (used in narrative, news items, tooltips)
- Short label: **COMMITTEE** (panel heading, tab label — matches existing all-caps style)
- All code identifiers (`board`, `BoardSlots`, `BoardMemberDef`, etc.) remain unchanged internally for now; rename is a display/string change only unless a dedicated refactor phase is scheduled.

---

## Summary of changes

| Area | Change |
|---|---|
| Recruiting | Costs an action slot (same cap as card plays) + per-character resource cost |
| Dismissing | Costs Political Will (20W by default) |
| Vacant slots | Explicit passive penalty shown in the panel |
| Recruitment pool | Seeded per run — only one alternative per role available per run |
| Era/tech gating | Some candidates only appear after tech discovery or era unlock |
| Retirement news | Use character name, not internal ID |
| Action cap scope | Extended to cover Build Facility and Recruit (not just card plays) |
| Notifications | Lightweight committee notifications inside the tab; major events escalate to event zone |

---

## ✅ 1. Action cap extended

Currently `actionsThisTurn` is only incremented by `playCard()`. Two additional actions must now consume an action slot:

- **Recruit committee member** — costs 1 action + resource cost
- **Build facility** — costs 1 action + build cost (already deducted)
- **Decommission facility** — free (losing a facility is already painful enough)

This means in a turn with `maxActionsPerTurn = 3` the player must choose between playing cards, building, and recruiting. They cannot do all three freely.

The UI should show the action counter `ACTIONS {n}/{max}` prominently enough that the player feels the constraint. Currently this counter is in the card hand header; it should remain there and also be visible when the facility picker is open.

---

## ✅ 2. Per-character recruitment costs

Recruitment cost moves from the hardcoded UI string `"15F · 10W"` to a field on each `BoardMemberDef`:

```ts
recruitCost: { funding: number; politicalWill: number }
```

Proposed costs:

| Character | Role | Cost |
|---|---|---|
| Dr. Elena Ramirez | Chief Scientist | 20F · 15W |
| Dr. Yuki Nakamura | Chief Scientist | 20F · 15W |
| Ing. Pavel Markov | Dir. Engineering | 15F · 10W |
| Dr. Tomasz Kowalski | Head of Finance | 10F · 20W |
| Prof. Funmi Akintunde | Head of Finance | 10F · 20W |
| Chair Abena Osei | Political Liaison | 5F · 30W |
| Director J. Bristow | Security Director | 20F · 5W |
| Manager Liwei Chen | Dir. Operations | 15F · 10W |
| Dr. Chidi Okonkwo | Signal Analyst | 25F · 20W |
| SYNTHESIS-7 | Signal Analyst | 40F · 50W (Era 3 only) |

The UI greys out candidates the player cannot currently afford (resource check, not action check — the player can see who they'd want even if they don't have the action yet).

---

## ✅ 3. Dismissal cost

Dismissing a committee member costs **20 Political Will**. This is deducted immediately. The dismissal is still instant (no delay). The cost reflects the political consequence of publicly removing a named official.

Exception: if a member is dismissed in response to a scandal or event card, the cost may be reduced or waived (defined in the event def).

---

## ✅ 4. Vacant slot penalties

Each unfilled role slot applies a passive penalty. The penalty is visible directly on the slot row in the panel even when collapsed — the player sees it without expanding.

Proposed penalties by role:

| Role | Vacant penalty |
|---|---|
| Chief Scientist | −10% Physics and Mathematics output |
| Dir. Engineering | −10% Engineering output |
| Head of Finance | −10% Funding income |
| Political Liaison | −10% Political Will income |
| Dir. Operations | −5% all resource income |
| Security Director | Security threat events cannot be auto-countered |
| Signal Analyst | −10% signal decode progress per turn |

Penalties are calculated in `computeBoardModifiers()` — vacant slots contribute a negative multiplier entry rather than the positive from an active member. The UI renders the penalty in amber/orange on the slot row: `VACANT — −10% Physics & Mathematics`.

**Open question:** Should there be a grace period (e.g. no penalty for the first 3 turns of a vacancy)? This would reduce early-game frustration when the player hasn't had time to recruit yet.

- _Yes to a grace period. The penalties for having open role slots are quite harsh. When the game starts a couple of slots should be filled (Head of Finance, Director of Operations) automatically._

---

## ✅ 5. Seeded candidate pool

Currently all 10 characters are always available. Instead, the run seed determines which alternative candidate is available per role:

- For roles with two defined candidates (Chief Scientist, Head of Finance, Signal Analyst), pick one using the run seed at game creation. The other never appears in that run.
- For roles with only one candidate, no change.

This means each run feels slightly different. The seed-based pick happens in `createGameState()` and is stored in state (as a list of available `defId`s), not recomputed on the fly.

- _In a future phase we need to extensively expand the pool of candidates, perhaps even procedural generation, to give a lot more flavour and variance between game runs._

---

## 6. Era and tech gating

Some candidates should not appear until game conditions are met:

| Character | Gate condition | Status |
|---|---|---|
| SYNTHESIS-7 | Era 3 only (`era === 'deepSpace'`) | ✅ Implemented |
| Dr. Chidi Okonkwo | Signal Analyst — requires `signalAnalysis` tech discovered | Deferred to Phase B |

The `candidateForRole()` function in `BoardPanel.svelte` filters by role and era; tech gating (Dr. Okonkwo) is deferred to Phase B alongside the rest of the tech-gate plumbing.

---

## 7. Committee notifications (lightweight events)

Committee members occasionally surface a **notification** — a short prompt displayed inside the Committee tab, not in the event zone. Notifications are non-blocking: the player can ignore them or act on them when they next open the tab.

Notification examples:
- *"Dr. Ramirez requests additional laboratory funding. Authorise +20F expenditure for a temporary +15% Physics bonus over 3 turns?"* → Authorise / Decline
- *"Ing. Markov warns that materials procurement is behind schedule."* (flavour only — no choice)
- *"Chair Osei recommends a diplomatic outreach. Spend 15W to pre-empt the next interference event?"*

Notifications that have **hard game consequences** (e.g. a member threatening resignation, the Orbital Station board proposal) escalate to the main event zone with a countdown timer and standard event resolution.

### Board proposals (era transition hook)

The Orbital Station board proposal (from `DESIGN_ERA_TRANSITIONS.md`) is an escalated notification — it fires in the event zone as a persistent event with no expiry countdown. It appears when the `orbitalMechanics` tech is discovered. The player must Authorise (spends Will + Funding) or Defer (member resurfaces periodically via news items).

This mechanic is defined here so the Committee rework and Era Transitions can share the same underlying system.

---

## ✅ 8. Retirement news fix

`tickBoardAges()` currently generates:
```
"Board member {member.id} has retired after a long and distinguished career."
```

This should use the character's display name, looked up from `defs`. The function needs to accept `defs` as a parameter (it currently does not).


## ✅ 9. Panel visual design

The current `BoardPanel.svelte` renders a plain vertical list of role names and member names. The redesigned panel uses the full available width to present each slot as a **card**, laid out in a **two-column grid** (so two slots sit side-by-side per row on a typical screen).

### Slot card anatomy

Each card has a fixed height and is divided into three horizontal zones:

```
┌──────────────────────────────────────────────┐
│ CHIEF SCIENTIST               [Dismiss]       │  ← role header bar (dark, all-caps)
├───────────┬──────────────────────────────────┤
│           │ Dr. Elena Ramirez                │  ← member name (bold)
│  [IMAGE]  │ +12% Physics & Mathematics       │  ← bonuses in green
│  64×64px  │ −5% Engineering                  │  ← debuff in amber/red
│           │                                  │
├───────────┴──────────────────────────────────┤
│ Cost to recruit: 20F · 15W                   │  ← only shown when VACANT
└──────────────────────────────────────────────┘
```

**Filled slot:**
- Role header bar across the full card width. A small **[Dismiss]** button sits in the top-right corner of the header — subdued styling (text-button or icon), not a prominent CTA.
- Left column: square placeholder image box (64×64 px), mid-grey background, rounded 4px, `role` initial letter centred as a stand-in until real portraits exist.
- Right column: member display name (bold, 1rem), then each buff on its own line in `#4ade80` (green), each debuff in `#f59e0b` (amber). Use the same short labels as the existing `computeBoardModifiers()` output.
- No recruit button; no cost line.

**Vacant slot:**
- Header bar shows the role name + `VACANT` badge (amber pill, right-aligned) instead of a [Dismiss] button.
- Left column: placeholder box with a dashed border and a `+` icon centred.
- Right column: penalty line(s) in amber, e.g. `VACANT — −10% Physics & Mathematics`. Below the penalty, the **[Recruit]** button — full-width within the right column, primary CTA styling. Greyed out and `disabled` if the player cannot afford the cost or has no action remaining.
- Below the right column (or as a footer row): recruitment cost in small text: `Costs 1 action · 20F · 15W`.

### States and interactions

| State | Visual treatment |
|---|---|
| Filled, affordable dismiss | [Dismiss] button visible in header |
| Filled, cannot afford dismiss (< 20W) | [Dismiss] button visible but greyed out; tooltip shows `Requires 20 Political Will` |
| Vacant, can recruit | [Recruit] button active; penalty shown |
| Vacant, cannot afford resources | [Recruit] button disabled; tooltip shows which resource is short |
| Vacant, no action remaining | [Recruit] button disabled; tooltip shows `No actions remaining this turn` |
| Grace period active (turns 1–3) | Penalty line replaced with `Grace period — penalty begins turn {n}` in grey |
| Era/tech gated candidate | Slot shows `No candidate available` instead of recruit button; small flavour line (e.g. `Requires Era 3`) |

### Notifications badge

When a member has a pending lightweight notification (§7), a small dot badge appears on the top-right of their card (outside the header bar). Clicking the card or the badge opens the notification inline below the card content.

### Responsive note

The two-column grid collapses to a single column if the panel width drops below ~480px. No horizontal scrolling.

### Colour palette reference

- Role header bar background: `#1e2a3a` (dark navy, matches existing panel chrome)
- Buff text: `#4ade80`
- Debuff / penalty text: `#f59e0b`
- VACANT badge background: `#f59e0b`, text: `#000`
- Grace period text: `#94a3b8` (slate-400)
- Recruit button: primary game CTA colour (matches "End Turn" button)
- Dismiss button: text-only, `#94a3b8`, hover `#ef4444`
- Placeholder image box border (vacant): `2px dashed #475569`

---

## Implementation scope

This design covers two separable implementation phases:

### Phase A — Mechanical foundations (recommended first)
- ✅ Extend action cap to `buildFacility` and `recruitMember`
- ✅ Add `recruitCost` to `BoardMemberDef` and enforce it properly
- ✅ Add dismissal Will cost
- ✅ Vacant slot penalties in `computeBoardModifiers()`
- ✅ Seeded candidate pool in `createGameState()`
- ✅ Rename "BOARD" → "COMMITTEE" in all display strings
- ✅ Fix retirement news to use character name
- ✅ Redesign `BoardPanel.svelte` to two-column card grid (§9)

### Phase B — Committee notifications + board proposals
- Notification data model (lightweight, stored in `GameState`)
- Committee tab renders active notifications
- Board proposal event (Orbital Station) wired to tech discovery
- Era gating for candidates — ✅ SYNTHESIS-7 Era 3 gate implemented; Dr. Okonkwo `signalAnalysis` tech gate still pending

Phase B depends on Era Transitions design being finalised and is best done alongside it.

---

## Open questions

1. Should vacant slots have a 3-turn grace period before penalties apply?

- _Yes, at least 3 turns, maybe more after playtesting_

2. Should decommissioning a facility also cost an action, or remain free?

- _Yes, decommissioning is a free action; may cost Will (putting people out of a job)_

3. For the seeded candidate pool — should the player be told at game start which candidates are available in their run, or discover it when the slot becomes vacant?

- _Discover when the slot becomes available, especially as we expand the recruitment pool in a later phase_

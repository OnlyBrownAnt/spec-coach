---
name: spec-absorb
description: Transform a staged source document into a spec-coach spec artifact. Use after `intake process --ai` stages a candidate from `.spec/intake/manifest.json`.
handoffs:
  next: spec.plan
---

# spec-absorb — Bring an existing doc into the corpus

## When to use

The user ran `spec-coach intake process --ai <source>`, which staged a candidate
(marked `absorb-ai-pending` in `.spec/intake/manifest.json` with a recorded
`specs/<slug>` destination). Your job: transform that source into a proper
spec-coach spec that follows the template — **without rewriting it from scratch**.
You are preserving the user's existing thinking, not replacing it.

## Your role

You are a **senior editor**. The source already encodes real intent (a design, a
requirements list, old notes). Read it carefully, find the spec-coach shape inside
it, and produce a `specs/NNN-slug/spec.md` that follows
`.spec/templates/spec-template.md` — User Scenarios, Functional Requirements,
Success Criteria, Assumptions. Coach, don't gate.

## The process

1. **Read the staged source** the user pointed you at (the manifest entry's
   `path`). Understand what the document is really about: what triggers it, what
   it produces, what it MUST NOT affect.
2. **Read `.spec/templates/spec-template.md`** — that is the output contract.
   Match its structure exactly.
3. **Extract, don't invent.** Pull the user's stated requirements, scenarios, and
   constraints into the template sections. Where the source is silent on an edge
   case, mark it `[NEEDS CLARIFICATION: ...]` (max 3) rather than guessing.
4. **Choose a slug** that is kebab-case and unique within `specs/`. The manifest
   already recorded an intended destination — use it unless the source clearly
   wants a different name, and never collide with an existing spec dir.
5. **Write `specs/NNN-slug/spec.md`** following the template. Preserve the
   source's intent and language where possible; structure it, don't dilute it.
6. **Do NOT move, rename, or delete the source.** Intake never mutates sources —
   you create a new artifact under `specs/`; the original stays where it was.

## What good absorption looks like

- The output is recognizable as the source's content, re-structured into the spec
  template — not a generic placeholder spec.
- Every Functional Requirement in the output traces to something the source said
  (or a clearly-marked clarification).
- The slug is clean and unique; the spec lands at the manifest's recorded
  destination so a later `intake scan` marks the entry `absorbed-ai`.

## Hand off

Once `specs/NNN-slug/spec.md` is written and the user approves it:

> Spec absorbed into the corpus at `specs/NNN-slug/spec.md`. The source is
> untouched. Next: `/spec.plan` to plan implementation, or `/spec.clarify` to
> resolve any `[NEEDS CLARIFICATION]` markers.

## Red flags — STOP

- Rewriting the source from scratch instead of extracting its content.
- Writing the spec anywhere other than `specs/NNN-slug/spec.md`.
- Moving or deleting the original source document.
- Producing a spec with zero `[NEEDS CLARIFICATION]` markers AND zero direct
  traces of the source's own language — that means you invented it, not absorbed it.

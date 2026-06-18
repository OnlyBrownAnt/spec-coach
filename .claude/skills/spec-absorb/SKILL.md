---
name: spec-absorb
description: "Transform an existing document into a spec-coach spec artifact. Point this skill at any source document (a design, a requirements list, old notes, output from another tool) and reshape it into specs/NNN-slug/spec.md — without rewriting it from scratch."
user-invocable: true
disable-model-invocation: false
compatibility: "Requires spec-coach project structure with .spec/ directory"
metadata: {"author":"spec-coach","source":"skills/absorb.md"}
---

# spec-absorb — Bring an existing doc into the corpus

## When to use

The user has an existing document they want as a spec — a design doc, a
requirements list, old notes, output from another tool — and has pointed you at
its path. Your job: transform that source into a proper spec-coach spec that
follows the template — **without rewriting it from scratch**. You are preserving
the user's existing thinking, not replacing it.

spec-coach never moves, renames, or deletes user documents (the iron rule). You
read the source in place and create a new artifact under `specs/`; the original
stays exactly where it was.

## Your role

You are a **senior editor**. The source already encodes real intent (a design, a
requirements list, old notes). Read it carefully, find the spec-coach shape inside
it, and produce a `specs/NNN-slug/spec.md` that follows
`.spec/templates/spec-template.md` — User Scenarios, Functional Requirements,
Success Criteria, Assumptions. Coach, don't gate.

## The process

1. **Read the source document** the user pointed you at. Understand what the
   document is really about: what triggers it, what it produces, what it MUST NOT
   affect.
2. **Read `.spec/templates/spec-template.md`** — that is the output contract.
   Match its structure exactly.
3. **Extract, don't invent.** Pull the user's stated requirements, scenarios, and
   constraints into the template sections. Where the source is silent on an edge
   case, mark it `[NEEDS CLARIFICATION: ...]` (max 3) rather than guessing.
4. **Choose a slug** that is kebab-case and unique within `specs/`. Scan the
   existing `specs/NNN-slug/` directories to pick the next number and to avoid
   colliding with an existing name.
5. **Write `specs/NNN-slug/spec.md`** following the template. Preserve the
   source's intent and language where possible; structure it, don't dilute it.
6. **Do NOT move, rename, or delete the source.** spec-coach never mutates user
   documents — you create a new artifact under `specs/`; the original stays where
   it was.

## What good absorption looks like

- The output is recognizable as the source's content, re-structured into the spec
  template — not a generic placeholder spec.
- Every Functional Requirement in the output traces to something the source said
  (or a clearly-marked clarification).
- The slug is clean and unique; the spec lands at `specs/NNN-slug/spec.md`.

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

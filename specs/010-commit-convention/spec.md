# Feature Specification: Configurable Commit Convention

**Feature Branch**: `010-commit-convention`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User observation: the SDD workflow is genuinely commit-coupled (`spec-tasks` / `spec-implement` make "one commit per task" a first-class doctrine), yet commit messages are inconsistent. Evidence gathered before drafting:

- **Drift is real and coached.** History mixes Conventional Commits (`feat:`/`fix:`/`docs(x):`/`chore:`) with a bare task-ID prefix (`T001:` / `T008 (US3):`). The task-ID form is **not** a valid Conventional Commit, and spec 008/009 are almost entirely `T0xx:`. Worse, it is self-inflicted: `skills/implement.md:137` literally says *"Commit with the task ID and a clear description"* — the tool's own skill produces the non-conforming form.
- **The source of truth is empty.** The constitution's "Runtime guidance" clause says *"commit style … live in `CLAUDE.md`"*, but the dogfood `CLAUDE.md` has **no** commit guidance; `.spec/` has no convention file; there is no commitlint / husky / commit-msg hook / package.json tooling. Commit convention currently lives nowhere.
- **The workflow is commit-coupled**, so commit format is structural, not cosmetic.

**Locked approach** (4 decisions, all user-confirmed): focused spec 010; a new user-owned `.spec/convention.md` (seedable); spec-coach's task ID **absorbed into** Conventional Commits (not dropped — preserve tasks.md↔commit traceability); a **coach-style** non-blocking advisor (`verify-commit.sh`), no commit-msg hook. This fits the product DNA (`.spec`-owned rules like the constitution and `hooks.md`) and honors Principle II (Coach-Not-Gatekeeper) + Principle III (Zero Dependencies — no commitlint/husky).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single source of truth, owned & configurable (Priority: P1)

A team using spec-coach wants ONE place that declares their commit convention — a file they own and can tailor (enforce a type set, declare allowed scopes, choose Conventional Commits or a house variant). Today there is no such place: the constitution delegates to an empty `CLAUDE.md`, and the implement skill coaches a format that contradicts Conventional Commits. spec 010 makes `.spec/convention.md` the charter-tier source (like the constitution: human-owned, agent-agnostic), seeded by `init` and never clobbered.

**Why this priority**: Root cause. Without a source of truth, neither the skill coaching (US2) nor the advisor (US3) can be consistent. It is also the user's explicit novel requirement (".spec, user-configurable"). Everything else depends on it.

**Independent Test**: In a `mkdtemp` repo, `init` seeds `.spec/convention.md` from `convention-template.md`; re-running `init` over an authored convention preserves it (never-clobber lock test, mirroring spec 009's FR-007 invariant). Content-assertion that the shipped template declares Conventional Commits as the default and documents the task-ID fold.

**Acceptance Scenarios**:

1. **Given** a repo with no `.spec/convention.md`, **When** `init` runs, **Then** `.spec/convention.md` is seeded from `convention-template.md` (TEMPLATE state).
2. **Given** an AUTHORED `.spec/convention.md`, **When** `init` or `update` runs, **Then** the file is preserved byte-for-byte (never overwritten) — the constitution never-clobber invariant extended to the convention.
3. **Given** an AUTHORED convention a team has tailored (e.g. a custom allowed-type list), **When** any spec-coach command runs, **Then** the team's edits survive untouched (the convention is IP, not regenerable tooling).

---

### User Story 2 - The workflow coaches conforming commits (Priority: P2)

The drift the user noticed is produced by the tool itself. spec 010 retargets the commit-producing skills — `spec-implement`'s COMMIT step, `spec-tasks`' one-commit-per-task doctrine, and the `tasks-template.md` guidance — to coach the declared convention. spec-coach's task ID is **folded into** Conventional Commits (not dropped), so the tasks.md↔commit traceability the implement skill values survives: default canonical form `type(scope): subject` with an optional `Task: Txxx` footer.

**Why this priority**: This is the drift fix — it resolves the live contradiction. It depends on US1 (the source) and is the MVP: without it the tool keeps emitting `T0xx:`-first commits that violate the convention it is supposed to enforce.

**Independent Test**: Content-assertion on `skills/implement.md` + `.spec/templates/tasks-template.md`: they coach the conventional form with the task ID folded in AND no longer coach the bare `Txxx:`-first format (RED: assert the old `Commit with the task ID` line is replaced by convention-aware coaching).

**Acceptance Scenarios**:

1. **Given** an authored `.spec/convention.md`, **When** `spec-implement` reaches its COMMIT step, **Then** it coaches a commit that conforms to the declared convention, with the task ID folded in per the canonical form.
2. **Given** no `.spec/convention.md` (ABSENT) or a TEMPLATE one, **When** the skills coach a commit, **Then** they coach the shipped default (Conventional Commits + task-ID fold) — never the bare `T0xx:`-first form.
3. **Given** a non-SDD commit (no task), **When** it is coached, **Then** it uses the plain conventional form with no `Task:` footer (the footer is optional, present only for SDD task commits).

---

### User Story 3 - A non-blocking compliance advisor (Priority: P3)

A team wants to self-audit commit hygiene without a hard gate. A `verify-commit.sh` advisor (mirroring `verify-spec.sh` / `verify-constitution-sync.sh`) checks HEAD — or a supplied rev-range — against `.spec/convention.md`, reports conforming/non-conforming, and **always exits 0** (Coach-Not-Gatekeeper, Principle II). It honors a custom type set/scope format declared in the convention rather than hardcoding Conventional Commits.

**Why this priority**: A verifiability layer on top of US1+US2 (Principle V — verify what ships). Lower priority because US1+US2 already stop the bleeding; the advisor makes compliance machine-checkable. Coach-only by design — no commit-msg hook (that would be a gatekeeper and would add install/uninstall lifecycle surface).

**Independent Test**: `execSync` `verify-commit.sh` in `mkdtemp` on crafted commit fixtures (conforming `feat(x): y` → reported conforming; non-conforming `T001: foo` → flagged; a merge commit → skipped; no convention file → reports ABSENT and coaches the default). Assert exit code 0 in every case.

**Acceptance Scenarios**:

1. **Given** a conforming HEAD commit and an AUTHORED convention, **When** `verify-commit.sh` runs, **Then** it reports the commit as conforming and exits 0.
2. **Given** a non-conforming HEAD commit (`T001: foo`), **When** `verify-commit.sh` runs, **Then** it flags the violation (citing the rule), still exits 0, and never blocks.
3. **Given** a merge commit or an automated/bot commit at HEAD, **When** `verify-commit.sh` runs, **Then** it skips that commit (these have their own format and are not governed) and exits 0.

---

### User Story 4 - Dogfood: ship spec-coach's own convention + fix the constitution hole (Priority: P4)

spec-coach should ship its OWN authored `.spec/convention.md`, and the constitution's "Runtime guidance" clause — which wrongly says commit style lives in `CLAUDE.md` — MUST be amended to delegate to `.spec/convention.md`, filling the hole that made the drift possible. This closes the loop on the home repo (like spec 009's US4) and removes the code/charter/convention drift.

**Why this priority**: Closure, not new capability. US1–US3 deliver the value independently; US4 ratifies it on the home repo and makes the constitution accurate. Lowest priority.

**Independent Test**: Content-assertion that spec-coach's `.spec/convention.md` is AUTHORED (no template tokens) and the constitution's Runtime-guidance clause points to `.spec/convention.md`; `verify-constitution-sync.sh` reports CLEAN.

**Acceptance Scenarios**:

1. **Given** spec-coach's repo, **When** spec 010 lands, **Then** `.spec/convention.md` is AUTHORED (no signature tokens) and declares Conventional Commits + the task-ID fold as spec-coach's convention.
2. **Given** the constitution's Runtime-guidance clause, **When** read, **Then** it delegates commit style to `.spec/convention.md` (not the empty `CLAUDE.md`), with a rationale.
3. **Given** the amended constitution, **When** `verify-constitution-sync.sh` runs, **Then** it reports the principle set and CLEAN (no pending amendment block).

---

### Edge Cases

- **Convention ABSENT** (never `init`'d): advisor reports `ABSENT`; skills coach the shipped default; never blocks.
- **Convention TEMPLATE** (seeded, never authored — signature tokens like `[ALLOWED_TYPES]` present): advisor reports `TEMPLATE` and coaches "ratify your convention"; uses the default for checking until authored (mirrors spec 009's constitution TEMPLATE state).
- **Custom type set / scope format** declared in an authored convention: advisor honors the declared set, not a hardcoded Conventional list.
- **Fully custom (non-Conventional) scheme** declared in prose: advisor defers ("custom convention — manual review") rather than hard-failing (Coach-Not-Gatekeeper).
- **Merge commits / automated/bot commits** (no type prefix): skipped, never flagged.
- **No commits yet** (fresh init, empty repo): advisor reports "no commits to check" and exits 0.
- **Rev-range vs single commit**: advisor accepts an optional rev-range arg (default `HEAD`).
- **Commit format is NOT a state source** (spec 008 boundary): no script infers feature/phase/progress from commit messages; commits are quality/presentation only. (Guardrail — see FR-005.)
- **Unrelated non-SDD commit** (no task ID): valid; the `Task:` footer is optional.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (convention source)**: `.spec/convention.md` MUST be the single, project-owned source of truth for the commit convention (charter-as-IP tier, like the constitution). `init` MUST seed it from `.spec/templates/convention-template.md` only when absent; `init`/`update` MUST never overwrite an AUTHORED convention (extending the spec 009 never-clobber invariant to the convention).
- **FR-002 (default convention)**: The shipped default MUST be Conventional Commits — subject `type(scope): subject` with an optional `Task: Txxx` footer that folds spec-coach's task ID in (preserving tasks.md↔commit traceability). The default allowed types MUST include at least `feat`, `fix`, `docs`, `refactor`, `test`, `chore` (the set the repo already uses).
- **FR-003 (skills conform)**: `spec-implement`'s COMMIT step, `spec-tasks`' one-commit-per-task doctrine, and `.spec/templates/tasks-template.md` MUST coach the default canonical form (FR-002) and MUST NOT coach the bare `Txxx:`-first format. They MUST reference `.spec/convention.md` as the source and coach the default when it is ABSENT/TEMPLATE.
- **FR-004 (advisor)**: A non-blocking `.spec/scripts/bash/verify-commit.sh` MUST report whether a commit (default `HEAD`, or a supplied rev-range) conforms to the declared convention; it MUST always exit 0 (Principle II), skip merge/bot commits, honor a custom type set / scope format declared in the convention (not a hardcoded list), and report convention status `ABSENT` / `TEMPLATE` / `AUTHORED`.
- **FR-005 (not a state source)**: Commit messages MUST NOT be read as a source of derived workflow state — no spec-coach script MAY infer feature, phase, or progress from commit messages (the spec 008 boundary; commits are quality/presentation, not state).
- **FR-006 (dogfood + constitution hole)**: spec-coach MUST ship an AUTHORED `.spec/convention.md`, and the constitution's "Runtime guidance" clause MUST be amended to delegate commit style to `.spec/convention.md` (filling the empty-`CLAUDE.md` hole). Constitution-doc version MUST bump MINOR → **v1.6.0** (expanding the Runtime-guidance clause); package version MUST bump MINOR **2.4.0 → 2.5.0**.

### Key Entities *(include if feature involves data)*

- **Convention status** (drives coaching + advisor behavior, computed read-only — never stored): `ABSENT` (no `.spec/convention.md`) | `TEMPLATE` (file present, ≥1 template-signature placeholder present, e.g. `[ALLOWED_TYPES]` / `[PROJECT_NAME]`) | `AUTHORED` (no signature placeholders present). Mirrors the spec 009 constitution-status model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `.spec/convention.md` is init-seeded from the template and never clobbered — verified by a TS lock test in `mkdtemp`: `init` seeds it; `init` over an AUTHORED convention preserves it (mirrors the spec 009 never-clobber test).
- **SC-002**: `skills/implement.md` + `.spec/templates/tasks-template.md` coach the conventional form with the task ID folded in and no longer coach the bare `Txxx:`-first form — verified by content-assertion (RED on the old `Commit with the task ID` line).
- **SC-003**: `verify-commit.sh` reports HEAD conformance, always exits 0, skips merge/bot commits, and honors `ABSENT`/`TEMPLATE`/`AUTHORED` + a custom type set — verified by an `execSync`-in-`mkdtemp` bash test (mirrors `constitution-charter.test.ts`).
- **SC-004**: No spec-coach script infers workflow state from commit messages — verified by a grep guardrail test over `scripts/bash/` + `src/` asserting the spec 008 boundary holds.
- **SC-005**: spec-coach ships an AUTHORED `.spec/convention.md` and the constitution's Runtime-guidance clause delegates to it — verified by content assertions + `verify-constitution-sync.sh` CLEAN.

## Assumptions

- **Scope / version**: behavioral + a new template (`convention-template.md`) + a new advisor script (`verify-commit.sh`) + skill-prose edits + a constitution amendment. No install file-structure break (template + script are additive; `update` is not broken) → **MINOR 2.4.0 → 2.5.0** (spec 009 was merged to `main` first, so 010 branches from 2.4.0 + the authored constitution v1.5.0 — no version collision).
- **FR-006 constitution amendment**: the amendment applies to the AUTHORED constitution, now on `main` (v1.5.0 — spec 009 was merged ahead of this spec). Expanding the Runtime-guidance clause to delegate commit style to `.spec/convention.md` is a MINOR constitution-doc bump → **v1.5.0 → v1.6.0**.
- **Advisor v1 surface**: checks the subject line (type prefix ∈ the declared set; scope shape) and recognizes the optional `Task:` footer. Full body/footer linting and allowed-scope-list enforcement are out of scope (future).
- **Coach-Not-Gatekeeper**: no commit-msg hook is installed (Principle II); the advisor reports only. A hook would also add install/uninstall lifecycle surface and would not run in GUI clients.
- **Convention location**: `.spec/convention.md` (agent-agnostic, like `.spec/memory/constitution.md`); `.spec/templates/convention-template.md` is the init seed.
- **No history rewrite**: existing `T0xx:` commits in the log are left as-is; conformance is forward-going.
- **spec 008 boundary**: commit format is quality/presentation, not a derived-state source (FR-005).
- **Testing philosophy**: skill-prose deliverables verified by content-assertion tests; the advisor verified by `execSync`-in-`mkdtemp` bash tests (mirroring `tests/units/constitution-charter.test.ts` + `workflow-state.test.ts`). `npm test` is non-headless and is NOT the gate; the gate is `npx tsx tests/units/*.test.ts` + bash/CLI smokes.
- **Constitution principles honored**: I (markdown skill + bash advisor — no new TS coaching code); II (non-blocking advisor, no hook); III (no commitlint/husky dependency); IV (RFC 2119 in the template, every section documented); V (content-assertion + advisor tests verify what ships).

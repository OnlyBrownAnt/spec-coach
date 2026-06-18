# Feature Specification: Constitution as Charter

**Feature Branch**: `009-constitution-charter`

**Created**: 2026-06-18

**Status**: Implemented

**Input**: User scope decision (scope A — behavioral, keep `.spec/memory/constitution.md`, MINOR) plus the preceding design dialogue: the constitution is a global, agent-agnostic, human-owned project charter on the same tier as `CLAUDE.md`, not disposable tooling. spec-coach already treats `CLAUDE.md` correctly (managed `<!-- COACH -->` slice: upsert only that slice, strip only that slice on uninstall, never delete the human file) but holds the constitution to a lower standard. spec 009 raises the constitution to parity. **Final scope (Path 1)**: behavioral improvements (scope A) PLUS re-authoring spec-coach's own live constitution via the improved tool as the closing dogfood; root-level migration (scope B / MAJOR) is deferred to a potential separate spec 010.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Amend, Don't Overwrite (Priority: P1)

Today `/spec-constitution` step 3 ("Write the Constitution") has no guard: re-running it on an already-authored constitution can rewrite settled principles wholesale (the overwrite model inherited from spec-kit, `templates/commands/constitution.md:100` "Write the completed constitution back ... (overwrite)"). A charter is the team's judgment; a re-run for a small tweak must not silently drift principles that were already decided.

**Why this priority**: This is the determinism win the user was probing for. Stability of an authored charter is the property that matters — not first-run determinism (a category error for any charter, `CLAUDE.md` included), but *amendability without drift*. It is also the cheapest to break and the most damaging when it does.

**Independent Test**: Given an authored constitution fixture, invoke the constitution workflow's status advisor and the skill's amend branch; assert settled principle text is unchanged unless an explicit amendment targets it. Fully testable via the advisor script (TEMPLATE vs AUTHORED detection) plus a skill-content assertion that the amend instruction is present.

**Acceptance Scenarios**:

1. **Given** `.spec/memory/constitution.md` is AUTHORED (no template-signature placeholders, ≥1 `### ` principle), **When** the user re-runs `/spec-constitution` to refine one principle, **Then** only that principle (and the version footer) changes; every other settled principle's text is byte-identical.
2. **Given** the constitution is AUTHORED, **When** `/spec-constitution` runs, **Then** the skill takes the *amend* branch (anchored to the existing principle set), not the cold-start *write* branch.
3. **Given** the constitution is AUTHORED and the user wants a full rewrite, **When** they pass an explicit destructive opt-in (e.g. `--reset`), **Then** and only then may the whole file be rewritten.

---

### User Story 2 - Seeded Cold-Start (Priority: P2)

When the constitution is absent or still the raw template, `/spec-constitution` step 2 ("Ask What Matters") asks the team abstract questions but reads no project signals — so two cold starts on the same repo diverge more than they must. spec-kit does better here (`commands/constitution.md:65` "infer from existing repo context (README, docs, prior constitution versions)"). spec-coach should coach *with seeding*: read the repo, PROPOSE candidate principles as a starting menu, and let the human ratify.

**Why this priority**: This is where spec-kit is genuinely ahead and spec-coach under-delivers. Seeded cold-start converges faster and still honors Coach-Not-Gatekeeper (propose, never impose). It directly serves the user's "same project should converge" concern at the one point where non-determinism is legitimate (first authoring).

**Independent Test**: Given a repo with concrete signals (a `package.json`, a source dir, a README, existing `specs/`), invoke cold-start; assert the proposal cites ≥3 concrete repo-derived signals and surfaces them for approval rather than auto-writing.

**Acceptance Scenarios**:

1. **Given** the constitution is ABSENT or still the TEMPLATE, **When** `/spec-constitution` runs, **Then** the skill reads concrete repo signals (package name/deps, source/skills structure, README, existing specs) and PROPOSES candidate principles + the two flexible sections as a starting menu.
2. **Given** a seeded proposal, **When** the human has not ratified it, **Then** nothing is written to `.spec/memory/constitution.md` beyond what the human approves (propose, not auto-insert).
3. **Given** the constitution is AUTHORED, **When** `/spec-constitution` runs, **Then** the cold-start/seeding branch is NOT taken (US1 amend branch wins).

---

### User Story 3 - Preserve on Uninstall (Priority: P3)

spec 007 classified `.spec/memory/constitution.md` as `INFRA_PATHS` ("regenerable tooling") and `uninstall` deletes it on plain uninstall. But the authored constitution is project IP — deleting it is data loss of the team's charter, the same hazard spec-coach criticizes in spec-kit's `init --force` overwrite. The constitution crosses from tooling to IP the moment the team authors it; `uninstall` should treat it like `CLAUDE.md` (preserve the human file; strip only any tool-managed slice) and like `specs/` (preserve on plain uninstall, remove only on `--force`).

**Why this priority**: A real data-loss footgun, but lower priority than US1/US2 because it only triggers on uninstall and the file is git-tracked (recoverable). Still, the principle (charter = IP) is load-bearing for the whole feature's coherence.

**Independent Test**: Given a repo with an authored constitution, run `uninstall --yes` (plain) and assert `.spec/memory/constitution.md` survives; run `uninstall --yes --force` and assert it is removed. Mechanical TS unit test in a `mkdtemp` repo.

**Acceptance Scenarios**:

1. **Given** a repo with an AUTHORED `.spec/memory/constitution.md`, **When** the user runs plain `uninstall --yes`, **Then** the constitution file is preserved (and `specs/` is preserved as today).
2. **Given** the same repo, **When** the user runs `uninstall --yes --force`, **Then** the constitution (and `specs/`) is removed.
3. **Given** a repo where the constitution is still the TEMPLATE (never authored), **When** plain `uninstall --yes` runs, **Then** the template file is removed (it is tooling — never crossed to IP).

---

### User Story 4 - Dogfood: Re-author spec-coach's own charter (Priority: P4)

spec-coach should ship with its OWN constitution authored by the improved tool. Today the repo's `.spec/memory/constitution.md` is the raw template (deliberate reset, `c31ce84`) — an embarrassment for a tool whose job is constitutions, and an inconsistency: spec 009 changes `uninstall` to preserve the constitution, but the (git-history) v1.4.0 charter still says spec 007 removes it. Re-authoring via the improved cold-start closes the loop: it proves US2 works end-to-end AND produces a charter natively consistent with the new code.

**Why this priority**: Closure, not new capability. It exercises US1–US3 on spec-coach itself and removes the code/charter drift. Lowest priority because US1–US3 deliver the user value independently; this task ratifies that value on the home repo.

**Independent Test**: Run the improved `/spec-constitution` cold-start on this repo; assert the result is an AUTHORED charter (no template placeholders) that codifies the charter-as-IP principle and the corrected uninstall clause. This is a content task (judgment about spec-coach's principles), not a TDD code task — verified by content assertion, not RED-first.

**Acceptance Scenarios**:

1. **Given** spec-coach's live constitution is the raw template, **When** the improved `/spec-constitution` cold-start runs (seeded from `package.json` / `skills` / `src` / README), **Then** it produces an AUTHORED charter: 5-7 principles (Iron Laws), each with a rationale, no template-signature placeholders, footer version set per FR-004.
2. **Given** the re-authored charter, **Then** it contains the charter-as-IP clause (global, agent-agnostic, human-owned; amended never overwritten, preserved never deleted) AND the corrected uninstall clause (plain uninstall preserves; only `--force` removes) — superseding spec 007's "regenerable tooling, removed on uninstall" classification.
3. **Given** the re-authored charter, **When** `verify-constitution-sync.sh` runs, **Then** it reports the principle set and the amendment status (PENDING until propagation completes, then CLEAN).

---

### Edge Cases

- **Template vs authored discrimination**: The advisor detects TEMPLATE by the template's *signature* placeholders (`[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`, `[CONSTITUTION_VERSION]`, `[RATIFICATION_DATE]`, `[LAST_AMENDED_DATE]`, `[SECTION_2_NAME]`, `[SECTION_2_CONTENT]`, etc.) — NOT by any bracket, so legitimate authored markers like `[NEEDS CLARIFICATION: ...]` or `[GUIDANCE_FILE]` do not cause false "template" classification.
- **Constitution absent entirely** (never init'd): cold-start path (seed + author); advisor reports `ABSENT`.
- **Constitution present but zero principles** (authored shell): treat as AUTHORED-but-thin → amend branch (do not clobber); advisor reports `AUTHORED`.
- **Partial amendment**: changing one principle touches only that principle + the version footer; bump per FR-004 semver; Sync Impact Report records the delta.
- **Re-run after a deliberate reset** (template on disk, the repo's current state): cold-start path applies (template detected) → produces a fresh charter. This is the intended recovery path for the user's reset.
- **Multiple agents installed** (Claude/Codex/Gemini): the constitution lives at agent-agnostic `.spec/memory/`, never inside any agent's context file; preserve-on-uninstall is independent of which agents are installed.
- **Advisor on missing/malformed constitution**: reports status and exits 0; never blocks the workflow (Coach-Not-Gatekeeper).
- **`spec-coach update` over an authored constitution**: must not clobber it (the existing `installConstitutionToMemory` `if (fs.existsSync(constDest)) return false` guard already enforces this for init; spec 009 codifies it as an invariant and verifies update respects it too).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (amend-guard)**: `/spec-constitution` MUST distinguish AUTHORED (no template-signature placeholders present — the principle count is informational and MAY be 0, e.g. an authored shell) from TEMPLATE/ABSENT. On AUTHORED it MUST take an *amend* branch anchored to the existing principle set — it MUST NOT rewrite a settled principle unless that principle is the explicit target of the amendment. On TEMPLATE/ABSENT it MUST take the cold-start *author* branch (US2).
- **FR-002 (status advisor)**: A non-blocking advisory script MUST report constitution status as `TEMPLATE` | `AUTHORED` | `ABSENT` together with the footer version and last-amended date. The skill MUST reference this to choose amend vs cold-start. The script MUST never refuse or exit non-zero on a present constitution (advises only — Coach-Not-Gatekeeper). (Implemented by extending `verify-constitution-sync.sh` or a new `constitution-status.sh`, matching the existing non-blocking advisor pattern.)
- **FR-003 (seeded cold-start)**: On the cold-start branch, the skill MUST read concrete repo signals — at minimum `package.json` (name + dependency list), the primary source/skills directory structure, `README.md`, and any existing `specs/` — and PROPOSE candidate principles plus the two flexible sections as a starting menu. It MUST surface the proposal for human ratification and MUST NOT write the constitution until the human approves.
- **FR-004 (constitution semver)**: On any amendment, the skill MUST bump the constitution footer version per semantic rules and state the bump rationale: MAJOR = principle removed, redefined, or renamed; MINOR = principle or section added or materially expanded; PATCH = wording/clarification with no semantic change.
- **FR-005 (exhaustive propagation)**: The amendment propagation checklist (skill step 4) MUST cover `spec-template.md`, `plan-template.md`, `tasks-template.md`, AND every installed skill that embeds principle wording (not only `plan-template.md` as today). Existing `specs/*/plan.md` files with stale Constitution Checks MUST be flagged for re-review.
- **FR-006 (preserve on uninstall)**: `uninstall` MUST preserve `.spec/memory/constitution.md` on plain uninstall (`--yes` without `--force`). Only `--force`/purge MAY remove it. This reclassifies the authored constitution off `INFRA_PATHS` and onto the IP tier alongside `specs/`.
- **FR-007 (never-clobber invariant)**: No command — `init`, `update`, `uninstall`, or `/spec-constitution` — MAY silently overwrite or delete an AUTHORED constitution except explicit `--force`/purge or an explicit `--reset` on the constitution command. The existing `installConstitutionToMemory` `if (fs.existsSync(constDest)) return false` guard is codified as the invariant for the install/update path.
- **FR-008 (dogfood re-author)**: spec 009 MUST re-author spec-coach's own `.spec/memory/constitution.md` via the improved `/spec-constitution` (cold-start — the live file is currently the template). The re-authored charter MUST codify (a) the **charter-as-IP principle** — the constitution is a global, agent-agnostic, human-owned project charter, amended never overwritten and preserved never deleted; and (b) the **corrected uninstall clause** — plain uninstall preserves the authored constitution, only `--force` removes it — superseding spec 007's "regenerable tooling, removed on uninstall" classification. The charter footer version MUST be set per FR-004 semantics (continuing the v1.4.0 lineage).

### Key Entities *(include if feature involves data)*

- **Constitution status** (drives amend vs cold-start): `TEMPLATE` (≥1 template-signature placeholder present) | `AUTHORED` (no signature placeholders present; the principle count is reported alongside and MAY be 0 — an authored shell is still AUTHORED) | `ABSENT` (file missing). Computed read-only by the status advisor (FR-002); never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `/spec-constitution` skill takes the *amend* branch on an AUTHORED constitution (anchored to the existing principle set) and the *cold-start* branch on TEMPLATE/ABSENT, verified by the advisor's status detection (TEMPLATE/AUTHORED/ABSENT) plus a skill-content assertion that the amend-vs-cold-start instruction is present. NOTE: the amend-guard is **coaching-enforced (best-effort)** — the content-assertion proves the guidance exists, not that the AI follows it (unlike US3/FR-006, which is mechanically enforced in `uninstall.ts`). This asymmetry is intentional under Constitution II (Coach-Not-Gatekeeper); the criterion asserts the coaching is in place, not hard prevention of drift.
- **SC-002**: A cold-start proposal cites ≥3 concrete repo-derived signals (e.g. dependency list, source/skills structure, README purpose) and is surfaced for approval, not auto-written. Verified via skill-content assertion.
- **SC-003**: Plain `uninstall --yes` preserves `.spec/memory/constitution.md`; `uninstall --yes --force` removes it. Verified by a TS unit test in a `mkdtemp` repo.
- **SC-004**: An amendment produces a constitution-footer version bump matching MAJOR/MINOR/PATCH semantics (FR-004) with a stated rationale. Verified via skill-content assertion + documented semantics.
- **SC-005**: No command overwrites an AUTHORED constitution except explicit purge/reset. Verified by TS unit tests: `init` over an authored constitution preserves it; `update` over an authored constitution preserves it.
- **SC-006**: spec-coach's own `.spec/memory/constitution.md` is re-authored via the improved tool — no template-signature placeholders, 5-7 principles each with a rationale, footer version set — and contains both the charter-as-IP clause and the corrected (preserve-on-uninstall) clause. Verified by content assertion (the advisor reports AUTHORED; the two clauses are present).

## Assumptions

- **Scope A (location unchanged)**: The constitution stays at `.spec/memory/constitution.md`. No move to a root-level file — scope B (root-level `CONSTITUTION.md`, a MAJOR file-structure change needing its own migration/compat design) is deferred to a potential separate **spec 010**. The install file-structure contract is unchanged, so the package version bump is **MINOR 2.3.0 → 2.4.0** (new skill behavior + uninstall behavior change), not MAJOR.
- **Live constitution re-authored by spec 009 (US4 / FR-008)**: The repo's `.spec/memory/constitution.md` is currently the raw template (deliberate reset, commit `c31ce84`). spec 009 re-authors it via the *improved* `/spec-constitution` as its final dogfood task — cold-start (template detected), seeded from repo signals, natively codifying the charter-as-IP principle + corrected uninstall clause. (This absorbs the earlier "self-amendment folds into a follow-up" framing — the follow-up is now in spec 009.) The **charter-doc version** is set per FR-004, continuing the v1.4.0 lineage; the **package** version bump stays MINOR 2.3.0 → 2.4.0 (the charter-doc version and the package version are independent tracks).
- **spec 007 refinement**: "uninstall = inverse of init" still holds for pure tooling (scripts, templates, `agents.json`); the authored constitution is the single `.spec/` artifact that crosses tooling→IP and is therefore preserved on plain uninstall (joining `specs/`). A never-authored template constitution is still tooling and is removed.
- **Testing philosophy**: Most deliverables are skill-prose (coaching) — they are verified by *skill-content assertion tests* (the shipped skill file contains the required guidance) plus behavioral smoke, consistent with Principle V (verify what ships: installed skill integrity) and the project memory (`npm test` is non-headless; verify via `tests/units/*.test.ts` + `npx tsx src/cli.ts` smokes). The mechanical deliverables — preserve-on-uninstall (FR-006), never-clobber (FR-007), and the status advisor (FR-002) — get real headless tests (TS unit tests in `mkdtemp`; execSync-driven bash for the advisor, mirroring `tests/units/workflow-state.test.ts`).
- **Advisor is non-blocking**: The status advisor (FR-002) follows the existing `verify-constitution-sync.sh` pattern — it reports and advises, never gates — preserving Principle II (Coach-Not-Gatekeeper).
- **Agent-agnostic**: The constitution remains at `.spec/memory/` (shared across Claude/Codex/Gemini); nothing in spec 009 moves it into an agent-specific context file.
- **Dogfood**: spec 009 changes spec-coach's own `skills/constitution.md` (source), `src/commands/uninstall.ts`, the advisor script, the status-advisor tests, `package.json` (2.3.0→2.4.0), `CHANGELOG.md`, AND re-authors the live `.spec/memory/constitution.md` (FR-008). Per the project memory, all changes go through the full SDD workflow (this spec → plan → tasks → analyze → implement).

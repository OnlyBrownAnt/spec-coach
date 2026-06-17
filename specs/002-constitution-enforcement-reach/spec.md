# Feature Specification: Constitution Enforcement Reach

**Feature Branch**: `constitution-enforcement-reach`

**Created**: 2026-06-17

**Status**: Implemented

**Input**: User description: "补齐 spec-coach 从 spec-kit 最小化抽离时漏吸收的能力，恢复 constitution 的执行触达；硬稳定性要求，但执行仍主要靠 AI 自觉，工具需提供验证 hook 为 AI 增加验证能力，不破坏教练声音优势，优先零依赖纯 markdown。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Constitution Amendments Propagate to Dependent Artifacts (Priority: P1)

When a maintainer amends the project constitution, the `/spec-constitution` skill guides them to re-align every dependent artifact (plan, spec, tasks templates and the skills that consume them) and records what changed. A provided verification capability lets the AI confirm afterward that no dependent artifact is stale relative to the constitution.

**Why this priority**: Without propagation, the constitution's authority silently rots the moment it is amended — downstream templates keep referencing superseded principles. This is the foundational enforcement gap; every other story assumes the constitution is trustworthy.

**Independent Test**: Amend the constitution (e.g., rename or add a principle), run the constitution-sync verification capability, observe a drift report listing stale dependent artifacts; after performing the guided propagation, run it again and observe a clean report.

**Acceptance Scenarios**:

1. **Given** the constitution is amended, **When** the `/spec-constitution` skill completes, **Then** a Sync Impact Report is recorded documenting the change and naming the dependent artifacts that require re-alignment
2. **Given** a dependent template still references a superseded principle, **When** the constitution-sync verification runs, **Then** it reports drift citing the specific template and the mismatch
3. **Given** all dependent artifacts have been re-aligned, **When** the constitution-sync verification runs, **Then** it reports no drift

---

### User Story 2 - Cross-Artifact Analysis Treats Constitution Violations as Critical (Priority: P1)

When `/spec-analyze` reviews the spec/plan/tasks set, it loads the constitution and treats any artifact that violates a stated principle as a CRITICAL finding — the highest severity, blocking implementation. Today analyze never loads the constitution, so principle drift passes review silently.

**Why this priority**: `/spec-analyze` is the workflow's safety net. A safety net blind to the constitution is the single largest hole in the enforcement footprint, and it directly undermines the constitution's own Governance clause ("no silent violations").

**Independent Test**: Create a plan that contradicts a stated principle (e.g., a plan that adds a production dependency when the constitution forbids it), run `/spec-analyze`, and confirm the output contains a CRITICAL finding that cites the specific constitution principle by name.

**Acceptance Scenarios**:

1. **Given** the constitution forbids X and a plan proposes X, **When** `/spec-analyze` runs, **Then** the analysis lists a CRITICAL finding citing the violated principle
2. **Given** the constitution is loaded during analysis, **Then** principle violations are always classified CRITICAL, never advisory
3. **Given** a spec/plan/tasks set that fully honors the constitution, **When** `/spec-analyze` runs, **Then** no constitution-related CRITICAL findings are produced

---

### User Story 3 - The Agent Always Knows the Current Feature and Workflow Phase (Priority: P2)

At any point mid-workflow, the agent can surface the current workflow state (current feature, last completed phase, skipped phases, decisions) through a provided capability and a pointer in `CLAUDE.md` — without manually opening `.spec/memory/constitution.md`. Today this state is scattered across `.spec/feature.json`, the feature artifacts, and the SDD STATE block, and none of it is surfaced on demand, so the agent has no ambient awareness of where it is in the workflow.

**Why this priority**: Awareness is foundational to coherent coaching, but it is advisory ("rely on AI self-discipline") rather than enforced — hence P2, not P1. It unblocks every subsequent phase's ability to behave context-appropriately.

**Independent Test**: Partway through a feature (last phase = plan), invoke the state-surfacing capability and confirm it prints the current feature id, the last phase, and any recorded decisions; confirm `CLAUDE.md` points at the SDD STATE location.

**Acceptance Scenarios**:

1. **Given** the agent is mid-workflow on a feature, **When** it invokes the state-surfacing capability, **Then** it receives the current feature, last phase, skipped phases, and decisions
2. **Given** `CLAUDE.md` exists, **When** a new session starts, **Then** the managed section directs the agent to the SDD STATE location
3. **Given** the SDD STATE block is missing or malformed, **When** the state-surfacing capability runs, **Then** it reports the absence gracefully rather than failing

---

### User Story 4 - Spec Authoring Iterates to Resolve Ambiguity (Priority: P2)

When `/spec-specify` drafts a spec, it runs an iterative validation loop (up to 3 rounds) that prioritizes unresolved issues by scope > security > UX > technical, verifying each round with a placeholder/ambiguity scan. Today specify performs a single one-shot self-review, so residual placeholders and ambiguities survive into the plan.

**Why this priority**: A spec that ships with `TBD`/`[ALL_CAPS]`/vague phrasing produces wrong plans and wrong implementations. Valuable but secondary to restoring constitutional authority.

**Independent Test**: Feed specify a feature description likely to produce placeholder text; confirm the skill enters a re-validation loop and that the spec-check capability reports unresolved tokens after round 1 and zero after resolution.

**Acceptance Scenarios**:

1. **Given** a drafted spec contains placeholder tokens, **When** `/spec-specify` validates, **Then** it iterates up to 3 rounds, each verified by the spec-check capability
2. **Given** multiple unresolved issues across categories, **When** the loop prioritizes, **Then** scope issues are addressed before security, security before UX, UX before technical
3. **Given** a spec that cannot be fully resolved within 3 rounds, **When** the loop exhausts, **Then** remaining items are explicitly surfaced (not silently dropped)

---

### User Story 5 - Governance Loads the Constitution at Authoring Time (Priority: P3)

The `/spec-specify` and `/spec-tasks` skills load the constitution during authoring — not only `/spec-plan`. Today only plan consults the constitution, so governance reach is narrowed to a single phase.

**Why this priority**: Low severity because plan already carries the primary Constitution Check; loading it earlier is a consistency improvement, not a hole-fix. Kept in scope because "complete fix" means the constitution is consulted wherever governance applies.

**Independent Test**: Confirm the `/spec-specify` and `/spec-tasks` skill bodies instruct loading `.spec/memory/constitution.md`, and that authoring output reflects a stated principle where applicable.

**Acceptance Scenarios**:

1. **Given** the constitution defines a principle relevant to the feature, **When** `/spec-specify` runs, **Then** the spec acknowledges the governing principle
2. **Given** task generation, **When** `/spec-tasks` runs, **Then** the constitution is loaded and task design respects it

---

### User Story 6 - Teams Extend the Coach via Markdown Hooks (Priority: P3)

A team can add a markdown-native hooks entry that injects an additional verification or coaching step into a skill's flow — without editing any source skill file. This restores the lightweight, zero-code extensibility seam that spec-kit carried (`.specify/extensions.yml` + per-command hook paragraphs) but spec-coach dropped.

**Why this priority**: Useful for compliance/security addenda, but optional for the core enforcement goal. Lowest priority; included because "complete fix" means teams have a customization vector that respects zero-dependency.

**Independent Test**: Add a hooks entry declaring a pre-step; run the relevant skill; confirm the skill surfaces the declared step; confirm no source skill file was modified.

**Acceptance Scenarios**:

1. **Given** a team adds a valid hooks entry, **When** the corresponding skill runs, **Then** the declared step is surfaced to the agent
2. **Given** the hooks file is malformed or absent, **When** a skill runs, **Then** it skips the hooks step gracefully (no crash, no workflow halt)

---

### Edge Cases

- **Constitution never created**: the constitution-sync and state-surfacing capabilities MUST detect the missing file and report clearly, not crash.
- **SDD STATE markers missing/duplicated**: the state-surfacing capability MUST handle malformed state gracefully and report what it could and could not parse.
- **Fresh dependent template with no constitution references**: the constitution-sync check MUST NOT false-positive on a template that legitimately has no principle references yet.
- **Principle count mismatch (constitution has N, templates reference M)**: drift handling MUST report the specific mismatch, not just "drift detected."
- **Verification run outside a feature directory (no `specs/`)**: capabilities MUST report "no active feature" gracefully.
- **Intentionally-retained template slots** (e.g., a deliberately-undefined `[SECTION_2_NAME]`): the spec placeholder scan MUST distinguish intentional slots from unfilled placeholders.
- **Malformed hooks file**: skills MUST skip hooks silently and continue, mirroring spec-kit's lenient parse behavior.
- **Non-bash environment (Windows)**: verification scripts are bash-only; this is a documented limitation (see Assumptions), not a defect.
- **Circular/excessive re-validation**: the specify loop MUST cap at 3 rounds and surface residuals rather than loop indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

**Constitution propagation (Story 1)**

- **FR-001**: The `/spec-constitution` skill MUST guide propagation of amendments to all dependent artifacts (plan, spec, tasks templates and the skills that consume them).
- **FR-002**: The `/spec-constitution` skill MUST record a Sync Impact Report documenting the amendment and naming dependent artifacts requiring re-alignment.
- **FR-003**: The tool MUST provide a constitution-sync verification capability that mechanically checks dependent artifacts' constitution references against the current constitution and reports drift with specific citations.

**Constitution authority in analysis (Story 2)**

- **FR-004**: The `/spec-analyze` skill MUST load `.spec/memory/constitution.md` before reviewing artifacts.
- **FR-005**: `/spec-analyze` MUST classify any artifact violating a stated constitution principle as a CRITICAL finding citing the principle by name.

**Workflow-state awareness (Story 3)**

- **FR-006**: The tool MUST provide a capability that surfaces the current workflow state — current feature, last phase, skipped phases, and decisions — on demand. Sources: current feature from `.spec/feature.json`; last phase inferred from which feature artifacts exist; decisions/skipped from the SDD STATE block. (The SDD STATE block's own `Last phase` field is deprecated as a source — it is never maintained.)
- **FR-007**: The `CLAUDE.md` managed section MUST direct the agent to the SDD STATE location.

**Iterative spec validation (Story 4)**

- **FR-008**: The `/spec-specify` skill MUST run an iterative validation loop capped at 3 rounds.
- **FR-009**: The loop MUST prioritize unresolved issues by scope > security > UX > technical.
- **FR-010**: The tool MUST provide a spec-check capability that scans a spec for placeholder/ambiguity tokens (including `TBD`, `TODO`, unfilled `[ALL_CAPS]` tokens, and vague filler phrases) and reports them per round.

**Constitution at authoring time (Story 5)**

- **FR-011**: The `/spec-specify` and `/spec-tasks` skills MUST load `.spec/memory/constitution.md` during authoring.

**Markdown extensibility seam (Story 6)**

- **FR-012**: The tool MUST provide a markdown-native hooks mechanism that lets teams declare an additional verification or coaching step consumed by a skill, without modifying source skill files.
- **FR-013**: Skills MUST surface declared hooks when present and skip them gracefully when the hooks file is absent or malformed.

**Cross-cutting constraints (apply to all of the above)**

- **FR-014**: All verification capabilities MUST be non-blocking: they report findings for the agent to act on; they MUST NOT halt the workflow, force a particular action, or auto-modify artifacts.
- **FR-015**: All new verification capabilities MUST ship as zero-dependency bash scripts (no production npm dependencies added) or as markdown.

### Key Entities *(include if feature involves data)*

- **SDD STATE block**: the managed section inside `.spec/memory/constitution.md`. Historically recorded current feature, last phase, skipped phases, and decisions. In this feature, current feature is sourced from `.spec/feature.json` and last phase is inferred from artifacts, so the block's `current feature`/`Last phase` fields are deprecated as state sources; the block is now read only for decisions and skipped phases.
- **Sync Impact Report**: a recorded summary of a constitution amendment (what changed, old→new where applicable) plus the list of dependent artifacts needing re-alignment.
- **Verification capability**: a non-blocking, zero-dependency mechanism (bash script or markdown procedure) that performs a mechanical check and reports findings for the agent.
- **Hooks file**: a markdown-native file declaring additional verification/coaching steps that skills surface, enabling team-level extension without source edits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After implementation, all SDD phase skills that carry governance responsibility (constitution, specify, plan, tasks, analyze) load or reference the constitution where applicable (5/5 skills).
- **SC-002**: A constitution amendment followed by the constitution-sync capability reports drift; after guided propagation, the same capability reports clean.
- **SC-003**: An artifact that violates a stated principle, when analyzed, produces a CRITICAL finding citing that principle by name.
- **SC-004**: The agent can determine the current feature and last-completed phase via the provided capability and the `CLAUDE.md` pointer, without opening `.spec/memory/constitution.md` manually.
- **SC-005**: A spec containing placeholder tokens triggers the iterative loop; after resolution, the spec-check capability reports zero unresolved tokens.
- **SC-006**: A team can add a markdown hooks entry that a skill surfaces, with no source skill file modified.
- **SC-007**: No new production npm dependencies are introduced (the set of production dependencies in `package.json` is unchanged in kind).
- **SC-008**: The full SDD workflow (`/spec-constitution` → `/spec-specify` → `/spec-clarify` → `/spec-plan` → `/spec-tasks` → `/spec-analyze` → `/spec-implement`) completes end-to-end after the changes.

## Assumptions

- **Mechanical vs semantic split**: verification capabilities perform mechanical/syntactic checks (placeholders, structure, counts, state readability); semantic judgment (whether a plan truly honors a principle) remains the agent's job, coached by markdown. Scripts do not replace agent judgment.
- **Coach, not gatekeeper**: verification is advisory and non-blocking (FR-014). Primary execution remains agent self-discipline; the tool adds verification *capability*, not enforcement *gates*.
- **No auto-injection for state**: per the "rely on AI self-discipline" directive, state awareness (Story 3) is surfaced via an agent-invoked capability plus a `CLAUDE.md` pointer — not via an auto-firing session hook that injects context regardless of the agent's choice.
- **Zero-dependency**: all new code is zero-dependency bash or markdown; no production npm packages are added (FR-015, SC-007).
- **Markdown-first preserved**: the existing "coach voice" advantages (Iron Laws, HARD-GATE, placeholder scan in plan) are preserved and extended, not replaced.
- **CLAUDE.md pointer via existing generator**: the `CLAUDE.md` managed-section change is made through the existing `init.ts` generator, not a new mechanism.
- **Bash-only scripts for now**: verification scripts target bash (`.sh`). PowerShell parity is a pre-existing, out-of-scope gap.
- **Out of scope**: test-suite expansion, CI hardening, and PowerShell parity are explicitly excluded — this spec covers only the spec-kit absorption gaps.

# Feature Specification: Precise Deletion (Only Remove What Spec Coach Owns)

**Feature Branch**: `004-precise-deletion`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "卸载和 agent 删除时能不能做到精准删除。只处理本身相关的内容，用户自己维护的不要动。" — 把 spec 003 已发布的 `agents remove` / `uninstall` 删除从"通配 + 内容启发式"升级为"只删 spec-coach 自己建过的路径"的可证明精准。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User content survives every lifecycle op (Priority: P1)

A spec-coach user keeps their own content inside the very namespaces spec-coach manages — a hand-authored `.claude/skills/spec-team-rules/`, notes in `.cursor/commands/spec/`, or a project `CLAUDE.md` they wrote themselves. When they bind and later remove an agent, or uninstall spec-coach entirely, that content MUST survive untouched. Today it does not: `removeAgentSkills` deletes by `spec-*` prefix (skills format) or the entire `spec/` subdir (markdown format), and `deleteIfShell` deletes a context file whenever it looks empty or holds only `# projectName`. Both can destroy user content.

**Why this priority**: This is the headline bug. Silent data loss of user-maintained content is the worst possible failure for a tool whose promise is "AI config can retire while spec docs persist." Every other story is moot if remove/uninstall eats user files.

**Independent Test**: Fully testable by adding an agent into a project that already contains colliding user content (`spec-*` dirs, a shared `spec/` file, a user-authored context file), running `agents remove` then `uninstall`, and diffing the tree: zero user paths deleted, zero spec-coach paths left.

**Acceptance Scenarios**:

1. **Given** a project with `.claude/skills/spec-team-rules/` (user content) and a corpus, **When** the user runs `agents add claude` then `agents remove claude --force`, **Then** `.claude/skills/spec-team-rules/` is unchanged AND the 11 spec-coach skill dirs are gone AND `.claude/` is pruned only if empty.
2. **Given** a project with `.cursor/commands/spec/notes.md` (user content), **When** the user runs `agents add cursor` then `agents remove cursor --force`, **Then** `notes.md` survives, only the spec-coach command `.md` files are removed, and `spec/` is pruned only because it became empty.
3. **Given** a project where the user authored `CLAUDE.md` (existed before binding), **When** the user runs `agents add claude` then `agents remove claude --force`, **Then** the managed block is stripped but `CLAUDE.md` is preserved even if it is now empty.
4. **Given** any of the above user content present, **When** the user runs `uninstall --yes`, **Then** all user content survives; only spec-coach infrastructure + its own bindings are removed.

---

### User Story 2 - Spec Coach cleans up its own shells (Priority: P2)

The complement of US1: when spec-coach created a file or directory and it is now empty after teardown, it SHOULD be removed — no litter left behind. A context file spec-coach created from scratch (and that holds nothing but the managed block) is deleted on remove/uninstall; empty skill parent dirs are pruned. The line is provenance: spec-coach deletes only what it can attribute to itself.

**Why this priority**: Required for the product to feel clean, but strictly secondary to not destroying user data. Without it, remove leaves stale empty shells; with it, teardown is tidy.

**Independent Test**: Add an agent into an empty project (spec-coach creates the context file), remove it, and assert the context file and all created skill dirs are gone — while an identical project where the user pre-created the context file keeps that file.

**Acceptance Scenarios**:

1. **Given** a project with no `CLAUDE.md`, **When** the user runs `agents add claude` (spec-coach creates it) then `agents remove claude --force`, **Then** `CLAUDE.md` is deleted (spec-coach-owned, now empty).
2. **Given** the same setup but the user adds a section to `CLAUDE.md` after binding, **When** the user runs `agents remove claude --force`, **Then** the block is stripped and `CLAUDE.md` is preserved (non-empty).
3. **Given** shared `AGENTS.md` with cursor + copilot installed, **When** the user removes cursor, **Then** `AGENTS.md` is kept (copilot still installed); **When** the user then removes copilot (last non-Claude), **Then** `AGENTS.md` is deleted if spec-coach created it and it is now empty.

---

### User Story 3 - Legacy projects get precise deletion with zero regression (Priority: P2)

A project created by spec 003 (v2.0.0) has agent bindings on disk but no provenance records (`createdFiles` / `createdContextFiles` did not exist). On the first agents command after upgrading to v2.1.0, the project MUST reconcile and immediately get precise deletion — no wildcard — with no change to already-installed agents.

**Why this priority**: spec-coach is already shipped at 2.0.0; existing users must not be stuck on the imprecise behavior, and the upgrade must be invisible and safe.

**Independent Test**: Scaffold a project exactly as v2.0.0 would (bindings on disk, no provenance fields), run `agents remove` on the v2.1.0 code path, and assert it deletes exactly the spec-coach skill set via the whitelist fallback — never a wildcard — and leaves colliding user content intact.

**Acceptance Scenarios**:

1. **Given** a v2.0.0 project with claude bindings on disk and no `createdFiles`, **When** the user runs `agents remove claude --force`, **Then** removal uses the known skill-name whitelist (Tier 1 fallback) and deletes exactly the 11 spec-coach skill dirs.
2. **Given** that same legacy project also holds `.claude/skills/spec-user-docs/`, **When** the user runs `agents remove claude --force`, **Then** `spec-user-docs/` survives (whitelist never widens to a wildcard).
3. **Given** a v2.0.0 project, **When** the user runs `agents list` (triggering reconcile), **Then** `createdFiles` is populated for detected agents (expected set ∩ on-disk) so subsequent removals use Tier 2 provenance, and already-installed agents remain installed.

---

### Edge Cases

- **Skills-format collision (different path)**: user-owned `.claude/skills/spec-anything/` must survive `agents remove claude` — deletion is by exact recorded/whitelist names, never `spec-*` prefix.
- **Markdown-format collision (shared dir)**: a user `.md` inside `.cursor/commands/spec/` must survive; the shared `spec/` dir is pruned only after every spec-coach file is gone.
- **User pre-created empty context file**: `agents add` appends a block (file existed → not recorded as spec-coach-created) → `agents remove` strips the block and leaves the now-empty user file in place.
- **spec-coach-created context file, left empty**: removed on teardown (owned + empty).
- **spec-coach-created context file, user added content**: preserved after block strip (non-empty).
- **Shared `AGENTS.md`, partial removal**: removing one of several non-Claude agents keeps the file (others remain); only the last removal can delete it, and only if owned + empty.
- **Legacy project, no provenance**: removal falls back to the skill-name whitelist; never widens to wildcard; colliding user content survives.
- **Manually deleted skill file**: a `createdFiles` entry whose path is already gone is skipped without error (idempotent).
- **Cross-version orphan**: a skill removed from the manifest but still on disk is never deleted (unattributable; conservative). Left in place, optionally pruned by a future `--prune-orphans`.
- **User repurposed a spec-coach-owned dir**: if a recorded skill directory now holds unexpected user files, the directory-integrity guard preserves it and emits a warning rather than deleting user content.
- **uninstall with only some agents installed**: non-installed manifest agents are not touched; only installed agents (state records) are torn down.

## Requirements *(mandatory)*

### Functional Requirements

**Provenance recording (Tier 2)**

- **FR-001**: `agents add` MUST record, per installed agent, the leaf paths it created on disk (a skill directory `agent.dir/spec-{name}` for skills format; a file `agent.dir/spec/{name}.md` for markdown format) in `.spec/agents.json` under `agents[key].createdFiles`.
- **FR-002**: `agents add` MUST record, at project level in `createdContextFiles`, any context file it created from scratch (the file did not exist immediately before the managed section was written). A file that only received an appended block MUST NOT be recorded.
- **FR-003**: `upsertManagedSection` MUST report whether it created the context file from scratch versus appending to an existing file, so callers can populate `createdContextFiles` correctly.

**Precise skill deletion**

- **FR-004**: `agents remove` and `uninstall` MUST delete an installed agent's skills using its recorded `createdFiles` when present — deleting exactly those paths and pruning now-empty parent directories up to (but not including) the project root.
- **FR-005**: When `createdFiles` is absent for an installed agent, deletion MUST fall back to a whitelist derived from the known skill-name set (the same set `installAllSkills` writes) — NEVER a prefix/wildcard match.
- **FR-006**: Skill deletion MUST NOT remove any path not attributable to spec-coach. Specifically, user-authored content in `spec-*` directories (skills format) or inside a shared `spec/` command directory (markdown format) MUST survive every lifecycle operation.
- **FR-007**: Before deleting a recorded skill directory, the system MUST verify the directory contains only spec-coach-managed content (the expected skill file). If unexpected user files are present, the directory MUST be preserved and a warning emitted — it is never deleted.

**Precise context-file deletion**

- **FR-008**: `agents remove` and `uninstall` MUST remove the managed COACH block from context files using the `<!-- COACH START/END -->` markers (unchanged, already precise).
- **FR-009**: A context file's body (the whole file) MUST be deleted only when ALL hold: (a) it is listed in `createdContextFiles`, AND (b) after block removal it is empty or holds only the auto-generated `# {projectName}` heading.
- **FR-010**: A context file NOT listed in `createdContextFiles` MUST NEVER be deleted, regardless of its content — even if it is empty after block removal.
- **FR-011**: For non-Claude agents sharing `AGENTS.md`, the managed block MUST be preserved while any other non-Claude agent remains installed (unchanged); the file body is deleted only when the last non-Claude agent is removed AND the file is spec-coach-owned AND it is now empty.

**Uninstall scope**

- **FR-012**: `uninstall` MUST remove agent bindings by iterating installed agents (the state records), using each agent's provenance or whitelist fallback — NOT by removing the directories of every agent in the manifest. Non-installed manifest agents MUST be skipped.

**State schema and backward compatibility**

- **FR-013**: The state-schema additions (`createdFiles` per agent; top-level `createdContextFiles`) MUST be optional. Existing `.spec/agents.json` files without them MUST remain valid and readable.
- **FR-014**: `recordAgent` MUST accept and persist a `createdFiles` list; `readState` MUST round-trip both new fields without loss.

**Legacy migration and update**

- **FR-015**: `reconcileFromFs` MUST populate `createdFiles` for each detected agent as the expected skill-name set intersected with the paths actually on disk, so legacy projects get Tier 2 skill deletion after one reconcile.
- **FR-016**: `reconcileFromFs` MUST NOT populate `createdContextFiles`. Provenance for context files created before this feature cannot be reconstructed, so legacy context files are never auto-deleted (conservative).
- **FR-017**: `agents update` MUST recompute the agent's `createdFiles` to reflect the current install set (the paths `installAllSkills` writes intersected with on-disk), so skill-set drift across versions stays attributed honestly.
- **FR-018**: Deletion MUST be idempotent — a path in `createdFiles` that no longer exists on disk is skipped without error.

### Key Entities *(include if feature involves data)*

- **Ownership record (`createdFiles`)**: per-agent list of leaf paths spec-coach created (skill dirs for skills-format agents; `.md` files for markdown-format agents). Drives Tier 2 skill deletion.
- **Context-file provenance (`createdContextFiles`)**: project-level list of context files spec-coach created from scratch. Drives context-file-body deletion; absent entries mean "user-owned, never delete."
- **Skill unit**: the ownable leaf of an agent binding — `agent.dir/spec-{name}` (skills format) or `agent.dir/spec/{name}.md` (markdown format). The granularity of ownership and deletion.
- **Whitelist (Tier 1 fallback)**: the known skill-name set (the same set `installAllSkills` installs) used to delete precisely when `createdFiles` is absent. Replaces the former `spec-*` wildcard.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `agents add` → `agents remove` on a project containing colliding user content (a `spec-*` skills dir AND a file inside a shared `spec/` command dir) deletes ZERO user paths — provable by a before/after recursive tree diff.
- **SC-002**: A context file the user authored (existed before `agents add`) is never deleted by `agents remove` or `uninstall`, even when it ends up empty after block removal.
- **SC-003**: A context file spec-coach created from scratch, left empty after block removal, IS deleted by `agents remove` / `uninstall` (no litter).
- **SC-004**: A project created at v2.0.0 (no provenance fields) achieves precise deletion — no wildcard — after the first reconcile, with zero regression: already-installed agents remain installed and behave identically.
- **SC-005**: The full mechanical suite passes headlessly — the new `precise-deletion` suite plus the existing lifecycle/migration/agents suites (the 172 assertions from spec 003) — with no regressions.

## Assumptions

- **Versioning**: PATCH bump to 2.0.1 — per the constitution versioning rule, this is a fix that does not change the install contract (no new skill, no template field, the installed file structure is unchanged, `update` is not broken). The state-schema fields are optional and backward compatible; the CLI contract, the agent-support surface, and the constitution are unchanged. No constitution amendment, no `verify-constitution-sync` change.
- **Legacy context-file provenance is unrecoverable**: there is no way to know whether a v2.0.0 project's `CLAUDE.md`/`AGENTS.md` was created by spec-coach or the user, so `reconcileFromFs` does not populate `createdContextFiles` and legacy context files are never auto-deleted. Only context files created after the upgrade get precise deletion.
- **Orphan skill dirs are left in place**: a skill removed from the manifest across versions but still on disk is not auto-deleted (unattributable). A future opt-in `--prune-orphans` may address this; it is out of scope here.
- **Same-path repurpose is treated as spec-coach-owned**: if a user repurposes an exact path that `createdFiles` records, that path is still treated as spec-coach's — EXCEPT that the directory-integrity guard (FR-007) protects a skill dir that has accumulated unexpected user files. Single recorded files are deleted per provenance.
- **Marker-block deletion is unchanged**: the `<!-- COACH START/END -->` mechanism is already precise and is not modified by this feature.
- **Verification is headless**: per project memory, `npm test` is AI-driven and cannot run in this environment; correctness is verified via `tests/units/*.test.ts` (zero-dependency `node:assert`) plus `npx tsx src/cli.ts` smokes.
- **Non-goals**: the document intake pipeline (`.spec/intake/` staging, verbatim/AI absorb) is a separate feature (spec 005). Changing the install contract, the CLI surface, or the agent-support manifest is out of scope.

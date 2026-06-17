# Feature Specification: Document Intake Pipeline (Bring Existing Docs Into the Corpus)

**Feature Branch**: `005-document-intake`

**Created**: 2026-06-18

**Status**: Implemented

**Input**: User description: "如何处理用户想有的旧 spec" — the intake half of that original request (spec 004 hardened the *deletion* side; spec 005 builds the *introduction* side). Resurrects the document-absorb concern that spec 003 deliberately removed (its non-TTY blocking bug, fixed ad hoc in spec 001, was not worth keeping inside `init`) and re-designs it as an isolated, deterministic, non-blocking pipeline with two absorb modes (verbatim copy + AI-coached transform).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover existing docs and absorb them verbatim (Priority: P1)

A spec-coach user arrives with documents already in hand — an old `docs/old-spec.md`, a `design/arch.md`, scattered requirements notes — written before they adopted spec-coach. They want to bring these into the managed corpus without retyping, and they want the discovery to be safe and repeatable: a deterministic scan that never blocks (the old `init` absorb hung indefinitely on stdin in non-TTY environments — spec 001). `intake scan` finds the candidates and writes a staging manifest; `intake process --verbatim` copies each unchanged into `.spec/absorbed/`. Sources are never moved or deleted.

**Why this priority**: This is the headline value — "handle the user's existing specs" — and it is the deterministic, code-doable core of the feature. It must land first because every other story (AI transform, ignore) layers on top of a working scan + manifest. It also closes the spec 001 blocking-bug class for good by making discovery non-interactive.

**Independent Test**: Seed a project with a few matching `.md` files inside the preset scan dirs plus some corpus-internal and ignored noise; run `intake scan` headlessly; assert the manifest lists exactly the real candidates, the process exits 0 with no prompt; then `intake process --verbatim --all` and assert each source was copied byte-identical into `.spec/absorbed/` while the sources remain unchanged in place.

**Acceptance Scenarios**:

1. **Given** a project with `docs/old-spec.md` and `design/arch.md` (both matching discovery signals) and an empty corpus, **When** the user runs `spec-coach intake scan`, **Then** `.spec/intake/manifest.json` lists exactly those two candidates (status `pending`), no corpus-internal or ignored paths, and the command exits 0 with no interactive prompt.
2. **Given** that manifest, **When** the user runs `spec-coach intake process --verbatim --all`, **Then** each source is copied unchanged to `.spec/absorbed/<safe-name>.md`, each manifest entry is marked `absorbed-verbatim` with its destination, and every source file remains byte-identical in its original location.
3. **Given** a project containing candidate docs, **When** the user runs `spec-coach init`, **Then** the corpus is scaffolded AND a one-line nudge is printed ("found N candidate docs — run `spec-coach intake scan`") AND `init` exits 0 without prompting or blocking.

---

### User Story 2 - Turn rough docs into proper spec artifacts via AI coaching (Priority: P1)

The complement of verbatim: the user has a rough design doc, a brain-dump of notes, or a requirements list that is *not* yet a spec-coach spec. Rather than copy it verbatim, they want spec-coach to coach its AI into transforming the source into a proper `specs/NNN-slug/spec.md` that follows the spec template. Per Constitution Principle I (markdown is the product), the transform is a *judgment call* done by a new `spec-absorb` SKILL — the CLI only stages the source and points the AI at the skill. No transformation logic lives in TypeScript.

**Why this priority**: This is the coaching differentiator — "Guidance over gates. Craftsmanship over compliance." It is what makes intake more than a file copier. It is P1 alongside verbatim because the user explicitly asked for both modes; together they define the feature.

**Independent Test**: Run `intake process --ai <source>`; assert the CLI marks the manifest entry `absorb-ai-pending`, emits instructions to invoke the `spec-absorb` skill, and contains no transform code path; then drive the skill on the staged source and assert the produced `specs/NNN-slug/spec.md` conforms to the spec template (sections present), with the CLI having done only staging + slug sanitization.

**Acceptance Scenarios**:

1. **Given** a manifest with a pending design doc, **When** the user runs `spec-coach intake process --ai docs/design.md`, **Then** the entry is marked `absorb-ai-pending`, the CLI prints clear instructions to invoke the `spec-absorb` skill on that source, and no transformation is performed by the CLI itself.
2. **Given** that staged task, **When** the AI runs the `spec-absorb` skill on the source, **Then** a `specs/NNN-slug/spec.md` is written following the spec template, the slug is sanitized/unique within `specs/`, and the manifest entry is updated to `absorbed-ai` with the destination.

---

### User Story 3 - Ignore noise and keep scans clean and idempotent (Priority: P2)

After a scan surfaces candidates, the user dismisses some as noise (`vendor-spec.md`, an unrelated `design/` note). Those decisions must persist: subsequent scans must not re-surface ignored paths, and already-absorbed sources must not reappear as pending. `intake ignore` manages the list; scan and process are idempotent across re-runs.

**Why this priority**: Hygiene and repeatability. Without it, every re-scan re-litigates dismissed docs and erodes trust in the pipeline. Strictly secondary to the two absorb modes — the pipeline is useful without it, but noisy with it.

**Independent Test**: Scan a project, ignore one candidate via `intake process --ignore` (or `intake ignore add`), absorb another verbatim; re-scan; assert the ignored path is excluded, the absorbed source stays absorbed, and only genuinely-new pending docs surface.

**Acceptance Scenarios**:

1. **Given** a manifest with a pending candidate, **When** the user runs `spec-coach intake process --ignore docs/noise.md`, **Then** `docs/noise.md` is appended to `.spec/intake/ignore.json` and the entry is marked `ignored`.
2. **Given** an ignored path and a previously-absorbed source, **When** the user runs `spec-coach intake scan` again, **Then** the ignored path is excluded, the absorbed source is not re-listed as pending, and only new pending candidates surface.
3. **Given** the ignore list has entries, **When** the user runs `spec-coach intake ignore list`, **Then** all entries are printed; `intake ignore remove <pattern>` removes one.

---

### Edge Cases

- **Non-TTY scan (CI, pipe, background)**: `intake scan` writes the manifest and exits 0; it MUST NEVER block on stdin (the spec 001 bug class — `readline.question()` with no TTY/timeout guard). No interactive prompt exists in the scan path.
- **Candidate inside corpus-internal paths**: files under `specs/`, `.spec/` (including `.spec/absorbed/` and `.spec/intake/`), `.git/`, `node_modules/` are never discovered.
- **Candidate on the ignore list**: excluded from discovery (exact-path or directory-prefix match).
- **Non-markdown / binary file**: skipped (only `.md` is a candidate).
- **Empty `.md` file**: skipped (nothing to absorb).
- **Duplicate content at two paths**: two distinct candidates keyed by source path; content hash is advisory for dedup signaling, not a hard merge.
- **Source deleted between scan and process**: `intake process` reports the missing source, marks the entry `source-missing`, and continues without crashing.
- **Very large project tree**: scan is bounded to the preset directories (project-root top-level files + `docs/`, `doc/`, `design/`, `spec/`, `requirements/`) — no full recursive walk — for determinism, performance, and noise control.
- **`--ai` with a colliding or invalid slug**: the CLI sanitizes the slug (kebab-case, unique within `specs/`) before any `specs/NNN-slug/` directory is created, so AI-chosen names cannot collide or escape `specs/`.
- **`intake process` with no manifest**: prints "run `spec-coach intake scan` first" and exits cleanly (no error, no crash).
- **Re-scan after a partial process**: absorbed and ignored entries persist; only pending + genuinely-new docs surface (idempotent).
- **`intake process` interactive review (if offered)**: guarded by `isTTY`; in non-TTY it operates via flags only and never blocks.

## Requirements *(mandatory)*

### Functional Requirements

**Discovery (`intake scan`)**

- **FR-001**: `intake scan` MUST discover candidate `.md` documents by scanning the preset directories — project-root top-level files plus `docs/`, `doc/`, `design/`, `spec/`, `requirements/` — matching spec-coach-relevant signals: filename keywords (`spec`, `plan`, `feature`, `design`, `requirement`, `roadmap`) OR content markers (`Overview`, `User Story`, `FR-`, `## Requirements`, `Acceptance`). (Re-introduces the spec 001 heuristic, re-implemented fresh in `src/commands/intake.ts`.)
- **FR-002**: scan MUST exclude corpus-internal paths (`specs/`, `.spec/`, `.git/`, `node_modules/`) and any path matching the ignore list.
- **FR-003**: scan MUST be deterministic and non-interactive: it writes the manifest and exits, and MUST NEVER block on stdin. This decisively closes the spec 001 blocking-bug class for the intake pipeline.
- **FR-004**: scan MUST write a staging manifest at `.spec/intake/manifest.json` — a list of candidates (source path + content hash + size + status `pending`) — WITHOUT copying file bodies (a manifest, not content duplication).
- **FR-005**: scan MUST be bounded to the preset directories (no full recursive project walk) for determinism, performance, and noise control.

**Process — verbatim absorb**

- **FR-006**: `intake process --verbatim <path|--all>` MUST copy each pending candidate's content unchanged into `.spec/absorbed/<safe-name>.md` and mark the manifest entry `absorbed-verbatim` with the destination path.
- **FR-007**: intake operations MUST NEVER move, rename, or delete a source document. Absorb copies or transforms INTO the corpus; the source is always preserved byte-identical in place. (Mirrors spec 004's "only touch what spec-coach owns.")

**Process — AI transform**

- **FR-008**: `intake process --ai <path>` MUST mark the candidate `absorb-ai-pending` and emit instructions to invoke the `spec-absorb` skill on the source. The CLI MUST NOT contain document-transformation logic (Constitution Principle I — the transform is a markdown-skill judgment call, not code).
- **FR-009**: the `spec-absorb` skill MUST coach the AI to read the staged source plus the spec template and write a `specs/NNN-slug/spec.md` following the template. The CLI only stages the source and points at the skill; the skill performs the transform.
- **FR-010**: the CLI MUST sanitize the slug (kebab-case, unique within `specs/`) before the `specs/NNN-slug/` directory is created, so AI-chosen names cannot collide or escape `specs/`.

**Process — ignore**

- **FR-011**: `intake process --ignore <path|--all>` MUST append the candidate's identifying key to `.spec/intake/ignore.json` and mark the manifest entry `ignored`.

**Ignore management (`intake ignore`)**

- **FR-012**: `intake ignore list | add <pattern> | remove <pattern>` MUST manage the ignore list. Matching is exact-path or directory-prefix (zero-dependency; no glob library — Constitution Principle III).

**Idempotency**

- **FR-013**: scan MUST exclude source paths already recorded as absorbed or ignored (tracked in the manifest) so only genuinely-new pending docs surface. `intake process` MUST be idempotent — re-running re-processes nothing already absorbed or ignored.

**Init integration**

- **FR-014**: `init` MUST, after scaffolding the corpus, run the same non-blocking candidate detection; if candidates exist, print a one-line nudge ("found N candidate docs — run `spec-coach intake scan`") and exit 0. It MUST NEVER prompt interactively or refuse to init. (Constitution Principle II — coach, not gatekeeper; plus the spec 001 lesson.)

**CLI surface**

- **FR-015**: `intake` MUST be a new top-level command with subcommands `scan` / `process` / `ignore`, mirroring the `agents {add|update|remove|list}` pattern. Justification (the constitution requires a compelling reason for any new top-level command): document intake is a distinct third lifecycle concern — the *document lifecycle* — separate from corpus infrastructure (`init`/`update`/`uninstall`) and agent binding (`agents`); it was explicitly deferred as its own pipeline by spec 003.

**Corpus / uninstall integration**

- **FR-016**: `.spec/intake/` (manifest + ignore list) is spec-coach-owned regenerable state; `uninstall` MUST remove it (like `.spec/agents.json`). `.spec/absorbed/` is user-originated content (verbatim copies of the user's own docs) and MUST be preserved by plain `uninstall`, purged only with `--force` — consistent with spec 003's user-artifact tiering (`.spec/absorbed/` is already in `uninstall.ts` `USER_PATHS`).

**Non-TTY safety**

- **FR-017**: any interactive review offered by `intake process` MUST be guarded by `isTTY`; in non-TTY environments it MUST operate via flags only and never block. (Belt-and-suspenders with FR-003 — the spec 001 blocking class must not return through any path.)

### Key Entities *(include if feature involves data)*

- **Candidate**: a discovered `.md` document pending review — identified by source path, with a content hash and size for change detection and a status. The unit of intake work.
- **Staging manifest (`.spec/intake/manifest.json`)**: the registry of intake work — a list of candidates each with status (`pending` | `absorbed-verbatim` | `absorb-ai-pending` | `absorbed-ai` | `ignored` | `source-missing`) and, where applicable, a destination path. Never holds file bodies.
- **Ignore list (`.spec/intake/ignore.json`)**: source paths / directory prefixes excluded from discovery. Drives FR-002 / FR-013.
- **Absorb modes**: verbatim (copy unchanged → `.spec/absorbed/`) vs AI-transform (coach via the `spec-absorb` skill → `specs/NNN-slug/spec.md`). The two ways a candidate enters the corpus.
- **`spec-absorb` skill**: the markdown skill that coaches AI transformation of a staged source into a spec artifact. The judgment layer; the CLI only stages and points.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `intake scan` in a project with N scattered matching docs produces a manifest of exactly those N (minus corpus-internal and ignored), deterministically, exiting 0 with no prompt — provable by running it in a non-TTY/headless harness.
- **SC-002**: verbatim-absorb of a candidate copies it byte-identical into `.spec/absorbed/` and leaves the source unchanged and in place — provable by a before/after recursive diff of source and destination.
- **SC-003**: AI-transform produces a `specs/NNN-slug/spec.md` that conforms to the spec template, coached by the `spec-absorb` skill, with zero document-transformation code in the CLI.
- **SC-004**: a path on the ignore list never reappears in a subsequent scan, and an absorbed source never re-surfaces as pending (idempotent re-scans).
- **SC-005**: `init` in a project with existing docs prints the intake nudge and exits 0 without prompting or blocking.
- **SC-006**: the full mechanical suite passes headlessly — the new `intake` suite plus the spec 003/004 suites — with no regressions (the skill-count assertions that read "11" are updated to "12" for the new `spec-absorb` skill).

## Assumptions

- **Versioning — MINOR 2.1.0**: this adds a new skill (`spec-absorb`), so per the constitution rule "MINOR bumps for new skills." The new runtime state dirs `.spec/intake/` and `.spec/absorbed/` are not part of the `update`-synced installed-file-structure contract (skills/templates/scripts locations), so this is not a MAJOR. `.spec/absorbed/` is already a preserved user-artifact path in `uninstall.ts`; `.spec/intake/` is new regenerable state added to uninstall's infra cleanup.
- **Constitution amendment — v1.2.0**: adding `intake` as a third top-level surface (the document lifecycle) updates the constitution's "CLI surface" constraint, which currently enumerates only two surfaces. Rationale: document intake is a distinct concern, deferred by spec 003. Migration is non-destructive (adds a command + skill; no existing installed file is restructured). This parallels spec 003's v1.1.0 amendment. No Core Principle changes — only the CLI-surface enumeration grows. (The amendment text itself is authored during /spec-plan, not in this spec.)
- **Migration**: existing projects gain `spec-absorb` via `agents update --all` (which re-installs the now-12-skill set); `.spec/intake/` and `.spec/absorbed/` are created on demand. No destructive change to any installed artifact.
- **Discovery heuristic** reuses spec 001's signals (preset directories + filename/content keywords), re-implemented fresh in `src/commands/intake.ts` (spec 003 removed the original code from `init.ts`).
- **Ignore matching** is exact-path + directory-prefix only — zero-dependency (Constitution Principle III; no glob library). Full glob patterns are out of scope.
- **Absorbed verbatim docs are user-originated content**, preserved like `specs/` (already in `uninstall.ts` `USER_PATHS`); only `--force` purges them. They are not tracked in spec 004's `createdFiles`/`createdContextFiles` provenance because they are never auto-deleted (they are user content, not spec-coach infrastructure).
- **AI mode stages + instructs; the `spec-absorb` SKILL performs the transform.** The CLI contains no doc-transformation logic and no AI calls — consistent with Constitution Principle I and the project's AI-driven (non-headless) testing model.
- **Non-TTY safety is mandatory** (FR-003 / FR-017): the spec 001 blocking class must not recur through any intake path.
- **Verification is headless**: per project memory, `npm test` is AI-driven and cannot run in this environment; correctness is verified via `tests/units/*.test.ts` (zero-dependency `node:assert`) plus `npx tsx src/cli.ts` smokes.
- **Non-goals**: spec-corpus health/drift views; a spec registry; full glob ignore patterns; auto-deletion of source documents (never — FR-007); and transforming non-spec docs (raw roadmaps/notes) beyond what the `spec-absorb` skill coaches.

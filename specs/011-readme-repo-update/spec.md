# Feature Specification: README & GitHub Repo Description Refresh

**Feature Branch**: `011-readme-repo-update`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "进行README.md全面更新，还有Github 仓库描述。我需要更新相关信息上去" — comprehensively update README.md and the GitHub repository description with current, accurate information.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Accurate capabilities for a first-time evaluator (Priority: P1)

A developer landing on the repo (via GitHub or search) needs to trust that what README claims matches what the tool actually ships. Today README is wrong in ~10 places: agent count (5 vs 6, kiro missing), skill count (11 vs 12), template count (6 vs 7), CLI `--agent` flag shown but absent, dead COACH.md link, dead spec-kit link, installer "~200 lines" vs ~1461, "total files ~15" vs ~154, and an `npm i -g` path to a package that is not published. This story makes every factual claim in README verifiable against the repo.

**Why this priority**: README is the primary marketing + onboarding surface. A single wrong claim, the moment a user cross-checks it, erodes trust in the whole tool. This is the core of the request.

**Independent Test**: A reviewer picks any number or claim in README and confirms it against the repo — count agents in `agents.json`, skills in `skills/`, templates in `.spec/templates/`, version in `package.json` — and every link resolves.

**Acceptance Scenarios**:

1. **Given** `agents.json` lists 6 agents (incl. kiro), **When** a reader opens README's "Supported AI Tools", **Then** all 6 are listed with the correct format + command style.
2. **Given** `skills/` contains 12 skills, **When** README states the skill count, **Then** it says 12 and the install tree lists the full set.
3. **Given** `.spec/templates/` contains 7 templates, **When** README states the template count, **Then** it says 7 (incl. `convention-template.md`).
4. **Given** the version is 2.5.0, **When** a reader scans README, **Then** the version is visible.
5. **Given** COACH.md does not exist and the spec-kit URL is dead, **When** README is rendered, **Then** there are zero broken links.

---

### User Story 2 — A Quick Start that actually works (Priority: P2)

A user following Quick Start must reach a working install without hitting a dead end. Today README suggests `npm i -g spec-coach`, but the package is NOT published to npm — the only working path is the raw tsx URL. Separately, `init --agent claude` is shown but `init` takes no `--agent` flag (agents are installed via `agents add`).

**Why this priority**: A broken Quick Start is the highest-friction failure — the user never gets past install, so nothing else in README matters.

**Independent Test**: Copy-pasting the README Quick Start into a clean directory runs to completion and installs the corpus plus an agent.

**Acceptance Scenarios**:

1. **Given** the package is not on npm, **When** a reader follows Quick Start, **Then** the command shown is the working raw-URL tsx command, and any `npm i -g` mention is removed or clearly marked not-yet-published.
2. **Given** `init` takes no `--agent` flag, **When** README documents the CLI, **Then** the init / agents / update / uninstall surface matches `src/cli.ts`.

---

### User Story 3 — An accurate GitHub repo card (Priority: P3)

A visitor seeing the repo in GitHub search/listings reads the description + topics to decide whether to click. The description must be current, concise, and on-brand; topics must aid discoverability.

**Why this priority**: Lowest effort and high discoverability payoff, but secondary to README accuracy.

**Independent Test**: The proposed description is within GitHub's limit, on-brand, and applies via a single documented `gh repo edit` command (or manual steps if `gh` is absent).

**Acceptance Scenarios**:

1. **Given** the repo needs a description, **When** applied, **Then** the GitHub "About" field states spec-coach's purpose and value prop in one line.
2. **Given** discoverability matters, **When** topics are applied, **Then** relevant topics (sdd, spec-driven-development, claude-code, cursor, copilot, etc.) are set.

---

### Edge Cases

- The spec-kit comparison table mixes spec-coach's own numbers (must be exact) with spec-kit's (approximate, third-party). The spec-coach column MUST be audited; the spec-kit column MUST be flagged as approximate so the exact/approximate boundary is honest.
- "Installer LOC" depends on what counts as the installer (TypeScript in `src/` only vs. also the bash scripts). The counting scope MUST be stated so the number is defensible and reproducible.
- "Total files" (~154 git-tracked) includes the dogfooded `specs/` and SDD tooling — README's audience cares about what ships, so README MUST distinguish "shipped files" from "repo files."
- GitHub limits the description length and requires topics to be lowercase, hyphenated, from a known vocabulary.
- If `gh` is unavailable or unauthenticated (the current state), the repo description cannot be auto-applied — the deliverable MUST fall back to documented manual steps, and auto-application is gated on user confirmation (it is an outward-facing change).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: README MUST list all 6 supported agents (claude, cursor, copilot, codex, windsurf, kiro) with correct format + command style per `agents.json`.
- **FR-002**: README MUST state accurate counts — 12 skills (`skills/`), 7 templates (`.spec/templates/`), version 2.5.0 (`package.json`).
- **FR-003**: README's "What Gets Installed" tree MUST list the full skill set (12) and template set (7), not a partial subset.
- **FR-004**: README Quick Start MUST present a working install command. Since spec-coach is not published to npm, the `npm i -g` path MUST be removed or clearly qualified as not-yet-published, and the working raw-URL tsx command MUST be the primary path.
- **FR-005**: README's CLI section MUST match the actual CLI surface in `src/cli.ts` (`init` takes no `--agent`; `agents add/update/remove/list`; `update`; `uninstall --yes [--force]`).
- **FR-006**: README MUST contain zero broken links — the COACH.md reference MUST be removed (file does not exist) and any dead third-party link fixed or removed.
- **FR-007**: README's comparison table MUST use verifiable spec-coach numbers (installer LOC, total files) with the counting scope stated; third-party (spec-kit) numbers MUST be marked approximate.
- **FR-008**: A GitHub repository description (within GitHub's limit) and a topic set MUST be defined and documented with the exact application command(s). Auto-application is gated on `gh` being available AND user confirmation (outward-facing change).

### Key Entities *(include if feature involves data)*

- **README.md**: the repo's primary onboarding + marketing document; the main editable artifact.
- **Repo metadata**: GitHub "About" description + topics — applied via `gh repo edit` or the GitHub UI, not a file in the repo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of numeric/factual claims in README are verifiable against the repo (agents = 6, skills = 12, templates = 7, version = 2.5.0, installer LOC per the stated scope, file count per the stated scope).
- **SC-002**: README renders with zero broken links (COACH.md removed; every link resolves).
- **SC-003**: Copy-pasting the README Quick Start into a clean directory completes a working install.
- **SC-004**: A GitHub repo description + topic set is defined and reproducibly applicable via a single documented command.

## Assumptions

- README is written in English (matches `CLAUDE.md`, the templates, the specs, and all installed artifacts).
- The spec-kit comparison is retained as a selling point; spec-coach's column is exact, spec-kit's column is best-effort/approximate and marked so.
- "Installer LOC" = TypeScript in `src/` (`cli.ts`, `utils.ts`, `state.ts`, `result.ts`, `manifest.ts`, `commands/*`) counted by the convention stated in README; the bash scripts are documented separately.
- spec-coach is not yet on npm; Quick Start leads with the working raw-URL path. Publishing to npm is out of scope for this feature.
- Auto-applying the GitHub description requires `gh` + auth + user confirmation; in its absence the deliverable is a documented proposal + command.

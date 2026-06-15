# Feature Specification: Kiro Agent Support

**Feature Branch**: `kiro-support`

**Created**: 2025-06-15

**Status**: Implemented

**Input**: User description: "支持 kiro"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initialize SDD Project with Kiro (Priority: P1)

A developer using Kiro CLI runs `spec-coach init --agent kiro` to scaffold an SDD project. All 11 skills are installed into `.kiro/skills/` with correct SKILL.md format and frontmatter, ready to use as slash commands.

**Why this priority**: This is the entire feature — enabling Kiro users to adopt spec-coach with a single command.

**Independent Test**: Run `spec-coach init --agent kiro` in a temp directory, verify `.kiro/skills/spec-specify/SKILL.md` exists with correct frontmatter, verify all 11 skills installed.

**Acceptance Scenarios**:

1. **Given** a project directory without spec-coach, **When** user runs `spec-coach init --agent kiro`, **Then** 11 skills are installed under `.kiro/skills/<skill-name>/SKILL.md` with valid YAML frontmatter containing `name` and `description`
2. **Given** an existing SDD project, **When** user runs `spec-coach update --agent kiro`, **Then** skills and templates are refreshed without overwriting `.spec/memory/constitution.md`
3. **Given** a Kiro-initialized project, **When** user types `/spec-specify` in Kiro, **Then** the skill is recognized as a slash command and loaded

---

### User Story 2 - CLI Validates Kiro as Supported Agent (Priority: P1)

`spec-coach --help` lists `kiro` among supported agents. Passing `--agent kiro` works; passing an unsupported agent fails with a clear message.

**Why this priority**: Discoverability and error handling are part of the complete feature.

**Independent Test**: Run `spec-coach --help`, verify `kiro` appears in agent list. Run `spec-coach init --agent unknown`, verify error message.

**Acceptance Scenarios**:

1. **Given** spec-coach is installed, **When** user runs `spec-coach --help`, **Then** the supported agents list includes `kiro`
2. **Given** spec-coach is installed, **When** user runs `spec-coach init --agent kiro`, **Then** the banner shows "Agent: Kiro | Format: skills"
3. **Given** spec-coach is installed, **When** user runs `spec-coach init --agent invalid`, **Then** CLI exits with code 1 and prints "Unknown agent: invalid. Supported: claude, cursor, copilot, codex, windsurf, kiro"

---

### User Story 3 - Kiro Skills Match Standard Skills Format (Priority: P2)

Kiro-installed skills produce functionally identical AI behavior to Claude Code and Codex skills — same SKILL.md body content, same workflow instructions, same templates.

**Why this priority**: Consistency across agents is a core project value (principle: Markdown Is the Product). Lower priority than P1 because it's verified by the same test.

**Independent Test**: Diff a Kiro-installed `spec-plan/SKILL.md` against a Claude Code-installed `spec-plan/SKILL.md` — only frontmatter should differ (no Claude-specific fields), body must be identical.

**Acceptance Scenarios**:

1. **Given** spec-coach installed for both `claude` and `kiro`, **When** user compares `spec-plan/SKILL.md` from both, **Then** body content is identical; Kiro frontmatter excludes `user-invocable` and `disable-model-invocation`
2. **Given** a Kiro-initiated project, **When** user opens any skill SKILL.md, **Then** it contains a `description` field suitable for Kiro's auto-activation matching

### Edge Cases

- **Name collision**: If `.kiro/skills/` already has a `spec-specify` directory from another source, `init` overwrites it (same behavior as other agents). This is intentional — spec-coach owns these skill names.
- **Kiro version**: Skills require Kiro CLI ≥ 1.24.0. Users on older versions won't see slash commands. This is documented, not enforced by spec-coach.
- **Global vs workspace**: Kiro supports `~/.kiro/skills/` (global) and `.kiro/skills/` (workspace). `spec-coach init` installs to workspace (`.kiro/skills/`), consistent with `.claude/skills/` behavior.
- **Agent not installed**: If user runs `spec-coach init --agent kiro` without Kiro CLI installed, the installation succeeds anyway — spec-coach only writes files, it doesn't require the agent to be present.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept `kiro` as a valid `--agent` value for both `init` and `update` commands
- **FR-002**: System MUST install skills to `.kiro/skills/<skill-id>/SKILL.md` using the `skills` format (directory per skill, YAML frontmatter + markdown body)
- **FR-003**: Skill SKILL.md files MUST include `name` and `description` in frontmatter (required by Kiro for slash command registration and auto-activation)
- **FR-004**: Skill SKILL.md files MUST NOT include Claude-specific frontmatter fields (`user-invocable`, `disable-model-invocation`) when installing for Kiro
- **FR-005**: Installed skill count MUST be 11 — same as all other agents (specify, plan, tasks, implement, analyze, clarify, checklist, constitution, taskstoissues, autopilot, fix)
- **FR-006**: `spec-coach --help` MUST list `kiro` among supported agents
- **FR-007**: `spec-coach init --agent kiro` MUST create the same `.spec/` structure, document templates, and scripts as all other agents. MUST NOT create `CLAUDE.md` (only Claude Code agent triggers `CLAUDE.md` generation)
- **FR-009**: System MUST NOT create any Kiro-specific config files (e.g., steering files). Kiro follows the same pattern as cursor/copilot/codex/windsurf — only Claude Code gets agent-specific config generation (`CLAUDE.md`)
- **FR-008**: Slash command separator for Kiro MUST be `-` (e.g., `/spec-specify`), matching Kiro's native slash command format

### Key Entities *(include if feature involves data)*

- **AgentConfig (kiro entry)**: key=`"kiro"`, name=`"Kiro"`, dir=`".kiro/skills"`, format=`"skills"`, separator=`"-"`, frontmatter=`{}`. No argument hints needed — Kiro natively supports `$ARGUMENTS` passthrough without frontmatter hints.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `spec-coach init --agent kiro` exits successfully and installs exactly 11 skills in under 2 seconds
- **SC-002**: All 11 installed SKILL.md files are valid YAML frontmatter + markdown (parseable by a YAML parser, non-empty body)
- **SC-003**: Kiro users can run `/spec-autopilot "describe a feature"` and Kiro loads the skill automatically via description matching
- **SC-004**: Existing agent support (claude, cursor, copilot, codex, windsurf) is unaffected — all existing tests pass

## Assumptions

- Kiro CLI's skill format follows the open Agent Skills standard (`.kiro/skills/<name>/SKILL.md` with `name` + `description` frontmatter), confirmed via kiro.dev documentation
- Kiro ignores unknown frontmatter fields — no need to strip compatibility/metadata fields
- No Kiro-specific `argumentHints` needed — Kiro's `$ARGUMENTS` passthrough works without hint metadata
- `CLAUDE.md` generation is NOT triggered for Kiro (currently only Claude Code gets it); this matches existing behavior where only `agent.key === "claude"` triggers `createCLAUDEmd`
- Kiro version ≥ 1.24.0 is the user's responsibility; spec-coach does not validate agent versions
- Adding `kiro` to `AgentKey` union type is the only TypeScript change needed beyond the AGENTS map entry

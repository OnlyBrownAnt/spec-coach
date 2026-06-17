# Changelog

## 2.0.0 — 2026-06-17

### Breaking — unified agent lifecycle (spec 003)

- **CLI restructured into two isolated surfaces**: the corpus lifecycle
  (`init`, `update`, `uninstall`) and the agent lifecycle
  (`agents add` / `update` / `remove` / `list`). The old `init --agent <key>`
  and `update --agent <key>` coupling is removed.
- **Agents are data-driven** via a root `agents.json` manifest. Adding an AI
  tool is a JSON entry, not a code change.
- **`init` no longer installs skills or absorbs documents.** Bind an agent with
  `agents add`; document intake is deferred to a future pipeline.
- **Install is reversible**: `agents add` / `agents remove` are precise inverses
  scoped to agent-owned paths; multi-agent coexistence is supported.
- **Universal context injection**: every agent now gets a managed section
  (Claude → `CLAUDE.md`; others → shared `AGENTS.md`), closing the gap where
  only Claude received context.
- **Migration**: existing projects are reconciled automatically on first
  `agents` command (`.spec/agents.json` rebuilt from the filesystem); no data
  loss.

### Constitution amendment (v1.1.0)

- Development Constraints updated: CLI surface (two isolated lifecycles) and
  agent support (`agents.json` manifest, replacing the in-source `AGENTS` map).

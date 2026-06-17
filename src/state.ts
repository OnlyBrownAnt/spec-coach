/**
 * Spec Coach — Installed-agent state (per-project).
 *
 * Tracks which agents are installed in a project and at what version, in
 * `.spec/agents.json`. This is the source of truth for `agents list/update/
 * remove` (FR-007). `reconcileFromFs` rebuilds state from the filesystem when
 * the state file is absent — migrating projects created by a prior spec-coach
 * version without data loss (FR-018).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { loadManifest, type AgentEntry } from "./manifest.ts";

export interface InstalledAgent {
  version: string;
  /** Leaf paths spec-coach created for this agent (skill dirs/files). Drives precise skill deletion (spec 004). */
  createdFiles?: string[];
}

/** Installed state, keyed by agent key. */
export type InstalledState = Record<string, InstalledAgent>;

const STATE_REL = path.join(".spec", "agents.json");

function statePath(projectRoot: string): string {
  return path.join(projectRoot, STATE_REL);
}

/**
 * Read installed-agent state. Returns {} when the file is absent or unreadable
 * (never throws — callers treat absent state as "nothing installed").
 */
export function readState(projectRoot: string): InstalledState {
  const p = statePath(projectRoot);
  if (!fs.existsSync(p)) return {};
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
  if (typeof data !== "object" || data === null) return {};
  // Wrapped form: { agents: { ... } }
  const wrapped = (data as { agents?: unknown }).agents;
  if (wrapped && typeof wrapped === "object") return wrapped as InstalledState;
  // Legacy bare-record form
  if (!("agents" in (data as object))) return data as InstalledState;
  return {};
}

/** Write installed-agent state. Creates the parent directory. */
export function writeState(projectRoot: string, state: InstalledState): void {
  const p = statePath(projectRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ agents: state }, null, 2) + "\n", "utf-8");
}

/** Record (or upgrade) a single installed agent. `createdFiles` (spec 004) records the leaf paths spec-coach created on disk, driving precise deletion. Returns the new full state. */
export function recordAgent(
  projectRoot: string,
  key: string,
  version: string,
  createdFiles?: string[],
): InstalledState {
  const state = readState(projectRoot);
  state[key] = createdFiles && createdFiles.length > 0 ? { version, createdFiles } : { version };
  writeState(projectRoot, state);
  return state;
}

/** Remove a single agent from state. No-op (no error) if not installed. */
export function unrecordAgent(projectRoot: string, key: string): InstalledState {
  const state = readState(projectRoot);
  delete state[key];
  writeState(projectRoot, state);
  return state;
}

/**
 * Rebuild installed state from the filesystem by scanning for known agent dirs
 * (FR-018). An agent counts as installed when its manifest `dir` exists and
 * contains spec-coach content:
 *   - skills format: a subdir named `spec<separator>...` (e.g. spec-specify)
 *   - markdown format: a `spec/` subdir containing `.md` files
 *
 * `manifest` defaults to the package manifest; pass a fixture for testing.
 * Writes the reconciled state only when `write` is true and state is non-empty.
 */
export function reconcileFromFs(
  projectRoot: string,
  manifest: AgentEntry[] = loadManifest(),
  write = false,
): InstalledState {
  const state: InstalledState = {};
  for (const agent of manifest) {
    if (hasSpecContent(projectRoot, agent)) {
      state[agent.key] = { version: agent.version };
    }
  }
  if (write && Object.keys(state).length > 0) {
    writeState(projectRoot, state);
  }
  return state;
}

function hasSpecContent(projectRoot: string, agent: AgentEntry): boolean {
  const agentDir = path.join(projectRoot, agent.dir);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(agentDir);
  } catch {
    return false;
  }
  if (!stat.isDirectory()) return false;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(agentDir, { withFileTypes: true });
  } catch {
    return false;
  }

  if (agent.format === "skills") {
    // Each command lives in its own spec<sep>... subdir (e.g. spec-specify/)
    return entries.some(
      (e) => e.isDirectory() && e.name.startsWith("spec" + agent.separator),
    );
  }
  // markdown format: commands live under a spec/ subdir as *.md
  const hasSpecDir = entries.some((e) => e.isDirectory() && e.name === "spec");
  if (!hasSpecDir) return false;
  try {
    return fs.readdirSync(path.join(agentDir, "spec")).some((f) => f.endsWith(".md"));
  } catch {
    return false;
  }
}

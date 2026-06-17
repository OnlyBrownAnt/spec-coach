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
import { ownedSkillUnits } from "./utils.ts";

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
/** Full on-disk state document: the agents map + project-level createdContextFiles (spec 004). */
interface StateDoc {
  agents?: InstalledState;
  createdContextFiles?: string[];
}

/**
 * Read the raw state document. Returns null when the file is absent or unreadable
 * (callers treat absent state as "nothing installed"). Handles the wrapped form
 * `{ agents, createdContextFiles }` and the legacy bare-record form (pre-spec-003,
 * where the whole object was the agents map).
 */
function readRaw(projectRoot: string): StateDoc | null {
  const p = statePath(projectRoot);
  if (!fs.existsSync(p)) return null;
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  if ("agents" in (data as object)) return data as StateDoc; // wrapped form
  return { agents: data as InstalledState }; // legacy bare-record form
}

/** Read installed-agent state (the agents map). Returns {} when absent/unreadable (never throws). */
export function readState(projectRoot: string): InstalledState {
  return readRaw(projectRoot)?.agents ?? {};
}

/** Write the agents map, preserving any existing createdContextFiles. Creates the parent directory. */
export function writeState(projectRoot: string, state: InstalledState): void {
  writeRaw(projectRoot, { agents: state, createdContextFiles: readRaw(projectRoot)?.createdContextFiles });
}

function writeRaw(projectRoot: string, doc: StateDoc): void {
  const p = statePath(projectRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const out =
    doc.createdContextFiles && doc.createdContextFiles.length > 0
      ? { agents: doc.agents ?? {}, createdContextFiles: doc.createdContextFiles }
      : { agents: doc.agents ?? {} };
  fs.writeFileSync(p, JSON.stringify(out, null, 2) + "\n", "utf-8");
}

// ── createdContextFiles (spec 004) ──────────────────────────────────────────
// Project-level record of the context files spec-coach created from scratch.
// Drives context-file-BODY deletion (a file is deleted only when spec-coach
// created it AND it is empty after teardown). Files the user authored are never
// in this list and thus never auto-deleted.

/** Context files spec-coach created from scratch. Returns [] when absent/unreadable. */
export function readCreatedContextFiles(projectRoot: string): string[] {
  return readRaw(projectRoot)?.createdContextFiles ?? [];
}

/** Idempotently record that spec-coach created a context file from scratch. */
export function recordContextFileCreated(projectRoot: string, file: string): void {
  const raw = readRaw(projectRoot) ?? {};
  const set = new Set(raw.createdContextFiles ?? []);
  set.add(file);
  writeRaw(projectRoot, { agents: raw.agents ?? {}, createdContextFiles: [...set] });
}

/** Idempotently remove a context file from the created-from-scratch record. Call when its body is deleted. */
export function removeContextFileCreated(projectRoot: string, file: string): void {
  const raw = readRaw(projectRoot) ?? {};
  const createdContextFiles = (raw.createdContextFiles ?? []).filter((f) => f !== file);
  writeRaw(projectRoot, { agents: raw.agents ?? {}, createdContextFiles });
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
      // FR-015: backfill createdFiles = ownedSkillUnits ∩ on-disk, so legacy projects
      // get Tier-2 precise skill deletion after one reconcile.
      const createdFiles = ownedSkillUnits(agent).filter((p) => fs.existsSync(path.join(projectRoot, p)));
      state[agent.key] = createdFiles.length > 0 ? { version: agent.version, createdFiles } : { version: agent.version };
    }
  }
  if (write && Object.keys(state).length > 0) {
    writeState(projectRoot, state);
  }
  // FR-016: createdContextFiles is intentionally NOT populated — provenance for
  // context files created before this feature cannot be reconstructed.
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

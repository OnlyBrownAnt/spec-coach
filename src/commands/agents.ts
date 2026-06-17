/**
 * Spec Coach — `agents` command group (agent-binding lifecycle).
 *
 * list / add / update / remove. These operate ONLY on agent-owned paths (an
 * agent's skill dir + its managed context section). They NEVER touch the spec
 * corpus (`.spec/scripts`, `.spec/templates`, `constitution.md`, `specs/`) —
 * that is a separate, isolated lifecycle (FR-008).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { loadManifest } from "../manifest.ts";
import { readState, recordAgent, unrecordAgent, reconcileFromFs, recordContextFileCreated, type InstalledState } from "../state.ts";
import { loadAgentConfig, installAllSkills, upsertManagedSection, removeManagedSection, ownedSkillUnits, type AgentConfig } from "../utils.ts";

export interface AgentStatus {
  key: string;
  name: string;
  installed: boolean;
  version?: string;
}

/** Compute manifest ∩ installed-state (FR-004). Pure — testable. */
export function getAgentsStatus(projectRoot: string): AgentStatus[] {
  const manifest = loadManifest();
  const state = ensureState(projectRoot);
  return manifest.map((entry) => {
    const rec = state[entry.key];
    return { key: entry.key, name: entry.name, installed: !!rec, version: rec?.version };
  });
}

/** Print the agent table (FR-004). Returns the status rows for programmatic use. */
export function runAgentsList(projectRoot: string): AgentStatus[] {
  const status = getAgentsStatus(projectRoot);
  console.log("  Agents (available → installed):\n");
  for (const a of status) {
    const mark = a.installed ? "✓ installed" : "  available";
    const ver = a.version ? ` (${a.version})` : "";
    console.log(`    ${a.key.padEnd(10)} ${a.name.padEnd(18)} ${mark}${ver}`);
  }
  const installed = status.filter((a) => a.installed).length;
  console.log(`\n  ${installed}/${status.length} installed.`);
  return status;
}

// ── Command results ────────────────────────────────────────────────────────

export type CmdResult = { ok: true; message: string } | { ok: false; reason: string };

/** A project has a spec corpus when `.spec/` exists (created by `spec-coach init`). */
export function corpusExists(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, ".spec"));
}

/**
 * Read installed state, reconciling from the filesystem when the state file is
 * absent but a corpus exists — migrating projects created by a prior version
 * whose agent bindings are on disk but unrecorded (FR-018). One-time write.
 */
function ensureState(projectRoot: string): InstalledState {
  if (fs.existsSync(path.join(projectRoot, ".spec", "agents.json"))) {
    return readState(projectRoot);
  }
  if (corpusExists(projectRoot)) {
    return reconcileFromFs(projectRoot, loadManifest(), true);
  }
  return readState(projectRoot);
}

/**
 * Install (or upgrade) an agent's bindings: skills + managed context section,
 * recorded in state. Requires the corpus to already exist (FR-013); idempotent
 * (FR-005/SC-006). Installs ONLY skills + context — never scripts/templates
 * (those are corpus infrastructure owned by init/update).
 */
export function runAgentsAdd(key: string, projectRoot: string): CmdResult {
  if (!corpusExists(projectRoot)) {
    return { ok: false, reason: "This project has no spec corpus — run `spec-coach init` first." };
  }
  const agent = loadAgentConfig(key);
  if (!agent) {
    return { ok: false, reason: `Unknown agent '${key}'. Run \`spec-coach agents list\` to see options.` };
  }
  installAllSkills(agent, projectRoot);
  const { created } = upsertManagedSection(agent, projectRoot);
  // Record provenance (spec 004): the leaf paths this agent owns, and whether we
  // created the context file from scratch. Drives precise deletion on remove.
  recordAgent(projectRoot, key, agent.version, ownedSkillUnits(agent));
  if (created) recordContextFileCreated(projectRoot, agent.contextFile);
  return { ok: true, message: `Installed ${agent.name} bindings (${agent.version}).` };
}

/**
 * Remove an agent's bindings: its skill files + managed context section (subject
 * to shared-AGENTS.md preservation) + state record. NEVER touches the corpus
 * (FR-008). Requires --force (FR-014); without it, refuses and deletes nothing.
 * A not-installed agent is a no-op (ok), never an error (FR-014).
 */
export function runAgentsRemove(
  key: string,
  projectRoot: string,
  opts: { force?: boolean } = {},
): CmdResult {
  const agent = loadAgentConfig(key);
  if (!agent) {
    return { ok: false, reason: `Unknown agent '${key}'. Run \`spec-coach agents list\` to see options.` };
  }
  if (!opts.force) {
    return { ok: false, reason: `Refusing to remove '${key}' without confirmation. Re-run with --force.` };
  }
  if (!ensureState(projectRoot)[key]) {
    return { ok: true, message: `'${key}' is not installed; nothing to do.` };
  }
  removeAgentSkills(agent, projectRoot);
  removeAgentContext(agent, projectRoot);
  unrecordAgent(projectRoot, key);
  return { ok: true, message: `Removed ${agent.name} bindings.` };
}

/** Remove exactly the skill files installAllSkills wrote (precise inverse of add). */
export function removeAgentSkills(agent: AgentConfig, projectRoot: string): void {
  const agentDir = path.join(projectRoot, agent.dir);
  if (!fs.existsSync(agentDir)) return;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(agentDir, { withFileTypes: true }); } catch { return; }

  if (agent.format === "skills") {
    const prefix = "spec" + agent.separator;
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith(prefix)) {
        try { fs.rmSync(path.join(agentDir, e.name), { recursive: true, force: true }); } catch { /* best effort */ }
      }
    }
  } else {
    // markdown format: commands live under a spec/ subdir
    const specDir = path.join(agentDir, "spec");
    if (fs.existsSync(specDir)) {
      try { fs.rmSync(specDir, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }
  // Precise inverse (SC-002): prune now-empty parent dirs up to projectRoot.
  pruneEmptyParents(agentDir, projectRoot);
}

/** Remove empty directories from `dir` upward, stopping at projectRoot or the first non-empty dir. */
function pruneEmptyParents(dir: string, projectRoot: string): void {
  const root = path.resolve(projectRoot);
  let cur = path.resolve(dir);
  while (cur !== root && cur.length > root.length) {
    if (!fs.existsSync(cur)) { cur = path.dirname(cur); continue; }
    try {
      if (fs.readdirSync(cur).length === 0) {
        fs.rmdirSync(cur);
        cur = path.dirname(cur);
      } else {
        break;
      }
    } catch { break; }
  }
}

/**
 * Remove the agent's managed context section, honoring shared AGENTS.md: for a
 * non-Claude agent, keep the section while any OTHER non-Claude agent remains
 * installed (FR-011 / analysis advisory #1).
 */
function removeAgentContext(agent: AgentConfig, projectRoot: string): void {
  if (agent.contextFile !== "CLAUDE.md" && otherNonClaudeAgentsInstalled(agent.key, projectRoot)) {
    return; // preserve the shared AGENTS.md section
  }
  removeManagedSection(agent, projectRoot);
  // Precise inverse (SC-002): if the context file now holds only the auto-
  // generated H1 (or is empty), it was created by our upsert — delete it.
  const filePath = path.join(projectRoot, agent.contextFile);
  try {
    if (!fs.existsSync(filePath)) return;
    const residual = fs.readFileSync(filePath, "utf-8").trim();
    const autoH1 = `# ${path.basename(projectRoot)}`;
    if (residual === "" || residual === autoH1) {
      fs.unlinkSync(filePath);
    }
  } catch { /* best effort */ }
}

function otherNonClaudeAgentsInstalled(excludeKey: string, projectRoot: string): boolean {
  const state = ensureState(projectRoot);
  return loadManifest().some(
    (e) => e.key !== excludeKey && e.contextFile !== "CLAUDE.md" && !!state[e.key],
  );
}

/**
 * Refresh installed agents' bindings (skills + context) from current sources,
 * syncing the recorded version to the manifest (FR-012; version-drift upgrade).
 * Idempotent. `target` is a key or "all". A not-installed single target is an
 * error; "all" with nothing installed is a no-op ok.
 */
export function runAgentsUpdate(target: string, projectRoot: string): CmdResult {
  const state = ensureState(projectRoot);
  let keys: string[];
  if (target === "all") {
    keys = Object.keys(state);
    if (keys.length === 0) {
      return { ok: true, message: "No agents installed; nothing to update." };
    }
  } else {
    if (!state[target]) {
      return { ok: false, reason: `'${target}' is not installed.` };
    }
    keys = [target];
  }

  let upgraded = 0;
  for (const key of keys) {
    const agent = loadAgentConfig(key);
    if (!agent) continue; // agent removed from manifest since install
    const prevVersion = state[key]?.version;
    installAllSkills(agent, projectRoot);
    upsertManagedSection(agent, projectRoot);
    recordAgent(projectRoot, key, agent.version);
    if (prevVersion !== agent.version) upgraded++;
  }
  const note = upgraded ? `, ${upgraded} version-upgraded` : "";
  return { ok: true, message: `Updated ${keys.length} agent(s)${note}.` };
}

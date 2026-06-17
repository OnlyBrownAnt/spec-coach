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
import { readState, recordAgent } from "../state.ts";
import { loadAgentConfig, installAllSkills, upsertManagedSection } from "../utils.ts";

export interface AgentStatus {
  key: string;
  name: string;
  installed: boolean;
  version?: string;
}

/** Compute manifest ∩ installed-state (FR-004). Pure — testable. */
export function getAgentsStatus(projectRoot: string): AgentStatus[] {
  const manifest = loadManifest();
  const state = readState(projectRoot);
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
  upsertManagedSection(agent, projectRoot);
  recordAgent(projectRoot, key, agent.version);
  return { ok: true, message: `Installed ${agent.name} bindings (${agent.version}).` };
}

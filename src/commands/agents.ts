/**
 * Spec Coach — `agents` command group (agent-binding lifecycle).
 *
 * list / add / update / remove. These operate ONLY on agent-owned paths (an
 * agent's skill dir + its managed context section). They NEVER touch the spec
 * corpus (`.spec/scripts`, `.spec/templates`, `constitution.md`, `specs/`) —
 * that is a separate, isolated lifecycle (FR-008).
 */
import { loadManifest } from "../manifest.ts";
import { readState } from "../state.ts";

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

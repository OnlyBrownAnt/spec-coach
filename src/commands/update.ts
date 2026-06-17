/**
 * Spec Coach — `update` command (spec-corpus lifecycle).
 *
 * Refreshes corpus infrastructure: document templates + helper scripts. Installs
 * NO agent bindings (skills/context) — those are refreshed per-agent by
 * `agents update`. Never modifies user artifacts (`specs/`, constitution, etc.)
 * (spec 003 FR-013/017).
 */
import type { AgentConfig } from "../utils.js";
import { installDocumentTemplates, installScripts } from "../utils.js";

/**
 * Refresh the spec corpus infrastructure. `agent` is accepted for backward
 * compatibility with the current CLI (T018 removes it) but is ignored: update is
 * corpus-scoped. To refresh an installed agent's bindings, use `agents update`.
 */
export async function runUpdate(_agent: AgentConfig | null, projectRoot: string): Promise<void> {
  const docTemplates = installDocumentTemplates(projectRoot);
  console.log(`  ✓  ${docTemplates.length} document templates refreshed`);

  const scripts = installScripts(projectRoot);
  console.log(`  ✓  ${scripts.length} helper scripts refreshed`);

  console.log("  Done. Corpus infrastructure (templates + scripts) is up to date.");
  console.log("  To refresh agent bindings, run: spec-coach agents update [--all]");
}

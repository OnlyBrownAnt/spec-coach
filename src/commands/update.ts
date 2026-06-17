/**
 * Spec Coach — `update` command.
 * Refreshes skills, templates, and scripts in place. Preserves project
 * structure, metadata, and constitution.md.
 */

import type { AgentConfig } from "../utils.js";
import {
  installAllSkills,
  installDocumentTemplates,
  installScripts,
  upsertClaudeManagedSection,
} from "../utils.js";

export async function runUpdate(agent: AgentConfig, projectRoot: string): Promise<void> {
  // Refresh skills
  const skills = installAllSkills(agent, projectRoot);
  console.log(`  ✓  ${skills.length} skill templates updated`);

  // Refresh document templates (does NOT touch .spec/memory/constitution.md)
  const docTemplates = installDocumentTemplates(agent, projectRoot);
  console.log(`  ✓  ${docTemplates.length} document templates updated`);

  // Refresh scripts
  const scripts = installScripts(projectRoot);
  console.log(`  ✓  ${scripts.length} helper scripts updated`);

  // Refresh the managed CLAUDE.md section (keeps existing projects current; FR-007)
  upsertClaudeManagedSection(projectRoot);
  console.log("  ✓  CLAUDE.md managed section refreshed\n");

  console.log("  Done. Skills, templates, and scripts are up to date.");
}

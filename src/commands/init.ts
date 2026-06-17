/**
 * Spec Coach — `init` command (spec-corpus lifecycle).
 *
 * Scaffolds the spec corpus: project structure, document templates, the
 * constitution (if absent), helper scripts, and an empty installed-agent state
 * file. Installs NO agent bindings (skills/context) and performs NO document
 * absorption — agent bindings come from `agents add`; document intake is a
 * separate pipeline (spec 003 FR-013/017).
 */
import * as path from "node:path";
import {
  installDocumentTemplates,
  installConstitutionToMemory,
  installScripts,
  ensureDir,
} from "../utils.js";
import { writeState } from "../state.ts";

// ── Project structure ──────────────────────────────────────────────────────

export function createProjectStructure(projectRoot: string): void {
  ensureDir(path.join(projectRoot, ".spec", "templates"));
  ensureDir(path.join(projectRoot, ".spec", "memory"));
  ensureDir(path.join(projectRoot, ".spec", "scripts", "bash"));
  ensureDir(path.join(projectRoot, "specs"));
}

// ── Next steps ──────────────────────────────────────────────────────────────

function printNextSteps(projectRoot: string, templates: number, scripts: number): void {
  console.log(`
  ✓  Spec corpus initialized at ${projectRoot}
  ✓  ${templates} document templates → ${path.join(projectRoot, ".spec/templates")}
  ✓  ${scripts} helper scripts → ${path.join(projectRoot, ".spec/scripts/bash")}
  ✓  Constitution → ${path.join(projectRoot, ".spec/memory/constitution.md")} (if absent)

  Next — bind an AI tool (installs its skills + context):
    spec-coach agents add <key>      (claude, cursor, copilot, codex, windsurf, kiro)
    spec-coach agents list           see available + installed

  Refresh corpus infrastructure later:
    spec-coach update                refresh templates + scripts
`);
}

// ── Main ───────────────────────────────────────────────────────────────────

/**
 * Initialize the spec corpus. The `agent` and `skipAbsorb` parameters are
 * accepted for backward compatibility with the current CLI (T018 removes them)
 * but are NOT used: init is corpus-only. Agent bindings come from `agents add`;
 * document absorption is deferred to a separate intake pipeline.
 */
export async function runInit(
  _agent: unknown,
  projectRoot: string,
  _skipAbsorb: boolean = false,
): Promise<void> {
  // 1. Project structure
  createProjectStructure(projectRoot);
  console.log("  ✓  Project structure created");

  // 2. Document templates (corpus infrastructure)
  const templates = installDocumentTemplates(projectRoot);
  console.log(`  ✓  ${templates.length} document templates installed`);

  // 3. Constitution (only if absent — never overwrite)
  if (installConstitutionToMemory(projectRoot)) {
    console.log("  ✓  Constitution created at .spec/memory/constitution.md");
  }

  // 4. Helper scripts (corpus infrastructure)
  const scripts = installScripts(projectRoot);
  console.log(`  ✓  ${scripts.length} helper scripts installed`);

  // 5. Empty installed-agent state — marks the corpus as spec-coach-managed.
  writeState(projectRoot, {});

  printNextSteps(projectRoot, templates.length, scripts.length);
}

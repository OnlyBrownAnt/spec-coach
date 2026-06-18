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
import { intakeNudge } from "./intake.ts";

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
 * Initialize the spec corpus. Installs NO agent bindings (those come from
 * `agents add`) and performs NO document absorption (that is the `intake`
 * pipeline, spec 005). Corpus-only.
 */
export async function runInit(projectRoot: string): Promise<void> {
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

  // 6. Intake nudge (FR-014): non-blocking. Detect candidates and hint; never prompt.
  const nudge = intakeNudge(projectRoot);
  if (nudge) console.log(nudge);

  printNextSteps(projectRoot, templates.length, scripts.length);
}

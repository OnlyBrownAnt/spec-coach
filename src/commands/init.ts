/**
 * Spec Coach — `init` command (spec-corpus lifecycle).
 *
 * Scaffolds the spec corpus: project structure, document templates, the
 * constitution (if absent), helper scripts, and an empty installed-agent state
 * file. Installs NO agent bindings (skills/context) — those come from
 * `agents add`. Document→spec conversion is the on-demand `/spec-absorb` skill
 * (spec 007); init never scans or touches the user's documents.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  installDocumentTemplates,
  installConstitutionToMemory,
  installConventionToMemory,
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
  ✓  Commit convention → ${path.join(projectRoot, ".spec/convention.md")} (if absent; edit it to your project)

  Next — bind an AI tool (installs its skills + context):
    spec-coach agents add <key>      (claude, cursor, copilot, codex, windsurf, kiro)
    spec-coach agents list           see available + installed

  Refresh corpus infrastructure later:
    spec-coach update                refresh templates + scripts
`);
}

// ── Existing-specs detection + document-safety guidance (spec 007 US4) ──────

/** Existing `NNN-slug` spec dirs under `specs/` and the highest leading number
 *  (0 when `specs/` is absent or has no conforming dirs). Pure — reads only. */
export function existingSpecs(projectRoot: string): { count: number; highest: number } {
  const specsDir = path.join(projectRoot, "specs");
  let entries: string[];
  try {
    entries = fs.readdirSync(specsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { count: 0, highest: 0 };
  }
  const nums = entries
    .map((e) => (/^(\d{3})-/.exec(e) ? parseInt(e.slice(0, 3), 10) : NaN))
    .filter((n) => !Number.isNaN(n));
  return { count: nums.length, highest: nums.length ? Math.max(...nums) : 0 };
}

/** Pure guidance text: the document-safety rule + the `/spec-absorb` how-to,
 *  preceded by an existing-specs line when `count > 0`. Never mutates anything. */
export function guidanceText(specs: { count: number; highest: number }): string {
  const pad3 = (n: number): string => String(n).padStart(3, "0");
  const lines: string[] = [];
  if (specs.count > 0) {
    lines.push(
      `Existing specs/ has ${specs.count} spec(s) (highest ${pad3(specs.highest)}). ` +
        `Adopted as-is — nothing was modified. Review with \`ls specs/\`; new specs continue from ${pad3(specs.highest + 1)}.`,
    );
  }
  lines.push(
    "Your own documents (docs/, *.md, wherever they live) are NEVER moved, deleted, or overwritten by spec-coach.",
  );
  lines.push(
    "To turn a document into a spec, run: /spec-absorb <path>  (it reads the doc in place and writes specs/NNN-slug/spec.md; the original stays put).",
  );
  lines.push("Documents you don't want as specs need nothing — leave them; they're safe.");
  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────────────

/**
 * Initialize the spec corpus. Installs NO agent bindings (those come from
 * `agents add`) and never touches user documents (the `/spec-absorb` skill
 * converts a document into a spec on demand — spec 007). Corpus-only.
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

  // 3b. Commit convention (only if absent — never overwrite; spec 010 FR-001).
  if (installConventionToMemory(projectRoot)) {
    console.log("  ✓  Commit convention created at .spec/convention.md");
  }

  // 4. Helper scripts (corpus infrastructure)
  const scripts = installScripts(projectRoot);
  console.log(`  ✓  ${scripts.length} helper scripts installed`);

  // 5. Empty installed-agent state — marks the corpus as spec-coach-managed.
  //    Written only when absent: re-running init must not wipe already-installed
  //    agents (spec 007 US1 / FR-001/002).
  if (!fs.existsSync(path.join(projectRoot, ".spec", "agents.json"))) {
    writeState(projectRoot, {});
  }

  printNextSteps(projectRoot, templates.length, scripts.length);

  // 7. Document-safety guidance (spec 007 US4): non-blocking. States what
  //    spec-coach will/won't touch and how to bring a document in (/spec-absorb).
  console.log(guidanceText(existingSpecs(projectRoot)));
}

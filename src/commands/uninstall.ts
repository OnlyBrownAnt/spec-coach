/**
 * Spec Coach — `uninstall` command (spec-corpus lifecycle).
 *
 * Removes spec-coach infrastructure (scripts, templates, state) + ALL agent
 * bindings (skill files + managed context sections), while PRESERVING user-
 * authored content (`specs/`, `.spec/memory/constitution.md`, `.spec/absorbed/`)
 * unless `purge` is set (FR-016). Requires explicit confirmation (FR-014).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { loadManifest } from "../manifest.ts";
import { loadAgentConfig, removeManagedSection } from "../utils.ts";
import { removeAgentSkills, type CmdResult } from "./agents.ts";

export interface UninstallOptions {
  /** FR-014: must be true to proceed (the CLI prompts; tests pass it directly). */
  confirmed?: boolean;
  /** FR-016 --force: also remove user-authored content (specs/, constitution, absorbed). */
  purge?: boolean;
}

const INFRA_PATHS = [".spec/scripts", ".spec/templates", ".spec/agents.json"];
const USER_PATHS = ["specs", ".spec/memory", ".spec/absorbed"];

export function runUninstall(projectRoot: string, opts: UninstallOptions = {}): CmdResult {
  if (!opts.confirmed) {
    return {
      ok: false,
      reason: "Refusing to uninstall without confirmation. Re-run with confirmation (CLI prompt or --yes).",
    };
  }

  // 1. Remove every agent's bindings (skills + managed context sections).
  for (const entry of loadManifest()) {
    const agent = loadAgentConfig(entry.key);
    if (!agent) continue;
    removeAgentSkills(agent, projectRoot);
    removeManagedSection(agent, projectRoot);
  }
  // Delete context files left as only the auto-generated H1 shell.
  for (const file of ["CLAUDE.md", "AGENTS.md"]) {
    deleteIfShell(projectRoot, file);
  }

  // 2. Remove spec-coach infrastructure.
  for (const rel of INFRA_PATHS) rmAny(path.join(projectRoot, rel));

  // 3. User content is preserved unless purge (--force) is set.
  if (opts.purge) {
    for (const rel of USER_PATHS) rmAny(path.join(projectRoot, rel));
    pruneIfEmpty(path.join(projectRoot, ".spec"));
  }

  const tail = opts.purge
    ? " (user content purged: specs/, constitution, absorbed/)"
    : " User content (specs/, constitution) preserved.";
  return { ok: true, message: `Removed spec-coach infrastructure + agent bindings.${tail}` };
}

function rmAny(p: string): void {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* best effort */ }
}

function deleteIfShell(projectRoot: string, file: string): void {
  const p = path.join(projectRoot, file);
  try {
    if (!fs.existsSync(p)) return;
    const residual = fs.readFileSync(p, "utf-8").trim();
    if (residual === "" || residual === `# ${path.basename(projectRoot)}`) fs.unlinkSync(p);
  } catch { /* best effort */ }
}

function pruneIfEmpty(dir: string): void {
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch { /* best effort */ }
}

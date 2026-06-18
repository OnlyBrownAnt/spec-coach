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
import { loadAgentConfig } from "../utils.ts";
import { readCreatedContextFiles, unrecordAgent } from "../state.ts";
import { removeAgentSkills, removeAgentContext } from "./agents.ts";
import { ensureState } from "../state.ts";
import type { CmdResult } from "../result.ts";

export interface UninstallOptions {
  /** FR-014: must be true to proceed (the CLI prompts; tests pass it directly). */
  confirmed?: boolean;
  /** FR-016 --force: also remove user-authored content (specs/, constitution, absorbed). */
  purge?: boolean;
}

const INFRA_PATHS = [".spec/scripts", ".spec/templates", ".spec/agents.json", ".spec/intake"];
const USER_PATHS = ["specs", ".spec/memory", ".spec/absorbed"];

export function runUninstall(projectRoot: string, opts: UninstallOptions = {}): CmdResult {
  if (!opts.confirmed) {
    return {
      ok: false,
      reason: "Refusing to uninstall without confirmation. Re-run with confirmation (CLI prompt or --yes).",
    };
  }

  // 1. Remove ONLY installed agents' bindings (provenance-aware). Non-installed
  //    manifest agents are untouched (FR-012). Skills use each agent's recorded
  //    createdFiles; context files use ownership (createdContextFiles). Unregister
  //    each agent after processing so the shared-AGENTS.md gate falls open for the
  //    last non-Claude agent (its removeAgentContext then strips + deletes the file).
  const state = ensureState(projectRoot);
  const createdContextFiles = readCreatedContextFiles(projectRoot);
  for (const key of Object.keys(state)) {
    const agent = loadAgentConfig(key);
    if (!agent) continue; // agent removed from manifest since install
    removeAgentSkills(agent, projectRoot, state[key]?.createdFiles);
    removeAgentContext(agent, projectRoot, { isOwner: createdContextFiles.includes(agent.contextFile) });
    unrecordAgent(projectRoot, key);
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

function pruneIfEmpty(dir: string): void {
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch { /* best effort */ }
}

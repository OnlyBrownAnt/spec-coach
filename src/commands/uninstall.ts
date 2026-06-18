/**
 * Spec Coach — `uninstall` command (spec-corpus lifecycle).
 *
 * Removes spec-coach infrastructure under `.spec/` (scripts, templates,
 * agents.json) + every agent binding (skill files + managed context sections),
 * PRESERVING user content (`specs/`, AND an AUTHORED constitution — project IP)
 * unless `purge` is set (FR-016). A never-authored TEMPLATE constitution is
 * still tooling and is removed (spec 009). Requires explicit confirmation
 * (FR-014).
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
  /** FR-016 --force: also remove user content (specs/). */
  purge?: boolean;
}

// Plain uninstall removes exactly what init installs (its inverse), minus user
// content. .spec/memory is handled separately (spec 009): an AUTHORED
// constitution is project IP and is preserved like specs/; a never-authored
// TEMPLATE is tooling and is removed. (spec 007 US2 / FR-003/004/005; spec 009.)
const INFRA_PATHS = [".spec/scripts", ".spec/templates", ".spec/agents.json"];
const USER_PATHS = ["specs"];

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

  // 2b. spec 009: the constitution is project IP once authored. Preserve an
  //     AUTHORED .spec/memory/constitution.md on plain uninstall; remove it on
  //     purge, or when it is still a TEMPLATE (never authored — tooling). An
  //     authored charter thus survives plain uninstall like specs/ and CLAUDE.md.
  const memoryDir = path.join(projectRoot, ".spec", "memory");
  if (opts.purge || !isAuthoredConstitution(path.join(memoryDir, "constitution.md"))) {
    rmAny(memoryDir);
  }

  // 2c. spec 010 (FR-001 charter-as-IP): the commit convention is project IP
  //     once authored, like the constitution. Preserve an AUTHORED
  //     .spec/convention.md on plain uninstall; remove it on purge or when it is
  //     still a TEMPLATE (never authored — tooling). A never-authored TEMPLATE
  //     is removed so an emptied .spec/ still prunes (uninstall = inverse of init).
  const convFile = path.join(projectRoot, ".spec", "convention.md");
  if (opts.purge || !isAuthoredConvention(convFile)) {
    rmAny(convFile);
  }

  // 3. User content is preserved unless purge (--force) is set.
  if (opts.purge) {
    for (const rel of USER_PATHS) rmAny(path.join(projectRoot, rel));
  }

  // 4. Prune an emptied .spec/ (spec 007 fix). pruneIfEmpty removes only an empty
  //    dir; preserving an AUTHORED .spec/memory/ leaves .spec/ non-empty (the
  //    charter survives in a shell), so the prune only fires when .spec/ is
  //    genuinely empty (template/absent constitution removed, no other content).
  pruneIfEmpty(path.join(projectRoot, ".spec"));

  const tail = opts.purge
    ? " (specs/ purged.)"
    : " User content (specs/) preserved.";
  return { ok: true, message: `Removed spec-coach infrastructure + agent bindings.${tail}` };
}

function rmAny(p: string): void {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* best effort */ }
}

/**
 * spec 009: an AUTHORED constitution has no template-signature placeholders (a
 * TEMPLATE still does). Same token set as verify-constitution-sync.sh; the small
 * duplication is documented because TS cannot `source` the bash script. Returns
 * false when the file is missing or unreadable.
 */
function isAuthoredConstitution(p: string): boolean {
  try {
    if (!fs.existsSync(p)) return false;
    const content = fs.readFileSync(p, "utf8");
    return !/\[(CONSTITUTION_VERSION|RATIFICATION_DATE|LAST_AMENDED_DATE|PROJECT_NAME|PRINCIPLE_1_NAME)\]/.test(content);
  } catch {
    return false;
  }
}

/**
 * spec 010: an AUTHORED convention has no template-signature placeholders (a
 * TEMPLATE still does — [PROJECT_NAME]/[ALLOWED_TYPES]/[SCOPE_FORMAT]). Same
 * idea as isAuthoredConstitution; a separate helper because the convention's
 * signature tokens differ. Returns false when the file is missing or unreadable.
 */
function isAuthoredConvention(p: string): boolean {
  try {
    if (!fs.existsSync(p)) return false;
    const content = fs.readFileSync(p, "utf8");
    return !/\[(PROJECT_NAME|ALLOWED_TYPES|SCOPE_FORMAT)\]/.test(content);
  } catch {
    return false;
  }
}

function pruneIfEmpty(dir: string): void {
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch { /* best effort */ }
}

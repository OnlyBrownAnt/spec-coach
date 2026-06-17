/**
 * Spec Coach — Shared utilities.
 * Types, agent configs, file ops, frontmatter parsing, and install helpers.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest, type AgentEntry } from "./manifest.ts";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentConfig {
  key: string;
  name: string;
  dir: string;
  format: "skills" | "markdown";
  separator: string;
  frontmatter: Record<string, string | boolean>;
  contextFile: string;
  version: string;
  argumentHints?: Record<string, string>;
}

// Agents are data-driven via agents.json (spec 003); AgentKey is now an open
// string type so manifest additions need no source change. Legacy callers
// (cli.ts) still import this name.
export type AgentKey = string;

// ── Agent configurations ───────────────────────────────────────────────────
// Agents are data-driven via agents.json (spec 003 FR-001/002/003). The former
// hardcoded enum is removed; AGENTS below is a backward-compat map derived from
// the manifest, retained until cli.ts is rewritten (T018). Prefer loadAgentConfig.

/** Convert a validated manifest entry into an AgentConfig. */
function entryToConfig(e: AgentEntry): AgentConfig {
  const config: AgentConfig = {
    key: e.key,
    name: e.name,
    dir: e.dir,
    format: e.format,
    separator: e.separator,
    frontmatter: e.frontmatter,
    contextFile: e.contextFile,
    version: e.version,
  };
  if (e.argumentHints) config.argumentHints = e.argumentHints;
  return config;
}

/** Resolve an agent's config from the manifest at runtime (FR-003). Null if unknown. */
export function loadAgentConfig(key: string): AgentConfig | null {
  const entry = loadManifest().find((e) => e.key === key);
  return entry ? entryToConfig(entry) : null;
}

/** Backward-compat agent map, manifest-derived. Legacy callers: cli.ts/init.ts/update.ts. */
export const AGENTS: Record<string, AgentConfig> = Object.fromEntries(
  loadManifest().map((e) => [e.key, entryToConfig(e)] as const),
);

// ── Package root resolution ────────────────────────────────────────────────

let __scriptPath: string;
try {
  __scriptPath = fileURLToPath(import.meta.url);
} catch {
  __scriptPath = process.argv[1];
}
export const PACKAGE_ROOT = path.resolve(path.dirname(__scriptPath), "..");

// ── Source path helpers ────────────────────────────────────────────────────

export function skillSource(name: string): string {
  return path.join(PACKAGE_ROOT, "skills", `${name}.md`);
}

export function templateSource(name: string): string {
  return path.join(PACKAGE_ROOT, "templates", `${name}.md`);
}

// ── File operations ────────────────────────────────────────────────────────

export function ensureDir(dir: string): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // A path component may be a broken symlink — find and remove it
      const parts = dir.split(path.sep);
      for (let i = 1; i <= parts.length; i++) {
        const partial = parts.slice(0, i).join(path.sep) || path.sep;
        try {
          const lst = fs.lstatSync(partial);
          if (lst.isSymbolicLink()) {
            try { fs.statSync(partial); } catch { fs.unlinkSync(partial); }
          }
        } catch { /* skip inaccessible components */ }
      }
      fs.mkdirSync(dir, { recursive: true });
    } else {
      throw err;
    }
  }
}

export function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

// ── Frontmatter ────────────────────────────────────────────────────────────

/** Parse YAML frontmatter from a markdown file. Returns [frontmatter, body]. */
export function parseFrontmatter(content: string): [Record<string, unknown>, string] {
  if (!content.startsWith("---")) return [{}, content];
  const end = content.indexOf("---", 3);
  if (end === -1) return [{}, content];
  const fm: Record<string, unknown> = {};
  for (const line of content.slice(3, end).split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      let value: string = line.slice(colon + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      fm[key] = value;
    }
  }
  return [fm, content.slice(end + 3).trimStart()];
}

/** Build YAML frontmatter string from an object. */
export function buildFrontmatter(obj: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "boolean") lines.push(`${key}: ${value}`);
    else if (typeof value === "string") {
      // Quote only when needed (spaces, colons, special chars); simple identifiers stay bare
      if (/^[a-zA-Z0-9][\w.\/-]*$/.test(value) && !/^(true|false|null|yes|no|on|off)$/i.test(value)) {
        lines.push(`${key}: ${value}`);
      } else {
        lines.push(`${key}: "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
      }
    }
    else lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push("---");
  return lines.join("\n") + "\n\n";
}

// ── Skill installation ─────────────────────────────────────────────────────

export function buildSkillFrontmatter(
  agent: AgentConfig,
  skillName: string,
  description: string,
  sourcePath: string,
): string {
  const fm: Record<string, unknown> = {
    name: skillName,
    description,
    ...agent.frontmatter,
  };

  if (agent.format === "skills") {
    fm.compatibility = "Requires spec-coach project structure with .spec/ directory";
    fm.metadata = {
      author: "spec-coach",
      source: sourcePath,
    };
  }

  if (agent.argumentHints) {
    const stem = skillName.replace("spec" + agent.separator, "");
    const hint = agent.argumentHints[stem];
    if (hint) {
      (fm as any)["argument-hint"] = hint;
    }
  }

  return buildFrontmatter(fm);
}

export function installSkill(
  agent: AgentConfig,
  templateName: string,
  projectRoot: string
): void {
  const src = skillSource(templateName);
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠  Skill template not found: ${templateName}.md — skipping`);
    return;
  }

  const raw = fs.readFileSync(src, "utf-8");
  const [origFm, body] = parseFrontmatter(raw);
  const description = String(origFm.description || `Spec Coach: ${templateName} workflow`);
  const skillId = `spec${agent.separator}${templateName.replace(".", agent.separator)}`;

  if (agent.format === "skills") {
    const destDir = path.join(projectRoot, agent.dir, skillId);
    ensureDir(destDir);
    const destFile = path.join(destDir, "SKILL.md");
    const sourceRef = `skills/${templateName}.md`;
    const fm = buildSkillFrontmatter(agent, skillId, description, sourceRef);
    fs.writeFileSync(destFile, fm + body.trimStart());
  } else {
    const destDir = path.join(projectRoot, agent.dir, "spec");
    const destFile = path.join(destDir, `${templateName}.md`);
    ensureDir(destDir);
    fs.writeFileSync(destFile, raw);
  }
}

const SKILL_NAMES = [
  "specify", "plan", "tasks", "implement",
  "analyze", "clarify", "checklist", "constitution",
  "taskstoissues", "autopilot", "fix",
];

export function installAllSkills(agent: AgentConfig, projectRoot: string): string[] {
  const installed: string[] = [];
  for (const name of SKILL_NAMES) {
    installSkill(agent, name, projectRoot);
    installed.push(name);
  }
  return installed;
}

// ── Document templates ─────────────────────────────────────────────────────

const TEMPLATE_NAMES = [
  "spec-template",
  "plan-template",
  "tasks-template",
  "checklist-template",
  "constitution-template",
  "fix-template",
];

export function installDocumentTemplates(agent: AgentConfig, projectRoot: string): string[] {
  const destDir = path.join(projectRoot, ".spec", "templates");
  ensureDir(destDir);

  const installed: string[] = [];
  for (const name of TEMPLATE_NAMES) {
    const src = templateSource(name);
    if (fs.existsSync(src)) {
      const dest = path.join(destDir, `${name}.md`);
      fs.copyFileSync(src, dest);
      installed.push(name);
    }
  }
  return installed;
}

/** Copy constitution-template to .spec/memory/constitution.md — only if absent. */
export function installConstitutionToMemory(projectRoot: string): boolean {
  const constSrc = templateSource("constitution-template");
  if (!fs.existsSync(constSrc)) return false;

  const memoryDir = path.join(projectRoot, ".spec", "memory");
  ensureDir(memoryDir);
  const constDest = path.join(memoryDir, "constitution.md");

  if (fs.existsSync(constDest)) return false; // never overwrite

  fs.copyFileSync(constSrc, constDest);
  return true;
}

// ── Scripts ─────────────────────────────────────────────────────────────────

export function installScripts(projectRoot: string): string[] {
  const scriptsSrc = path.join(PACKAGE_ROOT, "scripts", "bash");
  const scriptsDest = path.join(projectRoot, ".spec", "scripts", "bash");

  if (!fs.existsSync(scriptsSrc)) return [];

  const installed: string[] = [];
  for (const name of fs.readdirSync(scriptsSrc)) {
    if (name.endsWith(".sh")) {
      const src = path.join(scriptsSrc, name);
      const dest = path.join(scriptsDest, name);
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o755);
      installed.push(name);
    }
  }
  return installed;
}

// ── CLAUDE.md managed section ───────────────────────────────────────────────

export const COACH_MARKER_START = "<!-- COACH START -->";
export const COACH_MARKER_END = "<!-- COACH END -->";

/** The managed Spec Coach section body (between markers). Shared by init and update. */
export function buildClaudeManagedSection(): string {
  return [
    "This project uses **Spec Coach** for spec-driven development.",
    "",
    "## SDD Workflow",
    "",
    "Run these slash commands in order:",
    "",
    "1. /spec-constitution -- Define project principles",
    "2. /spec-specify -- Create feature specification",
    "3. /spec-clarify (optional) -- Clarify ambiguities",
    "4. /spec-plan -- Create technical plan",
    "5. /spec-tasks -- Generate task breakdown",
    "6. /spec-analyze (optional) -- Cross-artifact review",
    "7. /spec-implement -- Execute implementation",
    "",
    "See .spec/templates/ for document templates and .spec/scripts/ for helper scripts.",
    "",
    "## Workflow State",
    "",
    "Current feature & workflow phase: run `scripts/bash/show-sdd-state.sh` (state lives in `.spec/feature.json` + the SDD STATE block in `.spec/memory/constitution.md`).",
    "",
    "## Bug Fixes",
    "",
    "Run `/spec-fix \"describe the bug\"` for root-cause analysis and targeted fixes.",
    "",
  ].join("\n");
}

/**
 * Create or refresh the managed Spec Coach section in CLAUDE.md. Preserves any
 * user content outside the COACH markers. init writes a fresh file; update calls
 * this to keep existing projects current (FR-007).
 */
export function upsertClaudeManagedSection(projectRoot: string): void {
  const claudePath = path.join(projectRoot, "CLAUDE.md");
  const section = buildClaudeManagedSection();
  const block = `${COACH_MARKER_START}
${section}${COACH_MARKER_END}
`;

  let existing = "";
  try {
    existing = fs.existsSync(claudePath) ? fs.readFileSync(claudePath, "utf-8") : "";
  } catch { /* best-effort */ }

  const startIdx = existing.indexOf(COACH_MARKER_START);
  const endIdx = existing.indexOf(COACH_MARKER_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const replaced = existing.slice(0, startIdx) + block + existing.slice(endIdx + COACH_MARKER_END.length);
    try { fs.writeFileSync(claudePath, replaced); } catch { /* best-effort */ }
    return;
  }

  // No markers yet: append a managed block (create file with H1 if absent).
  const projectName = path.basename(projectRoot);
  const content = existing.trim().length > 0
    ? `${existing.trimEnd()}

${block}`
    : `# ${projectName}

${block}`;
  try { fs.writeFileSync(claudePath, content); } catch { /* best-effort */ }
}

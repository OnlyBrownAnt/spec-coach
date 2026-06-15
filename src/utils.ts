/**
 * Spec Coach — Shared utilities.
 * Types, agent configs, file ops, frontmatter parsing, and install helpers.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentConfig {
  key: string;
  name: string;
  dir: string;
  format: "skills" | "markdown";
  separator: string;
  frontmatter: Record<string, string | boolean>;
  argumentHints?: Record<string, string>;
}

export type AgentKey = "claude" | "cursor" | "copilot" | "codex" | "windsurf" | "kiro";

// ── Agent configurations ───────────────────────────────────────────────────

export const AGENTS: Record<AgentKey, AgentConfig> = {
  claude: {
    key: "claude",
    name: "Claude Code",
    dir: ".claude/skills",
    format: "skills",
    separator: "-",
    frontmatter: { "user-invocable": true, "disable-model-invocation": false },
    argumentHints: {
      specify: "Describe the feature you want to specify",
      plan: "Optional guidance for the planning phase",
      tasks: "Optional task generation constraints",
      implement: "Optional implementation guidance or task filter",
      analyze: "Optional focus areas for analysis",
      clarify: "Optional areas to clarify in the spec",
      constitution: "Principles or values for the project constitution",
      checklist: "Domain or focus area for the checklist",
      autopilot: "Describe the feature — AI will run the full SDD cycle autonomously",
      fix: "Describe the bug — what happened vs what should have happened. Optional: --spec specs/<id>",
    },
  },
  cursor: {
    key: "cursor",
    name: "Cursor",
    dir: ".cursor/commands",
    format: "markdown",
    separator: ".",
    frontmatter: {},
  },
  copilot: {
    key: "copilot",
    name: "GitHub Copilot",
    dir: ".github/copilot/commands",
    format: "markdown",
    separator: ".",
    frontmatter: {},
  },
  codex: {
    key: "codex",
    name: "OpenAI Codex",
    dir: ".codex/skills",
    format: "skills",
    separator: "-",
    frontmatter: { "user-invocable": true, "disable-model-invocation": false },
  },
  windsurf: {
    key: "windsurf",
    name: "Windsurf",
    dir: ".windsurf/commands",
    format: "markdown",
    separator: ".",
    frontmatter: {},
  },
  kiro: {
    key: "kiro",
    name: "Kiro",
    dir: ".kiro/skills",
    format: "skills",
    separator: "-",
    frontmatter: {},
  },
};

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

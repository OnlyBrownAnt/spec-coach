/**
 * Spec Coach — `init` command.
 * Scaffolds a new SDD project: directories, skills, templates, scripts, and metadata.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import type { AgentConfig } from "../utils.js";
import {
  installAllSkills,
  installDocumentTemplates,
  installConstitutionToMemory,
  installScripts,
  ensureDir,
  parseFrontmatter,
} from "../utils.js";

// ── Project structure ──────────────────────────────────────────────────────

export function createProjectStructure(projectRoot: string): void {
  ensureDir(path.join(projectRoot, ".spec", "templates"));
  ensureDir(path.join(projectRoot, ".spec", "memory"));
  ensureDir(path.join(projectRoot, ".spec", "scripts", "bash"));
  ensureDir(path.join(projectRoot, "specs"));
}

// ── CLAUDE.md ──────────────────────────────────────────────────────────────

export function createCLAUDEmd(projectRoot: string): void {
  const claudePath = path.join(projectRoot, "CLAUDE.md");
  const projectName = path.basename(projectRoot);
  const content = "# " + projectName + "\n\n" +
    "<!-- COACH START -->\n" +
    "This project uses **Spec Coach** for spec-driven development.\n\n" +
    "## SDD Workflow\n\n" +
    "Run these slash commands in order:\n\n" +
    "1. /spec-constitution -- Define project principles\n" +
    "2. /spec-specify -- Create feature specification\n" +
    "3. /spec-clarify (optional) -- Clarify ambiguities\n" +
    "4. /spec-plan -- Create technical plan\n" +
    "5. /spec-tasks -- Generate task breakdown\n" +
    "6. /spec-analyze (optional) -- Cross-artifact review\n" +
    "7. /spec-implement -- Execute implementation\n\n" +
    "See .spec/templates/ for document templates and .spec/scripts/ for helper scripts.\n\n" +
    "## Bug Fixes\n\n" +
    "Run `/spec-fix \"describe the bug\"` for root-cause analysis and targeted fixes.\n\n" +
    "<!-- COACH END -->\n";
  try {
    fs.writeFileSync(claudePath, content);
  } catch { /* best-effort */ }
}

// ── Absorb: scan and migrate existing spec documents ───────────────────────

const MAX_CANDIDATE_SIZE = 500 * 1024;

const SCAN_EXCLUDE_DIRS = new Set([
  "node_modules", ".git", ".claude", ".spec", "specs", ".test-output",
]);

const SCAN_EXCLUDE_FILES = new Set([
  "changelog", "readme", "license", "contributing", "code_of_conduct",
]);

const FILE_KEYWORDS = [
  "spec", "requirement", "需求", "prd", "feature", "设计",
  "proposal", "方案", "plan", "任务", "story", "design",
];

const CONTENT_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "frontmatter", regex: /^---\n[\s\S]*?\n---/m },
  { label: "User Story", regex: /user\s*story|用户故事/i },
  { label: "Functional Requirement", regex: /functional\s*requirement|FR-\d|功能需求/i },
  { label: "Overview section", regex: /##\s*(overview|概述|背景|background)/i },
  { label: "Acceptance Criteria", regex: /acceptance\s*criteria|验收标准/i },
  { label: '"As a...I want" pattern', regex: /as\s+a\b.*\bi\s*want\b/i },
];

function isExcludedDir(name: string): boolean {
  return SCAN_EXCLUDE_DIRS.has(name) || name.startsWith(".");
}

function slugify(name: string): string {
  return path.basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^\w一-鿿-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

interface Candidate {
  file: string;
  reason: string;
  sizeKB: number;
}

function scanForCandidateDocs(projectRoot: string): Candidate[] {
  const candidates: Candidate[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (isExcludedDir(entry.name)) continue;
        walk(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx")) continue;

      const stem = entry.name.replace(/\.mdx?$/i, "").toLowerCase();
      if (SCAN_EXCLUDE_FILES.has(stem)) continue;

      let sizeKB = 0;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_CANDIDATE_SIZE) continue;
        sizeKB = Math.round(stat.size / 1024);
      } catch { continue; }

      const relativePath = path.relative(projectRoot, fullPath);
      let reason = "";

      for (const kw of FILE_KEYWORDS) {
        if (entry.name.toLowerCase().includes(kw.toLowerCase())) {
          reason = `filename matches "${kw}"`;
          break;
        }
      }

      if (!reason) {
        let content: string;
        try { content = fs.readFileSync(fullPath, "utf-8"); }
        catch { continue; }

        for (const pattern of CONTENT_PATTERNS) {
          if (pattern.regex.test(content)) {
            reason = `content matches "${pattern.label}"`;
            break;
          }
        }
      }

      if (reason) {
        candidates.push({ file: relativePath, reason, sizeKB });
      }
    }
  }

  walk(projectRoot);
  return candidates;
}

function absorbDocument(
  sourceFile: string,
  featureId: string,
  projectRoot: string,
): void {
  const specsDir = path.join(projectRoot, "specs", featureId);
  ensureDir(specsDir);

  const sourceAbs = path.join(projectRoot, sourceFile);
  const originalContent = fs.readFileSync(sourceAbs, "utf-8");
  const [, body] = parseFrontmatter(originalContent);

  const today = new Date().toISOString().split("T")[0];

  const specContent = `# Spec: ${featureId}

**Created**: ${today} | **Status**: Draft | **Absorbed from**: ${sourceFile}

## Overview

${body.trim()}

## User Stories

[TODO: Not in original document — run /spec-specify to fill in]

## Functional Requirements

[TODO: Not in original document — run /spec-specify to fill in]

## Edge Cases

[TODO: Not in original document — run /spec-specify to fill in]

## Non-Goals

[TODO: Not in original document — run /spec-specify to fill in]

## Success Criteria

- [ ] [TODO: Not in original document — run /spec-specify to fill in]
`;

  const specFile = path.join(specsDir, "spec.md");
  fs.writeFileSync(specFile, specContent);

  // Archive original file
  const archiveDir = path.join(projectRoot, ".spec", "absorbed");
  ensureDir(archiveDir);
  const archiveName = sourceFile.replace(/\//g, "_");
  fs.copyFileSync(sourceAbs, path.join(archiveDir, archiveName));
  fs.unlinkSync(sourceAbs);
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      resolve(answer.trim());
    });
  });
}

export async function runAbsorbWorkflow(projectRoot: string): Promise<void> {
  const candidates = scanForCandidateDocs(projectRoot);
  if (candidates.length === 0) return;

  console.log(`\n  📄  Found ${candidates.length} candidate spec document(s):\n`);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    console.log(`  [${i + 1}] ${c.file}  (${c.sizeKB}KB, ${c.reason})`);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  const raw = await prompt(rl, "  [a]bsorb all  [n]skip all  or numbers (e.g. 1,3,5): ");

  if (raw.toLowerCase() === "n" || raw === "") {
    rl.close();
    return;
  }

  let selected: Candidate[];

  if (raw.toLowerCase() === "a") {
    selected = candidates;
  } else {
    const indices = raw.split(",").map(s => parseInt(s.trim(), 10)).filter(n => n >= 1 && n <= candidates.length);
    selected = indices.map(n => candidates[n - 1]);
  }

  if (selected.length === 0) {
    rl.close();
    return;
  }

  console.log(`\n  Absorbing ${selected.length} document(s). Enter a feature ID for each:\n`);

  for (const c of selected) {
    const defaultId = slugify(path.basename(c.file));
    const id = await prompt(rl, `  Feature ID for "${c.file}" [${defaultId}]: `);
    const featureId = id || defaultId;

    if (!featureId) {
      console.log(`  ⚠  Skipping "${c.file}" — no valid feature ID\n`);
      continue;
    }

    absorbDocument(c.file, featureId, projectRoot);
  }

  rl.close();

  console.log(`\n  ✓  Absorbed ${selected.length} document(s) into specs/\n`);
  console.log("  Original files archived at .spec/absorbed/");
  console.log("  Run /spec-specify on each to fill in [TODO] sections.");
}

// ── Next steps ─────────────────────────────────────────────────────────────

export function printNextSteps(agent: AgentConfig, projectRoot: string): void {
  const sep = agent.separator;
  console.log(`
  ✓  Project initialized at ${projectRoot}
  ✓  AI agent: ${agent.name}
  ✓  11 skills → ${path.join(projectRoot, agent.dir)}
  ✓  6 document templates → ${path.join(projectRoot, ".spec/templates")}
  ✓  5 helper scripts → ${path.join(projectRoot, ".spec/scripts/bash")}

  Quick start — one command for the full cycle:
    /spec-autopilot "your feature description"

  Manual step-by-step (official order):
    1. /spec-constitution  → define project principles
    2. /spec-specify       → what & why
    3. /spec-clarify       → resolve ambiguities
    4. /spec-checklist     → validate requirements quality
    5. /spec-plan          → technical plan
    6. /spec-tasks         → task breakdown
    7. /spec-analyze       → cross-check consistency
    8. /spec-implement     → execute

  Bug fixes:
    /spec-fix "describe the bug"   → root cause analysis + fix + archive

  Lean: specify → plan → tasks → implement (skip quality gates)
`);
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function runInit(agent: AgentConfig, projectRoot: string): Promise<void> {
  // 1. Create project structure
  createProjectStructure(projectRoot);
  console.log("  ✓  Project structure created");

  // 2. Install skill templates
  const skills = installAllSkills(agent, projectRoot);
  console.log(`  ✓  ${skills.length} skill templates installed`);

  // 3. Install document templates
  const docTemplates = installDocumentTemplates(agent, projectRoot);
  console.log(`  ✓  ${docTemplates.length} document templates installed`);

  // 4. Install constitution to memory (only if absent)
  const constInstalled = installConstitutionToMemory(projectRoot);
  if (constInstalled) {
    console.log("  ✓  Constitution created at .spec/memory/constitution.md");
  }

  // 5. Install helper scripts
  const scripts = installScripts(projectRoot);
  console.log(`  ✓  ${scripts.length} helper scripts installed`);

  // 6. CLAUDE.md (Claude Code only)
  if (agent.key === "claude") {
    createCLAUDEmd(projectRoot);
    console.log("  ✓  CLAUDE.md created");
  }

  // 7. Absorb existing spec documents (interactive)
  await runAbsorbWorkflow(projectRoot);

  printNextSteps(agent, projectRoot);
}

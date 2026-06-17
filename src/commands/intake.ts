/**
 * Spec Coach — `intake` command group (document lifecycle, spec 005).
 *
 * Brings existing documents into the spec corpus. `scan` discovers candidates;
 * `process` absorbs each verbatim (→ `.spec/absorbed/`) or via the `spec-absorb`
 * SKILL (→ `specs/NNN-slug/`); `ignore` manages a skip list. Discovery is
 * deterministic and non-interactive — it NEVER blocks on stdin (closing the
 * spec 001 non-TTY class). Sources are never moved, renamed, or deleted.
 *
 * Agent-agnostic: operates on the project tree, not on any agent binding.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export type CandidateStatus =
  | "pending"
  | "absorbed-verbatim"
  | "absorb-ai-pending"
  | "absorbed-ai"
  | "ignored"
  | "source-missing";

export interface Candidate {
  /** POSIX-normalized (`/`-separated) source path, relative to project root. */
  path: string;
  /** sha256 of file contents — advisory, for change/dedup signaling. */
  hash: string;
  size: number;
  status: CandidateStatus;
  /** Corpus destination once absorbed. */
  destination?: string;
}

/** Command result — mirrors the `agents.ts` discriminated-union shape. */
export type CmdResult = { ok: true; message: string } | { ok: false; reason: string };

// ── Manifest store (.spec/intake/manifest.json) ────────────────────────────

const INTAKE_DIR = path.join(".spec", "intake");
const MANIFEST_REL = path.join(INTAKE_DIR, "manifest.json");

function manifestPath(projectRoot: string): string {
  return path.join(projectRoot, MANIFEST_REL);
}

/**
 * Read the staging manifest. Returns `[]` when the file is absent or unreadable
 * (callers treat absence as "nothing staged"). Never throws.
 */
export function readManifest(projectRoot: string): Candidate[] {
  const p = manifestPath(projectRoot);
  if (!fs.existsSync(p)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data && Array.isArray(data.candidates)) return data.candidates as Candidate[];
    return [];
  } catch {
    return [];
  }
}

/** Write the staging manifest (creates `.spec/intake/`). */
export function writeManifest(projectRoot: string, candidates: Candidate[]): void {
  const p = manifestPath(projectRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ candidates }, null, 2) + "\n", "utf-8");
}

// ── Ignore store (.spec/intake/ignore.json) ────────────────────────────────

const IGNORE_REL = path.join(INTAKE_DIR, "ignore.json");

function ignorePath(projectRoot: string): string {
  return path.join(projectRoot, IGNORE_REL);
}

/** Read the ignore list. Returns `[]` when absent/unreadable. Never throws. */
export function readIgnoreList(projectRoot: string): string[] {
  const p = ignorePath(projectRoot);
  if (!fs.existsSync(p)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (data && Array.isArray(data.patterns)) return data.patterns as string[];
    return [];
  } catch {
    return [];
  }
}

/** Write the ignore list (`{ patterns }`). */
export function writeIgnoreList(projectRoot: string, patterns: string[]): void {
  const p = ignorePath(projectRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ patterns }, null, 2) + "\n", "utf-8");
}

/**
 * True iff `relPath` equals a pattern OR lives under a pattern directory
 * (exact-path + directory-prefix match — zero-dependency, no glob). `relPath`
 * and `patterns` MUST be POSIX-normalized (`/`-separated) before matching so
 * the comparison is cross-platform consistent (advisory A5).
 */
export function isIgnored(relPath: string, patterns: string[]): boolean {
  return patterns.some((p) => relPath === p || relPath.startsWith(p + "/"));
}

// ── Discovery ───────────────────────────────────────────────────────────────
// Deterministic + non-interactive (no stdin — FR-003). Bounded to preset dirs
// (FR-005): project-root top-level files + docs/doc/design/spec/requirements,
// never a full recursive walk. Excludes corpus-internal and ignored paths.

export const PRESET_SCAN_DIRS = ["docs", "doc", "design", "spec", "requirements"];

const KEYWORDS = ["spec", "plan", "feature", "design", "requirement", "roadmap"];
const CONTENT_MARKERS = ["Overview", "User Story", "FR-", "## Requirements", "Acceptance"];

/** Normalize a platform path to POSIX forward-slashes (cross-platform — A5). */
function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** A path inside spec-coach's own corpus (never re-discovered). */
function isCorpusInternal(posixRel: string): boolean {
  return (
    posixRel === "specs" || posixRel.startsWith("specs/") ||
    posixRel === ".spec" || posixRel.startsWith(".spec/") ||
    posixRel === ".git" || posixRel.startsWith(".git/") ||
    posixRel.startsWith("node_modules/") || posixRel.includes("/node_modules/")
  );
}

/** A `.md` file is a candidate iff its path carries a keyword OR its content carries a marker (FR-001). */
function isCandidate(posixRel: string, content: string): boolean {
  const lower = posixRel.toLowerCase();
  if (KEYWORDS.some((k) => lower.includes(k))) return true;
  return CONTENT_MARKERS.some((m) => content.includes(m));
}

function toCandidate(abs: string, posixRel: string, content: string): Candidate {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  let size = content.length;
  try { size = fs.statSync(abs).size; } catch { /* fall back to content length */ }
  return { path: posixRel, hash, size, status: "pending" };
}

function walkMd(absDir: string, projectRoot: string, visit: (abs: string, rel: string) => void): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const abs = path.join(absDir, e.name);
    if (e.isDirectory()) walkMd(abs, projectRoot, visit);
    else if (e.isFile() && e.name.endsWith(".md")) visit(abs, toPosix(path.relative(projectRoot, abs)));
  }
}

/**
 * Discover candidate documents (FR-001/002/003/005). Returns a deterministic,
 * path-sorted list. Reads file contents only for `.md` files that survive the
 * corpus/ignore filters — never blocks on stdin.
 */
export function discoverCandidates(projectRoot: string, ignoreList: string[] = []): Candidate[] {
  const found: Candidate[] = [];
  const visit = (abs: string, rel: string): void => {
    if (!rel.endsWith(".md")) return;
    if (isCorpusInternal(rel) || isIgnored(rel, ignoreList)) return;
    let content: string;
    try { content = fs.readFileSync(abs, "utf-8"); } catch { return; }
    if (content.trim().length === 0) return; // empty file — nothing to absorb
    if (!isCandidate(rel, content)) return;
    found.push(toCandidate(abs, rel, content));
  };

  // Root: top-level files only (never descend into root subdirs here).
  try {
    for (const e of fs.readdirSync(projectRoot, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith(".md")) visit(path.join(projectRoot, e.name), e.name);
    }
  } catch { /* unreadable root — skip */ }

  for (const dir of PRESET_SCAN_DIRS) {
    walkMd(path.join(projectRoot, dir), projectRoot, visit);
  }

  return found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// ── Command handlers ───────────────────────────────────────────────────────

/** Statuses that are terminal w.r.t. discovery — once set, a re-scan must not re-surface the source (FR-013). */
const TERMINAL_STATUSES: ReadonlySet<CandidateStatus> = new Set([
  "absorbed-verbatim",
  "absorbed-ai",
  "absorb-ai-pending",
  "ignored",
]);

/**
 * `intake scan` (FR-004, FR-013): discover candidates and merge them into the
 * manifest, PRESERVING any entry whose status is terminal (absorbed/ignored),
 * marking genuinely-new paths `pending`, and pruning entries whose source has
 * vanished. Deterministic and non-interactive. Idempotent across re-runs.
 */
export function runIntakeScan(projectRoot: string): CmdResult {
  const ignoreList = readIgnoreList(projectRoot);
  const discovered = discoverCandidates(projectRoot, ignoreList);
  const prevByPath = new Map(readManifest(projectRoot).map((c) => [c.path, c]));

  const merged: Candidate[] = discovered.map((disc) => {
    const old = prevByPath.get(disc.path);
    if (old && TERMINAL_STATUSES.has(old.status)) {
      // keep the terminal status; refresh hash/size from the current source
      return { ...old, hash: disc.hash, size: disc.size };
    }
    return disc; // pending — new, or a non-terminal entry still awaiting action
  });
  merged.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  writeManifest(projectRoot, merged);

  const pending = merged.filter((c) => c.status === "pending").length;
  return {
    ok: true,
    message: `scan found ${discovered.length} candidate(s); ${pending} pending (${merged.length - pending} already absorbed/ignored).`,
  };
}

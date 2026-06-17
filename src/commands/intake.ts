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

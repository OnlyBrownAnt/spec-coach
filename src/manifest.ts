/**
 * Spec Coach — Agent manifest loader.
 *
 * Reads `agents.json` (the data-driven agent registry at the package root) and
 * validates each entry. Replaces the former hardcoded `AGENTS` enum so that
 * adding an AI tool is a data edit, not a code change (spec 003 FR-001/002/003).
 *
 * Self-contained: computes its own package root from import.meta.url to avoid an
 * import cycle with utils.ts (which will import loadManifest in T004).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type AgentFormat = "skills" | "markdown";

export interface AgentEntry {
  key: string;
  name: string;
  dir: string;
  format: AgentFormat;
  separator: string;
  frontmatter: Record<string, string | boolean>;
  contextFile: string;
  version: string;
  argumentHints?: Record<string, string>;
}

/** Thrown when a manifest entry is malformed (FR-015 — specific, actionable). */
export class ManifestError extends Error {
  constructor(
    public readonly entryKey: string | null,
    message: string,
  ) {
    super(message);
    this.name = "ManifestError";
  }
}

const MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "agents.json",
);

interface ManifestFile {
  schema_version?: string;
  agents: Record<string, unknown>;
}

const REQUIRED_STRING_FIELDS = ["name", "dir", "contextFile", "version"] as const;

/**
 * Validate a single manifest entry. Throws ManifestError naming the offending
 * field/entry if anything is missing or the format is unknown (FR-015).
 */
export function validateAgentEntry(entry: unknown, expectedKey?: string): AgentEntry {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new ManifestError(expectedKey ?? null, "entry must be an object");
  }
  const e = entry as Record<string, unknown>;

  const key = e.key;
  if (typeof key !== "string" || key.length === 0) {
    throw new ManifestError(expectedKey ?? null, "missing or empty 'key'");
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof e[field] !== "string" || (e[field] as string).length === 0) {
      throw new ManifestError(key, `missing or empty '${field}'`);
    }
  }

  if (e.format !== "skills" && e.format !== "markdown") {
    throw new ManifestError(
      key,
      `invalid 'format' (must be 'skills' or 'markdown'), got ${JSON.stringify(e.format)}`,
    );
  }

  if (typeof e.separator !== "string" || e.separator.length === 0) {
    throw new ManifestError(key, "missing or empty 'separator'");
  }

  if (typeof e.frontmatter !== "object" || e.frontmatter === null || Array.isArray(e.frontmatter)) {
    throw new ManifestError(key, "'frontmatter' must be an object");
  }

  return entry as unknown as AgentEntry;
}

/**
 * Load and validate the agent manifest. Returns every entry as a validated
 * AgentEntry. Throws ManifestError on missing file, bad JSON, or any invalid
 * entry (FR-001/002/003).
 */
export function loadManifest(manifestPath: string = MANIFEST_PATH): AgentEntry[] {
  if (!fs.existsSync(manifestPath)) {
    throw new ManifestError(null, `agents.json not found at ${manifestPath}`);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(manifestPath, "utf-8");
  } catch (err) {
    throw new ManifestError(null, `cannot read agents.json: ${(err as Error).message}`);
  }

  let data: ManifestFile;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new ManifestError(null, `agents.json is not valid JSON: ${(err as Error).message}`);
  }

  if (typeof data !== "object" || data === null || typeof data.agents !== "object" || data.agents === null) {
    throw new ManifestError(null, "agents.json missing 'agents' object");
  }

  return Object.entries(data.agents).map(([key, val]) => validateAgentEntry(val, key));
}

/** Look up a single validated agent entry by key. Returns null if not found. */
export function findAgentEntry(key: string, manifestPath?: string): AgentEntry | null {
  return loadManifest(manifestPath).find((e) => e.key === key) ?? null;
}

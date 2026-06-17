// Mechanical test for spec 005 — document intake pipeline.
// Grows task-by-task: T002 manifest store, T003 ignore store, T004 discovery, etc.
// Run: npx tsx tests/units/intake.test.ts
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  readManifest,
  writeManifest,
  readIgnoreList,
  writeIgnoreList,
  isIgnored,
  discoverCandidates,
  type Candidate,
} from "../../src/commands/intake.ts";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { pass++; console.log("  [PASS]", name); }
  else { fail++; console.log("  [FAIL]", name); }
}

const tmpDirs: string[] = [];
function mktmp(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
function write(root: string, rel: string, content: string): void {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

console.log("=== intake.test (spec 005) ===");

try {
  // ── T002: manifest store ─────────────────────────────────────────────────
  const t = mktmp("intake-man-");
  ok("T002: absent manifest -> []", readManifest(t).length === 0);
  const cands: Candidate[] = [
    { path: "docs/old.md", hash: "abc", size: 10, status: "pending" },
    { path: "design/arch.md", hash: "def", size: 20, status: "absorbed-verbatim", destination: ".spec/absorbed/arch.md" },
  ];
  writeManifest(t, cands);
  const back = readManifest(t);
  ok("T002: round-trip preserves count", back.length === 2);
  ok("T002: round-trip preserves path", back[0].path === "docs/old.md");
  ok("T002: round-trip preserves status", back[1].status === "absorbed-verbatim");
  ok("T002: round-trip preserves destination", back[1].destination === ".spec/absorbed/arch.md");
  ok("T002: manifest file written to .spec/intake/", fs.existsSync(path.join(t, ".spec/intake/manifest.json")));

  // ── T003: ignore store + isIgnored ───────────────────────────────────────
  const ig = mktmp("intake-ign-");
  ok("T003: absent ignore list -> []", readIgnoreList(ig).length === 0);
  writeIgnoreList(ig, ["docs/noise.md", "vendor"]);
  ok("T003: round-trip patterns", JSON.stringify(readIgnoreList(ig)) === JSON.stringify(["docs/noise.md", "vendor"]));
  ok("T003: ignore file written to .spec/intake/", fs.existsSync(path.join(ig, ".spec/intake/ignore.json")));
  ok("T003: isIgnored exact match", isIgnored("docs/noise.md", ["docs/noise.md", "vendor"]));
  ok("T003: isIgnored dir-prefix match", isIgnored("vendor/extra.md", ["docs/noise.md", "vendor"]));
  ok("T003: isIgnored no false positive", !isIgnored("docs/real-spec.md", ["docs/noise.md", "vendor"]));
  ok("T003: isIgnored empty list matches nothing", !isIgnored("anything.md", []));

  // ── T004: discovery (deterministic, non-interactive, bounded) ────────────
  const d = mktmp("intake-disc-");
  write(d, "docs/old-spec.md", "# Old Spec\nOverview here\n");
  write(d, "design/arch.md", "# Architecture\n## Requirements\n");
  write(d, "docs/random.md", "just some notes with no markers\n");
  write(d, ".spec/internal.md", "# spec internal\nOverview\n");
  write(d, "specs/005/spec.md", "# spec\nOverview\n");
  write(d, "node_modules/pkg/spec.md", "# pkg spec\nOverview\n");

  const found = discoverCandidates(d, []);
  const paths = found.map((c) => c.path).sort();
  ok("T004: discovers docs/old-spec.md", paths.includes("docs/old-spec.md"));
  ok("T004: discovers design/arch.md", paths.includes("design/arch.md"));
  ok("T004: count is exactly the 2 real candidates", found.length === 2);
  ok("T004: excludes corpus-internal .spec/", !paths.includes(".spec/internal.md"));
  ok("T004: excludes corpus specs/", !paths.some((p) => p.startsWith("specs/")));
  ok("T004: excludes node_modules (bounded — no full walk)", !paths.some((p) => p.includes("node_modules/")));
  ok("T004: excludes non-matching docs/random.md", !paths.includes("docs/random.md"));
  ok("T004: all candidates pending", found.every((c) => c.status === "pending"));
  ok("T004: hash populated (sha256 hex)", found.every((c) => c.hash.length === 64));
  ok("T004: size populated", found.every((c) => c.size > 0));
  ok("T004: paths are POSIX-normalized", found.every((c) => !c.path.includes("\\")));

  // ignored path is excluded; others still found
  write(d, "docs/ignore-me.md", "# ignore\nOverview\n");
  const candsIgn = discoverCandidates(d, ["docs/ignore-me.md"]);
  ok("T004: ignored path excluded", !candsIgn.map((c) => c.path).includes("docs/ignore-me.md"));
  ok("T004: ignored scan still finds others", candsIgn.length === 2);

  // empty .md is skipped even if its name carries a keyword
  write(d, "docs/empty-spec.md", "");
  ok("T004: empty .md skipped", !discoverCandidates(d, []).map((c) => c.path).includes("docs/empty-spec.md"));
} catch (e) {
  ok("intake ran without throwing", false);
  console.log("    error:", (e as Error).message);
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran assertions");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);

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
  runIntakeScan,
  runIntakeProcess,
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

  // ── T005: runIntakeScan (idempotent merge) ───────────────────────────────
  const s = mktmp("intake-scan-");
  write(s, "docs/a-spec.md", "# A\nOverview\n");
  write(s, "docs/b-spec.md", "# B\nOverview\n");
  const r1 = runIntakeScan(s);
  ok("T005: scan returns ok", r1.ok === true);
  const m1 = readManifest(s);
  ok("T005: scan stages 2 pending", m1.length === 2 && m1.every((c) => c.status === "pending"));

  // simulate one already absorbed, then add a new doc + re-scan (idempotent)
  writeManifest(s, m1.map((c) => c.path === "docs/a-spec.md" ? { ...c, status: "absorbed-verbatim", destination: ".spec/absorbed/a-spec.md" } : c));
  write(s, "docs/c-spec.md", "# C\nOverview\n");
  runIntakeScan(s);
  const m2 = readManifest(s);
  ok("T005: re-scan keeps absorbed entry absorbed", m2.find((c) => c.path === "docs/a-spec.md")?.status === "absorbed-verbatim");
  ok("T005: re-scan surfaces new doc as pending", m2.find((c) => c.path === "docs/c-spec.md")?.status === "pending");
  ok("T005: re-scan manifest has 3 entries", m2.length === 3);

  // vanished source is pruned
  fs.rmSync(path.join(s, "docs/b-spec.md"));
  runIntakeScan(s);
  const m3 = readManifest(s);
  ok("T005: vanished source pruned on re-scan", !m3.some((c) => c.path === "docs/b-spec.md"));

  // ── T006: verbatim absorb (FR-006/007, +A3 source-missing) ───────────────
  const v = mktmp("intake-verb-");
  write(v, "docs/a-spec.md", "# A body\nOverview\n");
  write(v, "docs/b-spec.md", "# B body\nOverview\n");
  runIntakeScan(v);
  const before = fs.readFileSync(path.join(v, "docs/a-spec.md"), "utf-8");
  const rv = runIntakeProcess(v, { mode: "verbatim", target: "all" });
  ok("T006: verbatim returns ok", rv.ok === true);
  const mv = readManifest(v);
  ok("T006: all pending -> absorbed-verbatim", mv.filter((c) => c.status === "absorbed-verbatim").length === 2);
  const aEntry = mv.find((c) => c.path === "docs/a-spec.md");
  ok("T006: destination recorded", !!aEntry?.destination?.startsWith(".spec/absorbed/"));
  const destAbs = path.join(v, aEntry!.destination!);
  ok("T006: verbatim copy is byte-identical", fs.existsSync(destAbs) && fs.readFileSync(destAbs, "utf-8") === before);
  ok("T006: source unchanged in place", fs.readFileSync(path.join(v, "docs/a-spec.md"), "utf-8") === before);

  // single target
  const v2 = mktmp("intake-verb2-");
  write(v2, "docs/x-spec.md", "# X\nOverview\n");
  write(v2, "docs/y-spec.md", "# Y\nOverview\n");
  runIntakeScan(v2);
  runIntakeProcess(v2, { mode: "verbatim", target: "docs/x-spec.md" });
  const mv2 = readManifest(v2);
  ok("T006: single target absorbed", mv2.find((c) => c.path === "docs/x-spec.md")?.status === "absorbed-verbatim");
  ok("T006: non-target stays pending", mv2.find((c) => c.path === "docs/y-spec.md")?.status === "pending");

  // A3: source vanished between scan and process — no crash, marked source-missing
  const v3 = mktmp("intake-verb3-");
  write(v3, "docs/gone-spec.md", "# G\nOverview\n");
  write(v3, "docs/keep-spec.md", "# K\nOverview\n");
  runIntakeScan(v3);
  fs.rmSync(path.join(v3, "docs/gone-spec.md"));
  let threw = false;
  try { runIntakeProcess(v3, { mode: "verbatim", target: "all" }); } catch { threw = true; }
  ok("T006: missing source does not throw (A3)", !threw);
  const mv3 = readManifest(v3);
  ok("T006: missing source marked source-missing (A3)", mv3.find((c) => c.path === "docs/gone-spec.md")?.status === "source-missing");
  ok("T006: present source still absorbed alongside missing (A3)", mv3.find((c) => c.path === "docs/keep-spec.md")?.status === "absorbed-verbatim");

  // no manifest
  const v4 = mktmp("intake-verb4-");
  ok("T006: no manifest -> not ok", runIntakeProcess(v4, { mode: "verbatim", target: "all" }).ok === false);
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

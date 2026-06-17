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
  runIntakeIgnore,
  sanitizeSlug,
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

  // ── T008 / SC-001 + SC-002: scan→verbatim end-to-end (US1 capstone) ───────
  // Running headlessly here IS the FR-003/017 non-TTY proof (no blocking stdin).
  const cap = mktmp("intake-cap-");
  write(cap, "docs/old-spec.md", "# Old\nOverview body\n");
  write(cap, "design/arch.md", "# Arch\n## Requirements\n");
  write(cap, ".spec/internal.md", "# spec\nOverview\n");   // corpus-internal
  write(cap, "specs/005/spec.md", "# spec\nOverview\n");   // corpus
  write(cap, "node_modules/pkg.md", "# spec\nOverview\n");  // bounded out
  write(cap, "docs/noise.md", "# noise\nOverview\n");       // stays pending

  const scanRes = runIntakeScan(cap);
  ok("SC-001: scan ok + non-blocking (ran headlessly)", scanRes.ok === true);
  const capPaths = readManifest(cap).map((c) => c.path).sort();
  ok("SC-001: exact candidate set (corpus/bounded excluded)", JSON.stringify(capPaths) === JSON.stringify(["design/arch.md", "docs/noise.md", "docs/old-spec.md"]));

  const oldBefore = fs.readFileSync(path.join(cap, "docs/old-spec.md"), "utf-8");
  runIntakeProcess(cap, { mode: "verbatim", target: "docs/old-spec.md" });
  const afterVerb = readManifest(cap).find((c) => c.path === "docs/old-spec.md");
  const destCap = path.join(cap, afterVerb!.destination!);
  ok("SC-002: verbatim copy byte-identical", fs.readFileSync(destCap, "utf-8") === oldBefore);
  ok("SC-002: source preserved in place", fs.readFileSync(path.join(cap, "docs/old-spec.md"), "utf-8") === oldBefore);

  // idempotent re-scan: absorbed stays absorbed; others pending
  runIntakeScan(cap);
  const reM = readManifest(cap);
  ok("SC-001: re-scan keeps absorbed entry absorbed", reM.find((c) => c.path === "docs/old-spec.md")?.status === "absorbed-verbatim");
  ok("SC-001: re-scan keeps untouched entries pending", ["design/arch.md", "docs/noise.md"].every((p) => reM.find((c) => c.path === p)?.status === "pending"));

  // ── T009: sanitizeSlug (kebab + unique within specs/) ────────────────────
  const sl = mktmp("intake-slug-");
  ok("T009: kebab-case normalization", sanitizeSlug("My Design Doc!", sl) === "my-design-doc");
  ok("T009: collapses separators", sanitizeSlug("A   B/C", sl) === "a-b-c");
  ok("T009: empty -> spec fallback", sanitizeSlug("!!!", sl) === "spec");
  fs.mkdirSync(path.join(sl, "specs", "a-b"), { recursive: true });
  ok("T009: unique within specs/ (suffix on clash)", sanitizeSlug("A B", sl) === "a-b-2");

  // ── T010: --ai staging (FR-008, +A2 scan-completion flip) ────────────────
  const a = mktmp("intake-ai-");
  write(a, "docs/rough-design.md", "# Rough\nOverview\n");
  runIntakeScan(a);
  const rai = runIntakeProcess(a, { mode: "ai", target: "all" });
  ok("T010: ai staging returns ok", rai.ok === true);
  const aiMsg = rai.ok === true ? rai.message : "";
  ok("T010: message instructs the spec-absorb skill", aiMsg.includes("spec-absorb"));
  const entry = readManifest(a).find((c) => c.path === "docs/rough-design.md");
  ok("T010: entry marked absorb-ai-pending", entry?.status === "absorb-ai-pending");
  ok("T010: destination records specs/<slug>", !!entry?.destination?.startsWith("specs/"));
  ok("T010: CLI wrote NO spec artifact (zero transform code, FR-008)", !fs.existsSync(path.join(a, "specs")));

  // A2: scan flips absorb-ai-pending -> absorbed-ai once the spec-absorb skill writes the spec
  const slug = entry!.destination!;
  fs.mkdirSync(path.join(a, slug), { recursive: true });
  fs.writeFileSync(path.join(a, slug, "spec.md"), "# transformed by the skill\n");
  runIntakeScan(a);
  ok("T010/A2: scan flips to absorbed-ai when the spec appears", readManifest(a).find((c) => c.path === "docs/rough-design.md")?.status === "absorbed-ai");

  // ── T012 / SC-003: AI transform is coached by the skill, not coded in the CLI ─
  // A1: SC-003's "produces a conformant spec" half is AI-suite territory and is
  // NOT headlessly testable here (npm test is AI-driven). We assert the verifiable
  // half: the CLI contains no transformation logic and stages via the skill.
  const intakeSrc = fs.readFileSync(path.join(process.cwd(), "src", "commands", "intake.ts"), "utf-8");
  ok("SC-003: CLI has no spec-template rendering (transform is the skill's job)", !intakeSrc.includes("spec-template"));
  ok("SC-003: CLI has no document-template install call", !intakeSrc.includes("installDocumentTemplates"));

  const cap3 = mktmp("intake-sc3-");
  write(cap3, "docs/plan.md", "# Plan\nOverview\n");
  runIntakeScan(cap3);
  const rsc3 = runIntakeProcess(cap3, { mode: "ai", target: "all" });
  ok("SC-003: ai staging marks absorb-ai-pending", readManifest(cap3).find((c) => c.path === "docs/plan.md")?.status === "absorb-ai-pending");
  ok("SC-003: ai staging message names the spec-absorb skill", (rsc3.ok === true ? rsc3.message : "").includes("spec-absorb"));

  // ── T013: process --ignore (FR-011) ──────────────────────────────────────
  const igp = mktmp("intake-ign-proc-");
  write(igp, "docs/a-spec.md", "# A\nOverview\n");
  write(igp, "docs/b-spec.md", "# B\nOverview\n");
  runIntakeScan(igp);
  runIntakeProcess(igp, { mode: "ignore", target: "docs/b-spec.md" });
  const mig = readManifest(igp);
  ok("T013: ignored entry marked ignored", mig.find((c) => c.path === "docs/b-spec.md")?.status === "ignored");
  ok("T013: other entry stays pending", mig.find((c) => c.path === "docs/a-spec.md")?.status === "pending");
  ok("T013: path added to ignore list", readIgnoreList(igp).includes("docs/b-spec.md"));
  // idempotent union: ignoring again does not duplicate the pattern
  runIntakeProcess(igp, { mode: "ignore", target: "all" });
  ok("T013: ignore is idempotent union (no duplicate pattern)", readIgnoreList(igp).filter((p) => p === "docs/b-spec.md").length === 1);

  // ── T014: runIntakeIgnore (list/add/remove, FR-012) ──────────────────────
  const it = mktmp("intake-ignore-");
  ok("T014: list on empty -> ok", runIntakeIgnore(it, "list").ok === true);
  runIntakeIgnore(it, "add", "docs/noise.md");
  runIntakeIgnore(it, "add", "vendor");
  ok("T014: add persists patterns", readIgnoreList(it).length === 2);
  const listRes = runIntakeIgnore(it, "list");
  ok("T014: list message shows a pattern", listRes.ok === true && listRes.message.includes("docs/noise.md"));
  runIntakeIgnore(it, "add", "docs/noise.md");
  ok("T014: add is idempotent", readIgnoreList(it).length === 2);
  runIntakeIgnore(it, "remove", "vendor");
  ok("T014: remove drops the pattern", !readIgnoreList(it).includes("vendor"));
  ok("T014: add without pattern -> not ok", runIntakeIgnore(it, "add").ok === false);
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

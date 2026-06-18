// Mechanical tests for the configurable commit convention layer (spec 010).
// T002: init seeds .spec/convention.md (TEMPLATE); init AND update never
// clobber an AUTHORED convention (the spec 009 never-clobber invariant,
// FR-007, extended to the convention — FR-001; analysis A2 locks the update
// half). Drives the TS installer from node:assert in mkdtemp repos.
// Run: npx tsx tests/units/commit-convention.test.ts
//
// Later tasks (T003–T007) append their own labeled blocks above the final
// cleanup + results at the bottom of this file.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
import { runInit } from "../../src/commands/init.ts";
import { runUpdate } from "../../src/commands/update.ts";
import { runUninstall } from "../../src/commands/uninstall.ts";

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

const REPO = path.resolve(import.meta.dirname, "..", "..");
const conv = (root: string): string => path.join(root, ".spec", "convention.md");

// An AUTHORED convention: a real rules block + no signature tokens (the
// TEMPLATE's [PROJECT_NAME]/[ALLOWED_TYPES]/[SCOPE_FORMAT] are gone).
const AUTHORED_CONVENTION = `# Project Commit Convention

We use Conventional Commits.

<!-- CONVENTION RULES START
allowed_types: feat fix docs refactor test chore
scope_required: false
task_id_footer: optional
CONVENTION RULES END -->

**Version**: 1.0.0
`;

function writeAuthoredConvention(root: string): void {
  fs.mkdirSync(path.join(root, ".spec"), { recursive: true });
  fs.writeFileSync(conv(root), AUTHORED_CONVENTION);
}

// ─── T002: seed + never-clobber ─────────────────────────────────────────────
console.log("=== commit-convention.test (T002: seed + never-clobber) ===");
try {
  // (a) init seeds .spec/convention.md in TEMPLATE state.
  const a = mktmp("cc-seed-");
  await runInit(a);
  ok("(a) init seeds .spec/convention.md", fs.existsSync(conv(a)));
  ok("(a) seeded convention is TEMPLATE (signature token present)",
    /\[ALLOWED_TYPES\]/.test(fs.readFileSync(conv(a), "utf8")));

  // (b) init never clobbers an AUTHORED convention (FR-001 never-clobber).
  const b = mktmp("cc-init-nc-");
  writeAuthoredConvention(b);
  const before = fs.readFileSync(conv(b), "utf8");
  await runInit(b);
  const after = fs.readFileSync(conv(b), "utf8");
  ok("(b) init never clobbers an AUTHORED convention", before === after);

  // (c) update never clobbers an AUTHORED convention (analysis A2).
  const c = mktmp("cc-upd-nc-");
  await runInit(c);
  writeAuthoredConvention(c);
  const beforeU = fs.readFileSync(conv(c), "utf8");
  await runUpdate(c);
  const afterU = fs.readFileSync(conv(c), "utf8");
  ok("(c) update never clobbers an AUTHORED convention", beforeU === afterU);
} catch (e) {
  ok("T002 block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

// ─── (later task blocks T003–T007 are inserted here) ────────────────────────

// ─── T004: skill + tasks-template coaching conforms (FR-003) ────────────────
console.log("=== commit-convention.test (T004: skill coaching conforms) ===");
try {
  const skill = fs.readFileSync(path.join(REPO, "skills", "implement.md"), "utf8");
  ok("implement.md references .spec/convention.md (source of truth)", /convention\.md/.test(skill));
  ok("implement.md coaches the Task: Txxx trailer fold-in", /Task: Txxx/.test(skill));
  ok("implement.md coaches Conventional Commits", /Conventional Commits/i.test(skill));
  ok("implement.md names the allowed types (feat + chore)", /feat/.test(skill) && /chore/.test(skill));
  ok("implement.md no longer coaches bare 'Commit with the task ID'", !/Commit with the task ID/.test(skill));

  const tasksTpl = fs.readFileSync(path.join(REPO, "templates", "tasks-template.md"), "utf8");
  ok("tasks-template.md is convention-aware (references convention.md)", /convention\.md/.test(tasksTpl));
} catch (e) {
  ok("T004 block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

// ─── T003: status-aware uninstall preserve (FR-001 charter-as-IP) ───────────
console.log("=== commit-convention.test (T003: uninstall preserve) ===");
try {
  // (a) AUTHORED convention PRESERVED on plain uninstall (project IP).
  const u1 = mktmp("cc-un-auth-");
  await runInit(u1);
  writeAuthoredConvention(u1);
  runUninstall(u1, { confirmed: true });
  ok("AUTHORED convention PRESERVED on plain uninstall", fs.existsSync(conv(u1)));

  // (b) TEMPLATE convention (init-seeded) removed on plain uninstall (tooling).
  const u2 = mktmp("cc-un-tpl-");
  await runInit(u2);
  runUninstall(u2, { confirmed: true });
  ok("TEMPLATE convention removed on plain uninstall (tooling)", !fs.existsSync(conv(u2)));

  // (c) --force/purge removes even an AUTHORED convention.
  const u3 = mktmp("cc-un-purge-");
  await runInit(u3);
  writeAuthoredConvention(u3);
  runUninstall(u3, { confirmed: true, purge: true });
  ok("purge removes AUTHORED convention", !fs.existsSync(conv(u3)));
} catch (e) {
  ok("T003 block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

// ─── T005: verify-commit.sh advisor (FR-004; A1 custom-type; A3 git -C) ─────
console.log("=== commit-convention.test (T005: verify-commit.sh advisor) ===");
{
  const ADVISOR = path.join(REPO, ".spec", "scripts", "bash", "verify-commit.sh");
  function gitRepo(prefix: string): string {
    const d = mktmp(prefix);
    execSync("git init -q", { cwd: d });
    execSync("git config user.email t@t.tt", { cwd: d });
    execSync("git config user.name t", { cwd: d });
    fs.mkdirSync(path.join(d, ".spec"), { recursive: true }); // get_repo_root marker
    return d;
  }
  function commit(repo: string, subject: string): void {
    execSync(`git commit -q --allow-empty -m "${subject}"`, { cwd: repo });
  }
  function merge(repo: string): void {
    const br = execSync("git symbolic-ref --short HEAD", { cwd: repo, encoding: "utf8" }).trim();
    execSync("git checkout -q -b side", { cwd: repo });
    commit(repo, "side: a change");
    execSync(`git checkout -q ${br}`, { cwd: repo });
    execSync(`git merge --no-ff -q side -m "Merge branch 'side'"`, { cwd: repo });
  }
  function authoredWith(repo: string, allowedTypes: string): void {
    fs.writeFileSync(path.join(repo, ".spec", "convention.md"),
      `# Proj Commit Convention\n\n<!-- CONVENTION RULES START\nallowed_types: ${allowedTypes}\nscope_format: any\ntask_id_footer: optional\nCONVENTION RULES END -->\n`);
  }
  function advise(repo: string, rev?: string): string {
    try {
      return execSync(`bash "${ADVISOR}"${rev ? ` "${rev}"` : ""}`, { cwd: repo, encoding: "utf8" });
    } catch { return " ERR"; }
  }

  try {
    // (a) AUTHORED + default types + feat(x): y -> CONFORMING.
    const a = gitRepo("cc-adv-conf-"); authoredWith(a, "feat fix docs refactor test chore");
    commit(a, "feat(x): y");
    ok("(a) feat(x): y -> CONFORMING", /CONFORMING/.test(advise(a)));

    // (b) AUTHORED + default + T001: foo -> NON-CONFORMING.
    const b = gitRepo("cc-adv-bad-"); authoredWith(b, "feat fix docs refactor test chore");
    commit(b, "T001: foo");
    ok("(b) T001: foo -> NON-CONFORMING", /NON-CONFORMING/.test(advise(b)));

    // (c) merge commit -> SKIP.
    const c = gitRepo("cc-adv-merge-"); authoredWith(c, "feat fix docs refactor test chore");
    commit(c, "chore: init"); merge(c);
    ok("(c) merge commit -> SKIP", /SKIP/.test(advise(c)));

    // (d) ABSENT convention -> reports ABSENT + coaches default; exit 0.
    const d = gitRepo("cc-adv-absent-"); commit(d, "feat: ok");
    const od = advise(d);
    ok("(d) ABSENT convention reported", /Convention state: ABSENT/.test(od));
    let dExit = 0;
    try { execSync(`bash "${ADVISOR}"`, { cwd: d, stdio: "ignore" }); } catch (e: unknown) { dExit = (e as { status?: number }).status ?? 1; }
    ok("(d) advisor exits 0 on ABSENT", dExit === 0);

    // (e) TEMPLATE convention -> reports TEMPLATE, uses default.
    const e = gitRepo("cc-adv-tpl-");
    fs.copyFileSync(path.join(REPO, "templates", "convention-template.md"), path.join(e, ".spec", "convention.md"));
    commit(e, "feat: ok");
    ok("(e) TEMPLATE convention reported", /Convention state: TEMPLATE/.test(advise(e)));

    // (f) A1: custom allowed_types honored — build: foo CONFORMING; feat: foo NON-CONFORMING.
    const f = gitRepo("cc-adv-cust1-"); authoredWith(f, "build deploy"); commit(f, "build: foo");
    ok("(f) custom: build: foo -> CONFORMING (A1)", /CONFORMING/.test(advise(f)));
    const g = gitRepo("cc-adv-cust2-"); authoredWith(g, "build deploy"); commit(g, "feat: foo");
    ok("(f) custom: feat: foo -> NON-CONFORMING (A1)", /NON-CONFORMING/.test(advise(g)));
  } catch (e) {
    ok("T005 block ran without throwing", false);
    console.log("    error:", (e as Error).message);
  }
}

// ─── T007: FR-005 state-boundary guardrail (A5: per-function body extraction) ─
console.log("=== commit-convention.test (T007: FR-005 guardrail) ===");
try {
  const commonSh = path.join(REPO, "scripts", "bash", "common.sh");
  const src = fs.readFileSync(commonSh, "utf8");

  // Extract a function's body: from `fn() {` to the next column-1 `}`. Per-body
  // extraction (analysis A5) — NOT a whole-file grep — so verify-commit.sh's
  // legitimate `git log` (which checks FORMAT, never feeds a state function) is
  // not flagged.
  function functionBody(fn: string): string {
    const lines = src.split("\n");
    const start = lines.findIndex((l) => new RegExp(`^${fn}\\s*\\(\\)`).test(l));
    if (start === -1) return "";
    const body: string[] = [];
    for (let i = start; i < lines.length; i++) {
      body.push(lines[i]);
      if (i > start && /^\}/.test(lines[i])) break;
    }
    return body.join("\n");
  }

  for (const fn of ["resolve_feature", "infer_phase", "first_pending_task", "get_feature_paths"]) {
    const body = functionBody(fn);
    ok(`FR-005: ${fn}() body found`, body.length > 0);
    // Forbid any git-log form (bare `git log` OR scoped `git -C … log`) in state
    // functions — commits are NOT a state source (spec 008). Does NOT flag
    // `git symbolic-ref` / `git rev-parse` (branch-name resolution, allowed).
    ok(`FR-005: ${fn}() does not read commit messages (no git-log)`, !/git\b.*\blog\b/.test(body));
  }

  // Confirm the guardrail is scoped, not a blanket ban: verify-commit.sh DOES
  // access commit history (legitimately — format check, never state).
  const advisor = fs.readFileSync(path.join(REPO, "scripts", "bash", "verify-commit.sh"), "utf8");
  ok("guardrail scoped: verify-commit.sh legitimately reads commit history (format, not state)", /git\b.*\blog\b/.test(advisor));
} catch (e) {
  ok("T007 block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

// ─── T006: dogfood convention + constitution amendment (FR-006) ─────────────
console.log("=== commit-convention.test (T006: dogfood + constitution) ===");
try {
  const convBody = fs.readFileSync(path.join(REPO, ".spec", "convention.md"), "utf8");
  ok("spec-coach's .spec/convention.md is AUTHORED (no signature tokens)",
    !/\[(PROJECT_NAME|ALLOWED_TYPES|SCOPE_FORMAT)\]/.test(convBody));
  ok("spec-coach's convention declares Conventional + Task footer",
    /Conventional Commits/.test(convBody) && /Task: T/.test(convBody));

  const con = fs.readFileSync(path.join(REPO, ".spec", "memory", "constitution.md"), "utf8");
  ok("constitution delegates commit style to .spec/convention.md",
    /\.spec\/convention\.md/.test(con) && /Commit convention/.test(con));
  ok("constitution footer is v1.6.0", /\*\*Version\*\*:\s*1\.6\.0/.test(con));

  // verify-constitution-sync.sh reports CLEAN (no pending amendment block).
  const cadv = execSync(
    `bash "${path.join(REPO, ".spec", "scripts", "bash", "verify-constitution-sync.sh")}"`,
    { cwd: REPO, encoding: "utf8" },
  );
  ok("verify-constitution-sync.sh reports CLEAN on the amended constitution", /CLEAN/.test(cadv));
} catch (e) {
  ok("T006 block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

// ─── cleanup + results ──────────────────────────────────────────────────────
for (const d of tmpDirs) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);

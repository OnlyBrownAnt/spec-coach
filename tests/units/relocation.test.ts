// Relocation pins (spec 006): confirm the moved/deduped symbols resolve from
// their new single homes. Characterization, not behavior — the full suite is the
// real regression net. Run: npx tsx tests/units/relocation.test.ts
import assert from "node:assert/strict";
import type { CmdResult } from "../../src/result.ts";
import { ensureState, corpusExists } from "../../src/state.ts";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { pass++; console.log("  [PASS]", name); }
  else { fail++; console.log("  [FAIL]", name); }
}

console.log("=== relocation.test (spec 006) ===");

try {
  // CmdResult — single source of truth in src/result.ts (was duplicated in agents.ts + intake.ts)
  const okResult: CmdResult = { ok: true, message: "done" };
  const errResult: CmdResult = { ok: false, reason: "nope" };
  ok("CmdResult ok-branch carries message", okResult.ok === true && okResult.message === "done");
  ok("CmdResult error-branch carries reason", errResult.ok === false && errResult.reason === "nope");

  // ensureState + corpusExists — now exported from state.ts (was agents.ts)
  ok("ensureState is a function (from state.ts)", typeof ensureState === "function");
  ok("corpusExists is a function (from state.ts)", typeof corpusExists === "function");
} catch (e) {
  ok("relocation ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

assert.ok(pass > 0, "test ran assertions");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);

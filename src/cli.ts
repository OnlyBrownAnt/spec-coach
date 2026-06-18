#!/usr/bin/env -S npx tsx
/**
 * Spec Coach — SDD that trusts AI.
 *
 * Two isolated command surfaces (spec 003) + document lifecycle (spec 005):
 *   Corpus lifecycle:   init | update | uninstall
 *   Agent lifecycle:    agents { list | add | update | remove }
 *   Document lifecycle: intake { scan | process | ignore }
 *
 * Usage:
 *   spec-coach init                       # scaffold the spec corpus
 *   spec-coach agents add claude          # bind an AI tool (skills + context)
 *   spec-coach agents list                # available + installed
 *   spec-coach update                     # refresh corpus templates/scripts
 *   spec-coach agents update --all        # refresh agent bindings
 *   spec-coach uninstall --yes            # remove spec-coach (preserves specs/)
 */

import * as fs from "node:fs";
import { runInit } from "./commands/init.js";
import { runUpdate } from "./commands/update.js";
import { runUninstall } from "./commands/uninstall.js";
import { runAgentsList, runAgentsAdd, runAgentsUpdate, runAgentsRemove } from "./commands/agents.js";
import { runIntakeScan, runIntakeProcess, runIntakeIgnore } from "./commands/intake.js";

// ── Banner ─────────────────────────────────────────────────────────────────

const BANNER = `
  ╔══════════════════════════════════════════╗
  ║  🏈  Spec Coach — Your SDD copilot     ║
  ║  Guidance over gates.                   ║
  ║  Craftsmanship over compliance.         ║
  ╚══════════════════════════════════════════╝
`;

// ── Help ───────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`Spec Coach — SDD that trusts AI.

Corpus lifecycle (the durable product):
  init                           Scaffold the spec corpus (templates, scripts,
                                 constitution). Installs no agent.
  update                         Refresh corpus templates + scripts.
  uninstall --yes [--force]      Remove spec-coach infrastructure + agent
                                 bindings + constitution (regenerable tooling).
                                 --force also purges specs/ (user content).

Agent lifecycle (ephemeral bindings):
  agents list                    Show available + installed agents.
  agents add <key>               Install an agent's skills + context.
  agents update <key|--all>      Refresh installed agent bindings.
  agents remove <key> --force    Remove an agent's bindings (corpus untouched).

Document lifecycle (bring existing docs in):
  intake scan                    Discover candidate .md docs -> .spec/intake/ manifest.
  intake process --verbatim      Copy a candidate unchanged into .spec/absorbed/.
  intake process --ai            Stage a candidate for the spec-absorb skill
                                 (transforms it into specs/NNN-slug/spec.md).
  intake process --ignore        Mark a candidate ignored (never re-surfaced).
  intake ignore <list|add|remove>  Manage the ignore list.

Options:
  --help, -h        Show this help
  --version, -v     Show version

Examples:
  spec-coach init
  spec-coach agents add claude
  spec-coach agents add cursor
  spec-coach agents list
`);
}

function printVersion(): void {
  try {
    const pkgPath = new URL("../package.json", import.meta.url).pathname;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    console.log(pkg.version || "0.0.0");
  } catch {
    console.log("unknown");
  }
}

function report(result: { ok: boolean; message?: string; reason?: string }): boolean {
  if (result.ok) {
    console.log(`  ✓  ${result.message}`);
  } else {
    console.error(`  ✗  ${result.reason}`);
  }
  return result.ok;
}

// ── Arg parsing ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(BANNER);
    printHelp();
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-v")) {
    printVersion();
    process.exit(0);
  }

  const cmd = args[0];
  const rest = args.slice(1);
  const has = (flag: string): boolean => rest.includes(flag);
  const projectRoot = process.cwd();

  console.log(BANNER);

  switch (cmd) {
    case "init":
      await runInit(projectRoot);
      break;

    case "update":
      await runUpdate(projectRoot);
      break;

    case "uninstall": {
      if (!has("--yes")) {
        console.log("  Uninstall would remove: spec-coach infrastructure + all agent bindings + constitution.");
        console.log("  User content (specs/) is preserved; the constitution is removed as regenerable tooling.");
        console.log("  Re-run with --yes to proceed" + (has("--force") ? " (--force → also purges specs/)." : "."));
        process.exit(1);
      }
      const r = runUninstall(projectRoot, { confirmed: true, purge: has("--force") });
      if (!report(r)) process.exit(1);
      break;
    }

    case "agents": {
      const verb = rest[0];
      const key = rest[1];
      if (verb === "list") {
        runAgentsList(projectRoot);
        break;
      }
      if (verb === "add") {
        if (!key) { console.error("  ✗  usage: spec-coach agents add <key>"); process.exit(1); }
        if (!report(runAgentsAdd(key, projectRoot))) process.exit(1);
        break;
      }
      if (verb === "update") {
        if (!report(runAgentsUpdate(key || "all", projectRoot))) process.exit(1);
        break;
      }
      if (verb === "remove") {
        if (!key) { console.error("  ✗  usage: spec-coach agents remove <key> --force"); process.exit(1); }
        if (!report(runAgentsRemove(key, projectRoot, { force: has("--force") }))) process.exit(1);
        break;
      }
      console.error(`  ✗  unknown agents verb: ${verb || "(missing)"}\n`);
      printHelp();
      process.exit(1);
    }

    case "intake": {
      // Document lifecycle (spec 005). scan/process wire here; the `ignore`
      // subcommand dispatch lands in T014 once runIntakeIgnore exists (A4).
      const sub = rest[0];
      if (sub === "scan") {
        if (!report(runIntakeScan(projectRoot))) process.exit(1);
        break;
      }
      if (sub === "process") {
        let mode: "verbatim" | "ai" | "ignore" | null = null;
        if (has("--verbatim")) mode = "verbatim";
        else if (has("--ai")) mode = "ai";
        else if (has("--ignore")) mode = "ignore";
        if (!mode) {
          console.error("  ✗  usage: spec-coach intake process --verbatim|--ai|--ignore [path|--all]");
          process.exit(1);
        }
        const target = rest.slice(1).find((f) => !f.startsWith("-")) ?? "all";
        if (!report(runIntakeProcess(projectRoot, { mode, target }))) process.exit(1);
        break;
      }
      if (sub === "ignore") {
        const verb = rest[1];
        if (verb !== "list" && verb !== "add" && verb !== "remove") {
          console.error("  ✗  usage: spec-coach intake ignore <list|add|remove> [pattern]");
          process.exit(1);
        }
        if (!report(runIntakeIgnore(projectRoot, verb, rest[2]))) process.exit(1);
        break;
      }
      console.error(`  ✗  unknown intake subcommand: ${sub || "(missing)"}\n`);
      printHelp();
      process.exit(1);
    }

    default:
      console.error(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exit(1);
  }
}

main();

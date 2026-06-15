#!/usr/bin/env -S npx tsx
/**
 * Spec Coach — SDD that trusts AI.
 *
 * Usage:
 *   spec-coach init --agent claude
 *   spec-coach update --agent cursor
 *
 * Or run directly:
 *   npx tsx src/cli.ts init --agent claude
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { AGENTS, type AgentKey } from "./utils.js";
import { runInit } from "./commands/init.js";
import { runUpdate } from "./commands/update.js";

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

Usage:
  spec-coach init --agent <agent>
  spec-coach update --agent <agent>

Commands:
  init      Initialize a new SDD project (skills, templates, scripts, structure)
  update    Refresh skills, templates, and scripts in an existing project

Options:
  --agent, -a    AI coding agent (required): ${Object.keys(AGENTS).join(", ")}
  --help, -h     Show this help

Examples:
  spec-coach init --agent claude
  spec-coach update --agent cursor
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

// ── Arg parsing ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(BANNER);
    printHelp();
    process.exit(0);
  }

  // Look for --help/-h anywhere
  if (args.includes("--help") || args.includes("-h")) {
    console.log(BANNER);
    printHelp();
    process.exit(0);
  }

  // Look for --version anywhere
  if (args.includes("--version") || args.includes("-v")) {
    console.log(BANNER);
    printVersion();
    process.exit(0);
  }

  // Parse subcommand
  const subcommand = args[0];
  if (subcommand !== "init" && subcommand !== "update") {
    console.log(BANNER);
    console.error(`Unknown command: ${subcommand}\n`);
    printHelp();
    process.exit(1);
  }

  // Parse --agent
  let agentKey: AgentKey | null = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--agent" || args[i] === "-a") {
      const val = args[i + 1];
      if (val && val in AGENTS) {
        agentKey = val as AgentKey;
        i++; // consume the value
      } else {
        console.error(`Unknown agent: ${val || "(missing)"}. Supported: ${Object.keys(AGENTS).join(", ")}`);
        process.exit(1);
      }
    }
  }

  if (!agentKey) {
    console.error("Error: --agent is required. Supported: " + Object.keys(AGENTS).join(", "));
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const agent = AGENTS[agentKey];

  console.log(BANNER);
  console.log(`  Agent: ${agent.name}  |  Format: ${agent.format}  |  Project: ${path.basename(projectRoot)}`);

  if (subcommand === "init") {
    console.log("");
    await runInit(agent, projectRoot);
  } else if (subcommand === "update") {
    console.log("  Mode: update (skills/templates/scripts only)\n");
    await runUpdate(agent, projectRoot);
  }
}

main();

#!/usr/bin/env node
/**
 * Spec Coach CLI entry — resolves tsx from the package's own node_modules.
 * Avoids `npx tsx` shebang which hangs when tsx isn't in CWD.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = dirname(__dirname); // bin/../ = package root

const tsx = join(pkgRoot, "node_modules", ".bin", "tsx");
const tsxFallback = join(pkgRoot, "node_modules", "tsx", "dist", "cli.mjs");
const cli = join(pkgRoot, "src", "cli.ts");

if (!existsSync(tsx) && !existsSync(tsxFallback)) {
  console.error("Error: tsx not found in spec-coach dependencies. Run: cd", pkgRoot, "&& npm install");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [existsSync(tsx) ? tsx : tsxFallback, cli, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: process.cwd() },
);

child.on("exit", (code) => process.exit(code || 0));

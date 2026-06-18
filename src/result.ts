/**
 * Spec Coach — shared command-result type.
 *
 * Single source of truth for the value every command handler returns. The CLI's
 * `report()` consumes it; command modules import `CmdResult` from here rather
 * than re-defining it (spec 006 — once duplicated across command modules).
 */
export type CmdResult = { ok: true; message: string } | { ok: false; reason: string };

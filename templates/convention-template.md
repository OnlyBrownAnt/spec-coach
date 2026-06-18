# [PROJECT_NAME] Commit Convention

This is the project's commit-message convention — a human-owned, agent-agnostic
standard on the same tier as the constitution (`CLAUDE.md`). Amend it to fit the
project; never let it drift from practice. The `verify-commit.sh` advisor reads
the **Rules** block below and checks `HEAD` against it (non-blocking — it always
exits 0).

> **Author this file.** While the bracketed markers below remain
> (`[PROJECT_NAME]`, `[ALLOWED_TYPES]`, `[SCOPE_FORMAT]`), this file is a TEMPLATE
> and the advisor uses its built-in default. Fill them in (and set the version
> footer) to make it AUTHORED — the advisor then checks against YOUR rules.

## Canonical form

Every commit subject line MUST follow Conventional Commits:

```
<type>(<scope>): <subject>
```

- **type** — one of the allowed types listed in the Rules block below.
- **scope** — optional; the area of change (e.g. a feature slug `spec-010`, a
  component, or a package). Drop the parentheses when there is no natural scope.
- **subject** — imperative mood, lowercase, no trailing period, ≤ ~72 chars.

A `!` after the type/scope (or a `BREAKING CHANGE:` footer) flags a breaking
change.

```
feat(spec-010): seed .spec/convention.md from template
fix(uninstall): preserve authored convention on plain uninstall    ← bug fix
docs(spec-010): plan — configurable commit convention             ← docs only
```

## SDD task commits (spec-coach)

spec-coach's SDD workflow makes one commit per task. Fold the task ID into the
commit as a trailer so every commit maps back to its line in `tasks.md`:

```
feat(spec-010): seed convention.md from template

Task: T002
```

The `Task:` trailer is OPTIONAL: include it for SDD task commits; omit it for
commits that are not tasks.

## Body and trailers

- Use the body to explain WHY (the diff already shows WHAT).
- End every commit with the trailers your project requires (e.g.
  `Co-Authored-By:`).

## Customizing

Edit the Rules block to match your project — change the allowed types, constrain
the scope, or mandate the task trailer. A team may also declare a fully custom
(non-Conventional) scheme in prose above; the advisor then reports
"custom convention — manual review" rather than hard-failing (Coach-Not-Gatekeeper).

## Rules (machine-readable — the advisor parses this block when AUTHORED)

<!-- CONVENTION RULES START
allowed_types: [ALLOWED_TYPES]
scope_format: [SCOPE_FORMAT]
task_id_footer: optional
CONVENTION RULES END -->

**Version**: [CONVENTION_VERSION] | **Last Amended**: [LAST_AMENDED_DATE]

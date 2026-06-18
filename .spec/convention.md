# Spec Coach Commit Convention

spec-coach's commit-message convention. It is a human-owned, project-configurable
standard on the same tier as the constitution — amend it; never let it drift from
practice. The `verify-commit.sh` advisor reads the Rules block and checks `HEAD`
against it (non-blocking — it always exits 0). The SDD skills (`spec-implement`,
`spec-tasks`) coach this convention and fold each task's ID into its commit.

## Canonical form

Every commit subject follows Conventional Commits:

    <type>(<scope>): <subject>

- **type** — one of the allowed types in the Rules block below.
- **scope** — the feature slug (`spec-NNN`) or the component changed; drop the
  parentheses when there is no natural scope.
- **subject** — imperative mood, lowercase, no trailing period, ≤ ~72 chars.

A `!` after the type/scope (or a `BREAKING CHANGE:` footer) flags a breaking change.

```
feat(spec-010): seed convention.md from template
fix(uninstall): preserve authored convention on plain uninstall
docs(spec-010): plan — configurable commit convention
```

## SDD task commits

The SDD workflow makes one commit per task. Fold the task ID in as a trailer so
every commit maps back to its line in `tasks.md`:

```
feat(spec-010): seed convention.md from template

Task: T002
```

The `Task:` trailer is OPTIONAL — include it for SDD task commits; omit it for
commits that are not tasks.

## Body and trailers

- Use the body to explain WHY (the diff already shows WHAT).
- End every commit with `Co-Authored-By:` (and any other trailers the project requires).

## Rules (machine-readable — verify-commit.sh parses this block)

<!-- CONVENTION RULES START
allowed_types: feat fix docs refactor test chore
scope_format: spec-NNN | component
task_id_footer: optional
CONVENTION RULES END -->

**Version**: 1.0.0 | **Last Amended**: 2026-06-18

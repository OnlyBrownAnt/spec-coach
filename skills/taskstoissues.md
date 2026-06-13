---
name: coachkit-taskstoissues
description: Convert the task list into actionable, dependency-ordered GitHub Issues. Use after tasks.md is complete.
handoffs:
  next: null
tools: ['github/github-mcp-server/issue_write']
---

## Iron Laws

```
1. NEVER CREATE ISSUES IN A REPO THAT DOESN'T MATCH THE REMOTE.
   Verify the git remote is a GitHub URL before any API call.

2. EVERY ISSUE INCLUDES DEPENDENCIES. An implementer picking up issue T005
   must see immediately that it depends on T003 and T004.

3. DON'T DUPLICATE. If an issue already exists for a task, skip it.
   Creating duplicates is worse than creating nothing.
```

## Prerequisites

This skill requires the GitHub MCP server (`github/github-mcp-server/issue_write`). If unavailable, report and stop.

## The Process

### 1. Load Context

Read:
- `specs/{{FEATURE_ID}}/tasks.md` — the task list
- `.specify/memory/constitution.md` — project context

### 2. Verify Remote

```bash
git config --get remote.origin.url
```

**Stop if the remote is not a GitHub URL.** Do not proceed.

### 3. Create Issues

For each task, create a GitHub Issue in the repository matching the remote.

**Format:**

```
Title: [{{FEATURE_ID}}] T00N: {{task description}}

Body:
**Feature**: {{FEATURE_ID}}
**Phase**: {{phase name}}
**Dependencies**: {{task IDs this task depends on, or "none"}}
**Parallel**: {{yes if marked [P], no otherwise}}

{{Full task description from tasks.md}}
```

### 4. Order

Create issues in dependency order (Setup → Core → Integration → Polish). Tasks marked `[P]` within the same phase can be created in any order.

### 5. Report

```
{{N}} issues created from tasks.md.

Repository: {{remote URL}}
Feature: {{FEATURE_ID}}
```

## Red Flags — STOP and Fix

- Proceeding without verifying the remote URL
- Creating issues in a non-GitHub repository
- Creating an issue for a task that already has one
- Missing dependency information in the issue body

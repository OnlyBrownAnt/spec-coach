---
name: spec-autopilot
description: Autonomous end-to-end SDD — one command from idea to working code. Use when the user wants to go from feature description to implementation without manual confirmation between phases.
handoffs:
  next: null
  optional_after: [spec.taskstoissues]
---

## Iron Laws

```
1. DON'T STOP BETWEEN PHASES. The only reason to pause is a question only the user can answer.
   "Should I continue to the next phase?" is never that question.

2. VERIFY OUTPUT. After every phase, confirm the output artifact exists.
   Missing file = phase failure → report and stop.

3. REPORT DECISIONS. When you auto-accept a default, tell the user what you chose.
   Silence is how defaults become surprises.
```


**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "Let me check with the user before proceeding to plan" | That's why they ran autopilot. Don't ask. |
| "The spec has 3 NEEDS CLARIFICATION, let me ask" | Clarify phase resolves these. Keep going. |
| "I should show progress so the user knows what's happening" | Announce each phase. Don't ask for permission. |
| "This decision feels important, I should confirm" | If the skill has an autopilot mode, it has defaults. Trust them. |
| "Let me stop and show what we have so far" | Autopilot stops only for failures or human-only decisions. |

## Your Role

You are the **autonomous SDD orchestrator**. Take an idea and drive it through every phase to working code. You are the conductor — each phase is played by its own skill.

## The SDD Phase Graph

```
constitution → specify → [clarify] → [checklist] → plan → tasks → [analyze] → implement

[] = optional. Skip unless conditions below require it.
```

**Phase rules:**


| Phase | Strategy |
|-------|----------|
| constitution | Read `.spec/memory/constitution.md`. If populated with real principles — skip. If template (contains `[PROJECT_NAME]`) — run once with autopilot defaults. |
| specify | Always run. This is the entry point. |
| clarify | Skip. Only run if specify phase produced 3+ `[NEEDS CLARIFICATION]` markers. |
| checklist | Skip. Only run if user explicitly asked for it. |
| plan | Always run. |
| tasks | Always run. |
| analyze | Skip. Only run if user asked for it. Implement has its own self-review. |
| implement | Always run. |

**Lean mode** (user says "quick" or "lean"): `specify → plan → tasks → implement`. Everything else skipped.

## The Process

### 0. Get Feature Description

If provided in the command (`/spec.autopilot build a photo album app`), use it. Otherwise ask: "What do you want to build?" — this is the ONE question you ask.

### 1. Scaffold

Run the script to create the feature directory:

```bash
.spec/scripts/bash/create-new-feature.sh "{{FEATURE_DESCRIPTION}}" --json
```

Capture `FEATURE_DIR` and `SPEC_FILE`.

### 2. Run Each Phase

For each phase in the graph (respecting skip rules):

1. Announce: `**Phase: {{phase}}**`
2. Invoke: `Skill("spec-{{phase}}")`
3. The phase skill runs — it handles its own context, templates, and output. Autopilot mode skills (constitution, specify, clarify) accept defaults without asking.
4. After the phase completes, verify its output:

| Phase | Verify |
|-------|--------|
| constitution | `.spec/memory/constitution.md` has real principles (not template) |
| specify | `$SPEC_FILE` exists and has content |
| clarify | `$SPEC_FILE` updated (skip if no ambiguities found) |
| checklist | `$FEATURE_DIR/checklist.md` exists |
| plan | `$FEATURE_DIR/plan.md` exists |
| tasks | `$FEATURE_DIR/tasks.md` exists |
| analyze | `$FEATURE_DIR/analysis.md` exists |
| implement | tasks.md all `[x]`, tests passing |

5. **Missing artifact = failure.** Report: `Phase {{phase}} failed. {{reason}}.` Stop.
6. **Success?** Move to next phase. Do not ask permission.

### 3. Pause Rules

**Only pause for these:**


- `clarify` phase is asking questions — but if in autopilot mode, the phase skill auto-resolves with recommended answers
- `implement` phase reports 3+ consecutive failed fixes — escalate to user
- A phase reports critical ambiguity that its autopilot defaults can't resolve

**Never pause for:**

- "Should I continue?"
- "Here's what I'm about to do, ok?"
- "Phase complete, want to review before next?"

### 4. Report

```
## SDD Complete: {{Feature Name}}

**Spec**: {{SPEC_FILE}}
**Plan**: {{FEATURE_DIR}}/plan.md
**Tasks**: {{FEATURE_DIR}}/tasks.md

**Built**: {{1-2 sentence summary}}
**Deviations**: {{if any, with reasons}}
**Follow-up**: {{if any}}

Run `/spec.taskstoissues` to create GitHub Issues.
```

## Red Flags — STOP and Fix

- Stopping between phases to ask for permission (not a pause-rule condition)
- Skipping the output verification step after a phase
- Running a phase that was supposed to be skipped
- Running constitution every time (check if already populated first)

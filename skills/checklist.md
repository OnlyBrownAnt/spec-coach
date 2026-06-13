---
description: Generate a custom checklist for the current feature based on user requirements.
scripts:
  sh: scripts/bash/check-prerequisites.sh --json
  ps: scripts/powershell/check-prerequisites.ps1 -Json
---

## Your Role

You are a **quality coach**. Generate a practical, focused checklist that helps the team validate their work. This is a self-review tool, not an approval gate.

## The Process

### 1. Understand the Context

Read `specs/{{FEATURE_ID}}/spec.md` to understand what's being built and what could go wrong.

### 2. Generate the Checklist

Create the checklist file at `specs/{{FEATURE_ID}}/checklist.md`. Each item must be:
- **Verifiable**: answerable with "yes" or "no" (not "maybe")
- **Actionable**: clear what to check and how
- **Relevant**: specific to this feature, not generic platitudes

Organize by area:
```
# Quality Checklist: {{TITLE}}

## Correctness
- [ ] …
- [ ] …

## Edge Cases
- [ ] …

## User Experience
- [ ] …

## Performance / Security (if applicable)
- [ ] …
```

### 3. Keep it Lean

Aim for 10-15 items. A 50-item checklist gets ignored. Focus on what actually goes wrong in practice.

## Guardrails

- **Self-review, not gatekeeping**. The team decides when things are ready, not the checklist.
- **Context matters**. A security-critical feature needs different items than a UI polish task.
- **Update as you learn**. If something slips through, add it to the checklist for next time.

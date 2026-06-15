# Fix: Kiro skill 安装到错误的目录 (.kiro/skills → .kiro/steering)

**Bug**: `spec-coach init --agent kiro` 将技能安装到 `.kiro/skills/`，导致 Kiro 中 `/spec-specify` 等命令无法被识别为 slash command。

**Spec**: `specs/001-kiro-support/spec.md` — updated

**Date**: 2025-06-15 | **Status**: Fixed

**Classification**: Implementation deviation

## Root Cause

```
Symptom:     Kiro 中 /spec-specify 不被识别为 slash command
  ↓ why?
Wrong path:  Skills 安装到 .kiro/skills/<id>/SKILL.md
  ↓ why?
Confusion:   .kiro/skills/ → Kiro auto-activation (description matching)
             .kiro/steering/ → Kiro slash commands (explicit / invocation)
  ↓
ROOT CAUSE: AgentConfig 的 dir 字段错误地设置为 ".kiro/skills"。
            Spec 假设 Kiro 的 skill 目录是 .kiro/skills/，但 Kiro 的
            slash command 需要安装在 .kiro/steering/ 目录下。
```

## Similar Issues Found (Horizontal Scan)

Not performed — single configuration value, no other agent has this issue.

## Spec Change

- [x] **Updated FR-002**: `.kiro/skills/` → `.kiro/steering/`
- [x] **Updated Key Entities**: AgentConfig kiro entry dir field
- [x] **Updated Assumptions**: Clarified steering vs skills directory distinction
- [x] **Updated plan.md**: All path references
- [x] **Updated tasks.md**: All path references

## Files Changed

| File | Change | Rationale |
|------|--------|-----------|
| `src/utils.ts:82` | `dir: ".kiro/skills"` → `dir: ".kiro/steering"` | 正确的 Kiro slash command 目录 |
| `specs/001-kiro-support/spec.md` | 4 处更新 | 修正 FR-002, Key Entities, Assumptions |
| `specs/001-kiro-support/plan.md` | 3 处更新 | 路径引用同步 |
| `specs/001-kiro-support/tasks.md` | 5 处更新 | 路径引用同步 |

## Regression Test

**Test location**: Manual verification + `npm test` (5/5 passed)

**What it verifies**: `spec-coach init --agent kiro` 正确安装到 `.kiro/steering/`

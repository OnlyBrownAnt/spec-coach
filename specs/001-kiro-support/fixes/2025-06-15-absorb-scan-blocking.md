# Fix: init --agent kiro 在含匹配 .md 文件的目录中无限阻塞

**Bug**: `spec-coach init --agent kiro` 在包含匹配规格关键词的 `.md` 文件的目录中运行时，`runAbsorbWorkflow()` 通过 `readline.question()` 无限期阻塞等待 stdin 输入，导致进程「卡死」。

**Spec**: `specs/001-kiro-support/spec.md` — updated

**Date**: 2025-06-15 | **Status**: Fixed

**Classification**: Spec omission

## Root Cause

```
Symptom:   init --agent kiro 卡死，进程不退出
  ↓ why?
Blocking:  runAbsorbWorkflow() → readline.question() 无限等待 stdin 输入
  ↓ why?
No guard:  没有 isTTY 检查、没有超时、没有 --skip 参数
  ↓ why?
Scope:     scanForCandidateDocs() 递归扫描整个项目树，在任意目录找到
           匹配文件名关键词(spec/plan/feature/design)或内容 pattern
           (Overview/User Story/FR-*) 的 .md 文件后即触发交互式 prompt
  ↓
ROOT CAUSE: runAbsorbWorkflow 设计为交互式流程，但没有为以下场景提供退出机制：
  (a) 非 TTY stdin (CI、管道、后台进程)
  (b) 用户未注意到 prompt 文本
  (c) 用户主动想跳过 absorb 扫描
  同时 scanForCandidateDocs 扫描范围过大（全项目递归），增加了不必要
  的触发概率。
```

## Similar Issues Found (Horizontal Scan)

| File | Match Type | Issue | Fixed? |
|------|-----------|-------|--------|
| `src/commands/init.ts:273` | 🔴 Confirmed | `readline.createInterface` 主 prompt 无 isTTY 守卫 | ✅ |
| `src/commands/init.ts:253` | 🔴 Confirmed | `prompt()` 函数内 `rl.question()` 无超时 | ✅ (上游 TTY 守卫覆盖) |
| `src/commands/init.ts:267` | 🔴 Confirmed | absorb 阶段第二次 `readline.createInterface` | ✅ (上游 TTY 守卫覆盖) |
| `src/commands/init.ts:104` | ⚪ Safe | `readdirSync` 非递归 — 仅列脚本目录 | — |
| `src/utils.ts:284` | ⚪ Safe | `readdirSync` 非递归 — 仅列脚本目录 | — |

## Spec Change

- [x] **Added Edge Case**: Absorb scan — non-interactive stdin 行为
- [x] **Added Edge Case**: Absorb scan — preset directories 扫描范围
- [x] **Added Edge Case**: Absorb scan — interactive directory selection 交互流程
- [x] **Added Edge Case**: Absorb scan — `--no-absorb` flag 行为
- [x] **Added FR-010**: `--no-absorb` CLI flag
- [x] **Added FR-011**: 预设扫描目录限制 (root-level + `docs/`, `doc/`, `design/`, `spec/`, `requirements/`)
- [x] **Added FR-012**: TTY 检查 + 非交互环境自动跳过
- [x] **Updated SC-001**: 区分文件 I/O 时间预算和交互式 absorb 时间

## Files Changed

| File | Change | Rationale |
|------|--------|-----------|
| `src/commands/init.ts:58-68` | 新增 `PRESET_SCAN_DIRS` 常量、`checkCandidateFile` 辅助函数 | 提取文件检查逻辑，避免重复代码 |
| `src/commands/init.ts:99-135` | 重写 `scanForCandidateDocs` 接受 `scanDirs: string[]` | 根目录仅扫描根级文件，预设目录递归扫描 |
| `src/commands/init.ts:259-351` | 重写 `runAbsorbWorkflow` 添加 TTY 守卫 + 交互式目录选择 | 非 TTY 自动跳过；用户可选择 y/n/a |
| `src/commands/init.ts:350` | `runInit` 签名新增 `skipAbsorb` 参数 | 透传 `--no-absorb` flag |
| `src/cli.ts:98-108` | CLI arg 解析新增 `--no-absorb` / `--skip-absorb` | 用户显式跳过 absorb 扫描 |
| `src/cli.ts:124` | `runInit` 调用传递 `noAbsorb` | 连接 CLI flag 到 init 流程 |
| `specs/001-kiro-support/spec.md` | 新增 4 个 Edge Cases + 3 个 FR + 更新 SC-001 | 规范化 absorb workflow 行为 |

## Regression Test

**Test location**: Manual verification (4 scenarios) + existing `npm test` suite (5/5 passed)

**What it verifies**:
1. `--no-absorb` flag: init 立即跳过 absorb 扫描 (`⚠ Absorb scan skipped (--no-absorb)`)
2. `--skip-absorb` alias: 与 `--no-absorb` 行为一致
3. Non-TTY stdin (background/pipe): 自动跳过 (`⚠ Absorb scan skipped (non-interactive stdin)`)
4. Existing agents unaffected: Claude Code ✅ Cursor ✅ all 5 behavioral tests ✅

## Notes

- 修复影响所有 agent（claude, cursor, copilot, codex, windsurf, kiro），不仅是 kiro
- 预设扫描目录可扩展：用户可通过交互式 prompt 的 `[a]` 选项添加任意目录
- 根目录扫描是非递归的（仅根级 `.md` 文件）；预设目录是递归的（保持现有排除规则）
- 内容匹配 (CONTENT_PATTERNS) 逻辑保持不变，仅扫描范围收敛

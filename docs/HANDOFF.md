# p4pilot — 会话交接 / 续接指南 (Session Handoff)

> 这份文档就是"保存的会话"。下次回来先读它,即可无缝继续。

**暂停时间**：2026-07-15
**项目位置**：`D:\Downloads\p4pilot`
**Git 分支**：`master`

---

## 一句话状态

图纸（SPEC / PLAN / AGENTS / README + 工作区脚手架）**已全部完成并提交**；
`core` 包代码**尚未开始**（首次派发的 Codex 任务在"读取 SPEC / 规划"阶段卡死，
零产出，已终止）。**下次从"重新派发 Codex 构建 core"继续即可。**

## 已完成 ✅（已 git 提交）

- `docs/SPEC.md` — 技术规格 + 全部接口签名（权威设计）
- `docs/PLAN.md` — 里程碑1（core, Task 1.1–1.8）+ 里程碑2（mcp-server）的 TDD 施工单
- `AGENTS.md` — Codex 执行契约（TDD、离线测试、ESM、禁真实 P4、小步提交）
- `README.md` — 冲星标门面（问题陈述、对比表、接入片段、架构图、路线图）
- 根配置：`package.json`（npm workspaces）、`tsconfig.base.json`、`.gitignore`、`LICENSE`（MIT）

## 未开始 ⏳

- `packages/core`（`@p4pilot/core`）— 无任何文件
- `packages/mcp-server`（`@p4pilot/mcp-server`）— 无任何文件
- `examples/`、GitHub Actions CI、React WebView 面板

## 项目定位（提醒自己）

**p4pilot = 让 AI Coding Agent 原生支持 Perforce 的 MCP 层。** 切入点：主流 agent
（Claude Code/Cursor/Codex）全是 Git 原生，游戏工作室用 Perforce → 空白市场。
杀手功能：`ensureOpenForEdit`（改文件前自动 `p4 edit`）。对准米哈游 Coding Agent 岗
JD（P4 管理 / 代码评审 / 代码检索 / 跨端 WebView / TS+React）。

## 环境与配置（下次直接用，无需重设）

- **指挥官模型**：Claude Fable 5（已设默认，effort = high）
- **Codex 施工模型**：`gpt-5.6-sol` / high（`~/.codex/config.toml`），micu 通道
- `D:\Downloads\p4pilot` 已加入 Claude 允许目录 + Codex 信任项目列表
- Node ≥20 / npm / git 就绪；**pnpm、gh 未装**（计划已绕开，用 npm workspaces）
- 依赖版本（此 registry 实测可用）：`@modelcontextprotocol/sdk ^1.29`、`execa ^9.6`、
  `vitest ^4.1`、`zod ^4.4`、`tsup ^8.5`、`typescript ^5.6`

## ⚠️ 首次 Codex 派发失败复盘（下次改进）

- 任务 `task-mrm64pmx-q9684n`（gpt-5.6-sol）运行约 15 分钟，一直停在
  "用 powershell 分块读取 SPEC / 准备 Task 1.1"，随后线程静默死亡：**零文件、零提交**。
- 疑因：反复用 `powershell -Command '$OutputEncoding=...UTF8...'` 小块读文件，
  陷入低效循环 / 线程假死。
- **下次改进（任选其一）**：
  1. 首批只派 **Task 1.1–1.3**（脚手架 + ztag 解析器 + MockP4Runner），先验证 Codex
     能正常落地文件与提交，再继续 1.4–1.8。（推荐）
  2. 派发提示里明确："一次性读取整文件，禁止逐块 powershell 读取；每完成一个 Task
     立即 `git commit`，不要长时间只读不写。"
  3. 先由 Claude（指挥官）内联做 Task 1.1 脚手架打样，再把后续交给 Codex。
  4. 备选恢复旧会话：`codex resume 019f6627-79cc-7ad3-9782-1cdd3c463cc0`
     （但既然零产出，建议直接重开）。

## 如何续接（两种方式）

### A. 恢复本次对话（最省事）
终端里 `cd D:\Downloads\p4pilot`，然后：
- `claude --continue` —— 继续最近一次会话，或
- `claude --resume` —— 从列表挑这次会话
恢复后对我说 **"继续 p4pilot"**，我会读本文件 + PLAN 接着干。

### B. 全新会话
1. `cd D:\Downloads\p4pilot`
2. 让我先读 `docs/HANDOFF.md`、`docs/PLAN.md`、`docs/SPEC.md`、`AGENTS.md`
3. 说 **"派 Codex 做里程碑1 的 Task 1.1–1.3"**（建议小步验证）

## 下一步待办（按序）

1. [ ] 重新派发 Codex 构建 `@p4pilot/core`（建议先 Task 1.1–1.3 小步验证）
2. [ ] core 全绿后：`npm install / typecheck / test / build` 验证，指挥官复查代码
3. [ ] 派 Codex 构建 `@p4pilot/mcp-server`（里程碑2）
4. [ ] 冲星标打磨：README 演示、`examples/`、CI、`docs/`
5. [ ] 阶段2：React WebView 面板（跨端，命中 JD 第5条）

## 验证命令（core 完成后，从项目根运行）

```bash
npm install
npm run typecheck
npm test
npm run build
```

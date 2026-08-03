# p4pilot 会话交接 / 续接指南

**更新时间**：2026-08-03

**仓库**：<https://github.com/sdvgdfvds/p4pilot>

**线上 Demo**：<https://sdvgdfvds.github.io/p4pilot/>

**当前分支**：`feat/agent-runtime-safety`（相对 `origin/main` 的 agent 运行时安全工作）

## 当前状态

p4pilot 的下一阶段 Roadmap（PR #5）、一键 P4V 演示（PR #6）以及 P4V WebView
`fetch` 绑定修复（PR #7）均已合并到 `main`。`release/v0.2.0` 基于最新 `main`
准备公开包 `0.2.0` release candidate，具备完整的格式、lint、coverage、测试、
构建和 npm pack 门禁。GitHub Actions CI 和 GitHub Pages 部署已启用。

### 进行中：Agent runtime safety（本分支，tip `2351590`）

目标：为 MCP / agent 运行时增加**进程内策略门闩 + 审计**，并写清安全边界诚实性
（产品永不暴露 `p4_submit`；带 shell + 凭据的 agent 仍可绕过；生产必须叠加
受限 P4 用户与服务端 submit deny）。

契约摘要（权威接口见 `docs/SPEC.md` §4.11–§4.12、§5.1.1、§5.2）：

- `@p4pilot/core`：`src/policy.ts`（`SafetyPolicy`、三档预设、可选
  `pathAllowlist`、`checkPolicy` / `assertPolicyAllowed`、硬拒绝 `submit`）、
  `src/audit.ts`（`AuditEvent` / `AuditSink` / `MemoryAuditSink` /
  `JsonlFileAuditSink` / `createAuditEvent`）、`POLICY_DENIED`。
- `@p4pilot/mcp-server`：`ToolContext.policy` + `audit`（必填）、`safe-tool`
  `withPolicyAndAudit`、`resolveSafetyPolicy` / `P4PILOT_POLICY` /
  `P4PILOT_PATH_ALLOWLIST`、工具 `p4_audit_tail`；**仍无** `p4_submit`；
  host `GET /api/audit`。
- `@p4pilot/web`：Dashboard | Review | **Audit** 三标签；DemoStore 预置审计事件。
- CI：独立 job `safety-bench`；本地 `npm run test:bench-safety`。
- 示例：`examples/restricted-agent/helix/*` protect/trigger 模板 + `VERIFY.md`。
- 文档：`docs/SECURITY.md`、`docs/BENCH.md`、本 HANDOFF / PLAN / TOOLS / SPEC
  已与契约对齐。

**测试**：全仓 **181** 离线测试绿；`npm run typecheck` 通过。

相关 feature 分支（已合入本分支）：`feat/ci-bench-safety`、
`feat/web-audit-panel`、`feat/policy-path-allowlist`、
`feat/restricted-helix-scripts`。

下一优先：将本分支 PR 合入 `main`（勿在 main 直接改）；可选真实 Helix 联调
（仅用受限 bot 用户，**禁止**把生产 submit 写成自动化）。

已交付内容（`main` / v0.2.0 基线 + 本分支安全层）：

- `@p4pilot/core`：Perforce runner、ztag parser、typed client、auto-checkout、
  asset guard、shelved review、Unreal asset dependency traversal、changelist
  helpers、safety policy、audit，以及离线 `MockP4Runner`。
- `@p4pilot/mcp-server`：19 个 MCP 工具（含 `p4_audit_tail`），并提供
  loopback-only `p4pilot-host`；`--mock` 模式无需 Perforce。
- npm：registry 当前公开版本仍为 `@p4pilot/core@0.1.1` 与
  `@p4pilot/mcp-server@0.1.1`；`0.2.0` manifests 已准备，发布需要 npm 账号授权。
- `@p4pilot/web`：统一的 mock/HTTP backend 界面，包含工作区仪表盘、smart
  checkout、资产信息、错误/断线状态和 changelist review。HttpBackend 默认
  fetcher 通过 `globalThis.fetch` 绑定，避免嵌入式 WebView 的 Illegal
  invocation。
- 宿主：P4V HTML Tab、Unreal Editor `SWebBrowser` 插件、Maya Qt WebEngine
  dock 都复用同一个 Web build 和本地真实后端；Windows 一键启动/重置脚本位于
  `hosts/p4v`。
- 测试：根目录共 119 个用例，全部离线运行；CI 不连接真实 Perforce。
- 工程门禁：Prettier、ESLint、TypeScript、Vitest coverage、build 和 npm pack。

## 接手方式

不要直接在 `main` 上开发。先同步远端，再从最新 `origin/main` 建分支：

```bash
git fetch origin
git switch -c <feature-branch> origin/main
```

开始修改前完整阅读：

1. `AGENTS.md`：任何 AI agent 或贡献者必须遵守的执行契约。
2. `docs/SPEC.md`：MVP 的权威接口与行为规范。
3. `docs/PLAN.md`：原始 TDD 实现顺序和工程约束。

若接口或已交付行为发生变化，必须在同一提交更新 `docs/SPEC.md`。测试只能使用
`MockP4Runner`，不得连接真实 Perforce，也不得对真实工作区执行 stateful 命令。

## 验证命令

在仓库根目录运行：

```bash
npm install
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run build -w @p4pilot/web
```

单包测试也可独立运行：

```bash
npm test -w @p4pilot/core
npm test -w @p4pilot/mcp-server
npm test -w @p4pilot/web
```

Vitest 4 由根目录 `vitest.config.ts` 的 `test.projects` 编排。React 组件测试文件
需要 `// @vitest-environment jsdom`；core 和 MCP server 测试使用 Node 环境。

## 合并与发布

PR #5、#6、#7 已合并到 `main`。`release/v0.2.0` 只更新公开包版本和发布状态；
合并后从对应的 `main` 提交创建 `v0.2.0` Git tag / GitHub Release。npm publish
必须使用具备 `@p4pilot` scope 权限且已启用 2FA/automation token 的账号。

公开安装路径已验证：`npx @p4pilot/mcp-server --mock` 可从官方 registry 安装并
启动服务器。

## 后续产品化方向

- **（本分支）** 落地 agent-runtime-safety 实现与测试；文档契约已写在
  `docs/SPEC.md` / `docs/SECURITY.md` / `docs/PLAN.md` Milestone。
- 在演示 p4d 上配置受限 Perforce 用户与服务端 Submit 禁止规则（与
  `examples/restricted-agent` 对齐）。
- 可选：持久化 / 可插拔 `AuditSink`、审批工作流（超出当前 Memory + tail 范围）。
- 交付真实 Unreal Asset Registry 导出 commandlet/脚本。
- 在装有 Unreal Editor 和 Maya 的授权工作站上完成真实宿主验证。
- 改善 MCP/HTTP 身份验证和团队部署方案。

## 已知环境注意事项

- Windows Git Bash 中 `D:\Downloads\p4pilot` 对应 `/d/Downloads/p4pilot`；工具调用
  时优先显式指定仓库路径。
- GitHub 网络连接可能瞬时失败；`fetch` 或 `push` 可在确认错误为网络问题后重试。
- 测试和 CI 必须保持完全离线，不得依赖 `p4` binary、Perforce server 或网络。
- 本机 npm 可能未登录（`npm whoami` 返回 `ENEEDAUTH`）；发布前需要先授权。

提交使用 Conventional Commits，并保持一次提交只处理一个明确问题。

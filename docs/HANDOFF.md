# p4pilot 会话交接 / 续接指南

**更新时间**：2026-07-20

**仓库**：<https://github.com/sdvgdfvds/p4pilot>

**线上 Demo**：<https://sdvgdfvds.github.io/p4pilot/>

## 当前状态

p4pilot 的 MVP、Phase 2 浏览器 Demo，以及根目录测试编排修复均已合并到
`main`。GitHub Actions CI 和 GitHub Pages 部署已启用。

已交付内容：

- `@p4pilot/core`：Perforce runner、ztag parser、typed client、auto-checkout、
  asset guard、changelist helpers，以及离线 `MockP4Runner`。
- `@p4pilot/mcp-server`：12 个 MCP 工具；`--mock` 模式无需 Perforce。
- `@p4pilot/web`：使用真实 core 和内存假仓的浏览器 Demo，包含工作区仪表盘、
  smart checkout、资产信息和 changelist review。
- 测试：根目录共 66 个用例，全部离线运行；CI 不连接真实 Perforce。

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
npm run typecheck
npm test
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

## 后续工作

按当前优先级：

1. 补齐两个可发布 package 的 npm 元数据和 `publishConfig`，完成首次公开发布。
2. 完善 Web Demo：接通 Revert；为异步操作增加错误提示、加载态和重复提交保护；
   在 README 中加入截图或 GIF。
3. 补齐 `p4_edit`、`p4_add`、`p4_revert` 的 MCP 工具测试，扩大 MCP schema 层的
   集成覆盖，并为 `ExecaP4Runner` 添加 mocked-execa 单元测试。
4. 更新 `docs/SPEC.md` 以记录已交付的 Phase 2 Web package，并处理
   `examples/mock-depot.json` 与 mock factory 的单一数据源问题。
5. 在 Roadmap 中明确 `p4 submit` 由人执行；若未来实现自动提交，必须增加显式确认。
6. 增强项目维护文件和 CI，例如 format check、coverage、贡献指南和 issue 模板。

长期 Roadmap：shelved-changelist 评审、UE 资产依赖浮现、PC/UE/Maya WebView
嵌入，以及将 core 已有的 `deleteFiles`、`sync`、`reopen`、`where` 能力暴露为
MCP 工具。

## 已知环境注意事项

- Windows Git Bash 中 `D:\Downloads\p4pilot` 对应 `/d/Downloads/p4pilot`；工具调用
  时优先显式指定仓库路径。
- GitHub 网络连接可能瞬时失败；`fetch` 或 `push` 可在确认错误为网络问题后重试。
- 测试和 CI 必须保持完全离线，不得依赖 `p4` binary、Perforce server 或网络。

提交使用 Conventional Commits，并保持一次提交只处理一个明确问题。

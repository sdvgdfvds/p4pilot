# p4pilot 会话交接 / 续接指南

**更新时间**：2026-07-20

**仓库**：<https://github.com/sdvgdfvds/p4pilot>

**线上 Demo**：<https://sdvgdfvds.github.io/p4pilot/>

## 当前状态

p4pilot 的 MVP 和 Phase 2 浏览器 Demo 已在 `main`。产品化收尾位于
`feat/product-ready`，合并后即具备完整的格式、lint、coverage、测试、构建和
npm pack 门禁。GitHub Actions CI 和 GitHub Pages 部署已启用。

已交付内容：

- `@p4pilot/core`：Perforce runner、ztag parser、typed client、auto-checkout、
  asset guard、changelist helpers，以及离线 `MockP4Runner`。
- `@p4pilot/mcp-server`：12 个 MCP 工具；`--mock` 模式无需 Perforce。
- npm：`@p4pilot/core@0.1.1` 与 `@p4pilot/mcp-server@0.1.1` 已公开发布。
- `@p4pilot/web`：使用真实 core 和内存假仓的浏览器 Demo，包含工作区仪表盘、
  smart checkout、资产信息和 changelist review。
- Web Demo 已接通 Revert、加载/错误状态、重复操作保护，并包含响应式截图。
- 测试：根目录共 83 个用例，全部离线运行；CI 不连接真实 Perforce。
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

仓库内的产品化收尾和首次 npm 发布均已完成。下一步只需合并
`feat/product-ready`，然后从合并后的 `main` 创建 `v0.1.0` Git tag / GitHub
Release。

公开安装路径已验证：`npx @p4pilot/mcp-server --mock` 可从官方 registry 安装并
启动服务器。

## 长期 Roadmap

- Shelved-changelist 评审工作流。
- UE 资产依赖浮现。
- PC/UE/Maya WebView 嵌入。
- 将 core 已有的 `deleteFiles`、`sync`、`reopen`、`where` 能力暴露为 MCP 工具。

## 已知环境注意事项

- Windows Git Bash 中 `D:\Downloads\p4pilot` 对应 `/d/Downloads/p4pilot`；工具调用
  时优先显式指定仓库路径。
- GitHub 网络连接可能瞬时失败；`fetch` 或 `push` 可在确认错误为网络问题后重试。
- 测试和 CI 必须保持完全离线，不得依赖 `p4` binary、Perforce server 或网络。

提交使用 Conventional Commits，并保持一次提交只处理一个明确问题。

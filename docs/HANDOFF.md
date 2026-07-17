# p4pilot — 会话交接 / 续接指南 (Session Handoff)

> 下次回来先读这份。项目由 **Claude 用 Matt Pocock `tdd` 技能亲自 TDD 构建**
> （Codex 已弃用；GPT 手动交接方案也已放弃）。

**更新时间**：2026-07-16
**项目位置**：`D:\Downloads\p4pilot`　**分支**：`main`（已从 `master` 重命名）
**远程**：`https://github.com/sdvgdfvds/p4pilot`（public，**已推送**）

---

## 一句话状态

**MVP + 冲星标打磨（Milestone 1 / 2 / 3）全部完成并已公开推送。**
`@p4pilot/core` 与 `@p4pilot/mcp-server` 两包做完，**46 测试全绿**，
typecheck / build / `npm ci` 全绿。**下一步 = 阶段2 React WebView 面板。**

## 已完成 ✅（均已 git 提交并推送到 origin/main）

- **core（Milestone 1）**：runner 接缝 + ExecaP4Runner、ztag 解析器、MockP4Runner、
  P4Client（14 方法）、asset-guard、auto-checkout（`ensureOpenForEdit` 杀手功能）、
  changelist、config、barrel。34 测试。
- **mcp-server（Milestone 2）**：`buildCore`（--mock / 真实）、`createServer`、
  **12 个 MCP 工具**（p4_status / p4_smart_edit / p4_edit / p4_add / p4_revert /
  p4_changelist_create / p4_changelist_list / p4_describe / p4_review / p4_asset_info /
  p4_filelog / p4_search）+ `P4PilotError`→tool-error 映射 + 可注入 searcher +
  stdio 入口（bin `p4pilot-mcp`）。12 测试。
- **Milestone 3 冲星标（本次会话）**：
  - `examples/`：`claude-code.md`、`cursor.mcp.json`、`codex.config.toml`（各含真实 + `--mock` 两种接入）。
  - `.github/workflows/ci.yml`：Node 20/22 矩阵，`npm ci`→typecheck→test→build，无 Perforce。
  - `docs/TOOLS.md`（12 工具，输入/输出/**真实**示例——用 `--mock` 跑真 server 抓取）+ `docs/ARCHITECTURE.md`。
  - README 打磨：真实徽章（CI / tests / License / MCP / Node）、"See it in action" 实录演示、
    "Run from source" 一节、状态改为 MVP complete、roadmap 勾选。
  - 版本升到 **v0.1.0**（两包），`package-lock.json` 同步。
  - **已公开推送**到 github.com/sdvgdfvds/p4pilot（仓库最初误建为 `p4-pilot`，已重命名为 `p4pilot`）。

## 待办 ⏳（按序）

1. **验证 CI 首跑变绿**：看 <https://github.com/sdvgdfvds/p4pilot/actions>，确认 Node 20/22 两个 job 通过、README 的 CI 徽章变绿。
2. **（可选）发布 npm**：让 README 的 `npx @p4pilot/mcp-server` 真正可用。需 npm 账号 + OTP；
   发布顺序：先 `@p4pilot/core`、后 `@p4pilot/mcp-server`（后者依赖前者，发布前把
   `dependencies` 里的 `"@p4pilot/core": "*"` 换成具体版本如 `^0.1.0`）。本会话按用户选择**未发布**。
3. **阶段2 React WebView 面板**：changelist 仪表盘 / 评审 UI，可嵌浏览器 / PC 客户端 / **UE / Maya** WebView
   （命中米哈游 JD 第 5 条）。每个子功能仍走 brainstorm → plan → TDD。

## MCP SDK 速查（已实测，`@modelcontextprotocol/sdk` ^1.29，zod ^4.4 兼容）

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
const server = new McpServer({ name: "p4pilot", version: "0.1.0" });

// 注册工具：config 里 inputSchema 是 zod "raw shape"（键→zod 校验器的对象）
server.registerTool(
  "p4_smart_edit",
  { title: "...", description: "...", inputSchema: { paths: z.array(z.string()), changelist: z.string().optional() } },
  async (args) => ({ content: [{ type: "text" as const, text: "..." }] }),  // 无 inputSchema 时回调是 async () => ...
);
```

- stdio：`import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"`；`await server.connect(new StdioServerTransport())`
- 进程内集成测试：`InMemoryTransport.createLinkedPair()` + `Client`（见 `packages/mcp-server/test/integration.test.ts`）。
- 返回内容用 `type: "text" as const`（否则 TS 会把 "text" 拓宽成 string 而报错）。
- ToolResult 需带 `[key: string]: unknown` 索引签名，才兼容 SDK `registerTool`。

## 验证命令（从项目根，全绿且无需真实 Perforce）

```bash
npm install
npm run typecheck   # tsc -b（solution 式，含 core + mcp-server）
npm test            # vitest：当前 46 通过
npm run build       # 两个包 tsup：CJS+ESM+DTS
```

## 推送 / 续接

- 远程已配置：`origin` = `https://github.com/sdvgdfvds/p4pilot.git`，本地 `main` 跟踪 `origin/main`。
- 后续推送直接 `git push`。**注意本机到 github.com 网络偶发 reset/超时，失败多试几次即可。**
- 续接：`cd D:\Downloads\p4pilot` → `claude`（或 `--continue`）→ 说 **"继续 p4pilot 的阶段2 React WebView"**。

## 杂项

- `docs/GPT-BRIEFING.md`、`p4pilot-给GPT的完整指令.md` 是早前弃用方案产物，
  **未跟踪、未推送、可删**（删除不可逆，需要时再删）。
- 环境：Node ≥20 / npm / git；pnpm、gh 未装。git 作者身份 `sdvgdfvds`。指挥官模型 Opus 4.8 max。

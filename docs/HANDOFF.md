# p4pilot — 会话交接 / 续接指南 (Session Handoff)

> 下次回来先读这份。项目现在由 **Claude 用 Matt Pocock `tdd` 技能亲自 TDD 构建**
> （Codex 已弃用——两次都在读文件/规划阶段卡死；GPT-手动交接方案也已放弃）。

**更新时间**：2026-07-15（晚，用户吃饭前）
**项目位置**：`D:\Downloads\p4pilot`　**分支**：`master`

---

## 一句话状态

`@p4pilot/core` **已全部完成并提交**（34 个测试全绿）；`@p4pilot/mcp-server`
的 **Task 2.1 骨架已完成并提交**（server + `p4_status` 工具 + `--mock` 工厂，
typecheck/build 全绿）。**下一步：mcp-server 的 Task 2.2–2.6（补齐剩余工具 + 集成测试）。**

## 已完成 ✅（均已 git 提交，HEAD = mcp 2.1）

- **core（Milestone 1，Task 1.1–1.8 全部完成）**：runner 接缝 + ExecaP4Runner、
  ztag 解析器、MockP4Runner（含 sync/filelog）、P4Client（14 方法）、asset-guard、
  auto-checkout（`ensureOpenForEdit` 杀手功能）、changelist、config、barrel。
  6 个测试文件 / 34 测试全绿；tsup 构建 CJS+ESM+DTS 全绿。
- **mcp-server Task 2.1**：`@p4pilot/mcp-server` 包 + `buildCore()`（mock/真实二选一）
  + `createServer()`（已注册 `p4_status`，证明 `registerTool` 管线可编译）+ stdio 入口
  （bin `p4pilot-mcp`）+ `examples/mock-depot.json`。

## 待办 ⏳（按序）

1. **mcp-server Task 2.2–2.5**：把 SPEC §5.2 的其余工具补齐（建议每个工具一个
   `src/tools/*.ts`，或先在 `server.ts` 内联再重构）：
   `p4_smart_edit`（调 `ensureOpenForEditMany`，杀手）、`p4_edit`/`p4_add`/`p4_revert`、
   `p4_changelist_create`（用 `buildChangelistDescription` + `config.defaultChangelistPrefix`）、
   `p4_changelist_list`、`p4_describe`、`p4_review`（describe diff:true 格式化）、
   `p4_asset_info`（`fstat`+`classifyAsset`，二进制不回传字节）、
   `p4_search`（对 workspace grep/rg，用 asset-guard 跳过二进制；用可注入 runner 以便离线测）、
   `p4_filelog`。每个都用 TDD（handler 直接对 MockP4Runner 测）。
2. **mcp-server Task 2.6**：用 `InMemoryTransport` 做集成测试（listTools 含全部工具、
   callTool p4_smart_edit 后假仓库状态变化）；`P4PilotError` → MCP tool error（带 code）。
3. **Milestone 3 冲星标**：README 演示、`examples/`（已有 mock-depot.json）、GitHub Actions CI、`docs/TOOLS.md`。
4. **阶段2**：React WebView 面板（跨端，命中 JD 第5条）。

## MCP SDK 速查（已实测，@modelcontextprotocol/sdk 已装，zod 4.4.3 兼容）

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
const server = new McpServer({ name: "p4pilot", version: "0.0.0" });

// 注册工具：config 里 inputSchema 是 zod "raw shape"（键→zod 校验器的对象）
server.registerTool(
  "p4_smart_edit",
  { title: "...", description: "...", inputSchema: { paths: z.array(z.string()), changelist: z.string().optional() } },
  async (args) => ({ content: [{ type: "text" as const, text: "..." }] }),  // 无 inputSchema 时回调是 async () => ...
);
```

- stdio：`import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"`；`await server.connect(new StdioServerTransport())`
- 集成测试（进程内，无 stdio）：
  ```ts
  import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
  import { Client } from "@modelcontextprotocol/sdk/client/index.js";
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  await client.listTools();
  await client.callTool({ name: "p4_smart_edit", arguments: { paths: ["/ws/a.c"] } });
  ```
- 返回内容用 `type: "text" as const`（否则 TS 会把 "text" 拓宽成 string 而报错）。

## 远程落地（GitHub · 星标目标，尚未推送）

仓库：`https://github.com/sdvgdfvds/p4pilot`（public，仓库名 `p4pilot`）。
git 作者身份已设为 GitHub（`sdvgdfvds` / `sdvgdfvds@users.noreply.github.com`）。
建仓+推送（网页建空仓后）：
```bash
cd /d/Downloads/p4pilot
git remote add origin https://github.com/sdvgdfvds/p4pilot.git
git branch -M main
git push -u origin main
```

## 验证命令（从项目根，全绿且无需真实 Perforce）

```bash
npm install
npm run typecheck   # tsc -b（solution 式，含 core + mcp-server）
npm test            # vitest：当前 34 通过
npm run build       # 两个包 tsup：CJS+ESM+DTS
```

## 如何续接

终端 `cd D:\Downloads\p4pilot` → `claude --continue`（或 `--resume` 选本会话）→
对我说 **“继续 p4pilot 的 mcp-server”**，我会读本文件接着做 Task 2.2。

## 杂项

- 根目录两个文件 `docs/GPT-BRIEFING.md`、`p4pilot-给GPT的完整指令.md` 是早前
  “交给 GPT 手动做”的方案产物,**现已弃用,可删除**(未跟踪,不影响仓库)。
- 环境:Node ≥20 / npm / git;pnpm、gh 未装(计划已绕开)。指挥官模型 Opus 4.8 max。

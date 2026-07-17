# p4pilot — 会话交接 / 续接指南 (Session Handoff)

> 下次回来先读这份。项目由 **Claude 用 superpowers + Matt Pocock 技能亲自构建**（Codex 已弃用）。

**更新时间**：2026-07-16（Phase 2 执行中）
**项目位置**：`D:\Downloads\p4pilot`
**当前分支**：**`phase2-web-panel`**（Phase 2 全部工作在此，**尚未推送**）
**远程**：`https://github.com/sdvgdfvds/p4pilot`（public；`origin/main` 停在 `5974103`，即 MVP/Milestone 3）

---

## 一句话状态

**MVP（Milestone 1/2/3）已完成并推送到 `origin/main`。Phase 2（浏览器 Demo 面板）正在 `phase2-web-panel` 分支上用 subagent-driven-development 执行：10 个实现任务已完成 9 个，其中 8 个已通过任务复查，Task 9 已提交且验证全绿但尚未复查。** 下一步 = Task 9 复查 → Task 10 → 整支最终复查 → 收尾合并。

## Phase 2 是什么

一个**零安装、可点开的浏览器 Demo**（React 静态站点），在浏览器里跑真实 `@p4pilot/core`（MockP4Runner 内存假仓），含两视图：**工作区仪表盘**（文件+资产徽章+smart checkout+建CL+资产卡）与 **changelist 评审**（真 unified diff）。求职展示品定位（米哈游）。设计见 `docs/superpowers/specs/2026-07-16-phase2-webview-design.md`，实现计划见 `docs/superpowers/plans/2026-07-16-phase2-web-panel.md`。

## Phase 2 进度（分支 phase2-web-panel）

已提交的实现任务（每个都走了 实现 subagent → 复查 subagent）：
- ✅ Task1 `@p4pilot/core/browser` 浏览器安全入口（去 execa/fs；mock-runner 去 node:path）— eef8b30 — 复查通过
- ✅ Task2 `packages/web` 脚手架（Vite+React+TS）— d5e32ce — 复查通过
- ✅ Task3 demo 种子 makeSeed — 75622c0 — 复查通过
- ✅ Task5 diff 工具 toDiffRows — da78cb7 — 复查通过（复查抓出并修了空行丢失 Critical bug）
- ✅ Task4 DemoStore（镜像 MCP 工具）— 84b6a93 — 复查通过
- ✅ Task6 useDemo Provider/hook — 63e66b0 — 复查通过
- ✅ Task7 仪表盘视图 — 1fda703 — 复查通过
- ✅ Task8 评审+diff 视图 — a960880 — 复查通过
- ⏳ **Task9 App 集成（Header + dashboard/review tabs）— a4b7df8 — 已提交、验证全绿（typecheck 干净、web 17/17、App.test.tsx 无 act 警告），但【尚未做任务复查】**
- ⬜ Task10 GitHub Pages 部署（`.github/workflows/pages.yml`）+ README Live Demo 链接 — 未做
- ⬜ 整支最终复查（用最强模型 opus）+ superpowers:finishing-a-development-branch（合并/PR 决策）

当前：web 测试 17 全绿、typecheck 干净、单一 `vite@7.3.6` 实例。

## 如何在新会话续接

1. `cd D:\Downloads\p4pilot`，确认在分支：`git checkout phase2-web-panel`（HEAD 应为 `a4b7df8`）。
2. 读进度账本：`cat .superpowers/sdd/progress.md`（每任务状态 + 累积的 Minor 清单）。读计划：`docs/superpowers/plans/2026-07-16-phase2-web-panel.md`。
3. 调 **superpowers:subagent-driven-development**，从 **Task 9 的任务复查**接着做（复查包命令：`bash <skill>/scripts/review-package a960880 a4b7df8`；brief 在 `.superpowers/sdd/task-9-brief.md`，报告在 `task-9-report.md`）。复查通过后做 **Task 10**，最后 **整支最终复查 + finishing-branch**。
4. skill 脚本目录：`C:\Users\33277\.claude\plugins\cache\claude-plugins-official\superpowers\6.1.1\skills\subagent-driven-development\scripts\`（task-brief / review-package）。

## 本会话学到的关键事实（别再踩坑）

- **版本**：`vitest@4.x` 需要 `vite ^6/^7/^8`。web 已钉 `vite ^7`（单实例，与 `@vitejs/plugin-react@4.7.0` 兼容）；`vite.config.ts` 从 **`vitest/config`** 导入 `defineConfig`。若重装后又冒出重复 vite，跑一次 `npm dedupe`。
- **测试环境分割**：组件测试文件首行加 `// @vitest-environment jsdom`；core/server 测试留 node。根 `npm test`（vitest run）会跑到 web 测试。
- **命令坑**：`npm test -w @p4pilot/core` 不可用（core 无 test 脚本）——用根 `npm test` 或 `npx vitest run packages/core`。`@p4pilot/web` 有 `test` 脚本。
- **未推送**：`origin/main`=`5974103`；Phase 2 所有提交（含 spec/plan）都在本地 `phase2-web-panel`，未 push。
- **网络**：本机到 github.com / api.github.com 不稳（`git push` 常需重试多次；WebFetch 到 github 被安全校验挡）。npm 默认 registry 若失败可回退 `--registry=https://registry.npmmirror.com`。
- **推理网关**（micuapi.ai）偶发 503 / 分类器不可用 / 连接中断——属瞬时，重试即可。
- 桌面 `C:\Users\33277\Desktop\mihayou` 有一份供学习的仓库快照（某检查点，非最新）。

## 待权衡的 Minor（见账本；求职展示品建议做个小打磨 pass）

评审视图切回占位项未清空旧 diff（`setReview(null)`）；assetInfo/review 的过期响应竞态；DiffView 用数组下标做 key；useDemo 的 action 无错误处理。均非阻塞，但面向展示品可顺手修。

## 收尾后需人工一步

合并到 `main` 后，去 GitHub 仓库 Settings → Pages → Source 选 **GitHub Actions**，Pages workflow 才会部署；Live Demo：`https://sdvgdfvds.github.io/p4pilot/`。

## 验证命令（项目根，全绿且无需真实 Perforce）

```bash
npm install
npm run typecheck              # 根 tsc -b（core + mcp-server）
npm test                       # vitest：core 34 + browser 2 + mcp 12 + web 17
npm run build                  # 各包 tsup / vite build
npm run build -w @p4pilot/web  # 单独构建 web 静态站
```

## 杂项

- `docs/GPT-BRIEFING.md`、`p4pilot-给GPT的完整指令.md`：弃用产物，未跟踪、未推送、可删。
- git 作者身份 `sdvgdfvds`；指挥官模型 Opus 4.8 max。

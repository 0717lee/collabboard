# CollabBoard 安全与一致性修复反思报告

**日期**: 2026-07-13
**报告类型**: reflection
**提交类型**: bugfix
**修改文件数**: 39 个文件（含本报告）

## 1. 概述

本次工作对 CollabBoard 的认证、共享权限、实时协作、画布持久化、SVG 导出和客户端存储进行了完整审查与修复。目标是消除越权、认证 fail-open、数据回滚和持久化丢失路径，并建立可重复执行的数据库与自动化回归验证。

## 2. 用户需求与提示词

### 原始需求

- 详细审查项目是否存在 Bug。
- 验证报告问题是否真实并修复全部确认问题。
- 完成最终测试并推送到生产仓库。

### 关键提示词

`安全审查`、`修复所有问题`、`RLS`、`Liveblocks`、`自动保存`、`最终测试`、`Cloudflare Pages`

## 3. 工作流记录

### 执行步骤

1. 追踪认证、白板、共享、Liveblocks 和持久化数据流。
2. 复现并确认权限递归、权限提升、认证竞态和数据覆盖路径。
3. 分批修复客户端状态、服务端房间鉴权、数据库策略和依赖漏洞。
4. 补充单元测试、E2E 和真实 PostgreSQL RLS 回归。
5. 执行 lint、类型检查、构建、依赖审计、密钥扫描和差异检查。

### 决策点

- Liveblocks 权限必须由服务端根据数据库角色签发，不能信任公开 key 或 URL 角色参数。
- RLS 跨表判断使用受限的 `SECURITY DEFINER` 布尔函数，避免策略相互递归。
- 会话恢复使用服务端 `getUser()` 验证，并在超时或无会话时 fail-closed。
- 画布保存使用单飞与快照比较，Liveblocks/数据库冲突按版本时间选择新数据。
- 大型 Zustand 状态迁移至 IndexedDB，保留旧 localStorage 一次性迁移。

### 工具使用

- `rg`、Git diff/status：代码与变更核对。
- Vitest、Playwright、ESLint、TypeScript、Vite：自动化验证。
- PostgreSQL 15 临时容器：migration 幂等性与 RLS 行为验证。
- npm audit：依赖安全验证。

## 4. 修改内容

### 主要模块

- `functions/api/liveblocks-auth.ts`：新增 Cloudflare Pages 房间鉴权端点。
- `supabase/migrations/00001_initial_schema.sql`：统一 schema、GRANT、RLS、触发器和权限保护。
- `src/stores/authStore.ts`：认证恢复 fail-closed、注册/session 校验及用户状态隔离。
- `src/components/Canvas/CanvasBoardInner.tsx`：保存竞态、数据源冲突、角色解析和 SVG 导出修复。
- `src/lib/indexedDbStorage.ts`：大型本地状态迁移到 IndexedDB。
- `src/lib/svgUtils.ts`：SVG 主动内容与外部引用清理。
- `src/lib/liveblocksAuth.ts`：前端鉴权请求与错误处理。
- `src/tests`、`e2e`、`supabase/tests`：新增关键路径回归覆盖。

### 主要变更

- owner/editor/viewer 权限在数据库、Pages Function 和前端三层保持一致。
- 保护白板所有者、公开角色和身份字段，阻止共享编辑者提升权限。
- 自动保存失败不再清除 dirty，保存期间的新编辑不会被误判为已持久化。
- 旧 Liveblocks 数据不能覆盖更新的数据库或本地画布数据。
- 依赖升级后 npm audit 清零，Fabric 7 事件接口与 ECharts 6 加载兼容完成。

## 5. 遇到的错误

- RLS 在 `boards` 与 `shared_boards` 间互相查询，导致递归或权限行为不稳定。
- Liveblocks 房间名包含前缀，但服务端查询需要纯 UUID；旧设计同时缺少服务端鉴权。
- 自动保存发送快照 A 后可能用当前快照 B 标记成功，造成未保存编辑丢失。
- 认证初始化超时继续信任缓存，迟到的 `INITIAL_SESSION` 又可能恢复未验证身份。
- Fabric 7 改用 `scenePoint`，沿用旧 `pointer` 会破坏画布交互。
- 升级 Vite/ECharts 后 CommonJS double-default 造成图表组件加载异常。
- SVG 输出可能包含脚本、事件属性、外部 URL 或 `foreignObject` 主动内容。

## 6. 根本原因分析

问题的共同根因是权限和状态存在多个真源：URL、前端缓存、Liveblocks、Supabase 会话和数据库策略都曾独立决定行为。异步流程又缺少明确的成功契约、版本比较和请求身份校验，导致错误被当成成功或旧状态覆盖新状态。

依赖升级暴露的问题说明关键交互长期依赖库的隐式兼容行为，缺少覆盖真实画布操作与懒加载模块的回归测试。

## 7. 调试过程

### 调查步骤

1. 从调用点反向追踪到 store、SDK 和数据库策略。
2. 将每个报告项映射为具体失败路径和预期安全不变量。
3. 先修复返回值、竞态和状态清理，再处理服务端鉴权与 RLS。
4. 对每次依赖升级引入的行为变化补充针对性测试。
5. 使用真实 PostgreSQL 角色模拟 owner/editor/viewer，验证允许和拒绝路径。

### 迭代过程

- 自动保存从“返回成功标志”迭代为“单飞 + 捕获快照 + 当前值比较”。
- 缓存 reconcile 从“跳过空数组”迭代为“显式记录加载是否成功”。
- Liveblocks 从公开 key 连接迭代为 Cloudflare Pages Function 按房间授权。
- RLS 从互相查询策略迭代为受限 helper 函数和字段级 GRANT/trigger 双重保护。

## 8. 经验总结

### 核心洞察

- 权限必须以数据库事实为准，客户端参数只能用于展示，不能授予能力。
- 异步持久化必须明确区分“请求成功”和“当前状态已保存”。
- 本地会话缓存不是身份验证结果，超时场景必须按未验证处理。
- 安全修复需要同时覆盖允许路径，避免通过禁用合法功能实现表面安全。

### 预防策略

- 所有新增共享角色同时维护数据库策略、服务端授权和端到端测试。
- 所有保存 API 返回显式结果，并对并发、失败、重试和退出路径建测试。
- 数据库 migration 必须可重复执行，并配套权限提升负向断言。
- 升级画布和图表依赖时运行真实交互 E2E，而不只依赖类型检查。

## 9. 知识提炼

### 可复用模式

- 服务端签发短期房间权限，客户端只携带经验证会话。
- `SECURITY DEFINER` helper 仅返回布尔值、固定 `search_path`、撤销 public execute。
- 单飞保存结合不可变快照与版本戳，避免并发状态错认。
- IndexedDB storage adapter 兼容 Zustand，并提供显式迁移和失败日志。

### 应避免的反模式

- 信任 URL 中的角色、客户端缓存或公开协作 key。
- 在超时后继续把缓存认证状态视为有效。
- 保存函数吞掉错误或调用方忽略返回值。
- 用全局 `outline: none` 或静默 fallback 隐藏失败。

### 类似任务检查清单

- [x] 权限允许路径与拒绝路径均有测试。
- [x] migration 首次执行和重复执行均通过。
- [x] lint、单测、构建、E2E 和依赖审计通过。
- [x] 提交前执行密钥扫描与 `git diff --check`。
- [ ] 生产环境配置 Pages Function secrets 并执行真实协作冒烟测试。

## 10. 测试与验证

- ESLint：通过。
- Vitest：12 个测试文件、72 个测试全部通过。
- Production build：通过，包含应用与 Pages Function 类型检查。
- Playwright：44 passed，6 个移动端指针场景按设计跳过。
- npm audit：0 vulnerabilities。
- PostgreSQL 15：migration 首次与重复执行通过，RLS 回归断言全部通过。
- Git 差异检查和密钥扫描：通过。

## 11. 参考资料

- `DEPLOY.md`
- `supabase/migrations/00001_initial_schema.sql`
- `supabase/tests/rls_regression.sql`
- `functions/api/liveblocks-auth.ts`

## 12. 指标

- 已确认问题：全部关闭。
- 严重安全路径：房间未鉴权、RLS 递归/越权、认证 fail-open、SVG 主动内容。
- 修改规模：39 个文件，约 3,300 行新增、3,200 行删除（主要删除来自 lockfile 重算）。
- 自动化结果：72 个单元测试、44 个 E2E、完整 RLS 权限矩阵通过。

---

**生成工具**: OpenAI Codex
**技能**: commit-with-reflection v3.0

# CollabBoard 部署指南

## 方式一：Cloudflare Pages（推荐，当前生产环境）

### 1. 连接 GitHub 仓库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Create Application** → **Pages**
3. 选择 **Connect to Git**，选择 `collabboard` 仓库
4. 构建设置：
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js version**: `22.16.0`

> 仓库已通过 `.node-version` 固定 Cloudflare Pages 的构建 Node 版本。
> Cloudflare Pages 在没有顶层 `404.html` 时会自动按 SPA 方式回退到根入口，因此不需要额外维护 `public/200.html`。

### 2. 配置环境变量

在 Cloudflare Pages 项目设置 → **Environment variables** 中添加：

#### 前端变量（构建时注入，前缀 `VITE_`）

| Key | Value | 说明 |
|-----|-------|------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase 匿名 Key |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | `pk_live_...` | Liveblocks 公钥（现仅作为启用开关，房间鉴权由服务端处理） |

#### 服务端变量（运行时注入 Cloudflare Pages Function，无 `VITE_` 前缀）

| Key | Value | 说明 |
|-----|-------|------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL（与前端相同） |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase service role key（绕过 RLS，仅服务端使用，**切勿暴露到前端**） |
| `LIVEBLOCKS_SECRET_KEY` | `sk_live_...` | Liveblocks 服务端密钥（**切勿暴露到前端**） |

> 服务端变量在 Cloudflare Pages → Settings → Environment variables 中配置时，**不要**加 `VITE_` 前缀，否则会被打包到前端产物中泄露。Cloudflare Pages Functions 通过 `context.env` 访问这些变量。

### Liveblocks 房间鉴权

房间级权限由 `functions/api/liveblocks-auth.ts`（Cloudflare Pages Function）处理：

1. 前端 Liveblocks client 通过鉴权回调 POST 到 `/api/liveblocks-auth`
2. 连接 `collabboard-<board UUID>` 房间时，前端从 Supabase 获取 JWT，并把完整房间 ID 传给鉴权端点
3. 服务端验证 JWT，从房间 ID 提取 board UUID，查 `boards` + `shared_boards` 确定角色
4. owner/editor 获得 `*:write`，viewer 获得 `*:read`，无权限返回 403

> 本地开发时 `vite dev` 不运行 Cloudflare Functions，鉴权请求会 404，房间连接将失败。如需本地测试实时协作，用 `npx wrangler pages dev` 启动。

### 3. 部署

每次推送到 `main` 分支会自动触发构建部署。

---

## 方式二：Vercel

### 1. 安装与登录

```bash
npx vercel login
```

### 2. 初始化部署

```bash
npx vercel
```

按提示操作（全部默认即可）：
- `Set up and deploy?` **[Y]**
- `Which scope?` **[你的用户名]**
- `Link to existing project?` **[N]**
- `Project name?` **[collabboard]**
- `Code location?` **[./]**
- `Modify settings?` **[N]**

然后在 **Settings → General → Node.js Version** 中确认项目使用 `22.x`。

### 3. ⚠️ 配置环境变量

在 Vercel 控制台 → 项目 → **Settings** → **Environment Variables** 添加：

| Key | Value | 说明 |
|-----|-------|------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase 匿名 Key |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | `pk_live_...` 或 `pk_dev_...` | Liveblocks 公钥 |

### 4. 重新部署

```bash
npx vercel --prod
```

如果本地 `.vercel/project.json` 指向了旧项目，先运行：

```bash
npx vercel link
```

---

## 方式三：本地预览

```bash
npm run build
npm run preview
```

## Supabase 数据库设置

项目依赖 Supabase 的以下表结构。完整 migration 见 `supabase/migrations/00001_initial_schema.sql`，可直接在 Supabase SQL Editor 中执行。

### `profiles` 表

| Column | Type | 说明 |
|--------|------|------|
| `id` | UUID | 主键，关联 auth.users |
| `email` | TEXT | 邮箱（注册时由 trigger 自动写入） |
| `name` | TEXT | 用户名 |
| `avatar_url` | TEXT | 头像 URL |
| `created_at` | TIMESTAMPTZ | 创建时间 |

> 注册时由 `on_auth_user_created` trigger 自动创建 profile（security definer），前端无需手动 insert。

### `boards` 表

| Column | Type | 说明 |
|--------|------|------|
| `id` | UUID | 主键 |
| `name` | TEXT | 白板名称 |
| `owner_id` | UUID | 所有者 ID |
| `data` | JSONB | 画布数据（JSON 对象） |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间（由 trigger 自动更新） |

### `shared_boards` 表

| Column | Type | 说明 |
|--------|------|------|
| `id` | UUID | 主键 |
| `board_id` | UUID | 关联 boards.id |
| `user_id` | UUID | 共享用户 ID |
| `role` | TEXT | `editor` 或 `viewer` |
| `created_at` | TIMESTAMPTZ | 创建时间 |

> `shared_boards` 是房间级共享权限的真源。Liveblocks authEndpoint 会查此表决定用户在房间内的角色。`(board_id, user_id)` 唯一约束防止重复共享。

### RLS 策略摘要

- `profiles`：用户只能读写自己的 profile
- `boards`：owner 全权限；显式共享者和公开访问者按角色读取或更新内容；`owner_id`、`id`、`created_at` 不可通过普通更新修改，`public_role` 仅 owner 可修改
- `shared_boards`：board owner 管理（CRUD）；被共享者可读自己的记录；更新后仍必须属于当前 owner 的白板
- `private` 辅助函数：使用 `SECURITY DEFINER` 完成跨表权限判断，避免 `boards` 与 `shared_boards` 的 RLS 策略相互递归

## Supabase 公共 schema 授权模板

说明：
- 这条 Supabase 规则影响的是通过 Data API 访问 `public` schema 新表的场景，也就是 `supabase-js`、PostgREST、GraphQL。
- 当前 schema 与 RLS 迁移位于 `supabase/migrations/00001_initial_schema.sql`。下面模板用于后续新增公共表；生产发布前应先执行并验证 migration。
- 如果某张表只给后端直连 Postgres 使用，不走 Data API，可以按实际情况不做这些 `GRANT`。

```sql
-- 1) 创建表
create table public.your_table (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) 显式授权，避免 Data API 因缺少权限返回 42501
grant select on table public.your_table to anon;
grant select, insert, update, delete on table public.your_table to authenticated;
grant select, insert, update, delete on table public.your_table to service_role;

-- 3) 启用 RLS
alter table public.your_table enable row level security;

-- 4) 最小化策略示例
create policy "users can read their own rows"
  on public.your_table
  for select to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their own rows"
  on public.your_table
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users can update their own rows"
  on public.your_table
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own rows"
  on public.your_table
  for delete to authenticated
  using (auth.uid() = user_id);
```

## 上线检查清单

1. 新表是否创建在 `public` schema。
2. 创建语句后是否紧跟 `GRANT`，不要只写 `create table`。
3. 是否对实际会访问这张表的角色分别授权，避免一把梭给太多权限。
4. 是否启用 RLS，并且策略是否覆盖读、写、删。
5. 是否把 `GRANT` 和 `RLS` 一起放进迁移或初始化脚本，避免手工漏执行。
6. 是否用 `supabase-js` 实测过读写流程，没有触发 `42501`。
7. 是否在 Supabase Dashboard 的 Security Advisor 里复核过既有表。

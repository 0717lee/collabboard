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
   - **Node.js compatibility**: 启用

### 2. 配置环境变量

在 Cloudflare Pages 项目设置 → **Environment variables** 中添加：

| Key | Value | 说明 |
|-----|-------|------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase 匿名 Key |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | `pk_live_...` 或 `pk_dev_...` | Liveblocks 公钥 |

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

---

## 方式三：本地预览

```bash
npm run build
npm run preview
```

## Supabase 数据库设置

项目依赖 Supabase 的以下表结构：

### `profiles` 表

| Column | Type | 说明 |
|--------|------|------|
| `id` | UUID | 主键，关联 auth.users |
| `username` | TEXT | 用户名 |
| `avatar_url` | TEXT | 头像 URL |
| `created_at` | TIMESTAMPTZ | 创建时间 |

### `boards` 表

| Column | Type | 说明 |
|--------|------|------|
| `id` | UUID | 主键 |
| `name` | TEXT | 白板名称 |
| `owner_id` | UUID | 所有者 ID |
| `data` | TEXT | 画布数据（压缩后） |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

### `shared_boards` 表

| Column | Type | 说明 |
|--------|------|------|
| `id` | UUID | 主键 |
| `board_id` | UUID | 关联 boards.id |
| `user_id` | UUID | 共享用户 ID |
| `role` | TEXT | `editor` 或 `viewer` |
| `created_at` | TIMESTAMPTZ | 创建时间 |

> 建议在 Supabase 中启用 RLS（Row Level Security）策略，确保用户只能访问自己的白板和被共享的白板。

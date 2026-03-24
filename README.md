# CollabBoard - 实时协作白板应用

<div align="center">
  <img src="public/favicon.svg" alt="CollabBoard Logo" width="80" height="80">
  
  **支持角色化分享、版本快照与数据可视化的实时协作白板** | [English](./README.en.md)
  
  [![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org/)
  [![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)](https://vite.dev/)
  [![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
  
  🔗 **[在线体验 → collabboard.pages.dev](https://collabboard.pages.dev)**
</div>

## ✨ 功能特性

### 核心功能
- 🎨 **白板绘制** - 自由绘画、形状（矩形/圆形/直线）与文本编辑
- 👥 **实时协作** - 基于 Liveblocks 的多用户同时编辑，实时光标与在线状态
- 🔗 **角色化分享** - 生成“可编辑 / 只读”两种分享链接，邀请好友按权限加入协作
- 🕓 **版本快照** - 支持手动保存快照与自动快照，便于回看与恢复关键节点
- 📊 **数据可视化** - 内置 ECharts 图表（柱状图/折线图/饼图），可添加到画布
- 📁 **文件导出** - 支持 PNG/SVG 格式导出
- ⌨️ **键盘快捷键** - Ctrl+Z 撤销 / Ctrl+Y 重做 / Delete 删除

### 用户体验
- ✨ **Warm Minimalism & Claymorphism** - 全新温润极简态设计，呼吸感阴影与柔和玻璃拟态，打破高反差疲劳
- 🎨 **主题色系** - 以鼠尾草绿与亚麻暖色为核心的视觉锚点，包括全系统的圆角组件与沉浸式协作感
- 📊 **图表自由定制** - 不仅支持添加 ECharts，还能在前端自由选择符合主题风的天然色系
- 🔐 **用户认证** - 基于 Supabase Auth 的完整注册/登录系统
- ⭐ **白板总览** - 支持收藏、最近访问记录，以及“我的白板 / 协作白板”双入口
- 🌐 **中英双语** - 支持中文和英文界面切换
- 📱 **响应式设计** - 适配桌面、平板、手机多端
- ⚡ **性能优化** - 代码分割、图表懒加载、统一保存链路与 Liveblocks 同步防抖

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | React 19 + TypeScript |
| **构建工具** | Vite 7 |
| **状态管理** | Zustand (persist) |
| **UI 组件** | Ant Design 5 |
| **画布引擎** | Fabric.js |
| **实时协作** | Liveblocks |
| **后端/认证** | Supabase (Auth + PostgreSQL) |
| **数据可视化** | ECharts |
| **路由** | React Router 7 |
| **数据压缩** | LZString |
| **测试** | Vitest + Playwright |
| **部署** | Cloudflare Pages |

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/0717lee/collabboard.git
cd collabboard

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173 查看应用

### 环境变量

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_LIVEBLOCKS_PUBLIC_KEY=your_liveblocks_key
```

## 📝 可用脚本

```bash
npm run dev          # 开发模式
npm run build        # 构建生产版本
npm run preview      # 预览生产版本
npm run lint         # 代码检查
npm run test         # 运行单元测试
npm run test:coverage # 查看测试覆盖率
npm run test:e2e     # 运行 E2E 测试
```

首次运行 E2E 测试前需要下载浏览器：`npx playwright install`

当前 Playwright 用例默认运行在本地 mock 认证 / mock 协作环境下，因此不依赖线上 Supabase 或 Liveblocks 凭证即可完成主流程校验。

## 📁 项目结构

```
src/
├── components/          # 可复用组件
│   ├── Canvas/          # 画布核心组件 (CanvasBoardInner, LiveblocksRoom)
│   └── Charts/          # 图表组件 (ChartWidget)
├── features/            # 功能模块
│   ├── auth/            # 用户认证 (登录/注册)
│   ├── board/           # 白板管理 (仪表盘)
│   └── settings/        # 用户设置
├── stores/              # Zustand 状态管理
│   ├── authStore.ts     # 认证状态
│   ├── boardStore.ts    # 白板数据
│   ├── settingsStore.ts # 用户设置
│   └── languageStore.ts # 多语言
├── lib/                 # 工具库 (Supabase Client)
├── styles/              # 全局样式
└── types/               # TypeScript 类型定义
e2e/                     # E2E 测试
```

## 🏗️ 架构设计

### 设计模式
- **Feature-based 模块化** - 按功能划分目录
- **Compound Components** - 复合组件设计
- **Custom Hooks** - 逻辑复用抽象

### 性能优化
- **代码分割** - React.lazy 路由级分割
- **图表按需加载** - 图表编辑面板仅在打开时加载
- **同步防抖** - Liveblocks 推送 300ms 防抖，避免高频写入
- **数据压缩** - LZString 压缩画布数据，分块存储（5×80KB）
- **统一保存链路** - 减少重复序列化、缩略图生成与持久化写入
- **状态选择器** - Zustand 精确订阅

### 实时协作架构
- **Liveblocks Storage** - 画布数据分块同步
- **Loop Prevention** - 远程更新标记防止无限循环
- **Optimistic UI** - 本地即时响应 + 异步同步

## 📄 License

MIT License © 2026

---

<div align="center">
  Made with ❤️ by CollabBoard Team
</div>

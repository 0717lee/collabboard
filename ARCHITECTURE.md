# CollabBoard 技术架构文档

## 1. 系统概览

CollabBoard 是一个基于 React 生态系统的实时协作白板应用。它采用现代前端技术栈，实现了高性能的图形渲染、实时多用户同步和模块化应用架构。

## 2. 技术栈架构

### 核心层 (Core)
- **Framework**: React 19
- **Build Tool**: Vite 7
- **Language**: TypeScript 5.9+

### 视图层 (View)
- **UI Library**: Ant Design 5 (企业级 UI 组件库)
- **Canvas Engine**: Fabric.js 6 (支持 Object-based Canvas 渲染)
- **Charts**: ECharts for React (数据可视化)
- **Icons**: @ant-design/icons
- **Styling**: CSS Modules + Global CSS Variables

### 状态管理层 (State Management)
- **Global State**: Zustand
  - `authStore`: 用户认证与会话管理
  - `boardStore`: 白板列表与CRUD操作
  - `boardHistoryStore`: 版本快照管理
  - `boardLibraryStore`: 白板收藏与最近访问
  - `settingsStore`: 用户偏好设置（网格对齐、自动保存等）
  - `languageStore`: 多语言切换
- **Collaboration State**: Liveblocks
  - `Presence`: 实时光标位置、用户信息
  - `Storage`: 画布数据分块同步 (5×80KB) + 聊天消息

### 路由层 (Routing)
- **Library**: React Router DOM 7
- **Strategy**: 配合 `React.lazy` 实现路由级代码分割
- **Guards**: `ProtectedRoute` 组件拦截未授权访问

## 3. 核心模块设计

### 3.1 画布模块 (`CanvasBoard`)
采用分层架构：
1. **Wrapper Layer (`CanvasBoard.tsx`)**: 
   - 负责初始化 Liveblocks 房间连接 (`LiveblocksRoom`)
   - 注入协作上下文
2. **Logic Layer (`CanvasBoardInner.tsx`)**:
   - **Canvas Initialization**: 初始化 Fabric.js 实例
   - **Tool Management**: 状态机管理当前工具 (Select/Draw/Rect/Circle/Line/Text/StickyNote)
   - **Event Handling**: 处理鼠标事件、对象修改事件
   - **History Manager**: 自定义 Undo/Redo 栈 (最多20步)
   - **Sync Layer**: 监听 Liveblocks `useStorage` 变化同步画布数据
   - **Alignment Guidelines**: 6轴对齐辅助线 + 智能吸附 (5px阈值)
   - **Connector System**: 对象间连接线，支持锚点吸附
   - **Grid Snapping**: 网格对齐 (24px基准)
   - **Object Locking**: 对象锁定/解锁机制

### 3.2 实时协作机制
系统使用 **Serverless WebSocket** (Liveblocks)：
- **Presence Sync**: 
  - 频率限制 (Throttle): 100ms
  - 数据: `{ cursor: {x, y}, name, color }`
- **Storage Sync**: 
  - 画布数据 LZString 压缩后分块存储 (5×80KB)
  - 本地 300ms 防抖 + 远程更新标记防止无限循环
- **Chat**: 内置实时聊天功能 (`ChatSidebar`)，消息通过 Liveblocks Storage 同步
- **Security**: 
  - 前端持有 Public Key (Dev Mode)
  - 生产环境建议切换为 ID Token 模式

### 3.3 认证模块
- 使用 **Supabase Auth** 进行真实用户认证
- 存储: `localStorage` (Zustand persist)
- 支持: 邮箱密码登录/注册、会话管理、Profile 同步
- 监听: `supabase.auth.onAuthStateChange` 实现自动登录
- E2E 测试使用 `mockSupabaseClient` 进行本地模拟

### 3.4 聊天模块 (`ChatSidebar`)
- 基于 Liveblocks Storage 的实时聊天
- 消息以 `LiveList<ChatMessage>` 存储
- 支持: 发送消息、消息列表、用户头像与颜色标识

## 4. 目录结构规范

```
src/
├── components/        # 公共组件
│   ├── Canvas/        # 画布相关复杂业务组件
│   │   ├── CanvasBoard.tsx       # 画布容器
│   │   ├── CanvasBoardInner.tsx  # 画布核心逻辑
│   │   ├── canvasUtils.ts        # 画布工具函数 (对齐/吸附/便签/连接器)
│   │   ├── ChatSidebar.tsx       # 实时聊天侧边栏
│   │   ├── CircularSlider.tsx    # 圆形滑块控件
│   │   ├── LiveblocksCursors.tsx # 协作者光标
│   │   └── VersionHistoryModal.tsx # 版本历史弹窗
│   └── Charts/        # 图表组件 (ChartWidget)
├── features/          # 路由页面级组件
│   ├── auth/          # 登录/注册
│   ├── board/         # 白板仪表盘
│   └── settings/      # 设置
├── stores/            # Zustand Stores
├── lib/               # 工具函数 (Supabase Client, boardUtils, runtimeConfig)
├── styles/            # 全局样式
├── types/             # TypeScript 类型定义
└── tests/             # 单元测试
e2e/                   # E2E 测试
```

## 5. 性能优化策略

1. **代码分割 (Code Splitting)**
   - 路由懒加载
   - 动态导入庞大的第三方库 (`Fabric.js`, `ECharts`)
   - Vite 构建配置 `manualChunks` 分离 Vendor 包

2. **渲染优化**
   - Canvas 独立渲染循环 (Fabric.js 内部机制)
   - 协作光标层与交互层分离
   - 避免 React 重渲染触发 Canvas 重绘 (使用 Ref 引用 Canvas 实例)
   - 图表组件 `React.lazy` 懒加载

3. **数据优化**
   - LZString 压缩画布数据，减少传输体积
   - 300ms 防抖同步，避免高频 Liveblocks 写入
   - 缩略图延迟生成 (600ms)，避免频繁截图

## 6. 部署架构

- **Platform**: Cloudflare Pages (当前生产环境)
- **Strategy**: Single Page Application (SPA)
- **Environment API**: 通过 `.env` 文件注入 Supabase 和 Liveblocks Key
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) 自动构建与测试

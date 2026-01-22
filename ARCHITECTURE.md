# CollabBoard 技术架构文档

## 1. 系统概览

CollabBoard 是一个基于 React 生态系统的实时协作白板应用。它采用现代前端技术栈，实现了高性能的图形渲染、实时多用户同步和模块化应用架构。

## 2. 技术栈架构

### 核心层 (Core)
- **Framework**: React 19
- **Build Tool**: Vite 7
- **Language**: TypeScript 5.7+

### 视图层 (View)
- **UI Library**: Ant Design 5 (企业级 UI 组件库)
- **Canvas Engine**: Fabric.js 6 (支持 Object-based Canvas 渲染)
- **Charts**: ECharts for React (数据可视化)
- **Icons**: @ant-design/icons
- **Styling**: CSS Modules + Global CSS Variables (支持亮色/暗色主题)

### 状态管理层 (State Management)
- **Global State**: Zustand
  - `authStore`: 用户认证与会话管理
  - `boardStore`: 白板列表与CRUD操作
  - `settingsStore`: 用户偏好设置（主题、自动保存等）
- **Collaboration State**: Liveblocks
  - `Presence`: 实时光标位置、用户信息
  - `Broadcast`: 临时事件广播

### 路由层 (Routing)
- **Library**: React Router DOM 6
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
   - **Tool Management**: 状态机管理当前工具 (Select/Draw/Rect/etc.)
   - **Event Handling**: 处理鼠标事件、对象修改事件
   - **History Manager**: 自定义 Undo/Redo 栈
   - **Sync Layer**: 监听 Liveblocks `others` 变化渲染实时光标

### 3.2 实时协作机制
系统不依赖传统 WebSocket 后端，而是使用 **Serverless WebSocket** (Liveblocks)：
- **Presence Sync**: 
  - 频率限制 (Throttle): 100ms
  - 数据: `{ cursor: {x, y}, info: {name, color} }`
- **Security**: 
  - 前端持有 Public Key (Dev Mode)
  - 生产环境建议切换为 ID Token 模式

### 3.3 认证模块
- 目前使用模拟认证 (`AuthService`)
- 存储: `localStorage` (Token)
- 扩展性: 设计了标准的 JWT 流程，可无缝对接真实后端接口

## 4. 目录结构规范

```
src/
├── components/        # 公共组件
│   ├── Canvas/        # 画布相关复杂业务组件
│   └── ...
├── features/          # 路由页面级组件
│   ├── auth/          # 登录/注册
│   ├── dashboard/     # 仪表盘
│   └── settings/      # 设置
├── stores/            # Zustand Stores
├── types/             # TypeScript 类型定义
└── utils/             # 工具函数
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

## 6. 部署架构

- **Platform**: Vercel / Netlify
- **Strategy**: Static Site Generation (SSG) / Single Page Application (SPA)
- **Environment API**: 通过 `.env` 文件注入 Liveblocks Key

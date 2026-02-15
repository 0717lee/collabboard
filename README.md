# CollabBoard - 实时协作白板应用

<div align="center">
  <img src="public/favicon.svg" alt="CollabBoard Logo" width="80" height="80">
  
  **专业级实时协作白板应用** | [English](./README.en.md)
  
  [![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org/)
  [![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)](https://vite.dev/)
  [![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
</div>

## ✨ 功能特性

### 核心功能
- 🎨 **白板绘制** - 自由绘画、形状（矩形/圆形/直线）、文本、便签
- 👥 **实时协作** - 多用户同时编辑，实时光标显示
- � **一键邀请** - 生成分享链接，邀请好友即刻加入协作
- � **数据可视化** - 内置 ECharts 图表（柱状图/折线图/饼图）
- 📁 **文件导出** - 支持 PNG/SVG 格式导出

### 用户体验
- ✨ **Modern Glass UI** - 极简玻璃拟态设计，磨砂质感，沉浸式协作体验
- 🔐 **用户认证** - 完整的注册/登录系统，JWT 模拟
- 📱 **响应式设计** - 完美适配桌面端和移动端
- ⚡ **性能优化** - 代码分割、懒加载

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | React 19 + TypeScript |
| **构建工具** | Vite 7 |
| **状态管理** | Zustand |
| **UI 组件** | Ant Design 5 |
| **画布引擎** | Fabric.js |
| **数据可视化** | ECharts |
| **路由** | React Router 7 |
| **测试** | Vitest + Playwright |

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆项目
git clone <repository-url>
cd collabboard

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173 查看应用


## 📝 可用脚本

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 代码检查
npm run lint

# 运行单元测试
npm run test

# 查看测试覆盖率
npm run test:coverage

# 运行 E2E 测试
npm run test:e2e
```

首次运行 E2E 测试前需要下载浏览器：

```bash
npx playwright install
```

## 📁 项目结构

```
src/
├── components/          # 可复用组件
│   ├── Canvas/          # 画布核心组件
│   └── Charts/          # 图表组件
├── features/            # 功能模块
│   ├── auth/            # 用户认证
│   ├── board/           # 白板管理
│   └── settings/        # 用户设置
├── stores/              # 状态管理
├── styles/              # 全局样式
├── types/               # TypeScript 类型
└── tests/               # 单元测试
e2e/                     # E2E 测试
```

## 🧪 测试

### 单元测试覆盖
- ✅ 认证状态管理（登录/注册/登出）
- ✅ 白板 CRUD 操作
- ✅ 用户设置管理

### E2E 测试场景
- ✅ 完整登录注册流程
- ✅ 白板创建与搜索
- ✅ 画布工具操作
- ✅ 导出功能验证

## 🏗️ 架构设计

### 设计模式
- **Feature-based 模块化** - 按功能划分目录
- **Compound Components** - 复合组件设计
- **Custom Hooks** - 逻辑复用抽象

### 性能优化
- **代码分割** - React.lazy 路由级分割
- **虚拟画布** - Fabric.js 高效渲染
- **状态选择器** - Zustand 精确订阅

### 异常处理
1. **网络断开重连** - WebSocket 自动重连机制
3. **Real-time Sync** - Liveblocks Storage + Optimistic UI + Loop Prevention
4. **Large File Export** - Chunked processing + Progress feedback

## 📄 License

MIT License © 2024

---

<div align="center">
  Made with ❤️ by CollabBoard Team
</div>

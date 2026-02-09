# CollabBoard - Real-time Collaboration Whiteboard

<div align="center">
  <img src="public/favicon.svg" alt="CollabBoard Logo" width="80" height="80">

  **Professional Real-time Collaboration Whiteboard** | [中文](./README.md)

  [![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org/)
  [![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)](https://vite.dev/)
  [![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
</div>

## ✨ Features

### Core Features
- 🎨 **Whiteboard Drawing** - Free drawing, shapes (rectangle/circle/line), text, sticky notes
- 👥 **Real-time Collaboration** - Multi-user editing, real-time cursor display
- 📊 **Data Visualization** - Built-in ECharts (bar/line/pie charts)
- 📁 **Export** - Support PNG/SVG export

### User Experience
- ✨ **Modern Glass UI** - Minimalist glassmorphism design for immersive experience
- 🔐 **Authentication** - Complete registration/login system (JWT mock)
- 🌓 **Dark Mode** - Perfect support for Light/Dark themes
- 📱 **Responsive Design** - Optimized for desktop and mobile
- ⚡ **Performance** - Code splitting, lazy loading

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 7 |
| **State Management** | Zustand |
| **UI Components** | Ant Design 5 |
| **Canvas Engine** | Fabric.js |
| **Charts** | ECharts |
| **Routing** | React Router 7 |
| **Testing** | Vitest + Playwright |

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- npm >= 9

### Installation & Run

```bash
# Clone repository
git clone <repository-url>
cd collabboard

# Install dependencies
npm install

# Start dev server
npm run dev
```

Visit http://localhost:5173 to view the app.


## 📝 Available Scripts

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Run unit tests
npm run test

# Check test coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📁 Project Structure

```
src/
├── components/          # Reusable components
│   ├── Canvas/          # Core canvas components
│   └── Charts/          # Chart components
├── features/            # Feature modules
│   ├── auth/            # User authentication
│   ├── board/           # Board management
│   └── settings/        # User settings
├── stores/              # State management
├── styles/              # Global styles
├── types/               # TypeScript definitions
└── tests/               # Unit tests
e2e/                     # E2E tests
```

## 🧪 Testing

### Unit Test Coverage
- ✅ Auth State (Login/Register/Logout)
- ✅ Board CRUD Operations
- ✅ User Settings
- ✅ Theme Switching

### E2E Scenarios
- ✅ Full Login/Register Flow
- ✅ Board Creation & Search
- ✅ Canvas Tool Operations
- ✅ Export Functionality

## 🏗️ Architecture

### Design Patterns
- **Feature-based Modularization**
- **Compound Components**
- **Custom Hooks**

### Performance
- **Code Splitting** - Route-based lazy loading
- **Virtual Canvas** - Efficient Fabric.js rendering
- **State Selectors** - Precise Zustand subscriptions

### Exception Handling
- **Network Reconnection** - WebSocket auto-reconnect
- **Real-time Sync** - Liveblocks Storage + Loop Prevention Mechanism
- **Large File Export** - Chunked processing

## 📄 License

MIT License © 2024

---

<div align="center">
  Made with ❤️ by CollabBoard Team
</div>

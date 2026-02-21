# CollabBoard - Real-time Collaboration Whiteboard

<div align="center">
  <img src="public/favicon.svg" alt="CollabBoard Logo" width="80" height="80">

  **Professional Real-time Collaboration Whiteboard** | [中文](./README.md)

  [![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org/)
  [![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)](https://vite.dev/)
  [![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

  🔗 **[Live Demo → collabboard.pages.dev](https://collabboard.pages.dev)**
</div>

## ✨ Features

### Core Features
- 🎨 **Whiteboard Drawing** - Free draw, shapes (rect/circle/line), text, sticky notes
- 👥 **Real-time Collaboration** - Multi-user editing via Liveblocks with live cursors & presence
- 🔗 **One-click Invite** - Generate share links to invite collaborators instantly
- 📊 **Data Visualization** - Built-in ECharts (bar/line/pie), embeddable on canvas
- 📁 **Export** - PNG/SVG export support
- ⌨️ **Keyboard Shortcuts** - Ctrl+Z undo / Ctrl+Y redo / Delete remove

### User Experience
- ✨ **Ethereal Glassmorphism** - Minimalist frosted glass design for immersive experience
- 🔐 **Authentication** - Full registration/login via Supabase Auth
- 🌐 **Bilingual** - Chinese & English interface
- 📱 **Responsive** - Adapts to desktop, tablet & mobile
- ⚡ **Performant** - Code splitting, lazy loading, debounced Liveblocks sync

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 7 |
| **State Management** | Zustand (persist) |
| **UI Components** | Ant Design 5 |
| **Canvas Engine** | Fabric.js |
| **Real-time** | Liveblocks |
| **Backend/Auth** | Supabase (Auth + PostgreSQL) |
| **Charts** | ECharts |
| **Routing** | React Router 7 |
| **Compression** | LZString |
| **Testing** | Vitest + Playwright |
| **Deployment** | Cloudflare Pages |

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- npm >= 9

### Installation & Run

```bash
# Clone repository
git clone https://github.com/0717lee/collabboard.git
cd collabboard

# Install dependencies
npm install

# Start dev server
npm run dev
```

Visit http://localhost:5173 to view the app.

### Environment Variables

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_LIVEBLOCKS_PUBLIC_KEY=your_liveblocks_key
```

## 📝 Available Scripts

```bash
npm run dev          # Development mode
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Lint code
npm run test         # Run unit tests
npm run test:coverage # Check test coverage
npm run test:e2e     # Run E2E tests
```

Before running E2E tests for the first time: `npx playwright install`

## 📁 Project Structure

```
src/
├── components/          # Reusable components
│   ├── Canvas/          # Canvas core (CanvasBoardInner, LiveblocksRoom)
│   └── Charts/          # Chart components (ChartWidget)
├── features/            # Feature modules
│   ├── auth/            # Authentication (Login/Register)
│   ├── board/           # Board management (Dashboard)
│   └── settings/        # User settings
├── stores/              # Zustand state management
│   ├── authStore.ts     # Auth state
│   ├── boardStore.ts    # Board data
│   ├── settingsStore.ts # User settings
│   └── languageStore.ts # i18n
├── lib/                 # Utilities (Supabase Client)
├── styles/              # Global styles
└── types/               # TypeScript definitions
e2e/                     # E2E tests
```

## 🏗️ Architecture

### Design Patterns
- **Feature-based Modularization**
- **Compound Components**
- **Custom Hooks**

### Performance
- **Code Splitting** - Route-based lazy loading
- **Debounced Sync** - 300ms debounce on Liveblocks pushes
- **Data Compression** - LZString chunked storage (5×80KB)
- **State Selectors** - Precise Zustand subscriptions

### Real-time Collaboration
- **Liveblocks Storage** - Chunked canvas data sync
- **Loop Prevention** - Remote update flag to prevent infinite cycles
- **Optimistic UI** - Instant local updates + async sync

## 📄 License

MIT License © 2026

---

<div align="center">
  Made with ❤️ by CollabBoard Team
</div>

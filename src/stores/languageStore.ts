import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'zh-CN' | 'en-US';

interface LanguageState {
    language: Language;
    setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: 'zh-CN',
            setLanguage: (language) => set({ language }),
        }),
        {
            name: 'language-storage',
        }
    )
);

// Translation keys
export const translations: Record<Language, Record<string, string>> = {
    'zh-CN': {
        // Auth
        'auth.login': '登录',
        'auth.register': '注册',
        'auth.logout': '退出登录',
        'auth.email': '邮箱',
        'auth.password': '密码',
        'auth.name': '用户名',
        'auth.noAccount': '还没有账号？',
        'auth.haveAccount': '已有账号？',

        // Dashboard
        'dashboard.myBoards': '我的白板',
        'dashboard.newBoard': '新建白板',
        'dashboard.searchPlaceholder': '搜索白板...',
        'dashboard.boardCount': '共 {count} 个白板',
        'dashboard.noBoards': '还没有白板，点击上方按钮创建第一个',
        'dashboard.noMatch': '没有找到匹配的白板',
        'dashboard.createBoard': '创建白板',
        'dashboard.boardName': '白板名称',
        'dashboard.create': '创建',
        'dashboard.cancel': '取消',
        'dashboard.delete': '删除',
        'dashboard.confirmDelete': '确认删除',
        'dashboard.deleteWarning': '删除后无法恢复，确定要删除这个白板吗？',
        'dashboard.updatedAt': '更新于',

        // Canvas
        'canvas.select': '选择',
        'canvas.draw': '画笔',
        'canvas.rectangle': '矩形',
        'canvas.circle': '圆形',
        'canvas.line': '直线',
        'canvas.text': '文字',
        'canvas.sticky': '便签',
        'canvas.undo': '撤销',
        'canvas.redo': '重做',
        'canvas.delete': '删除选中',
        'canvas.export': '导出',
        'canvas.exportPNG': '导出为 PNG',
        'canvas.exportSVG': '导出为 SVG',
        'canvas.addChart': '添加图表',
        'canvas.invite': '邀请',
        'canvas.inviteFriends': '邀请好友协作',
        'canvas.shareDescription': '分享以下链接，邀请好友一起协作编辑这个白板。打开链接的用户将能够实时看到彼此的光标和编辑内容。',
        'canvas.shareLink': '分享链接',
        'canvas.copy': '复制',
        'canvas.copied': '已复制',
        'canvas.linkCopied': '链接已复制到剪贴板！',
        'canvas.onlineUsers': '当前在线',
        'canvas.you': '我 (你)',

        // Settings
        'settings.title': '设置',
        'settings.theme': '主题',
        'settings.themeLight': '浅色',
        'settings.themeDark': '深色',
        'settings.themeSystem': '跟随系统',
        'settings.language': '语言',

        // Common
        'common.settings': '设置',
        'common.loading': '加载中...',
    },
    'en-US': {
        // Auth
        'auth.login': 'Login',
        'auth.register': 'Register',
        'auth.logout': 'Logout',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.name': 'Name',
        'auth.noAccount': "Don't have an account?",
        'auth.haveAccount': 'Already have an account?',

        // Dashboard
        'dashboard.myBoards': 'My Boards',
        'dashboard.newBoard': 'New Board',
        'dashboard.searchPlaceholder': 'Search boards...',
        'dashboard.boardCount': '{count} boards',
        'dashboard.noBoards': 'No boards yet. Click the button above to create your first one.',
        'dashboard.noMatch': 'No matching boards found',
        'dashboard.createBoard': 'Create Board',
        'dashboard.boardName': 'Board Name',
        'dashboard.create': 'Create',
        'dashboard.cancel': 'Cancel',
        'dashboard.delete': 'Delete',
        'dashboard.confirmDelete': 'Confirm Delete',
        'dashboard.deleteWarning': 'This action cannot be undone. Are you sure you want to delete this board?',
        'dashboard.updatedAt': 'Updated',

        // Canvas
        'canvas.select': 'Select',
        'canvas.draw': 'Draw',
        'canvas.rectangle': 'Rectangle',
        'canvas.circle': 'Circle',
        'canvas.line': 'Line',
        'canvas.text': 'Text',
        'canvas.sticky': 'Sticky Note',
        'canvas.undo': 'Undo',
        'canvas.redo': 'Redo',
        'canvas.delete': 'Delete Selected',
        'canvas.export': 'Export',
        'canvas.exportPNG': 'Export as PNG',
        'canvas.exportSVG': 'Export as SVG',
        'canvas.addChart': 'Add Chart',
        'canvas.invite': 'Invite',
        'canvas.inviteFriends': 'Invite Friends',
        'canvas.shareDescription': 'Share the link below to invite friends to collaborate on this board. Users who open the link will see each other\'s cursors and edits in real-time.',
        'canvas.shareLink': 'Share Link',
        'canvas.copy': 'Copy',
        'canvas.copied': 'Copied',
        'canvas.linkCopied': 'Link copied to clipboard!',
        'canvas.onlineUsers': 'Online Now',
        'canvas.you': 'Me (You)',

        // Settings
        'settings.title': 'Settings',
        'settings.theme': 'Theme',
        'settings.themeLight': 'Light',
        'settings.themeDark': 'Dark',
        'settings.themeSystem': 'System',
        'settings.language': 'Language',

        // Common
        'common.settings': 'Settings',
        'common.loading': 'Loading...',
    },
};

// Hook to get translation
export function useTranslation() {
    const { language } = useLanguageStore();

    const t = (key: string, params?: Record<string, string | number>): string => {
        let text = translations[language][key] || key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, String(v));
            });
        }
        return text;
    };

    return { t, language };
}

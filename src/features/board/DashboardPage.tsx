import React, { useEffect, useMemo, useState } from 'react';
import {
    Avatar,
    Button,
    Card,
    Dropdown,
    Empty,
    Form,
    Input,
    Layout,
    Modal,
    Tag,
    Tooltip,
    Typography,
    message,
} from 'antd';
import {
    AppstoreOutlined,
    ClockCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    LogoutOutlined,
    PlusOutlined,
    SearchOutlined,
    SettingOutlined,
    StarFilled,
    StarOutlined,
    TeamOutlined,
    UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { sortBoardsForDisplay } from '@/lib/boardUtils';
import { useAuthStore } from '@/stores/authStore';
import { useBoardLibraryStore } from '@/stores/boardLibraryStore';
import { useBoardStore } from '@/stores/boardStore';
import { useLanguageStore } from '@/stores/languageStore';
import type { Board } from '@/types';
import styles from './Dashboard.module.css';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const formatLocaleDate = (date: string, locale: 'zh-CN' | 'en-US') =>
    new Date(date).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout, hasInitialized, isAuthenticated } = useAuthStore();
    const { boards, sharedBoards, createBoard, deleteBoard, loadBoards } = useBoardStore();
    const {
        entries,
        removeBoard,
        setThumbnail,
        syncBoards,
        toggleFavorite,
        touchBoard,
    } = useBoardLibraryStore();
    const { language } = useLanguageStore();

    const [editingBoard, setEditingBoard] = useState<{ id: string; name: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm();

    const isEn = language === 'en-US';

    useEffect(() => {
        if (hasInitialized && isAuthenticated && user?.id) {
            loadBoards(user.id);
        }
    }, [hasInitialized, isAuthenticated, user?.id, loadBoards]);

    useEffect(() => {
        if (boards.length > 0) {
            syncBoards(boards, 'owned');
        }

        if (sharedBoards.length > 0) {
            syncBoards(sharedBoards, 'shared');
        }
    }, [boards, sharedBoards, syncBoards]);

    const filteredOwnedBoards = useMemo(() => {
        const sorted = sortBoardsForDisplay(boards, entries);
        return sorted.filter((board) => board.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [boards, entries, searchQuery]);

    const filteredSharedBoards = useMemo(() => {
        const sorted = sortBoardsForDisplay(sharedBoards, entries);
        return sorted.filter((board) => board.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [entries, searchQuery, sharedBoards]);

    const totalBoardCount = boards.length + sharedBoards.length;

    const handleCreateBoard = async (values: { name: string }) => {
        if (!user) return;

        const newBoard = await createBoard(values.name);

        if (newBoard) {
            syncBoards([newBoard], 'owned');
            touchBoard(newBoard, 'owner');
            message.success(isEn ? 'Board created!' : '白板创建成功！');
            setIsCreateModalOpen(false);
            form.resetFields();
            navigate(`/board/${newBoard.id}`);
        } else {
            const error = useBoardStore.getState().error;
            message.error(error || (isEn ? 'Failed to create, please retry' : '创建失败，请重试'));
        }
    };

    const handleOpenBoard = (board: Board) => {
        touchBoard(board, board.accessRole || 'owner');
        navigate(`/board/${board.id}`);
    };

    const handleEditStart = (board: { id: string; name: string }, event: React.MouseEvent) => {
        event.stopPropagation();
        setEditingBoard(board);
        form.setFieldsValue({ name: board.name });
        setIsEditModalOpen(true);
    };

    const handleUpdateBoard = async (values: { name: string }) => {
        if (!editingBoard) return;

        const { updateBoard } = useBoardStore.getState();
        await updateBoard(editingBoard.id, { name: values.name });
        syncBoards([
            {
                ...(boards.find((board) => board.id === editingBoard.id)
                    || sharedBoards.find((board) => board.id === editingBoard.id)
                    || {
                        id: editingBoard.id,
                        ownerId: user?.id || '',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    }),
                name: values.name,
                updatedAt: new Date().toISOString(),
            },
        ], 'owned');
        message.success(isEn ? 'Board updated' : '白板已更新');
        setIsEditModalOpen(false);
        setEditingBoard(null);
        form.resetFields();
    };

    const handleToggleFavorite = (board: Board, event: React.MouseEvent) => {
        event.stopPropagation();
        syncBoards([board], board.source || 'owned');
        toggleFavorite(board.id);
    };

    const handleDeleteBoard = async (boardId: string, boardOwnerId: string, event: React.MouseEvent) => {
        if (event.nativeEvent) event.nativeEvent.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();

        if (user?.id !== boardOwnerId) {
            message.error(isEn ? 'Permission denied: You are not the owner' : '权限不足：您不是该白板的创建者');
            return;
        }

        if (!window.confirm(isEn ? 'Are you sure you want to delete this board?' : '确定要删除这个白板吗？\n删除后无法恢复。')) {
            return;
        }

        const hideHelper = message.loading(isEn ? 'Deleting...' : '正在删除...', 0);

        try {
            const timeoutPromise = new Promise<{ success: boolean; error: string }>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );

            const result = await Promise.race([deleteBoard(boardId), timeoutPromise]) as { success: boolean; error?: string };

            hideHelper();

            if (result.success) {
                removeBoard(boardId);
                message.success(isEn ? 'Deleted successfully' : '白板已删除');
            } else {
                message.error(result.error || (isEn ? 'Delete failed' : '删除失败'));
            }
        } catch (error) {
            hideHelper();
            console.error('Delete error:', error);
            message.error(isEn ? 'An error occurred' : '操作超时或失败');
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
            message.info(isEn ? 'Logged out' : '已退出登录');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    const renderBoardCard = (board: Board, section: 'owned' | 'shared') => {
        const entry = entries[board.id];
        const isFavorite = entry?.isFavorite;
        const lastOpenedAt = entry?.lastOpenedAt;
        const roleLabel = board.accessRole === 'viewer'
            ? (isEn ? 'View only' : '只读')
            : board.accessRole === 'editor'
                ? (isEn ? 'Can edit' : '可编辑')
                : null;

        const actions = [
            <Tooltip title={isFavorite ? (isEn ? 'Remove favorite' : '取消收藏') : (isEn ? 'Favorite' : '收藏')} key="favorite">
                {isFavorite ? (
                    <StarFilled className={styles.favoriteActionActive} onClick={(event) => handleToggleFavorite(board, event)} />
                ) : (
                    <StarOutlined className={styles.favoriteAction} onClick={(event) => handleToggleFavorite(board, event)} />
                )}
            </Tooltip>,
        ];

        if (section === 'owned') {
            actions.push(
                <Tooltip title={isEn ? 'Rename' : '编辑名称'} key="edit">
                    <EditOutlined onClick={(event) => handleEditStart(board, event)} />
                </Tooltip>,
                <Tooltip title={isEn ? 'Delete' : '删除'} key="delete">
                    <DeleteOutlined
                        onClick={(event) => handleDeleteBoard(board.id, board.ownerId, event)}
                        style={{ color: 'red' }}
                    />
                </Tooltip>
            );
        }

        return (
            <Card
                key={board.id}
                className={styles.boardCard}
                hoverable
                onClick={() => handleOpenBoard(board)}
                cover={(
                    <div className={styles.boardThumbnail}>
                        {entry?.thumbnail ? (
                            <>
                                <img
                                    src={entry.thumbnail}
                                    alt={board.name}
                                    className={styles.boardThumbnailImage}
                                    onError={() => setThumbnail(board.id, undefined)}
                                />
                                <div className={styles.thumbnailOverlay} />
                            </>
                        ) : (
                            <div className={styles.thumbnailPlaceholder}>
                                {section === 'shared' ? <TeamOutlined /> : <AppstoreOutlined />}
                            </div>
                        )}
                    </div>
                )}
                actions={actions}
            >
                <Card.Meta
                    title={board.name}
                    description={(
                        <div className={styles.boardMeta}>
                            <div className={styles.boardTags}>
                                {section === 'shared' && (
                                    <Tag color="geekblue" className={styles.boardTag}>
                                        <TeamOutlined /> {isEn ? 'Shared' : '协作'}
                                    </Tag>
                                )}
                                {roleLabel && (
                                    <Tag color={board.accessRole === 'viewer' ? 'default' : 'green'} className={styles.boardTag}>
                                        {board.accessRole === 'viewer' ? <EyeOutlined /> : <EditOutlined />} {roleLabel}
                                    </Tag>
                                )}
                                {isFavorite && (
                                    <Tag color="gold" className={styles.boardTag}>
                                        <StarFilled /> {isEn ? 'Favorite' : '收藏'}
                                    </Tag>
                                )}
                            </div>

                            <Paragraph type="secondary" ellipsis className={styles.boardDate}>
                                {isEn ? 'Updated' : '更新于'} {formatLocaleDate(board.updatedAt, language)}
                            </Paragraph>

                            {lastOpenedAt && (
                                <Text type="secondary" className={styles.boardRecent}>
                                    <ClockCircleOutlined /> {isEn ? 'Visited' : '最近访问'} {formatLocaleDate(lastOpenedAt, language)}
                                </Text>
                            )}
                        </div>
                    )}
                />
            </Card>
        );
    };

    const userMenuItems = [
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: isEn ? 'Settings' : '设置',
            onClick: () => navigate('/settings'),
        },
        { type: 'divider' as const },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: isEn ? 'Logout' : '退出登录',
            onClick: handleLogout,
            danger: true,
        },
    ];

    const renderSection = (title: string, description: string, boardsToRender: Board[], section: 'owned' | 'shared') => {
        if (boardsToRender.length === 0) {
            return null;
        }

        return (
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div>
                        <Title level={4} className={styles.sectionTitle}>{title}</Title>
                        <Text type="secondary" className={styles.sectionDescription}>{description}</Text>
                    </div>
                </div>

                <div className={styles.boardGrid}>
                    {boardsToRender.map((board) => renderBoardCard(board, section))}
                </div>
            </section>
        );
    };

    const emptyDescription = searchQuery
        ? (isEn ? 'No matching boards found' : '没有找到匹配的白板')
        : totalBoardCount === 0
            ? (isEn ? 'No boards yet. Click the button above to create one.' : '还没有白板，点击上方按钮创建第一个')
            : (isEn ? 'No boards in this view yet.' : '当前分类下还没有白板');

    return (
        <Layout className={styles.dashboardLayout}>
            <Header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.logo}>
                        <Logo size={28} className={styles.logoIcon} />
                        <span className={styles.logoText}>CollabBoard</span>
                    </div>
                </div>

                <div className={styles.headerCenter}>
                    <Input
                        placeholder={isEn ? 'Search boards...' : '搜索白板...'}
                        prefix={<SearchOutlined />}
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className={styles.searchInput}
                        allowClear
                    />
                </div>

                <div className={styles.headerRight}>
                    <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                        <div className={styles.userInfo}>
                            <Avatar icon={<UserOutlined />} className={styles.avatar} />
                            <span className={styles.userName}>{user?.name}</span>
                        </div>
                    </Dropdown>
                </div>
            </Header>

            <Content className={styles.content}>
                <div className={styles.contentHeader}>
                    <div>
                        <Title level={2} className={styles.pageTitle}>
                            <AppstoreOutlined /> {isEn ? 'Boards Library' : '白板总览'}
                        </Title>
                        <Text type="secondary">
                            {isEn ? `${totalBoardCount} boards across owned and shared spaces` : `共 ${totalBoardCount} 个白板，含我的白板与协作白板`}
                        </Text>
                    </div>

                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        size="large"
                        onClick={() => setIsCreateModalOpen(true)}
                        className={styles.createButton}
                    >
                        {isEn ? 'New Board' : '新建白板'}
                    </Button>
                </div>

                {filteredOwnedBoards.length === 0 && filteredSharedBoards.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Empty description={emptyDescription} />
                    </div>
                ) : (
                    <>
                        {renderSection(
                            isEn ? 'My Boards' : '我的白板',
                            isEn ? `${boards.length} owned boards` : `${boards.length} 个我创建的白板`,
                            filteredOwnedBoards,
                            'owned'
                        )}
                        {renderSection(
                            isEn ? 'Shared With Me' : '协作白板',
                            isEn ? `${sharedBoards.length} recently opened shared boards` : `${sharedBoards.length} 个最近访问的协作白板`,
                            filteredSharedBoards,
                            'shared'
                        )}
                    </>
                )}
            </Content>

            <Modal
                title={isEn ? 'New Board' : '新建白板'}
                open={isCreateModalOpen}
                onCancel={() => {
                    setIsCreateModalOpen(false);
                    form.resetFields();
                }}
                footer={null}
                centered
                className={styles.createModal}
            >
                <Form form={form} onFinish={handleCreateBoard} layout="vertical">
                    <Form.Item
                        name="name"
                        label={isEn ? 'Board Name' : '白板名称'}
                        rules={[
                            { required: true, message: isEn ? 'Please enter board name' : '请输入白板名称' },
                            { max: 50, message: isEn ? 'Name cannot exceed 50 characters' : '名称不能超过50个字符' },
                        ]}
                    >
                        <Input placeholder={isEn ? 'Enter board name' : '输入白板名称'} autoFocus />
                    </Form.Item>
                    <Form.Item className={styles.modalFooter}>
                        <Button onClick={() => setIsCreateModalOpen(false)} className={styles.cancelBtn}>
                            {isEn ? 'Cancel' : '取消'}
                        </Button>
                        <Button type="primary" htmlType="submit">
                            {isEn ? 'Create' : '创建'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={isEn ? 'Rename Board' : '重命名白板'}
                open={isEditModalOpen}
                onCancel={() => {
                    setIsEditModalOpen(false);
                    setEditingBoard(null);
                    form.resetFields();
                }}
                footer={null}
                centered
            >
                <Form form={form} onFinish={handleUpdateBoard} layout="vertical" initialValues={{ name: editingBoard?.name }}>
                    <Form.Item
                        name="name"
                        label={isEn ? 'Board Name' : '白板名称'}
                        rules={[
                            { required: true, message: isEn ? 'Please enter board name' : '请输入白板名称' },
                            { max: 50, message: isEn ? 'Name cannot exceed 50 characters' : '名称不能超过50个字符' },
                        ]}
                    >
                        <Input placeholder={isEn ? 'Enter board name' : '输入白板名称'} autoFocus />
                    </Form.Item>
                    <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0 }}>
                        <Button onClick={() => setIsEditModalOpen(false)} style={{ marginRight: 8 }}>
                            {isEn ? 'Cancel' : '取消'}
                        </Button>
                        <Button type="primary" htmlType="submit">
                            {isEn ? 'Save' : '保存'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default DashboardPage;

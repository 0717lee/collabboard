/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
    Layout,
    Card,
    Button,
    Input,
    Typography,
    Avatar,
    Dropdown,
    Modal,
    Form,
    Empty,
    Tooltip,
    message,
} from 'antd';
import {
    PlusOutlined,
    SearchOutlined,
    UserOutlined,
    SettingOutlined,
    LogoutOutlined,
    DeleteOutlined,
    EditOutlined,
    AppstoreOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useBoardStore } from '@/stores/boardStore';
import { useLanguageStore } from '@/stores/languageStore';
import styles from './Dashboard.module.css';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { boards, createBoard, deleteBoard, loadBoards } = useBoardStore();
    const { language } = useLanguageStore();
    const [editingBoard, setEditingBoard] = useState<{ id: string; name: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm();

    const isEn = language === 'en-US';

    // Load boards on mount
    useEffect(() => {
        if (user?.id) {
            loadBoards(user.id);
        }
    }, [user?.id, loadBoards]);

    const filteredBoards = boards.filter((b) =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateBoard = async (values: { name: string }) => {
        if (!user) {
            alert('DEBUG: User is missing in DashboardPage');
            return;
        }
        console.log('Creating board with name:', values.name);

        try {
            const newBoard = await createBoard(values.name);
            console.log('Create result:', newBoard);

            if (newBoard) {
                message.success(isEn ? 'Board created!' : '白板创建成功！');
                setIsCreateModalOpen(false);
                form.resetFields();
                navigate(`/board/${newBoard.id}`);
            } else {
                const error = useBoardStore.getState().error;
                console.error('Create failed, store error:', error);

                // Show specific error using alert for visibility
                alert(`CREATE ERROR: ${error || 'Unknown error'}`);
            }
        } catch (e: any) {
            console.error('Create exception:', e);
            alert('CREATE EXCEPTION: ' + e.message);
        }
    };

    const handleEditStart = (board: { id: string; name: string }, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingBoard(board);
        form.setFieldsValue({ name: board.name });
        setIsEditModalOpen(true);
    };

    const handleUpdateBoard = async (values: { name: string }) => {
        if (!editingBoard) return;
        // Assume updateBoard is available from store (it is)
        const { updateBoard } = useBoardStore.getState();
        await updateBoard(editingBoard.id, { name: values.name });
        message.success(isEn ? 'Board updated' : '白板已更新');
        setIsEditModalOpen(false);
        setEditingBoard(null);
        form.resetFields();
    };

    const handleDeleteBoard = async (boardId: string, boardOwnerId: string, e: React.MouseEvent) => {
        // Critical: Prevent event bubbling to card click
        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();

        // Permission check
        if (user?.id !== boardOwnerId) {
            message.error(isEn ? 'Permission denied: You are not the owner' : '权限不足：您不是该白板的创建者');
            return;
        }

        // Use native window.confirm for maximum reliability
        // AntD Modal can have z-index/propagation issues in this context
        if (!window.confirm(isEn ? 'Are you sure you want to delete this board?' : '确定要删除这个白板吗？\n删除后无法恢复。')) {
            return;
        }

        const hideHelper = message.loading(isEn ? 'Deleting...' : '正在删除...', 0);

        try {
            // Race against a 10s timeout to detect hangs
            const timeoutPromise = new Promise<{ success: boolean; error: string }>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );

            const deletePromise = deleteBoard(boardId);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await Promise.race([deletePromise, timeoutPromise]) as any;

            hideHelper();

            if (result.success) {
                message.success(isEn ? 'Deleted successfully' : '白板已删除');
            } else {
                message.error(result.error || (isEn ? 'Delete failed' : '删除失败'));
            }
        } catch (err) {
            hideHelper();
            console.error('Delete error:', err);
            message.error(isEn ? 'An error occurred' : '操作超时或失败');
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
            message.info(isEn ? 'Logged out' : '已退出登录');
        } catch (e) {
            console.error('Logout failed', e);
        }
    };

    // ... userMenuItems ...

    // And update the return JSX for Cards
    // actions={[
    //    <Tooltip title="编辑名称" key="edit">
    //        <EditOutlined onClick={(e) => handleEditStart(board, e)} />
    //    </Tooltip>,
    //    ...
    // ]}

    // And add Edit Modal at the bottom
    /*
            <Modal
                title={isEn ? 'Edit Board Name' : '编辑白板名称'}
                open={isEditModalOpen}
                onCancel={() => {
                    setIsEditModalOpen(false);
                    setEditingBoard(null);
                    form.resetFields();
                }}
                footer={null}
                centered
            >
                <Form form={form} onFinish={handleUpdateBoard} layout="vertical">
                    ...
                </Form>
            </Modal>
    */

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

    return (
        <Layout className={styles.dashboardLayout}>
            <Header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.logo}>
                        <span className={styles.logoIcon}>◇</span>
                        <span className={styles.logoText}>CollabBoard</span>
                    </div>
                </div>

                <div className={styles.headerCenter}>
                    <Input
                        placeholder={isEn ? "Search boards..." : "搜索白板..."}
                        prefix={<SearchOutlined />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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
                            <AppstoreOutlined /> {isEn ? 'My Boards' : '我的白板'}
                        </Title>
                        <Text type="secondary">
                            {isEn ? `${boards.length} boards` : `共 ${boards.length} 个白板`}
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

                <div className={styles.boardGrid}>
                    {filteredBoards.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Empty
                                description={
                                    searchQuery
                                        ? (isEn ? 'No matching boards found' : '没有找到匹配的白板')
                                        : (isEn ? 'No boards yet. Click the button above to create one.' : '还没有白板，点击上方按钮创建第一个')
                                }
                            />
                        </div>
                    ) : (
                        filteredBoards.map((board) => (
                            <Card
                                key={board.id}
                                className={styles.boardCard}
                                hoverable
                                onClick={() => navigate(`/board/${board.id}`)}
                                cover={
                                    <div className={styles.boardThumbnail}>
                                        <div className={styles.thumbnailPlaceholder}>
                                            <AppstoreOutlined />
                                        </div>
                                    </div>
                                }
                                actions={[
                                    <Tooltip title={isEn ? "Rename" : "编辑名称"} key="edit">
                                        <EditOutlined onClick={(e) => handleEditStart(board, e)} />
                                    </Tooltip>,
                                    <Tooltip title={isEn ? "Delete" : "删除"} key="delete">
                                        <DeleteOutlined
                                            onClick={(e) => handleDeleteBoard(board.id, board.ownerId, e)}
                                            style={{ color: 'red' }}
                                        />
                                    </Tooltip>,
                                ]}
                            >
                                <Card.Meta
                                    title={board.name}
                                    description={
                                        <Paragraph type="secondary" ellipsis className={styles.boardDate}>
                                            {isEn ? 'Updated' : '更新于'} {new Date(board.updatedAt).toLocaleDateString(isEn ? 'en-US' : 'zh-CN')}
                                        </Paragraph>
                                    }
                                />
                            </Card>
                        ))
                    )}
                </div>
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
                        <Button onClick={() => setIsCreateModalOpen(false)}>{isEn ? 'Cancel' : '取消'}</Button>
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

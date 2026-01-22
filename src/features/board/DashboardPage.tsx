import React, { useState } from 'react';
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
import styles from './Dashboard.module.css';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { boards, createBoard, deleteBoard } = useBoardStore();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm();

    const userBoards = boards.filter((b) => b.ownerId === user?.id);
    const filteredBoards = userBoards.filter((b) =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateBoard = (values: { name: string }) => {
        if (!user) return;
        const newBoard = createBoard(values.name, user.id);
        message.success('白板创建成功！');
        setIsCreateModalOpen(false);
        form.resetFields();
        navigate(`/board/${newBoard.id}`);
    };

    const handleDeleteBoard = (boardId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        Modal.confirm({
            title: '确认删除',
            content: '删除后无法恢复，确定要删除这个白板吗？',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: () => {
                deleteBoard(boardId);
                message.success('已删除');
            },
        });
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
        message.info('已退出登录');
    };

    const userMenuItems = [
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: '设置',
            onClick: () => navigate('/settings'),
        },
        { type: 'divider' as const },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: '退出登录',
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
                        placeholder="搜索白板..."
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
                            <AppstoreOutlined /> 我的白板
                        </Title>
                        <Text type="secondary">
                            共 {userBoards.length} 个白板
                        </Text>
                    </div>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        size="large"
                        onClick={() => setIsCreateModalOpen(true)}
                        className={styles.createButton}
                    >
                        新建白板
                    </Button>
                </div>

                <div className={styles.boardGrid}>
                    {filteredBoards.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Empty
                                description={
                                    searchQuery
                                        ? '没有找到匹配的白板'
                                        : '还没有白板，点击上方按钮创建第一个'
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
                                    <Tooltip title="编辑名称" key="edit">
                                        <EditOutlined />
                                    </Tooltip>,
                                    <Tooltip title="删除" key="delete">
                                        <DeleteOutlined
                                            onClick={(e) => handleDeleteBoard(board.id, e)}
                                        />
                                    </Tooltip>,
                                ]}
                            >
                                <Card.Meta
                                    title={board.name}
                                    description={
                                        <Paragraph type="secondary" ellipsis className={styles.boardDate}>
                                            更新于 {new Date(board.updatedAt).toLocaleDateString('zh-CN')}
                                        </Paragraph>
                                    }
                                />
                            </Card>
                        ))
                    )}
                </div>
            </Content>

            <Modal
                title="新建白板"
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
                        label="白板名称"
                        rules={[
                            { required: true, message: '请输入白板名称' },
                            { max: 50, message: '名称不能超过50个字符' },
                        ]}
                    >
                        <Input placeholder="输入白板名称" autoFocus />
                    </Form.Item>
                    <Form.Item className={styles.modalFooter}>
                        <Button onClick={() => setIsCreateModalOpen(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">
                            创建
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default DashboardPage;

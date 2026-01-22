import React from 'react';
import {
    Layout,
    Card,
    Typography,
    Switch,
    Select,
    Button,
    Divider,
    Space,
    message,
} from 'antd';
import {
    ArrowLeftOutlined,
    BulbOutlined,
    ReloadOutlined,
    LayoutOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settingsStore';
import styles from './Settings.module.css';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings, updateSettings, toggleTheme, resetSettings } = useSettingsStore();

    const handleReset = () => {
        resetSettings();
        message.success('设置已重置');
    };

    const themeColors = [
        { value: '#1890ff', label: '默认蓝' },
        { value: '#667eea', label: '紫罗兰' },
        { value: '#52c41a', label: '极光绿' },
        { value: '#fa541c', label: '日落橙' },
        { value: '#eb2f96', label: '法式洋红' },
    ];

    return (
        <Layout className={styles.settingsLayout}>
            <Header className={styles.header}>
                <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/dashboard')}
                />
                <Title level={4} className={styles.headerTitle}>
                    设置
                </Title>
                <div style={{ width: 32 }} />
            </Header>

            <Content className={styles.content}>
                <div className={styles.settingsGrid}>
                    {/* Appearance */}
                    <Card className={styles.settingCard}>
                        <div className={styles.cardHeader}>
                            <BulbOutlined className={styles.cardIcon} />
                            <Title level={5}>外观</Title>
                        </div>

                        <div className={styles.settingItem}>
                            <div className={styles.settingInfo}>
                                <Text strong>深色模式</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    切换深色/浅色主题
                                </Paragraph>
                            </div>
                            <Switch
                                checked={settings.theme.mode === 'dark'}
                                onChange={toggleTheme}
                            />
                        </div>

                        <Divider />

                        <div className={styles.settingItem}>
                            <div className={styles.settingInfo}>
                                <Text strong>主题色</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    选择应用主题颜色
                                </Paragraph>
                            </div>
                            <Select
                                value={settings.theme.primaryColor}
                                onChange={(color) => updateSettings({ theme: { ...settings.theme, primaryColor: color } })}
                                style={{ width: 120 }}
                            >
                                {themeColors.map((color) => (
                                    <Select.Option key={color.value} value={color.value}>
                                        <Space>
                                            <span
                                                className={styles.colorDot}
                                                style={{ backgroundColor: color.value }}
                                            />
                                            {color.label}
                                        </Space>
                                    </Select.Option>
                                ))}
                            </Select>
                        </div>
                    </Card>

                    {/* Canvas Settings */}
                    <Card className={styles.settingCard}>
                        <div className={styles.cardHeader}>
                            <LayoutOutlined className={styles.cardIcon} />
                            <Title level={5}>画布</Title>
                        </div>

                        <div className={styles.settingItem}>
                            <div className={styles.settingInfo}>
                                <Text strong>自动保存</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    每5秒自动保存画布内容
                                </Paragraph>
                            </div>
                            <Switch
                                checked={settings.autoSave}
                                onChange={(checked) => updateSettings({ autoSave: checked })}
                            />
                        </div>

                        <Divider />

                        <div className={styles.settingItem}>
                            <div className={styles.settingInfo}>
                                <Text strong>显示网格</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    在画布上显示辅助网格
                                </Paragraph>
                            </div>
                            <Switch
                                checked={settings.showGrid}
                                onChange={(checked) => updateSettings({ showGrid: checked })}
                            />
                        </div>

                        <Divider />

                        <div className={styles.settingItem}>
                            <div className={styles.settingInfo}>
                                <Text strong>吸附到网格</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    对象自动对齐到网格
                                </Paragraph>
                            </div>
                            <Switch
                                checked={settings.snapToGrid}
                                onChange={(checked) => updateSettings({ snapToGrid: checked })}
                            />
                        </div>
                    </Card>

                    {/* Reset */}
                    <Card className={styles.settingCard}>
                        <div className={styles.cardHeader}>
                            <ReloadOutlined className={styles.cardIcon} />
                            <Title level={5}>重置</Title>
                        </div>

                        <Paragraph type="secondary">
                            将所有设置恢复为默认值。此操作不会影响您的白板数据。
                        </Paragraph>

                        <Button
                            danger
                            icon={<ReloadOutlined />}
                            onClick={handleReset}
                            className={styles.resetButton}
                        >
                            重置所有设置
                        </Button>
                    </Card>
                </div>
            </Content>
        </Layout>
    );
};

export default SettingsPage;

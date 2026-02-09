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
    GlobalOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settingsStore';
import { useLanguageStore, Language } from '@/stores/languageStore';
import styles from './Settings.module.css';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings, updateSettings, toggleTheme, resetSettings } = useSettingsStore();
    const { language, setLanguage } = useLanguageStore();

    const handleReset = () => {
        resetSettings();
        message.success(language === 'zh-CN' ? '设置已重置' : 'Settings reset');
    };

    const languageOptions = [
        { value: 'zh-CN' as Language, label: '简体中文' },
        { value: 'en-US' as Language, label: 'English' },
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
                    {language === 'zh-CN' ? '设置' : 'Settings'}
                </Title>
                <div style={{ width: 32 }} />
            </Header>

            <Content className={styles.content}>
                <div className={styles.settingsGrid}>
                    {/* Appearance */}
                    <Card className={styles.settingCard}>
                        <div className={styles.cardHeader}>
                            <BulbOutlined className={styles.cardIcon} />
                            <Title level={5}>{language === 'zh-CN' ? '外观' : 'Appearance'}</Title>
                        </div>

                        <div className={styles.settingItem}>
                            <div className={styles.settingInfo}>
                                <Text strong>{language === 'zh-CN' ? '深色模式' : 'Dark Mode'}</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    {language === 'zh-CN' ? '切换深色/浅色主题' : 'Switch between dark/light theme'}
                                </Paragraph>
                            </div>
                            <Switch
                                checked={settings.theme.mode === 'dark'}
                                onChange={toggleTheme}
                            />
                        </div>
                    </Card>

                    {/* Language Settings */}
                    <Card className={styles.settingCard}>
                        <div className={styles.cardHeader}>
                            <GlobalOutlined className={styles.cardIcon} />
                            <Title level={5}>{language === 'zh-CN' ? '语言' : 'Language'}</Title>
                        </div>

                        <div className={styles.settingItem}>
                            <div className={styles.settingInfo}>
                                <Text strong>{language === 'zh-CN' ? '界面语言' : 'Interface Language'}</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    {language === 'zh-CN' ? '选择应用显示语言' : 'Choose display language'}
                                </Paragraph>
                            </div>
                            <Select
                                value={language}
                                onChange={(value) => setLanguage(value)}
                                style={{ width: 140 }}
                            >
                                {languageOptions.map((option) => (
                                    <Select.Option key={option.value} value={option.value}>
                                        {option.label}
                                    </Select.Option>
                                ))}
                            </Select>
                        </div>
                    </Card>

                    {/* Canvas Settings */}
                    <Card className={styles.settingCard}>
                        <div className={styles.cardHeader}>
                            <LayoutOutlined className={styles.cardIcon} />
                            <Title level={5}>{language === 'zh-CN' ? '画布' : 'Canvas'}</Title>
                        </div>

                        <div className={styles.settingItem}>
                            <div className={styles.settingInfo}>
                                <Text strong>{language === 'zh-CN' ? '自动保存' : 'Auto Save'}</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    {language === 'zh-CN' ? '每5秒自动保存画布内容' : 'Auto-save canvas every 5 seconds'}
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
                                <Text strong>{language === 'zh-CN' ? '显示网格' : 'Show Grid'}</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    {language === 'zh-CN' ? '在画布上显示辅助网格' : 'Display helper grid on canvas'}
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
                                <Text strong>{language === 'zh-CN' ? '吸附到网格' : 'Snap to Grid'}</Text>
                                <Paragraph type="secondary" className={styles.settingDesc}>
                                    {language === 'zh-CN' ? '对象自动对齐到网格' : 'Auto-align objects to grid'}
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
                            <Title level={5}>{language === 'zh-CN' ? '重置' : 'Reset'}</Title>
                        </div>

                        <Paragraph type="secondary">
                            {language === 'zh-CN'
                                ? '将所有设置恢复为默认值。此操作不会影响您的白板数据。'
                                : 'Reset all settings to default. This will not affect your board data.'}
                        </Paragraph>

                        <Button
                            danger
                            icon={<ReloadOutlined />}
                            onClick={handleReset}
                            className={styles.resetButton}
                        >
                            {language === 'zh-CN' ? '重置所有设置' : 'Reset All Settings'}
                        </Button>
                    </Card>
                </div>
            </Content>
        </Layout>
    );
};

export default SettingsPage;

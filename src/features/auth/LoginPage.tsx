import React from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import styles from './Auth.module.css';

const { Title, Text } = Typography;

interface LoginFormValues {
    email: string;
    password: string;
}

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useAuthStore();
    const [form] = Form.useForm();

    const handleSubmit = async (values: LoginFormValues) => {
        clearError();
        const success = await login(values.email, values.password);
        if (success) {
            message.success('登录成功！');
            navigate('/dashboard');
        }
    };

    return (
        <div className={styles.authContainer}>
            <div className={styles.authBackground}>
                <div className={styles.gradientOrb1} />
                <div className={styles.gradientOrb2} />
            </div>

            <Card className={styles.authCard} bordered={false}>
                <div className={styles.logoSection}>
                    <div className={styles.logo}>
                        <span className={styles.logoIcon}>◇</span>
                        <span className={styles.logoText}>CollabBoard</span>
                    </div>
                    <Title level={3} className={styles.title}>欢迎回来</Title>
                    <Text type="secondary">登录以继续使用协作白板</Text>
                </div>

                <Form
                    form={form}
                    name="login"
                    onFinish={handleSubmit}
                    layout="vertical"
                    size="large"
                    className={styles.form}
                >
                    <Form.Item
                        name="email"
                        rules={[
                            { required: true, message: '请输入邮箱' },
                            { type: 'email', message: '请输入有效的邮箱地址' },
                        ]}
                    >
                        <Input
                            prefix={<MailOutlined />}
                            placeholder="邮箱地址"
                            autoComplete="email"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: '请输入密码' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="密码"
                            autoComplete="current-password"
                        />
                    </Form.Item>

                    {error && (
                        <div className={styles.errorMessage}>
                            {error}
                        </div>
                    )}

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={isLoading}
                            block
                            className={styles.submitButton}
                        >
                            登录
                        </Button>
                    </Form.Item>
                </Form>

                <div className={styles.authFooter}>
                    <Text type="secondary">还没有账号？</Text>
                    <Link to="/register">立即注册</Link>
                </div>
            </Card>
        </div>
    );
};

export default LoginPage;

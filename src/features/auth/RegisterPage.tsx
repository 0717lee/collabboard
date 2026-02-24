import React from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Logo } from '@/components/Logo';
import styles from './Auth.module.css';

const { Title, Text } = Typography;

interface RegisterFormValues {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { register, isLoading, error, clearError } = useAuthStore();
    const [form] = Form.useForm();

    // Get the redirect target from location state (set by ProtectedRoute)
    const from = (location.state as { from?: string })?.from || '/dashboard';

    const handleSubmit = async (values: RegisterFormValues) => {
        clearError();
        const success = await register(values.email, values.password, values.name);
        if (success) {
            message.success('注册成功！');
            navigate(from, { replace: true });
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
                        <Logo size={32} className={styles.logoIcon} />
                        <span className={styles.logoText}>CollabBoard</span>
                    </div>
                    <Title level={3} className={styles.title}>创建账号</Title>
                    <Text type="secondary">加入 CollabBoard 开始协作</Text>
                </div>

                <Form
                    form={form}
                    name="register"
                    onFinish={handleSubmit}
                    layout="vertical"
                    size="large"
                    className={styles.form}
                >
                    <Form.Item
                        name="name"
                        rules={[
                            { required: true, message: '请输入用户名' },
                            { min: 2, message: '用户名至少2个字符' },
                        ]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder="用户名"
                            autoComplete="name"
                        />
                    </Form.Item>

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
                        rules={[
                            { required: true, message: '请输入密码' },
                            { min: 6, message: '密码至少6个字符' },
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="密码"
                            autoComplete="new-password"
                        />
                    </Form.Item>

                    <Form.Item
                        name="confirmPassword"
                        dependencies={['password']}
                        rules={[
                            { required: true, message: '请确认密码' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('两次输入的密码不一致'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="确认密码"
                            autoComplete="new-password"
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
                            注册
                        </Button>
                    </Form.Item>
                </Form>

                <div className={styles.authFooter}>
                    <Text type="secondary">已有账号？</Text>
                    <Link to="/login" state={location.state}>立即登录</Link>
                </div>
            </Card>
        </div>
    );
};

export default RegisterPage;

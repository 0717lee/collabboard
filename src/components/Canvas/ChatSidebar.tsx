import React, { useState } from 'react';
import { useMutation, useStorage } from '@/liveblocks.config';
import { Button, Input, List, Typography, Drawer } from 'antd';
import { SendOutlined, MessageOutlined } from '@ant-design/icons';
import { useLanguageStore } from '@/stores/languageStore';
import { useAuthStore } from '@/stores/authStore';


const { Text } = Typography;

export const ChatSidebar: React.FC = () => {
    const { language } = useLanguageStore();
    const isEn = language === 'en-US';
    const { user } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    
    const messages = useStorage((root) => root.chatMessages);

    const sendMessage = useMutation(({ storage }, text: string) => {
        if (!text.trim() || !user) return;
        
        const chatMessagesList = storage.get('chatMessages');
        if (!chatMessagesList) return;

        chatMessagesList.push({
            id: Date.now().toString(),
            text,
            userId: user.id,
            userName: user.name || (isEn ? 'Anonymous' : '匿名用户'),
            userColor: '#1890ff',
            timestamp: Date.now(),
        });

        if (chatMessagesList.length > 200) {
            chatMessagesList.delete(0);
        }
    }, [user, isEn]);

    const handleSend = () => {
        sendMessage(inputValue);
        setInputValue('');
    };

    return (
        <>
            <Button
                type="primary"
                shape="circle"
                icon={<MessageOutlined />}
                size="large"
                style={{
                    position: 'absolute',
                    right: 24,
                    bottom: 24,
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onClick={() => setIsOpen(true)}
            />
            <Drawer
                title={isEn ? 'Team Chat' : '团队聊天'}
                placement="right"
                onClose={() => setIsOpen(false)}
                open={isOpen}
                mask={false}
                width={320}
                styles={{
                    body: { padding: 0, display: 'flex', flexDirection: 'column' }
                }}
                style={{ position: 'absolute' }}
                getContainer={false}
            >
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    <List
                        dataSource={messages ? Array.from(messages) : []}
                        renderItem={(item) => {
                            const isMe = user?.id === item.userId;
                            return (
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: isMe ? 'flex-end' : 'flex-start',
                                        marginBottom: 12,
                                    }}
                                >
                                    <Text type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
                                        {item.userName}
                                    </Text>
                                    <div
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 12,
                                            backgroundColor: isMe ? '#1890ff' : '#f0f2f5',
                                            color: isMe ? '#fff' : '#000',
                                            maxWidth: '85%',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {item.text}
                                    </div>
                                </div>
                            );
                        }}
                    />
                </div>
                <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onPressEnter={handleSend}
                        placeholder={isEn ? 'Type a message...' : '输入消息...'}
                    />
                    <Button type="primary" icon={<SendOutlined />} onClick={handleSend} />
                </div>
            </Drawer>
        </>
    );
};

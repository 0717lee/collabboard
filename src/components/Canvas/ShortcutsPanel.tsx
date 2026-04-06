import React, { useState } from 'react';
import { Button, Modal, List, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useLanguageStore } from '@/stores/languageStore';

const { Text } = Typography;

const Kbd: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <span style={{ 
        padding: '2px 6px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: 4, 
        border: '1px solid #d9d9d9', 
        fontFamily: 'monospace',
        fontSize: '0.9em',
        ...style 
    }}>
        {children}
    </span>
);

interface ShortcutsPanelProps {
    isOpen?: boolean;
    onOpen?: () => void;
    onClose?: () => void;
    showTrigger?: boolean;
    isCompactViewport?: boolean;
}

export const ShortcutsPanel: React.FC<ShortcutsPanelProps> = ({
    isOpen: controlledOpen,
    onOpen,
    onClose,
    showTrigger = true,
    isCompactViewport = false,
}) => {
    const { language } = useLanguageStore();
    const isEn = language === 'en-US';
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = typeof controlledOpen === 'boolean';
    const isModalOpen = isControlled ? controlledOpen : internalOpen;
    const openModal = () => {
        if (!isControlled) setInternalOpen(true);
        onOpen?.();
    };
    const closeModal = () => {
        if (!isControlled) setInternalOpen(false);
        onClose?.();
    };

    const shortcuts = [
        { key: 'V', desc: isEn ? 'Select Tool' : '选择工具' },
        { key: 'R', desc: isEn ? 'Rectangle Tool' : '矩形工具' },
        { key: 'O', desc: isEn ? 'Circle Tool' : '圆形工具' },
        { key: 'L', desc: isEn ? 'Line Tool' : '直线工具' },
        { key: 'T', desc: isEn ? 'Text Tool' : '文本工具' },
        { key: 'S', desc: isEn ? 'Sticky Note' : '便签工具' },
        { key: 'Space', desc: isEn ? 'Hold to Pan' : '按住空格平移' },
        { key: 'Delete/Back', desc: isEn ? 'Delete selected' : '删除选中' },
        { key: 'Ctrl + Z', desc: isEn ? 'Undo' : '撤销' },
        { key: 'Ctrl + Y', desc: isEn ? 'Redo' : '重做' },
    ];

    return (
        <>
            {showTrigger && (
                <Button
                    type="text"
                    icon={<QuestionCircleOutlined />}
                    className={isCompactViewport ? 'collabboard-shortcuts-trigger compact' : 'collabboard-shortcuts-trigger'}
                    onClick={openModal}
                    style={{
                        position: 'absolute',
                        left: 24,
                        bottom: 24,
                        zIndex: 1000,
                        color: '#8c8c8c'
                    }}
                >
                    {isEn ? 'Shortcuts' : '快捷键'}
                </Button>
            )}
            <Modal
                title={isEn ? 'Keyboard Shortcuts' : '快捷键说明'}
                open={isModalOpen}
                onOk={closeModal}
                onCancel={closeModal}
                footer={null}
                width={isCompactViewport ? 'min(100vw - 16px, 420px)' : 400}
            >
                <List
                    dataSource={shortcuts}
                    renderItem={(item) => (
                        <List.Item style={{ padding: '8px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <Text>{item.desc}</Text>
                                <Kbd>
                                    {item.key}
                                </Kbd>
                            </div>
                        </List.Item>
                    )}
                />
            </Modal>
        </>
    );
};

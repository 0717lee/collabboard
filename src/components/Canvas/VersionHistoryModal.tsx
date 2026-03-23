import React from 'react';
import { Button, Empty, List, Modal, Tag, Typography } from 'antd';
import {
    ClockCircleOutlined,
    DeleteOutlined,
    HistoryOutlined,
    ReloadOutlined,
    SaveOutlined,
} from '@ant-design/icons';
import type { BoardSnapshot } from '@/types';
import styles from './CanvasBoard.module.css';

const { Text } = Typography;

interface VersionHistoryModalProps {
    isEn: boolean;
    open: boolean;
    snapshots: BoardSnapshot[];
    onClose: () => void;
    onCreateSnapshot: () => void;
    onDeleteSnapshot: (snapshotId: string) => void;
    onRestoreSnapshot: (snapshot: BoardSnapshot) => void;
}

const formatTimestamp = (value: string, locale: 'zh-CN' | 'en-US') =>
    new Date(value).toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
    isEn,
    open,
    snapshots,
    onClose,
    onCreateSnapshot,
    onDeleteSnapshot,
    onRestoreSnapshot,
}) => (
    <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        centered
        className={styles.versionModal}
        width={720}
        title={isEn ? 'Version History' : '版本历史'}
    >
        <div className={styles.versionModalContent}>
            <div className={styles.versionToolbar}>
                <div>
                    <Text strong>{isEn ? 'Saved snapshots' : '已保存快照'}</Text>
                    <div className={styles.versionMetaText}>
                        {isEn
                            ? `${snapshots.length} versions are available for restore`
                            : `当前有 ${snapshots.length} 个版本可恢复`}
                    </div>
                </div>

                <Button type="primary" icon={<SaveOutlined />} onClick={onCreateSnapshot}>
                    {isEn ? 'Save Snapshot' : '保存快照'}
                </Button>
            </div>

            {snapshots.length === 0 ? (
                <div className={styles.versionEmpty}>
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={isEn ? 'No snapshots yet' : '还没有保存的快照'}
                    />
                </div>
            ) : (
                <List
                    dataSource={snapshots}
                    className={styles.versionList}
                    renderItem={(snapshot) => (
                        <List.Item
                            className={styles.versionItem}
                            actions={[
                                <Button
                                    key="restore"
                                    type="link"
                                    icon={<ReloadOutlined />}
                                    onClick={() => onRestoreSnapshot(snapshot)}
                                >
                                    {isEn ? 'Restore' : '恢复'}
                                </Button>,
                                <Button
                                    key="delete"
                                    type="link"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => onDeleteSnapshot(snapshot.id)}
                                >
                                    {isEn ? 'Delete' : '删除'}
                                </Button>,
                            ]}
                        >
                            <div className={styles.versionThumb}>
                                {snapshot.thumbnail ? (
                                    <img src={snapshot.thumbnail} alt={snapshot.name} className={styles.versionThumbImage} />
                                ) : (
                                    <HistoryOutlined />
                                )}
                            </div>

                            <div className={styles.versionBody}>
                                <div className={styles.versionTitleRow}>
                                    <Text strong>{snapshot.name}</Text>
                                    <Tag color={snapshot.source === 'auto' ? 'default' : 'green'}>
                                        {snapshot.source === 'auto'
                                            ? (isEn ? 'Auto' : '自动')
                                            : (isEn ? 'Manual' : '手动')}
                                    </Tag>
                                </div>
                                <div className={styles.versionMetaRow}>
                                    <ClockCircleOutlined />
                                    <Text type="secondary">
                                        {formatTimestamp(snapshot.createdAt, isEn ? 'en-US' : 'zh-CN')}
                                    </Text>
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            )}
        </div>
    </Modal>
);

export default VersionHistoryModal;

import { Typography, Button, Tooltip } from 'antd';
import { HistoryOutlined, DeleteOutlined } from '@ant-design/icons';
import type { HistoryEntry } from '../../hooks/useAutoFix';
import styles from './HistoryPanel.module.css';

const { Text } = Typography;

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HistoryPanel({ history, onRestore, onDelete }: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <HistoryOutlined style={{ fontSize: 12 }} />
          <Text className={styles.title}>历史记录</Text>
        </div>
        <div className={styles.empty}>暂无生成记录</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <HistoryOutlined style={{ fontSize: 12 }} />
        <Text className={styles.title}>历史记录</Text>
        <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
          {history.length}
        </Text>
      </div>
      <div className={styles.list}>
        {history.map((entry) => (
          <div
            key={entry.id}
            className={styles.item}
            onClick={() => onRestore(entry)}
            title={entry.prompt}
          >
            <div className={styles.itemTop}>
              <Text className={styles.itemPrompt} ellipsis>
                {entry.prompt.slice(0, 60)}
              </Text>
              <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
                {formatTime(entry.timestamp)}
              </Text>
            </div>
            <div className={styles.itemMeta}>
              <span className={styles.badge}>{entry.language}</span>
              <span className={styles.badge}>{entry.nodes.length} 节点</span>
              <Tooltip title="删除记录">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
                  }}
                />
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

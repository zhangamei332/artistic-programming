import { useState, useCallback, useRef } from 'react';
import { Typography, Button, Tooltip } from 'antd';
import { HistoryOutlined, DeleteOutlined, BranchesOutlined, HolderOutlined } from '@ant-design/icons';
import type { HistoryEntry } from '../../hooks/useAutoFix';
import styles from './HistoryPanel.module.css';

const { Text } = Typography;

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onMoveToParent?: (entryId: string, newParentId: string | null) => void;
  activeBaseId?: string | null;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getChildren(parentId: string, all: HistoryEntry[]): HistoryEntry[] {
  return all.filter((e) => e.parentId === parentId);
}

/** Check if `potentialParent` is an ancestor of `entryId` (prevent circular) */
function isDescendantOf(entryId: string, potentialParent: HistoryEntry, all: HistoryEntry[]): boolean {
  let current = all.find((e) => e.id === entryId);
  while (current?.parentId) {
    if (current.parentId === potentialParent.id) return true;
    current = all.find((e) => e.id === current!.parentId);
  }
  return false;
}

export function HistoryPanel({ history, onRestore, onDelete, onMoveToParent, activeBaseId }: HistoryPanelProps) {
  // 使用 ref 追踪拖拽状态，避免闭包过期问题
  const dragIdRef = useRef<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, entryId: string) => {
    e.dataTransfer.setData('text/plain', entryId);
    e.dataTransfer.effectAllowed = 'move';
    dragIdRef.current = entryId;
    // 让浏览器渲染drag图像
    const el = e.currentTarget.closest(`.${styles.item}`) as HTMLElement;
    if (el) {
      e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDropTargetId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, entryId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdRef.current && dragIdRef.current !== entryId) {
      setDropTargetId(entryId);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetEntry: HistoryEntry) => {
    e.preventDefault();
    e.stopPropagation();
    const entryId = e.dataTransfer.getData('text/plain');
    if (!entryId || entryId === targetEntry.id) {
      dragIdRef.current = null;
      setDropTargetId(null);
      return;
    }
    // 防止循环引用
    if (isDescendantOf(targetEntry.id, { id: entryId } as HistoryEntry, history)) {
      dragIdRef.current = null;
      setDropTargetId(null);
      return;
    }
    onMoveToParent?.(entryId, targetEntry.id);
    dragIdRef.current = null;
    setDropTargetId(null);
  }, [history, onMoveToParent]);

  // Drop on empty area to detach from parent
  const handlePanelDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const entryId = e.dataTransfer.getData('text/plain');
    if (!entryId) return;
    onMoveToParent?.(entryId, null);
    dragIdRef.current = null;
    setDropTargetId(null);
  }, [onMoveToParent]);

  const handlePanelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

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

  // Build flat tree: top-level entries followed by their children
  const rendered: HistoryEntry[] = [];
  const topLevel = history.filter((e) => !e.parentId);
  for (const parent of topLevel) {
    rendered.push(parent);
    const children = getChildren(parent.id, history);
    rendered.push(...children);
  }

  function renderEntry(entry: HistoryEntry, isChild: boolean) {
    const isActive = activeBaseId === entry.id;
    const isDropTarget = dropTargetId === entry.id;

    return (
      <div
        key={entry.id}
        className={`${styles.item} ${isChild ? styles.itemChild : ''} ${isActive ? styles.itemActive : ''} ${isDropTarget ? styles.dropTarget : ''}`}
        onClick={() => onRestore(entry)}
        onDragOver={(e) => handleDragOver(e, entry.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, entry)}
        title={entry.prompt}
      >
        {isChild && (
          <div className={styles.childIndicator}>
            <BranchesOutlined style={{ fontSize: 10 }} />
          </div>
        )}
        {/* Drag handle — only for non-child entries */}
        <div
          className={styles.dragHandle}
          draggable
          onDragStart={(e) => handleDragStart(e, entry.id)}
          onDragEnd={handleDragEnd}
          onClick={(e) => e.stopPropagation()}
          title="拖拽到其他记录上以建立父子级关系"
        >
          <HolderOutlined />
        </div>
        <div className={styles.itemContent}>
          <div className={styles.itemTop}>
            <Text className={styles.itemPrompt} ellipsis>
              {entry.prompt.slice(0, 60)}
            </Text>
            <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
              {formatTime(entry.timestamp)}
            </Text>
          </div>
          <div className={styles.itemMeta}>
            {entry.diffSummary && (
              <span className={styles.diffBadge} title={entry.diffSummary}>
                {entry.diffSummary.slice(0, 40)}
              </span>
            )}
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
      </div>
    );
  }

  return (
    <div
      className={styles.panel}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
    >
      <div className={styles.header}>
        <HistoryOutlined style={{ fontSize: 12 }} />
        <Text className={styles.title}>历史记录</Text>
        <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
          {history.length}
        </Text>
      </div>
      <div className={styles.list}>
        {rendered.map((entry) => {
          const isChild = !!entry.parentId;
          return renderEntry(entry, isChild);
        })}
      </div>
    </div>
  );
}

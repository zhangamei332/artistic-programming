import { useCallback, useRef, useState } from 'react';
import { Typography } from 'antd';
import { BranchesOutlined, HistoryOutlined, HolderOutlined } from '@ant-design/icons';
import type { ApiProgressEntry, HistoryEntry, Phase } from '../../hooks/useAutoFix';
import styles from './HistoryPanel.module.css';

const { Text } = Typography;

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onMoveToParent?: (entryId: string, newParentId: string | null) => void;
  activeBaseId?: string | null;
  isProcessing?: boolean;
  phase?: Phase;
  apiProgress?: ApiProgressEntry[];
  streamedCode?: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getChildren(parentId: string, all: HistoryEntry[]): HistoryEntry[] {
  return all.filter((e) => e.parentId === parentId);
}

function isDescendantOf(entryId: string, potentialParent: HistoryEntry, all: HistoryEntry[]): boolean {
  let current = all.find((e) => e.id === entryId);
  while (current?.parentId) {
    if (current.parentId === potentialParent.id) return true;
    current = all.find((e) => e.id === current!.parentId);
  }
  return false;
}

export function HistoryPanel({
  history,
  onRestore,
  onMoveToParent,
  activeBaseId,
  isProcessing = false,
  phase = 'idle',
  apiProgress = [],
  streamedCode = '',
}: HistoryPanelProps) {
  const dragIdRef = useRef<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, entryId: string) => {
    e.dataTransfer.setData('text/plain', entryId);
    e.dataTransfer.effectAllowed = 'move';
    dragIdRef.current = entryId;
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
    if (isDescendantOf(targetEntry.id, { id: entryId } as HistoryEntry, history)) {
      dragIdRef.current = null;
      setDropTargetId(null);
      return;
    }
    onMoveToParent?.(entryId, targetEntry.id);
    dragIdRef.current = null;
    setDropTargetId(null);
  }, [history, onMoveToParent]);

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

  const showLiveEntry = isProcessing || streamedCode.length > 0 || apiProgress.length > 0;
  const phaseLabel: Record<Phase, string> = {
    idle: '空闲',
    generating: '生成中',
    verifying: '检查中',
    fixing: '调整中',
    success: '已完成',
    failed: '失败',
  };

  const rendered: HistoryEntry[] = [];
  const topLevel = history.filter((e) => !e.parentId);
  for (const parent of topLevel) {
    rendered.push(parent);
    rendered.push(...getChildren(parent.id, history));
  }

  function renderLiveEntry() {
    if (!showLiveEntry) return null;
    const isExpanded = expandedId === 'live';
    const latestProgress = apiProgress[apiProgress.length - 1]?.message || '等待模型返回代码';

    return (
      <div
        className={`${styles.item} ${styles.liveItem} ${isProcessing ? styles.liveItemActive : ''}`}
        onClick={() => setExpandedId((current) => (current === 'live' ? null : 'live'))}
      >
        <div className={styles.itemContent}>
          <div className={styles.itemTop}>
            <Text className={styles.itemPrompt} ellipsis>
              实时代码生成
            </Text>
            <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
              {phaseLabel[phase]}
            </Text>
          </div>
          <div className={styles.liveProgress}>{latestProgress}</div>
          <div className={styles.itemMeta}>
            <span className={styles.badge}>{streamedCode.length} 字符</span>
            <span className={styles.codeHint}>{isExpanded ? '收起代码' : '查看实时代码'}</span>
          </div>
          {isExpanded && (
            <pre className={styles.codeBlock}>{streamedCode || '正在等待第一段代码返回...'}</pre>
          )}
        </div>
      </div>
    );
  }

  function renderEntry(entry: HistoryEntry, isChild: boolean) {
    const isActive = activeBaseId === entry.id;
    const isDropTarget = dropTargetId === entry.id;
    const isExpanded = expandedId === entry.id;

    return (
      <div
        key={entry.id}
        className={`${styles.item} ${isChild ? styles.itemChild : ''} ${isActive ? styles.itemActive : ''} ${isDropTarget ? styles.dropTarget : ''}`}
        onClick={() => {
          onRestore(entry);
          setExpandedId((current) => (current === entry.id ? null : entry.id));
        }}
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
        <div
          className={styles.dragHandle}
          draggable
          onDragStart={(e) => handleDragStart(e, entry.id)}
          onDragEnd={handleDragEnd}
          onClick={(e) => e.stopPropagation()}
          title="拖拽到其他记录上建立父子级关系"
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
            <span className={styles.codeHint}>{isExpanded ? '收起代码' : '查看代码'}</span>
          </div>
          {isExpanded && (
            <pre className={styles.codeBlock}>{entry.code}</pre>
          )}
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
        {renderLiveEntry()}
        {rendered.map((entry) => renderEntry(entry, !!entry.parentId))}
        {history.length === 0 && !showLiveEntry && (
          <div className={styles.empty}>暂无生成记录</div>
        )}
      </div>
    </div>
  );
}

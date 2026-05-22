import { useState } from 'react';
import { Timeline, Typography } from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { LogEntry, Phase } from '../../hooks/useAutoFix';
import styles from './CorrectionLog.module.css';

const { Text } = Typography;

interface CorrectionLogProps {
  log: LogEntry[];
  phase: Phase;
}

const phaseConfig: Record<
  LogEntry['phase'],
  { color: string; icon: React.ReactNode; label: string }
> = {
  generating: {
    color: '#4A90D9',
    icon: <ThunderboltOutlined />,
    label: 'AI 正在生成代码...',
  },
  verifying: {
    color: '#FAAD14',
    icon: <ClockCircleOutlined />,
    label: '正在沙箱中验证代码...',
  },
  fixing: {
    color: '#FA8C16',
    icon: <ToolOutlined />,
    label: 'AI 正在修复代码...',
  },
  success: {
    color: '#52C41A',
    icon: <CheckCircleOutlined />,
    label: '验证通过，无错误',
  },
  failed: {
    color: '#FF4D4F',
    icon: <CloseCircleOutlined />,
    label: '错误',
  },
};

function truncateError(msg: string, maxLen = 80): string {
  return msg.length > maxLen ? msg.slice(0, maxLen) + '...' : msg;
}

function getSummary(log: LogEntry[]): { text: string; color: string } {
  const lastEntry = log[log.length - 1];
  if (!lastEntry) return { text: '', color: '#999' };

  if (lastEntry.phase === 'success') {
    return { text: `验证通过 (${log.filter((e) => e.phase === 'success').length} 次尝试)`, color: '#52C41A' };
  }
  if (lastEntry.phase === 'failed') {
    const total = log.filter((e) => e.error).length;
    return { text: `验证失败 (${total} 个错误)`, color: '#FF4D4F' };
  }
  return { text: '处理中...', color: '#FAAD14' };
}

export function CorrectionLog({ log, phase }: CorrectionLogProps) {
  const [expanded, setExpanded] = useState(false);

  if (log.length === 0 && phase === 'idle') return null;

  const summary = getSummary(log);

  const timelineItems = log
    .filter((entry) => entry.phase !== 'fixing' || entry.code)
    .map((entry) => {
      const config = phaseConfig[entry.phase];
      const dot = entry.phase === 'generating' && phase === 'generating' ? (
        <LoadingOutlined style={{ color: config.color }} />
      ) : entry.phase === 'verifying' && phase === 'verifying' ? (
        <LoadingOutlined style={{ color: config.color }} />
      ) : entry.phase === 'fixing' && phase === 'fixing' ? (
        <LoadingOutlined style={{ color: config.color }} />
      ) : (
        config.icon
      );

      let children: React.ReactNode = config.label;

      if (entry.phase === 'fixing' && entry.code) {
        children = `AI 修复代码 (第 ${entry.iteration} 次尝试)`;
      } else if (entry.phase === 'generating') {
        children = `AI 生成代码 (第 ${entry.iteration} 次尝试)`;
      } else if (entry.phase === 'verifying') {
        children = `验证代码 (第 ${entry.iteration} 次尝试)`;
      } else if (entry.phase === 'failed' && entry.error) {
        children = (
          <span>
            错误 (第 {entry.iteration} 次):{' '}
            <code className={styles.errorCode}>{truncateError(entry.error)}</code>
          </span>
        );
      } else if (entry.phase === 'success') {
        children = `验证通过 (第 ${entry.iteration} 次尝试)`;
      }

      return {
        dot,
        color: config.color,
        children: <span style={{ fontSize: 13 }}>{children}</span>,
      };
    });

  const isActive = phase !== 'idle' && phase !== 'success' && phase !== 'failed';

  return (
    <div>
      <div
        className={styles.collapsed}
        onClick={() => setExpanded(!expanded)}
      >
        {isActive ? (
          <LoadingOutlined style={{ color: summary.color, fontSize: 14 }} />
        ) : summary.color === '#52C41A' ? (
          <CheckCircleOutlined style={{ color: summary.color, fontSize: 14 }} />
        ) : (
          <CloseCircleOutlined style={{ color: summary.color, fontSize: 14 }} />
        )}
        <Text className={styles.collapsedStatus} style={{ color: summary.color }}>
          {summary.text}
        </Text>
        <span
          className={`${styles.collapsedArrow} ${expanded ? styles.open : ''}`}
        >
          ▶
        </span>
      </div>

      {expanded && (
        <div className={styles.expanded}>
          <Timeline items={timelineItems} />
        </div>
      )}
    </div>
  );
}

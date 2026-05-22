import { useState, useCallback } from 'react';
import { Slider, InputNumber, ColorPicker, Button, Modal, Typography, Tag } from 'antd';
import {
  SettingOutlined,
  DownOutlined,
  UpOutlined,
  KeyOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { categoryFromNodeType, categoryLabels, tdNodeTypes } from '../nodes/TDNodes';
import type { NodeData } from '../nodes/NodeCanvas';
import styles from './ParamPanel.module.css';

const { Text } = Typography;

interface ParamPanelProps {
  selectedNode: NodeData | null;
  onParamChange?: (nodeId: string, key: string, value: unknown) => void;
  onApply?: () => void;
  adjustExplanation?: string | null;
}

const catHeaderClasses: Record<string, string> = {
  scene: styles.catScene,
  geometry: styles.catGeometry,
  light: styles.catLight,
  control: styles.catControl,
  effect: styles.catEffect,
  interaction: styles.catInteraction,
  drawing: styles.catDrawing,
};

export function ParamPanel({ selectedNode, onParamChange, onApply, adjustExplanation }: ParamPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyRecording, setKeyRecording] = useState('');
  const [recordingParam, setRecordingParam] = useState('');

  const handleParamChange = useCallback(
    (key: string, value: unknown) => {
      if (selectedNode && onParamChange) {
        onParamChange(selectedNode.id, key, value);
      }
    },
    [selectedNode, onParamChange],
  );

  const startKeyRecord = useCallback(
    (paramKey: string) => {
      setRecordingParam(paramKey);
      setKeyRecording('');
      setKeyModalOpen(true);
    },
    [],
  );

  if (!selectedNode) {
    return (
      <div className={styles.panel}>
        <div className={styles.collapsed} onClick={() => setExpanded(!expanded)}>
          <SettingOutlined style={{ fontSize: 12 }} />
          <Text className={styles.headerText}>参数面板</Text>
          {expanded ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
        </div>
      </div>
    );
  }

  const cat = categoryFromNodeType(selectedNode.type);
  const catCls = catHeaderClasses[cat] || '';
  const typeLabel = tdNodeTypes[selectedNode.type] || selectedNode.type;
  const params = selectedNode.params || {};

  const paramEntries = Object.entries(params).filter(
    ([k]) => k !== 'interaction',
  );
  const hasInteraction = 'interaction' in params;

  return (
    <div className={styles.panel}>
      <div className={styles.collapsed} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined style={{ fontSize: 12 }} />
          <Text className={styles.headerText}>
            {selectedNode.label}
          </Text>
        </div>
        {expanded ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
      </div>

      {expanded && (
        <div className={styles.expanded}>
          <div className={styles.nodeInfo}>
            <span className={`${styles.nodeCategory} ${catCls}`}>
              {categoryLabels[cat] || cat}
            </span>
            <span className={styles.nodeLabel}>{selectedNode.label}</span>
            <Tag color="default" style={{ fontSize: 10, marginLeft: 'auto' }}>
              {typeLabel}
            </Tag>
          </div>

          {paramEntries.map(([key, value]) => {
            if (typeof value === 'number') {
              const min = 0;
              const max = key.includes('速度') || key.includes('speed') ? 0.1
                : key.includes('数量') || key.includes('count') ? 10000 : 10;
              const step = max <= 0.1 ? 0.001 : max <= 10 ? 0.1 : 1;
              return (
                <div key={key} className={styles.paramGroup}>
                  <div className={styles.paramLabel}>
                    <span>{key}</span>
                    <span className={styles.paramValue}>{typeof value === 'number' ? value.toFixed(step < 1 ? 3 : 0) : ''}</span>
                  </div>
                  <div className={styles.paramSlider}>
                    <Slider
                      min={0}
                      max={max}
                      step={step}
                      value={value as number}
                      onChange={(v) => handleParamChange(key, v)}
                      style={{ flex: 1 }}
                    />
                    <InputNumber
                      size="small"
                      min={0}
                      max={max}
                      step={step}
                      value={value as number}
                      onChange={(v) => handleParamChange(key, v ?? 0)}
                      style={{ width: 70 }}
                    />
                  </div>
                </div>
              );
            }

            if (typeof value === 'string' && (value.startsWith('#') || key.includes('颜色') || key.includes('color'))) {
              return (
                <div key={key} className={styles.paramGroup}>
                  <div className={styles.paramLabel}>{key}</div>
                  <div className={styles.colorRow}>
                    <ColorPicker
                      value={value as string}
                      onChange={(c) => handleParamChange(key, c.toHexString())}
                      showText
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>{value as string}</Text>
                  </div>
                </div>
              );
            }

            if (typeof value === 'string' && (key.includes('按键') || key.includes('key') || key.includes('键盘'))) {
              return (
                <div key={key} className={styles.paramGroup}>
                  <div className={styles.paramLabel}>{key}</div>
                  <div className={styles.keyDisplay}>
                    <span className={styles.keyBadge}>{String(value || '未设置')}</span>
                    <Button
                      size="small"
                      icon={<KeyOutlined />}
                      onClick={() => startKeyRecord(key)}
                    >
                      修改
                    </Button>
                  </div>
                </div>
              );
            }

            if (typeof value === 'string' && (key.includes('鼠标') || key.includes('mouse') || key.includes('点击'))) {
              return (
                <div key={key} className={styles.paramGroup}>
                  <div className={styles.paramLabel}>{key}</div>
                  <div className={styles.keyDisplay}>
                    <span className={styles.keyBadge}>{String(value || '未设置')}</span>
                    <Button
                      size="small"
                      onClick={() => startKeyRecord(key)}
                    >
                      修改
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={key} className={styles.paramGroup}>
                <div className={styles.paramLabel}>
                  <span>{key}</span>
                  <span className={styles.paramValue}>{String(value).slice(0, 30)}</span>
                </div>
              </div>
            );
          })}

          {hasInteraction && (
            <div className={styles.paramGroup}>
              <div className={styles.paramLabel}>交互方式</div>
              <div className={styles.interactionRow}>
                <span className={styles.interactionText}>{String(params.interaction)}</span>
                <Button
                  size="small"
                  icon={<KeyOutlined />}
                  onClick={() => startKeyRecord('interaction')}
                >
                  编辑
                </Button>
              </div>
            </div>
          )}

          {paramEntries.length === 0 && !hasInteraction && (
            <div className={styles.empty}>此节点无可调参数</div>
          )}

          {onApply && paramEntries.length > 0 && (
            <div className={styles.applyRow}>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={onApply}
                block
              >
                应用参数并刷新预览
              </Button>
            </div>
          )}

          {adjustExplanation && (
            <div className={styles.adjustExplain}>
              <Text style={{ fontSize: 12, color: '#52C41A' }}>{adjustExplanation}</Text>
            </div>
          )}
        </div>
      )}

      <Modal
        title="录制按键"
        open={keyModalOpen}
        onCancel={() => setKeyModalOpen(false)}
        onOk={() => {
          if (keyRecording && selectedNode) {
            handleParamChange(recordingParam, keyRecording);
          }
          setKeyModalOpen(false);
        }}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Text>请在下方输入框中按下键盘按键</Text>
          <input
            style={{
              width: '100%',
              marginTop: 16,
              padding: '8px 12px',
              fontSize: 18,
              textAlign: 'center',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
            }}
            value={keyRecording}
            onKeyDown={(e) => {
              e.preventDefault();
              let key = '';
              if (e.ctrlKey) key += 'Ctrl+';
              if (e.shiftKey) key += 'Shift+';
              if (e.altKey) key += 'Alt+';
              key += e.key.length === 1 ? e.key.toUpperCase() : e.key;
              setKeyRecording(key);
            }}
            readOnly
            placeholder="在此按下按键..."
          />
        </div>
      </Modal>
    </div>
  );
}

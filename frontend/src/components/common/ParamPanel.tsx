import { useState, useCallback, useMemo } from 'react';
import { Slider, InputNumber, ColorPicker, Button, Modal, Typography, Tag, Select } from 'antd';
import {
  SettingOutlined,
  DownOutlined,
  UpOutlined,
  KeyOutlined,
  CheckOutlined,
  PlusOutlined,
  LinkOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { categoryFromNodeType, categoryLabels, tdNodeTypes } from '../nodes/TDNodes';
import { ANIMATION_MOTION_TYPES } from '../../utils/nodeSemantics';
import type { NodeData } from '../nodes/NodeCanvas';
import type { EdgeData } from '../nodes/NodeCanvas';
import styles from './ParamPanel.module.css';

const { Text } = Typography;

interface ParamPanelProps {
  selectedNode: NodeData | null;
  allNodes?: NodeData[];
  allEdges?: EdgeData[];
  onParamChange?: (nodeId: string, key: string, value: unknown) => void;
  onApply?: () => void;
  onApplyAll?: () => void;
  onConnectNodes?: (sourceId: string, targetId: string) => void;
  onRemoveConnection?: (sourceId: string, targetId: string) => void;
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

export function ParamPanel({ selectedNode, allNodes, allEdges, onParamChange, onApply, onApplyAll, onConnectNodes, onRemoveConnection, adjustExplanation }: ParamPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyRecording, setKeyRecording] = useState('');
  const [recordingParam, setRecordingParam] = useState('');
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [customKeyModalOpen, setCustomKeyModalOpen] = useState(false);
  const [connectTargetId, setConnectTargetId] = useState<string | undefined>(undefined);

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

  // --- Keyboard key grid helpers ---
  const selectedKeys: string[] = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'keyboard') return [];
    const keys = selectedNode.params?.keys;
    if (Array.isArray(keys)) return keys as string[];
    // backward compat: single key string
    const singleKey = selectedNode.params?.key;
    if (typeof singleKey === 'string' && singleKey) return [singleKey];
    return [];
  }, [selectedNode]);

  const toggleKey = useCallback(
    (key: string) => {
      const current = selectedKeys;
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      handleParamChange('keys', next);
    },
    [selectedKeys, handleParamChange],
  );

  const addCustomKey = useCallback(() => {
    const trimmed = customKeyInput.trim();
    if (!trimmed) return;
    toggleKey(trimmed);
    setCustomKeyInput('');
    setCustomKeyModalOpen(false);
  }, [customKeyInput, toggleKey]);

  const removeCustomKey = useCallback(
    (key: string) => {
      toggleKey(key);
    },
    [toggleKey],
  );

  // --- Connection helpers ---
  const existingConnections = useMemo(() => {
    if (!selectedNode || !allEdges) return [];
    return allEdges.filter((e) => e.source === selectedNode.id).map((e) => e.target);
  }, [selectedNode, allEdges]);

  const connectableNodes = useMemo(() => {
    if (!allNodes || !selectedNode) return [];
    // Animation nodes, mesh, particles, etc. — anything that can be controlled
    return allNodes.filter(
      (n) =>
        n.id !== selectedNode.id &&
        !existingConnections.includes(n.id) &&
        ['animation', 'mesh', 'particles', 'transform', 'material', 'light', 'camera'].some(
          (t) => n.type === t || n.type.includes('Light'),
        ),
    );
  }, [allNodes, selectedNode, existingConnections]);

  const handleAddConnection = useCallback(() => {
    if (!selectedNode || !connectTargetId || !onConnectNodes) return;
    onConnectNodes(selectedNode.id, connectTargetId);
    setConnectTargetId(undefined);
  }, [selectedNode, connectTargetId, onConnectNodes]);

  // --- Accept drag from interaction node on canvas ---
  const [dropHighlight, setDropHighlight] = useState(false);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/interaction-node')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
      setDropHighlight(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropHighlight(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      setDropHighlight(false);
      const raw = e.dataTransfer.getData('application/interaction-node');
      if (!raw) return;
      try {
        const { nodeId, nodeType, label }: { nodeId: string; nodeType: string; label: string } = JSON.parse(raw);
        // If a target node is currently selected (e.g. animation), connect to it
        if (selectedNode && onConnectNodes && selectedNode.id !== nodeId) {
          const isValidTarget = ['animation', 'mesh', 'particles', 'transform', 'material'].some(
            (t) => selectedNode.type === t || selectedNode.type.includes('Light'),
          );
          if (isValidTarget) {
            onConnectNodes(nodeId, selectedNode.id);
          }
        }
      } catch {
        // ignore
      }
    },
    [selectedNode, onConnectNodes],
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
    ([k]) => k !== 'interaction' && k !== 'keys' && k !== 'key',
  );
  const hasInteraction = 'interaction' in params;
  const isKeyboardNode = selectedNode.type === 'keyboard';

  return (
    <div
      className={`${styles.panel} ${dropHighlight ? styles.panelDropActive : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

          {/* 动画节点：运动方式选择器 */}
          {selectedNode.type === 'animation' && (
            <div className={styles.paramGroup}>
              <div className={styles.paramLabel}>运动方式</div>
              <Select
                value={(params.motionType as string) || 'rotate'}
                onChange={(v) => handleParamChange('motionType', v)}
                style={{ width: '100%' }}
                size="small"
                options={Object.entries(ANIMATION_MOTION_TYPES).map(([key, label]) => ({
                  value: key,
                  label,
                }))}
              />
            </div>
          )}

          {/* 键盘交互节点：按键网格选择器 */}
          {isKeyboardNode && (
            <div className={styles.keyGridSection}>
              <div className={styles.keyGridLabel}>按键选择（点击切换）</div>
              <div className={styles.keyGrid}>
                <div className={styles.keyRow}>
                  {['1', '2', '3', '4', '5'].map((k) => (
                    <div
                      key={k}
                      className={`${styles.keyCircle} ${selectedKeys.includes(k) ? styles.keyCircleActive : ''}`}
                      onClick={() => toggleKey(k)}
                    >
                      {k}
                    </div>
                  ))}
                </div>
                <div className={styles.keyRow}>
                  {['6', '7', '8', '9', '0'].map((k) => (
                    <div
                      key={k}
                      className={`${styles.keyCircle} ${selectedKeys.includes(k) ? styles.keyCircleActive : ''}`}
                      onClick={() => toggleKey(k)}
                    >
                      {k}
                    </div>
                  ))}
                </div>
                {selectedKeys.filter((k) => !/^[0-9]$/.test(k)).length > 0 && (
                  <div className={styles.customKeysRow}>
                    {selectedKeys
                      .filter((k) => !/^[0-9]$/.test(k))
                      .map((k) => (
                        <div
                          key={k}
                          className={styles.customKeyCircle}
                          onClick={() => removeCustomKey(k)}
                          title={`点击删除 ${k}`}
                        >
                          {k}
                        </div>
                      ))}
                  </div>
                )}
                <div
                  className={`${styles.keyCircle} ${styles.keyCircleAdd}`}
                  onClick={() => setCustomKeyModalOpen(true)}
                >
                  +
                </div>
              </div>
            </div>
          )}

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

          {/* 交互节点：连接目标 */}
          {['keyboard', 'mouse', 'interaction', 'gesture', 'camera_interaction', 'audioRhythm', 'mp4Recognition', 'faceRecognition', 'hardware'].includes(selectedNode.type) && (
            <div className={styles.connectSection}>
              <div className={styles.connectLabel}>
                <LinkOutlined /> 连接目标
              </div>
              {allEdges && allNodes && existingConnections.map((targetId) => {
                const targetNode = allNodes.find((n) => n.id === targetId);
                return (
                  <div key={targetId} className={styles.connectRow}>
                    <span className={styles.connectTargetName}>
                      {targetNode ? targetNode.label : targetId}
                    </span>
                    {onRemoveConnection && (
                      <span
                        className={styles.connectRemove}
                        onClick={() => onRemoveConnection(selectedNode.id, targetId)}
                      >
                        <DeleteOutlined />
                      </span>
                    )}
                  </div>
                );
              })}
              {connectableNodes.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <Select
                    size="small"
                    placeholder="选择目标节点..."
                    value={connectTargetId}
                    onChange={setConnectTargetId}
                    style={{ flex: 1 }}
                    options={connectableNodes.map((n) => ({
                      value: n.id,
                      label: `${n.label} (${tdNodeTypes[n.type] || n.type})`,
                    }))}
                  />
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddConnection}
                    disabled={!connectTargetId}
                  >
                    连接
                  </Button>
                </div>
              )}
              {connectableNodes.length === 0 && existingConnections.length === 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  画布中暂无可用目标节点。请先从工具箱添加动画或网格节点。
                </Text>
              )}
            </div>
          )}

          {paramEntries.length === 0 && !hasInteraction && !isKeyboardNode && (
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
                保存调整局部参数
              </Button>
            </div>
          )}

          {onApplyAll && (paramEntries.length > 0 || isKeyboardNode || hasInteraction) && (
            <div className={styles.applyRow}>
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={onApplyAll}
                block
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                应用全部参数并预览
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

      <Modal
        title="添加自定义按键"
        open={customKeyModalOpen}
        onCancel={() => setCustomKeyModalOpen(false)}
        onOk={addCustomKey}
        okText="添加"
        cancelText="取消"
      >
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Text>请输入要添加的按键字符（如 a、Space、/、*、- 等）</Text>
          <input
            className={styles.addKeyModalInput}
            value={customKeyInput}
            onChange={(e) => setCustomKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomKey();
              }
            }}
            placeholder="输入按键字符..."
            autoFocus
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['A', 'B', 'C', 'D', 'Space', 'Enter', '/', '*', '-', '.', 'Escape'].map((k) => (
              <Tag
                key={k}
                style={{ cursor: 'pointer' }}
                color={customKeyInput === k ? 'blue' : 'default'}
                onClick={() => setCustomKeyInput(k)}
              >
                {k}
              </Tag>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

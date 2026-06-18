import { useState, useCallback, useMemo, useEffect } from 'react';
import { Slider, InputNumber, ColorPicker, Button, Modal, Typography, Tag, Select, Switch, Input, Tabs } from 'antd';
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
import { categoryFromNodeType, categoryLabels, getNodeDisplayLabel, getParamDisplayLabel, getParamDisplayValue, tdNodeTypes } from '../nodes/TDNodes';
import { ANIMATION_MOTION_TYPES } from '../../utils/nodeSemantics';
import { completeNodeParams, getNodeParamSpec, shouldShowParam, isReadonlyParam } from '../../utils/nodeSpec.generated';
import type { InspectorMode } from '../../utils/nodeSpec.generated';
import type { NodeData } from '../nodes/NodeCanvas';
import type { EdgeData } from '../nodes/NodeCanvas';
import { MotionCurveMenu } from '../../visual-runtime/ui/MotionCurveMenu';
import type { MotionCurveVariant } from '../../visual-runtime/curves/motionCurves';
import {
  applyCreativeControl,
  createCreativeGraph,
  readCreativeControl,
  type CreativeGraph,
  type CreativeGraphReceipt,
} from '../../visual-runtime/product/creativeGraph';
import styles from './ParamPanel.module.css';

const { Text } = Typography;

interface ParamPanelProps {
  selectedNode: NodeData | null;
  selectedNodes?: NodeData[];
  projectName?: string;
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

function getOptionDisplayLabel(option: string): string {
  return getParamDisplayValue(option);
}

const creativeParamOptions: Record<string, Array<{ value: string; label: string }>> = {
  motionType: [
    { value: 'rotation', label: '旋转' },
    { value: 'bounce', label: '跳动' },
    { value: 'translate', label: '位移' },
    { value: 'sine', label: 'Sine 正弦波' },
    { value: 'pulse', label: 'Pulse 脉冲波' },
    { value: 'saw', label: 'Saw 锯齿波' },
    { value: 'ramp', label: 'Ramp 斜坡' },
    { value: 'triangle', label: 'Triangle 三角波' },
    { value: 'noise', label: 'Noise 噪波' },
    { value: 'spring', label: 'Spring 弹簧' },
    { value: 'collPulse', label: 'Coll Pulse 密集脉冲' },
    { value: 'constant', label: 'Constant 恒定值' },
  ],
  layoutMode: [
    { value: 'line', label: '线性排列' },
    { value: 'grid', label: '网格型' },
    { value: 'cubeMatrix', label: '立方体矩阵' },
    { value: 'sphere', label: '球形' },
    { value: 'circle', label: '圆形' },
    { value: 'concentric', label: '同心圆型' },
    { value: 'star', label: '星型' },
  ],
  mode: [
    { value: 'constant', label: '恒定方向' },
    { value: 'random', label: '随机游走' },
    { value: 'noise', label: '噪波式' },
    { value: 'curlNoise', label: '卷曲噪波' },
    { value: 'vortex', label: '涡旋' },
    { value: 'orbit', label: '轨道运动' },
    { value: 'attractor', label: '吸引' },
    { value: 'repulsion', label: '排斥' },
    { value: 'flock', label: '群集' },
    { value: 'wave', label: '波浪' },
    { value: 'turbulence', label: '湍流' },
  ],
  materialTexture: [
    { value: 'none', label: '无纹理' },
    { value: 'checker', label: '棋盘格' },
    { value: 'noise', label: '噪波纹理' },
    { value: 'gradient', label: '渐变纹理' },
    { value: 'image', label: '图片纹理' },
  ],
};

const creativeParamLabels: Record<string, string> = {
  count: '主体数量',
  speed: '运动速度',
  size: '主体大小',
  layoutMode: '主体布局',
  motionType: '运动方式',
  mode: '粒子运动方式',
  bodyColor: '主体颜色',
  color: '颜色',
  opacity: '透明度',
  materialTexture: '材质纹理',
  ambientColor: '环境光色彩',
  ambientIntensity: '环境光强度',
  spacing: '间距',
  particleCount: '粒子数量',
  amplitude: '运动幅度',
  springConstant: '弹簧强度',
  mass: '质量',
  damping: '阻尼',
};

function getCreativeParamLabel(nodeType: string, key: string): string {
  if (creativeParamLabels[key]) return creativeParamLabels[key];
  const translatedTokens: Record<string, string> = {
    x: 'X轴', y: 'Y轴', z: 'Z轴', width: '宽度', height: '高度', depth: '深度',
    radius: '半径', scale: '缩放', rotation: '旋转', position: '位置', frequency: '频率',
    intensity: '强度', density: '密度', distance: '距离', duration: '时长', delay: '延迟',
    roughness: '粗糙度', metalness: '金属度', segments: '分段数', columns: '列数', rows: '行数',
    particle: '粒子', ambient: '环境光', body: '主体', material: '材质', texture: '纹理',
    layout: '布局', motion: '运动', color: '颜色', opacity: '透明度', count: '数量',
    size: '大小', speed: '速度', strength: '强度', noise: '噪波', mode: '方式',
  };
  const translated = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((token) => translatedTokens[token.toLowerCase()] || '')
    .filter(Boolean)
    .join('');
  return translated || `自定义参数（${getParamDisplayLabel(nodeType, key)}）`;
}

function getNumberRange(nodeType: string, key: string, fallbackMax: number): { min: number; max: number; step: number } {
  const spec = getNodeParamSpec(nodeType, key);
  const rangeMatch = spec?.range?.match(/(-?\d+(?:\.\d+)?)\s*[–-]\s*(-?\d+(?:\.\d+)?)/);
  const min = spec?.min ?? (rangeMatch ? Number(rangeMatch[1]) : 0);
  const max = spec?.max ?? (rangeMatch ? Number(rangeMatch[2]) : fallbackMax);
  const span = Math.abs(max - min);
  const step = span <= 1 ? 0.001 : span <= 20 ? 0.1 : 1;
  return { min, max, step };
}

function PreviewParamControls({
  node,
  onParamChange,
}: {
  node: NodeData;
  onParamChange?: (nodeId: string, key: string, value: unknown) => void;
}) {
  const params = node.type === 'CreativeControls' ? node.params || {} : completeNodeParams(node.type, node.params || {});
  const entries = Object.entries(params).filter(([key]) => {
    if (key === 'interaction' || key === 'keys' || key === 'key') return false;
    const spec = getNodeParamSpec(node.type, key);
    return !spec || shouldShowParam(spec, 'normal');
  });
  const update = (key: string, value: unknown) => onParamChange?.(node.id, key, value);

  if (entries.length === 0) {
    return <div className={styles.empty}>此节点暂无可调参数</div>;
  }

  return (
    <div className={styles.previewParamList}>
      {entries.map(([key, value]) => {
        const spec = getNodeParamSpec(node.type, key);
        const label = getCreativeParamLabel(node.type, key);
        const options = creativeParamOptions[key] || spec?.options?.map((option) => ({
          value: option,
          label: getOptionDisplayLabel(option),
        }));

        if (options?.length) {
          return (
            <div key={key} className={styles.paramGroup}>
              <div className={styles.paramLabel}>{label}</div>
              <Select
                size="small"
                value={String(value)}
                onChange={(next) => update(key, next)}
                options={options}
                style={{ width: '100%' }}
              />
            </div>
          );
        }

        if (typeof value === 'number') {
          const fallbackMax = key.includes('speed') || key.includes('速度') ? 10
            : key.includes('count') || key.includes('数量') ? 10000 : 100;
          const { min, max, step } = getNumberRange(node.type, key, fallbackMax);
          return (
            <div key={key} className={styles.paramGroup}>
              <div className={styles.paramLabel}><span>{label}</span><span className={styles.paramValue}>{value}</span></div>
              <div className={styles.paramSlider}>
                <Slider min={min} max={max} step={step} value={value} onChange={(next) => update(key, next)} style={{ flex: 1 }} />
                <InputNumber size="small" min={min} max={max} step={step} value={value} onChange={(next) => update(key, next ?? 0)} style={{ width: 70 }} />
              </div>
            </div>
          );
        }

        if (typeof value === 'boolean') {
          return (
            <div key={key} className={styles.settingRow}>
              <span>{label}</span>
              <Switch size="small" checked={value} onChange={(next) => update(key, next)} />
            </div>
          );
        }

        if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
          return (
            <div key={key} className={styles.paramGroup}>
              <div className={styles.paramLabel}>{label}</div>
              <div className={styles.paramSlider}>
                {value.map((item, index) => (
                  <InputNumber
                    key={`${key}_${index}`}
                    size="small"
                    value={item as number}
                    step={0.1}
                    onChange={(next) => {
                      const nextValue = [...value];
                      nextValue[index] = next ?? 0;
                      update(key, nextValue);
                    }}
                    style={{ width: 70 }}
                  />
                ))}
              </div>
            </div>
          );
        }

        if (typeof value === 'string' && (value.startsWith('#') || key.toLowerCase().includes('color') || key.includes('颜色'))) {
          return (
            <div key={key} className={styles.paramGroup}>
              <div className={styles.paramLabel}>{label}</div>
              <ColorPicker value={value} onChange={(color) => update(key, color.toHexString())} showText />
            </div>
          );
        }

        return (
          <div key={key} className={styles.paramGroup}>
            <div className={styles.paramLabel}>{label}</div>
            {typeof value === 'string'
              ? <Input size="small" value={value} onChange={(event) => update(key, event.target.value)} />
              : <div className={styles.paramValue}>{getParamDisplayValue(value)}</div>}
          </div>
        );
      })}
    </div>
  );
}

const sourceModeOptions = [
  { value: 'singleObject', label: '单个对象' },
  { value: 'instances', label: '对象阵列' },
  { value: 'particles', label: '粒子系统' },
];
const layoutOptions = [
  { value: 'single', label: '单体' },
  { value: 'linear', label: '线性' },
  { value: 'grid', label: '网格' },
  { value: 'boxMatrix', label: '立方体矩阵' },
  { value: 'sphereSurface', label: '球形' },
  { value: 'circle', label: '圆形' },
  { value: 'concentricRings', label: '同心圆' },
  { value: 'star', label: '星型' },
];
const baseMotionOptions = [
  { value: 'rotate', label: '旋转' },
  { value: 'bounce', label: '跳动' },
  { value: 'translate', label: '位移' },
];
const curveRouteOptions = [
  { value: 'baseMotion', label: '基础运动' },
  { value: 'particleMotion', label: '粒子运动' },
  { value: 'both', label: '同时作用' },
];
const particleMotionOptions = [
  { value: 'constantDirection', label: '恒定方向' },
  { value: 'randomWalk', label: '随机游走' },
  { value: 'noise', label: '噪波' },
  { value: 'curlNoise', label: '卷曲噪波' },
  { value: 'vortex', label: '涡旋' },
  { value: 'orbit', label: '轨道' },
  { value: 'attract', label: '吸引' },
  { value: 'repel', label: '排斥' },
  { value: 'flock', label: '群集' },
  { value: 'wave', label: '波浪' },
  { value: 'turbulence', label: '湍流' },
];

function PreviewCreativeFacade({
  controlNode,
  onParamChange,
}: {
  controlNode: NodeData;
  onParamChange: (nodeId: string, key: string, value: unknown) => void;
}) {
  const [graph, setGraph] = useState<CreativeGraph>(() => createCreativeGraph(controlNode.params));
  const [receipt, setReceipt] = useState('');
  const [undoStack, setUndoStack] = useState<CreativeGraphReceipt[]>([]);
  const [redoStack, setRedoStack] = useState<CreativeGraphReceipt[]>([]);

  useEffect(() => {
    setGraph(createCreativeGraph(controlNode.params));
    setUndoStack([]);
    setRedoStack([]);
  }, [controlNode.id]);

  const update = (control: string, value: unknown) => {
    const next = applyCreativeControl(graph, control, value);
    setGraph(next.after);
    setUndoStack((current) => [...current, next].slice(-30));
    setRedoStack([]);
    setReceipt(`${next.label} · 事务 ${next.after.revision} · 影响 ${next.affectedNodeIds.length} 个真实节点`);
    onParamChange(controlNode.id, control, value);
  };
  const value = (control: string) => readCreativeControl(graph, control);
  const curve = String(value('motionCurve') || 'sine') as MotionCurveVariant;

  return (
    <div className={styles.creativeFacade}>
      <div className={styles.creativePipelineStatus}>
        <strong>实时内容管线</strong>
        <span>{graph.nodes.length} 节点 · {graph.edges.length} 条类型化连接</span>
      </div>
      <div className={styles.creativeHistoryActions}>
        <Button size="small" disabled={undoStack.length === 0} onClick={() => {
          const previous = undoStack[undoStack.length - 1];
          if (!previous) return;
          setGraph(previous.before);
          setUndoStack((current) => current.slice(0, -1));
          setRedoStack((current) => [...current, previous]);
          setReceipt(`已撤销：${previous.label}`);
          onParamChange(controlNode.id, previous.control, readCreativeControl(previous.before, previous.control));
        }}>撤销事务</Button>
        <Button size="small" disabled={redoStack.length === 0} onClick={() => {
          const next = redoStack[redoStack.length - 1];
          if (!next) return;
          setGraph(next.after);
          setRedoStack((current) => current.slice(0, -1));
          setUndoStack((current) => [...current, next]);
          setReceipt(`已重做：${next.label}`);
          onParamChange(controlNode.id, next.control, readCreativeControl(next.after, next.control));
        }}>重做事务</Button>
      </div>

      <section className={styles.creativeSection}>
        <h4>内容源</h4>
        <div className={styles.paramGroup}><div className={styles.paramLabel}>内容模式</div><Select value={String(value('sourceMode'))} options={sourceModeOptions} onChange={(next) => update('sourceMode', next)} /></div>
        <div className={styles.paramGroup}><div className={styles.paramLabel}>大小</div><Slider min={0.1} max={10} step={0.1} value={Number(value('size') || 1)} onChange={(next) => update('size', next)} /></div>
        {graph.sourceMode !== 'singleObject' && <div className={styles.paramGroup}><div className={styles.paramLabel}>数量</div><Slider min={1} max={1000} step={1} value={Number(value('count') || 1)} onChange={(next) => update('count', next)} /></div>}
      </section>

      <section className={styles.creativeSection}>
        <h4>布局</h4>
        <Select value={String(value('layout'))} options={layoutOptions} disabled={graph.sourceMode === 'singleObject'} onChange={(next) => update('layout', next)} />
      </section>

      {graph.sourceMode !== 'particles' && (
        <section className={styles.creativeSection}>
          <h4>基础运动</h4>
          <Select value={String(value('motion'))} options={baseMotionOptions} onChange={(next) => update('motion', next)} />
          <div className={styles.paramGroup}><div className={styles.paramLabel}>运动速度</div><Slider min={0} max={10} step={0.05} value={Number(value('motionSpeed') || 0)} onChange={(next) => update('motionSpeed', next)} /></div>
        </section>
      )}

      <section className={styles.creativeSection}>
        <h4>运动规律</h4>
        <MotionCurveMenu value={curve} onChange={(next) => update('motionCurve', next)} />
        <div className={styles.paramGroup}><div className={styles.paramLabel}>作用对象</div><Select value={String(value('curveRoute'))} options={curveRouteOptions} onChange={(next) => update('curveRoute', next)} /></div>
        <div className={styles.paramGroup}><div className={styles.paramLabel}>频率</div><Slider min={0} max={10} step={0.05} value={Number(value('curveFrequency') || 0)} onChange={(next) => update('curveFrequency', next)} /></div>
        <div className={styles.paramGroup}><div className={styles.paramLabel}>幅度</div><Slider min={0} max={10} step={0.05} value={Number(value('curveAmplitude') || 0)} onChange={(next) => update('curveAmplitude', next)} /></div>
        {(curve === 'pulse' || curve === 'collPulse') && <div className={styles.paramGroup}><div className={styles.paramLabel}>占空比</div><Slider min={0.05} max={0.95} step={0.01} value={Number(value('curveDutyCycle') || 0.35)} onChange={(next) => update('curveDutyCycle', next)} /></div>}
        {curve === 'collPulse' && <div className={styles.paramGroup}><div className={styles.paramLabel}>密集脉冲数量</div><Slider min={2} max={32} step={1} value={Number(value('curvePulseCount') || 9)} onChange={(next) => update('curvePulseCount', next)} /></div>}
        {curve === 'noise' && <div className={styles.paramGroup}><div className={styles.paramLabel}>噪波平滑度</div><Slider min={0.05} max={5} step={0.05} value={Number(value('curveNoiseSmoothness') || 1)} onChange={(next) => update('curveNoiseSmoothness', next)} /></div>}
        {curve === 'spring' && <>
          <div className={styles.paramGroup}><div className={styles.paramLabel}>弹簧衰减</div><Slider min={0} max={12} step={0.1} value={Number(value('curveSpringDecay') || 4.5)} onChange={(next) => update('curveSpringDecay', next)} /></div>
          <div className={styles.paramGroup}><div className={styles.paramLabel}>振荡次数</div><Slider min={0.1} max={12} step={0.1} value={Number(value('curveSpringOscillations') || 3.5)} onChange={(next) => update('curveSpringOscillations', next)} /></div>
          <div className={styles.settingRow}><span>循环</span><Switch checked={Boolean(value('curveSpringLoop'))} onChange={(next) => update('curveSpringLoop', next)} /></div>
        </>}
        {curve === 'constant' && <div className={styles.paramGroup}><div className={styles.paramLabel}>恒定值</div><Slider min={0} max={1} step={0.01} value={Number(value('curveConstantValue') || 1)} onChange={(next) => update('curveConstantValue', next)} /></div>}
      </section>

      {graph.sourceMode === 'particles' && (
        <section className={styles.creativeSection}>
          <h4>粒子运动</h4>
          <Select value={String(value('particleMotion'))} options={particleMotionOptions} onChange={(next) => update('particleMotion', next)} />
        </section>
      )}

      <section className={styles.creativeSection}>
        <h4>材质与环境</h4>
        <div className={styles.paramGroup}><div className={styles.paramLabel}>主体颜色</div><ColorPicker value={String(value('color') || '#4A8DF6')} onChange={(next) => update('color', next.toHexString())} showText /></div>
        <div className={styles.paramGroup}><div className={styles.paramLabel}>透明度</div><Slider min={0} max={1} step={0.01} value={Number(value('opacity') ?? 1)} onChange={(next) => update('opacity', next)} /></div>
        <div className={styles.paramGroup}><div className={styles.paramLabel}>环境光色彩</div><ColorPicker value={String(value('ambientColor') || '#ffffff')} onChange={(next) => update('ambientColor', next.toHexString())} showText /></div>
        <div className={styles.paramGroup}><div className={styles.paramLabel}>环境光强度</div><Slider min={0} max={5} step={0.05} value={Number(value('ambientIntensity') || 0)} onChange={(next) => update('ambientIntensity', next)} /></div>
      </section>
      {receipt && <div className={styles.creativeReceipt}>{receipt}</div>}
    </div>
  );
}

function PreviewInspector({
  previewNode,
  allNodes,
  onParamChange,
  onApplyAll,
}: {
  previewNode: NodeData;
  allNodes?: NodeData[];
  onParamChange?: (nodeId: string, key: string, value: unknown) => void;
  onApplyAll?: () => void;
}) {
  const resolvedInspectableNodes = useMemo(
    () => {
      if (previewNode.inspectableNodes?.length) {
        return previewNode.inspectableNodes.filter((node) => node.type === 'CreativeControls');
      }
      const inspectableIds = new Set(previewNode.inspectableNodeIds || []);
      return (allNodes || []).filter((node) => inspectableIds.has(node.id) && node.type === 'CreativeControls');
    },
    [allNodes, previewNode.inspectableNodeIds, previewNode.inspectableNodes],
  );
  const [inspectableNodes, setInspectableNodes] = useState(resolvedInspectableNodes);
  const cameraNodes = useMemo(() => inspectableNodes.filter((node) => node.type === 'camera'), [inspectableNodes]);
  const [activeNodeId, setActiveNodeId] = useState('');
  const [previewRatio, setPreviewRatio] = useState('16:9');
  const [previewQuality, setPreviewQuality] = useState('自动');
  const [transparent, setTransparent] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [exportPreset, setExportPreset] = useState('3840 × 2160');
  const [exportFormat, setExportFormat] = useState('PNG');

  useEffect(() => {
    setInspectableNodes(resolvedInspectableNodes);
  }, [resolvedInspectableNodes]);

  useEffect(() => {
    if (!inspectableNodes.some((node) => node.id === activeNodeId)) {
      const primaryNode = inspectableNodes.find((node) => node.id === previewNode.primaryContentNodeId);
      setActiveNodeId(primaryNode?.id || inspectableNodes[0]?.id || '');
    }
  }, [activeNodeId, inspectableNodes, previewNode.primaryContentNodeId]);

  const activeNode = inspectableNodes.find((node) => node.id === activeNodeId);
  const activeCamera = cameraNodes[0];
  const handleInspectableParamChange = (nodeId: string, key: string, value: unknown) => {
    setInspectableNodes((current) => current.map((node) => (
      node.id === nodeId ? { ...node, params: { ...node.params, [key]: value } } : node
    )));
    if (previewNode.onPreviewParamChange) {
      previewNode.onPreviewParamChange(nodeId, key, value);
      return;
    }
    onParamChange?.(nodeId, key, value);
  };

  const contentTab = (
    <div className={styles.tabBody}>
      <div className={styles.sectionTitle}>当前预览中的真实节点</div>
      {inspectableNodes.length > 0 ? (
        <>
          <div className={styles.previewNodeList}>
            {inspectableNodes.map((node) => (
              <button
                type="button"
                key={node.id}
                className={`${styles.previewNodeButton} ${node.id === activeNodeId ? styles.previewNodeButtonActive : ''}`}
                onClick={() => setActiveNodeId(node.id)}
              >
                <span>{getNodeDisplayLabel(node.type, node.label)}</span>
                <small>{tdNodeTypes[node.type] || node.type}</small>
              </button>
            ))}
          </div>
          {activeNode && activeNode.type === 'CreativeControls' && (
            <div className={styles.previewNodeParams}>
              <div className={styles.nodeInfo}>
                <span className={styles.nodeLabel}>{getNodeDisplayLabel(activeNode.type, activeNode.label)}</span>
                <Tag color="blue">{tdNodeTypes[activeNode.type] || activeNode.type}</Tag>
              </div>
              <PreviewCreativeFacade controlNode={activeNode} onParamChange={handleInspectableParamChange} />
              {onApplyAll && (
                <Button type="primary" block icon={<PlayCircleOutlined />} onClick={onApplyAll}>
                  应用全部参数并预览
                </Button>
              )}
            </div>
          )}
        </>
      ) : <div className={styles.empty}>当前 Preview 暂无可检查的内容节点</div>}
    </div>
  );

  const cameraTab = (
    <div className={styles.tabBody}>
      <div className={styles.settingRow}><span>输出摄像机</span><strong>{activeCamera ? getNodeDisplayLabel(activeCamera.type, activeCamera.label) : '未连接'}</strong></div>
      {activeCamera
        ? <PreviewParamControls node={activeCamera} onParamChange={handleInspectableParamChange} />
        : <div className={styles.empty}>当前 Preview 未连接摄像机节点</div>}
    </div>
  );

  const pathTab = (
    <div className={styles.tabBody}>
      <div className={styles.pathCard}><span>位置路径</span><strong>未设置</strong></div>
      <div className={styles.pathCard}><span>注视目标路径</span><strong>未设置</strong></div>
      <div className={styles.settingRow}><span>双视图编辑</span><Switch size="small" /></div>
      <div className={styles.paramGroup}><div className={styles.paramLabel}>路径时长</div><InputNumber size="small" min={0.1} defaultValue={5} addonAfter="秒" style={{ width: '100%' }} /></div>
      <div className={styles.paramGroup}><div className={styles.paramLabel}>缓动</div><Select size="small" defaultValue="平滑" options={['线性', '平滑', '缓入缓出'].map((value) => ({ value }))} style={{ width: '100%' }} /></div>
    </div>
  );

  const imageTab = (
    <div className={styles.tabBody}>
      <div className={styles.paramGroup}><div className={styles.paramLabel}>画布比例</div><Select size="small" value={previewRatio} onChange={setPreviewRatio} options={['16:9', '1:1', '4:3', '9:16'].map((value) => ({ value }))} style={{ width: '100%' }} /></div>
      <div className={styles.paramGroup}><div className={styles.paramLabel}>预览质量</div><Select size="small" value={previewQuality} onChange={setPreviewQuality} options={['自动', '高', '中', '低'].map((value) => ({ value }))} style={{ width: '100%' }} /></div>
      <div className={styles.settingRow}><span>透明背景</span><Switch size="small" checked={transparent} onChange={setTransparent} /></div>
      <div className={styles.settingRow}><span>辅助网格</span><Switch size="small" checked={showGrid} onChange={setShowGrid} /></div>
    </div>
  );

  const exportTab = (
    <div className={styles.tabBody}>
      <div className={styles.paramGroup}><div className={styles.paramLabel}>输出规格</div><Select size="small" value={exportPreset} onChange={setExportPreset} options={['1920 × 1080', '3840 × 2160', '4096 × 2160', '自定义'].map((value) => ({ value }))} style={{ width: '100%' }} /></div>
      <div className={styles.paramGroup}><div className={styles.paramLabel}>输出比例</div><Select size="small" value={previewRatio} onChange={setPreviewRatio} options={['16:9', '1:1', '4:3', '9:16'].map((value) => ({ value }))} style={{ width: '100%' }} /></div>
      <div className={styles.paramGroup}><div className={styles.paramLabel}>格式</div><Select size="small" value={exportFormat} onChange={setExportFormat} options={['PNG', 'JPG', 'WebP'].map((value) => ({ value }))} style={{ width: '100%' }} /></div>
      <div className={styles.settingRow}><span>下载透明底图</span><Switch size="small" checked={transparent} onChange={setTransparent} /></div>
      <div className={styles.performanceCard}>下载按钮仍位于预览窗口顶部；这里用于统一检查输出参数。</div>
    </div>
  );

  return (
    <div className={styles.panel}>
      <div className={styles.inspectorTitle}>
        <div><strong>预览参数</strong><span>仅显示当前 Preview 的真实内容与输出设置</span></div>
        <Tag color="blue">{inspectableNodes.length} 节点</Tag>
      </div>
      <Tabs
        className={styles.previewTabs}
        defaultActiveKey={inspectableNodes.length > 0 ? 'content' : 'image'}
        items={[
          { key: 'content', label: '内容', children: contentTab },
          { key: 'camera', label: '摄像机', children: cameraTab },
          { key: 'path', label: '路径', children: pathTab },
          { key: 'image', label: '画面', children: imageTab },
          { key: 'export', label: '导出', children: exportTab },
        ]}
      />
    </div>
  );
}

export function ParamPanel({ selectedNode, selectedNodes, allNodes, allEdges, onParamChange, onApply, onApplyAll, onConnectNodes, onRemoveConnection, adjustExplanation }: ParamPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('normal');
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

  if ((selectedNodes?.length || 0) > 1) {
    const commonParamKeys = Object.keys(selectedNodes?.[0].params || {}).filter((key) =>
      selectedNodes?.every((node) => key in node.params),
    );
    return (
      <div className={styles.panel}>
        <div className={styles.inspectorTitle}>
          <div><strong>批量参数</strong><span>已选择 {selectedNodes?.length} 个节点</span></div>
        </div>
        <div className={styles.expanded}>
          <div className={styles.sectionTitle}>共同参数</div>
          {commonParamKeys.length > 0 ? commonParamKeys.map((key) => (
            <div key={key} className={styles.paramGroup}>
              <div className={styles.paramLabel}>{getParamDisplayLabel(selectedNodes?.[0].type || '', key)}</div>
              <div className={styles.batchValue}>多个值</div>
            </div>
          )) : <div className={styles.empty}>这些节点没有共同参数</div>}
          <Button danger block icon={<DeleteOutlined />}>删除所选节点</Button>
        </div>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className={styles.panel}>
        <div className={styles.inspectorTitle}>
          <div><strong>参数检查器</strong><span>选择画布中的节点或预览输出</span></div>
        </div>
        <div className={styles.empty}>未选择节点</div>
      </div>
    );
  }

  if (selectedNode.type === 'preview') {
    return <PreviewInspector previewNode={selectedNode} allNodes={allNodes} onParamChange={onParamChange} onApplyAll={onApplyAll} />;
  }

  const cat = categoryFromNodeType(selectedNode.type);
  const catCls = catHeaderClasses[cat] || '';
  const typeLabel = tdNodeTypes[selectedNode.type] || selectedNode.type;
  const displayNodeLabel = getNodeDisplayLabel(selectedNode.type, selectedNode.label);
  const params = completeNodeParams(selectedNode.type, selectedNode.params || {});
  const isVisionInteractionNode = selectedNode.type === 'gesture' || selectedNode.type === 'faceRecognition';

  if (isVisionInteractionNode) {
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
            <Text className={styles.headerText}>{displayNodeLabel}</Text>
          </div>
          {expanded ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
        </div>

        {expanded && (
          <div className={styles.expanded}>
            <div className={styles.nodeInfo}>
              <span className={`${styles.nodeCategory} ${catCls}`}>
                {categoryLabels[cat] || cat}
              </span>
              <span className={styles.nodeLabel}>{displayNodeLabel}</span>
              <Tag color="default" style={{ fontSize: 10, marginLeft: 'auto' }}>
                {typeLabel}
              </Tag>
            </div>
            <div className={styles.empty}>
              Use the authorization button inside this node. The node shows SYSTEM plus HAND/FACE interaction status after camera permission is granted.
            </div>
          </div>
        )}
      </div>
    );
  }

  const paramEntries = Object.entries(params).filter(
    ([k]) => {
      if (k === 'interaction' || k === 'keys' || k === 'key') return false;
      if (selectedNode.type === 'animation' && k === 'motionType') return false;
      // Filter by visibility based on inspector mode
      const spec = getNodeParamSpec(selectedNode.type, k);
      if (spec && !shouldShowParam(spec, inspectorMode)) return false;
      return true;
    },
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
            {displayNodeLabel}
          </Text>
          {inspectorMode !== 'normal' && (
            <Tag color={inspectorMode === 'advanced' ? 'blue' : 'orange'} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
              {inspectorMode === 'advanced' ? '高级' : '开发'}
            </Tag>
          )}
        </div>
        {expanded ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
      </div>

      {expanded && (
        <div className={styles.expanded}>
          <div className={styles.nodeInfo}>
            <span className={`${styles.nodeCategory} ${catCls}`}>
              {categoryLabels[cat] || cat}
            </span>
            <span className={styles.nodeLabel}>{displayNodeLabel}</span>
            <Tag color="default" style={{ fontSize: 10, marginLeft: 'auto' }}>
              {typeLabel}
            </Tag>
          </div>

          {/* Inspector mode toggle */}
          <div className={styles.paramGroup} style={{ marginBottom: 8 }}>
            <div className={styles.paramLabel}>检查器模式</div>
            <Select
              size="small"
              value={inspectorMode}
              onChange={(v) => setInspectorMode(v as InspectorMode)}
              style={{ width: '100%' }}
              options={[
                { value: 'normal', label: '普通 — 仅核心创作参数' },
                { value: 'advanced', label: '高级 — 含高级参数' },
                { value: 'developer', label: '开发 — 全部参数' },
              ]}
            />
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
            const paramSpec = getNodeParamSpec(selectedNode.type, key);

            if (paramSpec?.options?.length) {
              return (
                <div key={key} className={styles.paramGroup}>
                  <div className={styles.paramLabel}>{getParamDisplayLabel(selectedNode.type, key)}</div>
                  <Select
                    value={String(value)}
                    onChange={(v) => handleParamChange(key, v)}
                    style={{ width: '100%' }}
                    size="small"
                    options={paramSpec.options.map((option) => ({ value: option, label: getOptionDisplayLabel(option) }))}
                  />
                </div>
              );
            }

            if (typeof value === 'number') {
              const fallbackMax = key.includes('速度') || key.includes('speed') ? 0.1
                : key.includes('数量') || key.includes('count') ? 10000 : 10;
              const { min, max, step } = getNumberRange(selectedNode.type, key, fallbackMax);
              return (
                <div key={key} className={styles.paramGroup}>
                  <div className={styles.paramLabel}>
                    <span>{getParamDisplayLabel(selectedNode.type, key)}</span>
                    <span className={styles.paramValue}>{typeof value === 'number' ? value.toFixed(step < 1 ? 3 : 0) : ''}</span>
                  </div>
                  <div className={styles.paramSlider}>
                    <Slider
                      min={min}
                      max={max}
                      step={step}
                      value={value as number}
                      onChange={(v) => handleParamChange(key, v)}
                      style={{ flex: 1 }}
                    />
                    <InputNumber
                      size="small"
                      min={min}
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

            if (typeof value === 'boolean') {
              return (
                <div key={key} className={styles.paramGroup}>
                  <div className={styles.paramLabel}>{getParamDisplayLabel(selectedNode.type, key)}</div>
                  <Switch
                    size="small"
                    checked={value}
                    onChange={(checked) => handleParamChange(key, checked)}
                  />
                </div>
              );
            }

            if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
              return (
                <div key={key} className={styles.paramGroup}>
                  <div className={styles.paramLabel}>{getParamDisplayLabel(selectedNode.type, key)}</div>
                  <div className={styles.paramSlider}>
                    {value.map((item, index) => (
                      <InputNumber
                        key={`${key}_${index}`}
                        size="small"
                        value={item as number}
                        step={0.1}
                        onChange={(v) => {
                          const next = [...value];
                          next[index] = v ?? 0;
                          handleParamChange(key, next);
                        }}
                        style={{ width: 70 }}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            if (typeof value === 'string' && (value.startsWith('#') || key.includes('颜色') || key.includes('color'))) {
              return (
                <div key={key} className={styles.paramGroup}>
                  <div className={styles.paramLabel}>{getParamDisplayLabel(selectedNode.type, key)}</div>
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
                  <div className={styles.paramLabel}>{getParamDisplayLabel(selectedNode.type, key)}</div>
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
                  <div className={styles.paramLabel}>{getParamDisplayLabel(selectedNode.type, key)}</div>
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
                  <span>{getParamDisplayLabel(selectedNode.type, key)}</span>
                  <span className={styles.paramValue}>{getParamDisplayValue(value)}</span>
                </div>
                {typeof value === 'string' && (
                  <Input
                    size="small"
                    value={value}
                    onChange={(e) => handleParamChange(key, e.target.value)}
                  />
                )}
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
                      {targetNode ? getNodeDisplayLabel(targetNode.type, targetNode.label) : targetId}
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
                      label: `${getNodeDisplayLabel(n.type, n.label)} (${tdNodeTypes[n.type] || n.type})`,
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

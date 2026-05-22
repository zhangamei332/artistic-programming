import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import styles from './TDNodes.module.css';

export interface TDNodeData {
  label: string;
  nodeType: string;
  params?: Record<string, unknown>;
}

function catFromType(nt: string): string {
  if (/^scene$|^camera$|^renderer$/.test(nt)) return 'scene';
  if (/^geometry$|^material$|^mesh$/.test(nt)) return 'geometry';
  if (/Light$/.test(nt)) return 'light';
  if (/^transform$|^animation$|^controls$|^responsive$/.test(nt)) return 'control';
  if (/^texture$|^particles$|^shader$|^color$/.test(nt)) return 'effect';
  if (/^interaction$/.test(nt)) return 'interaction';
  if (/^line$|^rect2d$|^ellipse2d$|^circle$|^arc$|^bezier$|^curve2d$|^vertex$|^quad$/.test(nt)) return 'drawing';
  return 'scene';
}

const catStyles: Record<string, string> = {
  scene: styles.nodeScene,
  geometry: styles.nodeGeometry,
  light: styles.nodeLight,
  control: styles.nodeControl,
  effect: styles.nodeEffect,
  interaction: styles.nodeInteraction,
  drawing: styles.nodeDrawing,
};

export const categoryLabels: Record<string, string> = {
  scene: '场景层',
  geometry: '几何体层',
  light: '光照层',
  control: '控制层',
  effect: '效果层',
  interaction: '交互层',
  drawing: '2D绘图层',
};

export const tdNodeTypes: Record<string, string> = {
  // 场景层
  scene: '场景', camera: '摄像机', renderer: '渲染器',
  // 几何体层
  geometry: '几何体', material: '材质', mesh: '网格体',
  // 光照层
  ambientLight: '环境光', directionalLight: '方向光', pointLight: '点光源',
  // 控制层
  transform: '变换', animation: '动画', controls: '控制器', responsive: '响应式',
  // 效果层
  texture: '纹理', particles: '粒子', shader: '着色器', color: '颜色',
  // 交互层
  interaction: '交互',
  // 2D绘图层
  line: '直线', rect2d: '矩形', ellipse2d: '椭圆', circle: '圆形',
  arc: '弧线', bezier: '贝塞尔曲线', curve2d: '曲线', vertex: '自定义形状', quad: '四边形',
};

function TDNodeBase({ data, rfType }: { data: TDNodeData; rfType: string }) {
  const cat = catFromType(data.nodeType || rfType);
  const cls = catStyles[cat] || styles.nodeScene;
  const catLabel = categoryLabels[cat] || '场景';
  const params = data.params || {};

  const paramEntries = Object.entries(params).filter(
    ([k]) => k !== 'interaction',
  );

  return (
    <div className={`${styles.node} ${cls}`}>
      <Handle type="target" position={Position.Left} style={{ width: 8, height: 8 }} />
      <div className={styles.header}>{catLabel}</div>
      <div className={styles.label}>{data.label}</div>
      {paramEntries.length > 0 && (
        <div className={styles.params}>
          {paramEntries.slice(0, 3).map(([key, val]) => (
            <div key={key} className={styles.paramRow} title="点击编辑参数">
              <span className={styles.paramKey}>{key}</span>
              <span className={styles.paramVal}>
                {typeof val === 'number' ? val.toFixed(2) : String(val).slice(0, 12)}
              </span>
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8 }} />
    </div>
  );
}

export const SceneNode = memo((props: NodeProps) => (
  <TDNodeBase data={props.data as TDNodeData} rfType="scene" />
));
export const GeometryNode = memo((props: NodeProps) => (
  <TDNodeBase data={props.data as TDNodeData} rfType="geometry" />
));
export const LightNode = memo((props: NodeProps) => (
  <TDNodeBase data={props.data as TDNodeData} rfType="light" />
));
export const ControlNode = memo((props: NodeProps) => (
  <TDNodeBase data={props.data as TDNodeData} rfType="control" />
));
export const EffectNode = memo((props: NodeProps) => (
  <TDNodeBase data={props.data as TDNodeData} rfType="effect" />
));
export const InteractionNode = memo((props: NodeProps) => (
  <TDNodeBase data={props.data as TDNodeData} rfType="interaction" />
));
export const DrawingNode = memo((props: NodeProps) => (
  <TDNodeBase data={props.data as TDNodeData} rfType="drawing" />
));

export const nodeTypesMap = {
  scene: SceneNode,
  geometry: GeometryNode,
  light: LightNode,
  control: ControlNode,
  effect: EffectNode,
  interaction: InteractionNode,
  drawing: DrawingNode,
};

export { catFromType as categoryFromNodeType };

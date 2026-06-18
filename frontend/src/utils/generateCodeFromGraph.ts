import type { NodeData } from '../components/nodes/NodeCanvas';
import type { EdgeData } from '../components/nodes/NodeCanvas';
import { buildGraphText } from './nodeSemantics';
import type { GraphTextOutput } from './nodeSemantics';
import { completeNodeParams } from './nodeSpec.generated';

interface GraphToCodeParams {
  nodes: NodeData[];
  edges: EdgeData[];
  originalCode: string;
  language: 'threejs';
}

function compactOriginalCode(code: string): string {
  const lines = code.split('\n').map((line) => line.trim()).filter(Boolean);
  const annotations = lines.filter((line) => line.startsWith('// @')).slice(0, 44);
  const structure = lines.filter((line) => (
    /import |OrbitControls|controls\.|new THREE\.|renderer\.|camera\.|scene\.|rootGroup|context\s*=|modules\s*=|function create[A-Z]|update\s*\(|resize\s*\(|dispose\s*\(|requestAnimationFrame|animate|addEventListener\(['"](keydown|keyup|mousedown|mouseup|mousemove|pointerdown|pointermove|pointerup|wheel)|navigator\.mediaDevices|getUserMedia|HandLandmarker|FaceLandmarker|detectForVideo|landmarks|faceLandmarks|scaleX\(-1\)/.test(line)
  )).slice(0, 80);
  const text = [
    annotations.length ? `节点注释:\n${annotations.join('\n')}` : '',
    structure.length ? `关键代码:\n${structure.join('\n')}` : '',
  ].filter(Boolean).join('\n');
  return text.length > 5000 ? `${text.slice(0, 5000)}...` : text;
}

/**
 * 从节点图构建结构化的文本描述。
 * 使用 nodeSemantics 引擎：每个节点 → 局部文本指令，每条连线 → 逻辑关系文本，
 * 按语义分段组织（场景结构/几何体/光照/效果/交互/动画/数据流）。
 */
export function buildGraphDescription(params: GraphToCodeParams): string {
  const { nodes, edges, originalCode, language } = params;

  const result: GraphTextOutput = buildGraphText({
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      params: completeNodeParams(n.type, n.params),
    })),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
    language,
  });

  const originalCodeContext = originalCode.trim() ? compactOriginalCode(originalCode) : '';
  if (!originalCodeContext) return result.fullText;

  return [
    result.fullText,
    '\n=== 现有预览代码压缩参考 ===',
    '必须把以下代码摘要当作当前作品基底：保留已有对象、动画循环、键盘/鼠标/摄像头交互和 @node/@connect 关系，只根据节点图叠加或更新必要部分。',
    '保留已有 context、createXxx、modules、update、resize、dispose 组合结构；新增能力只新增对应模块并接入 modules，局部调整只修改目标模块和必要连接。',
    "如果新增 hand/face 识别，禁止自行加载摄像头或 MediaPipe；必须订阅前端内置 window.__previewVision 的 face/gesture 数据，并使用标准 @node:gesture=手势识别 / @node:faceRecognition=人脸识别 注释协议。",
    '不要直接裸调用 setPointerCapture 或 releasePointerCapture；如必须使用，必须 try/catch 捕获 NotFoundError，避免预览运行时报错。',
    originalCodeContext,
  ].join('\n');
}

/**
 * 从节点图重新生成代码 — 将图结构文本发给AI修复端点。
 */
export async function regenerateCode(
  graphParams: GraphToCodeParams,
): Promise<string | null> {
  const prompt = buildGraphDescription(graphParams);

  try {
    const response = await fetch('/api/generate/fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: graphParams.originalCode,
        error: `请根据以下节点图更新代码参数:\n${prompt}`,
        language: graphParams.language,
      }),
    });

    const result = await response.json();
    if (result.success && result.data?.code) {
      return result.data.code;
    }
    return null;
  } catch (err) {
    console.error('代码重组失败:', err);
    return null;
  }
}

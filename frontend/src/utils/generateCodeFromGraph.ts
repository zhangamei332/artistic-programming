import type { NodeData } from '../components/nodes/NodeCanvas';
import type { EdgeData } from '../components/nodes/NodeCanvas';
import { buildGraphText } from './nodeSemantics';
import type { GraphTextOutput } from './nodeSemantics';

interface GraphToCodeParams {
  nodes: NodeData[];
  edges: EdgeData[];
  originalCode: string;
  language: 'threejs';
}

/**
 * 从节点图构建结构化的文本描述。
 * 使用 nodeSemantics 引擎：每个节点 → 局部文本指令，每条连线 → 逻辑关系文本，
 * 按语义分段组织（场景结构/几何体/光照/效果/交互/动画/数据流）。
 */
export function buildGraphDescription(params: GraphToCodeParams): string {
  const { nodes, edges, language } = params;

  const result: GraphTextOutput = buildGraphText({
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, label: n.label, params: n.params })),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
    language,
  });

  return result.fullText;
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

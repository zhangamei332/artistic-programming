import type { NodeData } from '../components/nodes/NodeCanvas';
import type { EdgeData } from '../components/nodes/NodeCanvas';
import { tdNodeTypes } from '../components/nodes/TDNodes';

interface GraphToCodeParams {
  nodes: NodeData[];
  edges: EdgeData[];
  originalCode: string;
  language: 'threejs' | 'p5js';
}

export function buildGraphDescription(params: GraphToCodeParams): string {
  const { nodes, edges, originalCode } = params;

  const nodeLines = nodes.map((n) => {
    const typeName = tdNodeTypes[n.type] || n.type;
    const paramStr = Object.entries(n.params)
      .map(([k, v]) => `    ${k}=${v}`)
      .join('\n');
    return `节点: ${n.id} [${typeName}] "${n.label}"
参数:
${paramStr || '    (无)'}`;
  });

  const edgeLines = edges.map((e) => {
    const src = nodes.find((n) => n.id === e.source);
    const tgt = nodes.find((n) => n.id === e.target);
    return `${src?.label || e.source} -> ${tgt?.label || e.target}`;
  });

  return `根据以下节点参数更新代码：

节点与参数:
${nodeLines.join('\n\n')}

连线关系:
${edgeLines.join('\n') || '(无连线)'}

请仅修改上面列出的参数值，保持代码其他部分不变。确保所有 @node:、@param:、@color:、@interaction:、@connect: 标记完整保留。`;
}

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

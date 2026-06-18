import OpenAI from 'openai';
import { config } from '../../config';
import { THREE_NODE_TYPES } from './nodeTypes';
import { SYSTEM_PROMPT, FIX_SYSTEM_PROMPT } from './prompts';
import { getNodeSpecDefinition } from './nodeSpec.generated';

interface GenerateParams {
  prompt: string;
  language: string;
  onProgress?: (message: string) => void;
  onDelta?: (text: string) => void;
}

interface GenerateResult {
  code: string;
  language: 'threejs';
  nodes: NodeData[];
  edges: EdgeData[];
}

interface FixParams {
  code: string;
  error: string;
  language: 'threejs';
  onProgress?: (message: string) => void;
  onDelta?: (text: string) => void;
}

interface NodeData {
  id: string;
  type: string;
  label: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
}

export { THREE_NODE_TYPES };

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

async function completeChat(
  client: OpenAI,
  messages: ChatMessage[],
  temperature: number,
  onProgress?: (message: string) => void,
  onDelta?: (text: string) => void,
): Promise<string> {
  onProgress?.('正在连接 DeepSeek API');
  const stream = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    temperature,
    max_tokens: 4096,
    stream: true,
  });

  onProgress?.('API 已响应，正在接收代码');
  let rawCode = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (!delta) continue;
    rawCode += delta;
    onDelta?.(delta);
  }
  onProgress?.('代码接收完成，正在整理结果');
  return rawCode;
}

function parseAnnotationValue(rawValue: string): unknown {
  const value = rawValue.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function getFamilyRank(nodeType: string): number {
  const family = getNodeSpecDefinition(nodeType)?.family;
  if (!family) return 10;
  const order = ['SCENE', 'SIGNAL', 'GEOMETRY', 'MATERIAL', 'TEXTURE', 'SVG', 'PARTICLE', 'P5_TEXTURE', 'DATA', 'AI'];
  return order.indexOf(family) === -1 ? 10 : order.indexOf(family);
}

function applySpecLayout(nodes: NodeData[]): void {
  const familyCounts = new Map<number, number>();
  for (const node of nodes) {
    const rank = getFamilyRank(node.type);
    const index = familyCounts.get(rank) || 0;
    node.position = {
      x: 100 + rank * 260,
      y: 100 + index * 150,
    };
    familyCounts.set(rank, index + 1);
  }
}

export async function generateWithDeepSeek(
  params: GenerateParams,
): Promise<GenerateResult> {
  if (!config.deepseek.apiKey) {
    console.warn('[DeepSeek] API Key not configured, returning demo code');
    return getDemoCode(params.prompt);
  }

  const client = new OpenAI({
    apiKey: config.deepseek.apiKey,
    baseURL: config.deepseek.baseUrl,
  });

  const langHint =
    params.language === 'auto'
      ? ''
      : `请使用 ${params.language} 来生成代码。`;

  const rawCode = await completeChat(
    client,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${params.prompt}\n${langHint}` },
    ],
    0.7,
    params.onProgress,
    params.onDelta,
  );
  const code = stripMarkdownCodeBlock(rawCode);
  const { nodes, edges } = parseAnnotations(code);

  return {
    code,
    language: 'threejs',
    nodes,
    edges,
  };
}

export function parseAnnotations(code: string): { nodes: NodeData[]; edges: EdgeData[] } {
  const nodes: NodeData[] = [];
  const edges: EdgeData[] = [];
  const lines = code.split('\n');
  const pendingConnections: Array<{ sourceLabel: string; targetLabel: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match @node:type=label
    const nodeMatch = line.match(/\/\/\s*@node:(\w+)=(.+)/);
    if (nodeMatch) {
      const nodeType = nodeMatch[1];
      const nodeLabel = nodeMatch[2].trim();
      const nodeId = `node_${nodes.length}`;

      const params: Record<string, unknown> = {};
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.match(/\/\/\s*@node:/)) break;

        const paramMatch = nextLine.match(/\/\/\s*@param:(.+)=(.+)/);
        if (paramMatch) {
          params[paramMatch[1].trim()] = parseAnnotationValue(paramMatch[2]);
        }

        const colorMatch = nextLine.match(/\/\/\s*@color:(.+)=(.+)/);
        if (colorMatch) {
          params[colorMatch[1].trim()] = colorMatch[2].trim();
        }

        const interactMatch = nextLine.match(/\/\/\s*@interaction:(.+)/);
        if (interactMatch) {
          params['interaction'] = interactMatch[1].trim();
        }
      }

      nodes.push({
        id: nodeId,
        type: nodeType,
        label: nodeLabel,
        params,
        position: { x: 100, y: 100 },
      });
      continue;
    }

    // Match @connect:source->target (by label name)
    const connectMatch = line.match(/\/\/\s*@connect:(.+)->(.+)/);
    if (connectMatch) {
      pendingConnections.push({
        sourceLabel: connectMatch[1].trim(),
        targetLabel: connectMatch[2].trim(),
      });
    }
  }

  if (nodes.length === 0) {
    return parseLegacyAnnotations(code);
  }

  for (const connection of pendingConnections) {
    const sourceNode = nodes.find((n) => n.label === connection.sourceLabel);
    const targetNode = nodes.find((n) => n.label === connection.targetLabel);
    if (!sourceNode || !targetNode) continue;
    edges.push({
      id: `edge_${sourceNode.id}_${targetNode.id}`,
      source: sourceNode.id,
      target: targetNode.id,
    });
  }

  applySpecLayout(nodes);
  addCreativeControlNode(code, nodes, edges);

  return { nodes, edges };
}

function addCreativeControlNode(code: string, nodes: NodeData[], edges: EdgeData[]) {
  if (nodes.length === 0) return;
  const globalParams = parseGlobalParams(code);
  const existingControlNode = nodes.find((node) => node.type === 'CreativeControls');
  if (existingControlNode) {
    existingControlNode.label = '全局主体参数';
    existingControlNode.params = globalParams;
    return;
  }
  const controlNode: NodeData = {
    id: `node_${nodes.length}`,
    type: 'CreativeControls',
    label: '全局主体参数',
    params: globalParams,
    position: { x: 100, y: 100 },
  };
  nodes.push(controlNode);
  const sourceNode = nodes.find((node) => node.id !== controlNode.id && !['scene', 'camera', 'renderer', 'controls'].includes(node.type));
  const globalMotionType = typeof globalParams.motionType === 'string' ? globalParams.motionType : '';
  const hasMotionNode = nodes.some((node) => (
    node.id !== controlNode.id
    && (typeof node.params.motionType === 'string' || typeof node.params.waveform === 'string')
  ));
  if (globalMotionType && !hasMotionNode) {
    const motionNode: NodeData = {
      id: `node_${nodes.length}`,
      type: 'animation',
      label: `${globalMotionType} 运动信号`,
      params: {
        motionType: globalMotionType,
        speed: typeof globalParams.speed === 'number' ? globalParams.speed : 1,
        amplitude: typeof globalParams.amplitude === 'number' ? globalParams.amplitude : 1,
        ...(globalMotionType === 'spring' ? {
          springConstant: typeof globalParams.springConstant === 'number' ? globalParams.springConstant : 0.5,
          mass: typeof globalParams.mass === 'number' ? globalParams.mass : 1,
          damping: typeof globalParams.damping === 'number' ? globalParams.damping : 0.2,
        } : {}),
      },
      position: { x: 100, y: 100 },
    };
    nodes.push(motionNode);
    if (sourceNode) {
      edges.push({
        id: `edge_${motionNode.id}_${sourceNode.id}`,
        source: motionNode.id,
        target: sourceNode.id,
      });
    }
  }
  if (sourceNode) {
    edges.push({
      id: `edge_${sourceNode.id}_${controlNode.id}`,
      source: sourceNode.id,
      target: controlNode.id,
    });
  }
  applySpecLayout(nodes);
}

function parseGlobalParams(code: string): Record<string, unknown> {
  const marker = code.match(/\bconst\s+GLOBAL_PARAMS\s*=\s*\{/);
  if (!marker || marker.index === undefined) return {};
  const start = code.indexOf('{', marker.index);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < code.length; index++) {
    const char = code[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          const value = JSON.parse(code.slice(start, index + 1));
          return value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
        } catch {
          return {};
        }
      }
    }
  }
  return {};
}

function parseLegacyAnnotations(code: string): { nodes: NodeData[]; edges: EdgeData[] } {
  const nodes: NodeData[] = [];
  const edges: EdgeData[] = [];
  const lines = code.split('\n');
  let y = 100;

  for (const line of lines) {
    const paramMatch = line.match(/\/\/ @param:(.+)=(.+)/);
    if (paramMatch) {
      nodes.push({
        id: `param_${nodes.length}`,
        type: 'transform',
        label: paramMatch[1],
        params: { value: parseFloat(paramMatch[2]) || paramMatch[2] },
        position: { x: 100, y },
      });
      y += 120;
      continue;
    }

    const colorMatch = line.match(/\/\/ @color:(.+)=(.+)/);
    if (colorMatch) {
      nodes.push({
        id: `color_${nodes.length}`,
        type: 'color',
        label: colorMatch[1],
        params: { color: colorMatch[2] },
        position: { x: 350, y: 100 },
      });
      continue;
    }

    const interactionMatch = line.match(/\/\/ @interaction:(.+)/);
    if (interactionMatch) {
      nodes.push({
        id: `interact_${nodes.length}`,
        type: 'interaction',
        label: interactionMatch[1],
        params: {},
        position: { x: 600, y: 100 },
      });
    }
  }

  return { nodes, edges };
}

export async function fixWithDeepSeek(params: FixParams): Promise<{ code: string; nodes: NodeData[]; edges: EdgeData[] }> {
  if (!config.deepseek.apiKey) {
    console.warn('[DeepSeek] API Key not configured, returning original code');
    return { code: params.code, nodes: [], edges: [] };
  }

  const client = new OpenAI({
    apiKey: config.deepseek.apiKey,
    baseURL: config.deepseek.baseUrl,
  });

  const userMessage = `代码（${params.language}）：
\`\`\`
${params.code}
\`\`\`

任务：${params.error}

请按要求输出修改后的完整代码。`;

  const rawCode = await completeChat(
    client,
    [
      { role: 'system', content: FIX_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    0.3,
    params.onProgress,
    params.onDelta,
  );
  const code = stripMarkdownCodeBlock(rawCode);
  const { nodes, edges } = parseAnnotations(code);

  return { code, nodes, edges };
}

interface ImageToCodeParams {
  imageDataUrl: string;
  instruction: string;
  onProgress?: (message: string) => void;
  onDelta?: (text: string) => void;
}

export async function imageToCodeWithDeepSeek(
  params: ImageToCodeParams,
): Promise<GenerateResult> {
  if (!config.deepseek.apiKey) {
    console.warn('[DeepSeek] API Key not configured, returning demo code');
    return getDemoCode(params.instruction);
  }

  const client = new OpenAI({
    apiKey: config.deepseek.apiKey,
    baseURL: config.deepseek.baseUrl,
  });

  // construct vision-format message (OpenAI-compatible)
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: 'image_url',
      image_url: { url: params.imageDataUrl },
    },
    {
      type: 'text',
      text: `请根据这张参考图片和以下指令生成创意编程代码（Three.js 主渲染；GSAP 只用于 DOM 或对象属性动画；p5.js 只能作为可选动态纹理）：\n${params.instruction}\n\n请保留完整 @node/@param/@connect 节点注释，但不要创建 GUI 调参面板。`,
    },
  ];

  const rawCode = await completeChat(
    client,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent as unknown as string },
    ],
    0.7,
    params.onProgress,
    params.onDelta,
  );
  const code = stripMarkdownCodeBlock(rawCode);
  const { nodes, edges } = parseAnnotations(code);

  return { code, language: 'threejs', nodes, edges };
}

function stripMarkdownCodeBlock(text: string): string {
  const codeBlockMatch = text.match(/```[\w#]*\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return text.trim();
}

function getDemoCode(prompt: string): GenerateResult {
  const code = `
// @node:scene=3D场景
// @node:camera=主摄像机
// @param:视野=75
// @node:renderer=渲染器
// @node:comp_root=根容器

import * as THREE from 'three';

const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const rootGroup = new THREE.Group();
scene.add(rootGroup);

// @node:mesh=旋转立方体
// @param:尺寸=1.0
// @color:立方体颜色=#4A90D9
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({
  color: 0x4A90D9,
  roughness: 0.3,
  metalness: 0.7,
});
const cube = new THREE.Mesh(geometry, material);
rootGroup.add(cube);
// @connect:根容器->旋转立方体

// @node:ambientLight=环境光
// @param:强度=0.5
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
rootGroup.add(ambientLight);
// @connect:根容器->环境光

// @node:directionalLight=主方向光
// @param:强度=1.0
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
rootGroup.add(directionalLight);
// @connect:根容器->主方向光

// @node:particles=星空粒子
// @param:数量=500
// @param:旋转速度=0.0005
const starsGeometry = new THREE.BufferGeometry();
const starsCount = 500;
const starsPositions = new Float32Array(starsCount * 3);
for (let i = 0; i < starsCount * 3; i++) {
  starsPositions[i] = (Math.random() - 0.5) * 20;
}
starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.02 });
const stars = new THREE.Points(starsGeometry, starsMaterial);
rootGroup.add(stars);
// @connect:根容器->星空粒子

// @node:resize=视口自适应
const resizeObserver = new ResizeObserver(() => {
  const { width, height } = container.getBoundingClientRect();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});
resizeObserver.observe(container);

// @node:animation=旋转动画
// @param:速度X=0.01
// @param:速度Y=0.01
let animationId;
function animate() {
  animationId = requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  stars.rotation.y += 0.0005;
  renderer.render(scene, camera);
}
animate();
// @connect:旋转动画->旋转立方体
// @connect:旋转动画->星空粒子

// @node:dispose=资源释放
window.__disposeCallbacks.push(function dispose() {
  cancelAnimationFrame(animationId);
  resizeObserver.disconnect();
  renderer.dispose();
  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
});
`.trim();
  const { nodes, edges } = parseAnnotations(code);

  return {
    code,
    language: 'threejs',
    nodes,
    edges,
  };
}

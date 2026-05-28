import OpenAI from 'openai';
import { config } from '../../config';
import { THREE_NODE_TYPES } from './nodeTypes';
import { SYSTEM_PROMPT, FIX_SYSTEM_PROMPT } from './prompts';

interface GenerateParams {
  prompt: string;
  language: string;
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

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${params.prompt}\n${langHint}` },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });

  const rawCode = response.choices[0]?.message?.content || '';
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

  const cols = 3;
  let row = 0;
  let col = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match @node:type=label
    const nodeMatch = line.match(/\/\/\s*@node:(\w+)=(.+)/);
    if (nodeMatch) {
      const nodeType = nodeMatch[1];
      const nodeLabel = nodeMatch[2].trim();
      const nodeId = `node_${nodes.length}`;

      const params: Record<string, unknown> = {};
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j];
        if (nextLine.match(/\/\/\s*@node:/)) break;

        const paramMatch = nextLine.match(/\/\/\s*@param:(.+)=(.+)/);
        if (paramMatch) {
          const val = parseFloat(paramMatch[2].trim());
          params[paramMatch[1].trim()] = isNaN(val) ? paramMatch[2].trim() : val;
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
        position: { x: 100 + col * 320, y: 100 + row * 180 },
      });

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
      continue;
    }

    // Match @connect:source->target (by label name)
    const connectMatch = line.match(/\/\/\s*@connect:(.+)->(.+)/);
    if (connectMatch) {
      const sourceLabel = connectMatch[1].trim();
      const targetLabel = connectMatch[2].trim();
      const sourceNode = nodes.find((n) => n.label === sourceLabel);
      const targetNode = nodes.find((n) => n.label === targetLabel);
      if (sourceNode && targetNode) {
        edges.push({
          id: `edge_${sourceNode.id}_${targetNode.id}`,
          source: sourceNode.id,
          target: targetNode.id,
        });
      }
    }
  }

  if (nodes.length === 0) {
    return parseLegacyAnnotations(code);
  }

  return { nodes, edges };
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
    const { nodes, edges } = parseAnnotations(params.code);
    return { code: params.code, nodes, edges };
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

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: FIX_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });

  const rawCode = response.choices[0]?.message?.content || '';
  const code = stripMarkdownCodeBlock(rawCode);
  const { nodes, edges } = parseAnnotations(code);

  return { code, nodes, edges };
}

interface ImageToCodeParams {
  imageDataUrl: string;
  instruction: string;
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
      text: `请根据这张参考图片和以下指令生成创意编程代码（GSAP + Three.js）：\n${params.instruction}\n\n请严格遵循 @node/@connect 注释标记规则。`,
    },
  ];

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent as unknown as string },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });

  const rawCode = response.choices[0]?.message?.content || '';
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

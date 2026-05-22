import OpenAI from 'openai';
import { config } from '../../config';

interface GenerateParams {
  prompt: string;
  language: string;
}

interface GenerateResult {
  code: string;
  language: 'threejs' | 'p5js';
  nodes: NodeData[];
  edges: EdgeData[];
}

interface FixParams {
  code: string;
  error: string;
  language: 'threejs' | 'p5js';
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

const THREE_NODE_TYPES: Record<string, string> = {
  // 场景层
  scene: '场景',
  camera: '摄像机',
  renderer: '渲染器',
  // 几何体层
  geometry: '几何体',
  material: '材质',
  mesh: '网格体',
  // 光照层
  ambientLight: '环境光',
  directionalLight: '方向光',
  pointLight: '点光源',
  // 控制层
  transform: '变换',
  animation: '动画',
  controls: '控制器',
  responsive: '响应式',
  // 效果层
  texture: '纹理',
  particles: '粒子',
  shader: '着色器',
  color: '颜色',
  // 交互层
  interaction: '交互',
  // 2D绘图层
  line: '直线',
  rect2d: '矩形',
  ellipse2d: '椭圆',
  circle: '圆形',
  arc: '弧线',
  bezier: '贝塞尔曲线',
  curve2d: '曲线',
  vertex: '自定义形状',
  quad: '四边形',
};

const SYSTEM_PROMPT = `你是创意编程专家。根据用户描述生成 Three.js 或 p5.js 代码。必须严格遵循以下模板结构。

=== 输出格式（极其重要） ===
- 只输出纯 JavaScript 代码，禁止输出 HTML 标签
- 禁止包裹在 \`\`\` 代码块中
- 禁止添加任何解释、说明文字
- 代码第一行必须是注释或 import 语句

=== Three.js 代码必须遵循的结构 ===
import * as THREE from 'three';

// @node:scene=场景
// @node:camera=摄像机
// @param:视野=75
// @node:renderer=渲染器

const scene = new THREE.Scene();
scene.background = ...;
const camera = new THREE.PerspectiveCamera(...);
camera.position.set(...);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);  // 必须挂载！

// ... 创建物体（mesh, light 等），每个物体加 @node 标记 ...

// @node:animation=动画循环
function animate() {
  requestAnimationFrame(animate);
  // 更新逻辑
  renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', ...);

=== p5.js 代码必须遵循的结构 ===
// p5.js 已全局加载，禁止写 import 语句
// @node:setup=初始化
function setup() {
  createCanvas(windowWidth, windowHeight);
}
// @node:draw=绘制循环
function draw() {
  background(0);
  // 绘制逻辑
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }

=== 节点注释规则 ===
1. 每个创建的物体/效果都要标注：// @node:类型ID=名称
   类型ID只能是：${Object.keys(THREE_NODE_TYPES).join(', ')}
2. 参数标记放在对应 @node 下方：
   // @param:参数名=数值
   // @color:描述=#色值
3. 有数据依赖的节点必须连线：
   // @connect:源节点名称->目标节点名称
4. 场景节点(scene/camera/renderer/setup/draw)是基础设施，不需要 @connect
5. 其他所有节点（mesh/light/animation/particles等）必须至少有一条 @connect 指向它或从它出发

=== 关键约束 ===
- 禁止输出 HTML、CSS、markdown
- renderer 必须 appendChild 到 document.body
- 颜色用 THREE.Color 或十六进制，不要用 CSS 字符串
- 每个物体都要有对应的 @node 标记，不要遗漏
- @connect 的目标名称必须与 @node 中的名称精确一致`;


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
    language: code.includes('three') ? 'threejs' : 'p5js',
    nodes,
    edges,
  };
}

function parseAnnotations(code: string): { nodes: NodeData[]; edges: EdgeData[] } {
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

const FIX_SYSTEM_PROMPT = `你是一个创意编程调试专家。给定一段有 bug 的代码和错误信息，修复代码。

规则：
1. 仅修复报错的问题，不要修改艺术效果和行为
2. 保留所有 // @node:、// @param:、// @color:、// @interaction:、// @connect: 注释标记，原样保留
3. 只输出修复后的完整代码，不要任何解释
4. 保持与原代码相同的格式（完整 HTML 或纯 JS）
5. 常见问题检查：
   - 缺少 import/script 标签
   - 未定义的变量或拼写错误的函数名
   - Three.js API 版本兼容问题
   - 缺少 renderer DOM 挂载 (document.body.appendChild)`;

export async function fixWithDeepSeek(params: FixParams): Promise<{ code: string }> {
  if (!config.deepseek.apiKey) {
    console.warn('[DeepSeek] API Key not configured, returning original code');
    return { code: params.code };
  }

  const client = new OpenAI({
    apiKey: config.deepseek.apiKey,
    baseURL: config.deepseek.baseUrl,
  });

  const userMessage = `原始代码：
\`\`\`
${params.code}
\`\`\`

错误信息：${params.error}

请修复以上代码。使用语言：${params.language}`;

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

  return { code };
}

function stripMarkdownCodeBlock(text: string): string {
  // Remove any markdown code block with optional language tag
  const codeBlockMatch = text.match(/```[\w#]*\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  // If no code block markers, return the raw text trimmed
  return text.trim();
}

function getDemoCode(prompt: string): GenerateResult {
  const code = `
// @node:scene=3D场景
// @node:camera=主摄像机
// @param:视野=75
// @node:renderer=渲染器
// @node:mesh=旋转立方体
// @param:尺寸=1.0
// @color:立方体颜色=#4A90D9
// @node:material=金属材质
// @param:粗糙度=0.3
// @param:金属感=0.7
// @node:animation=旋转动画
// @param:速度X=0.01
// @param:速度Y=0.01
// @connect:旋转动画->旋转立方体
// @node:ambientLight=环境光
// @param:强度=0.5
// @node:directionalLight=主方向光
// @param:强度=1.0
// @connect:主方向光->旋转立方体
// @node:particles=星空粒子
// @param:数量=500
// @param:旋转速度=0.0005
// @connect:旋转动画->星空粒子

import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({
  color: 0x4A90D9,
  roughness: 0.3,
  metalness: 0.7,
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const starsGeometry = new THREE.BufferGeometry();
const starsCount = 500;
const starsPositions = new Float32Array(starsCount * 3);
for (let i = 0; i < starsCount * 3; i++) {
  starsPositions[i] = (Math.random() - 0.5) * 20;
}
starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.02 });
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  stars.rotation.y += 0.0005;
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
`.trim();

  const { nodes, edges } = parseAnnotations(code);

  return {
    code,
    language: 'threejs',
    nodes,
    edges,
  };
}

import OpenAI from 'openai';
import { config } from '../../config';

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

const THREE_NODE_TYPES: Record<string, string> = {
  // 容器层
  comp_root: '根容器',
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
  // 交互层 — 基础
  interaction: '交互',
  // 交互层 — 输入设备
  keyboard: '键盘交互', mouse: '鼠标交互',
  // 交互层 — 传感器
  gesture: '手势交互', camera_interaction: '摄像头交互', audioRhythm: '声音节奏交互',
  // 交互层 — 视觉识别
  mp4Recognition: 'MP4内容识别', faceRecognition: '人脸识别',
  // 交互层 — 外部硬件
  hardware: '硬件交互（Kinect/LeapMotion/雷达等）',
  // 2D绘图层（GSAP + SVG/DOM）
  line: '线段（SVG）',
  rect2d: '矩形（SVG）',
  ellipse2d: '椭圆（SVG）',
  circle: '圆形（SVG）',
  arc: '弧线（SVG path）',
  bezier: '贝塞尔曲线（SVG path）',
  curve2d: '曲线（SVG path）',
  vertex: '顶点（SVG）',
  quad: '四边形（SVG polygon）',
  // GSAP动画层
  gsap_timeline: 'GSAP时间线',
  gsap_tween: 'GSAP补间动画',
  gsap_scroll: 'GSAP滚动触发',
  // 文件资源节点
  file_texture: '纹理文件',
  file_model: '3D模型',
  file_data: '数据文件',
  file_video: '视频素材',
};

const SYSTEM_PROMPT = `你是创意编程专家。根据用户描述生成 GSAP + Three.js 创意编程代码。所有2D动画/DOM/UI效果使用GSAP，所有3D场景/模型/渲染使用Three.js。必须严格遵循以下模板结构。

=== 输出格式（极其重要） ===
- 只输出纯 JavaScript 代码，禁止输出 HTML 标签
- 禁止包裹在 \`\`\` 代码块中
- 禁止添加任何解释、说明文字
- 代码第一行必须是注释或 import 语句

=== Three.js 代码必须遵循的结构（父子级 + ArrayList 阵列） ===
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
document.body.appendChild(renderer.domElement);

// === 根容器（必须！所有物体都放在根容器下） ===
// @node:comp_root=根容器
const rootGroup = new THREE.Group();
scene.add(rootGroup);

// === 物体创建：使用 ArrayList 阵列模式（必须！） ===
// @node:sop_cubes=立方体阵列
// @param:数量=5
// @param:间距=2
// @color:阵列颜色=#4A90D9
const cubes = [];  // ArrayList 阵列
for (let i = 0; i < 5; i++) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4A90D9, roughness: 0.3, metalness: 0.2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.x = (i - 2) * 2;
  rootGroup.add(mesh);
  cubes.push(mesh);
}
// @connect:根容器->立方体阵列

// 灯光也放在根容器下
// @node:light_ambient=环境光
// @param:强度=0.5
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
rootGroup.add(ambientLight);
// @connect:根容器->环境光

// === 动画循环 ===
// @node:animation=动画循环
// @param:运动方式=rotate     ← 运动方式参数（必加！）
// @param:速度X=0.01
// @param:速度Y=0.01
// @param:强度=0.5
// @param:频率=1.0

运动方式(motionType)可以是以下之一：
- rotate: 持续旋转 — target.rotation.x/y += speed
- fastRotate: 快速旋转 — target.rotation.x/y += speed * 3
- slowMove: 缓慢移动 — target.position += sin/cos(time) * speed
- bounce: 跳动/弹跳 — target.position.y = sin(time * freq) * strength
- sineWave: 正弦波动 — target.position.x = sin(time * freq) * strength
- noiseMotion: 噪波运动 — 使用 simplex noise 或 Math.random() 驱动的随机运动
- randomDisplace: 随机位移 — target.position 每帧微调随机偏差
- scalePulse: 缩放脉冲 — target.scale = 1 + sin(time * freq) * strength
- orbit: 轨道环绕 — target.position 按圆形轨道移动
- pendulum: 钟摆运动 — target.rotation 按 arcsin 摆动
- spiral: 螺旋上升 — target.position.y += speed; position.x/z 螺旋
- float: 漂浮摆动 — target.position 低频小幅随机漂移

function animate() {
  requestAnimationFrame(animate);
  // 根据 @param:运动方式 的值实现对应的运动逻辑
  // 遍历 ArrayList 更新每个元素
  cubes.forEach((cube, i) => {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01 * (i + 1);
  });
  renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', ...);

=== ArrayList 阵列模式规则（极其重要） ===
1. 任何重复物体必须用数组管理：const items = []; for(...) { items.push(obj); }
2. 动画中遍历数组更新：items.forEach(item => { ... });
3. 数组变量名用复数形式：cubes, spheres, particles, lights
4. 根容器 rootGroup 是所有物体的父级，通过 @connect 连线
5. 没有父级容器的物体视为孤立体，会被过滤掉！

=== 节点注释规则 ===
1. 每个创建的物体/效果都要标注：// @node:类型ID=名称
   类型ID只能是：${Object.keys(THREE_NODE_TYPES).join(', ')}
2. 参数标记放在对应 @node 下方：
   // @param:参数名=数值
   // @color:描述=#色值
3. 有数据依赖的节点必须连线：
   // @connect:源节点名称->目标节点名称
4. 场景节点和根容器是基础设施，不需要 @connect
5. 其他所有节点必须至少有一条 @connect 指向它或从它出发
6. 文件资源节点（file_texture/file_model/file_data/file_video）：
   如果用户上传了文件，必须创建对应节点标注：// @node:file_texture=文件名
   并用 @connect 连接到使用它的节点
7. 交互节点（interaction/keyboard/mouse/gesture/camera_interaction/audioRhythm/
   mp4Recognition/faceRecognition/hardware）：
   根据用户描述选择合适的交互类型标注 @node:类型=名称：
   - keyboard: 按键控制 / mouse: 鼠标控制 / gesture: 手势控制
   - camera_interaction: 摄像头输入 / audioRhythm: 音频节奏
   - mp4Recognition: 视频内容分析 / faceRecognition: 人脸追踪
   - hardware: 外部硬件设备（Kinect/LeapMotion/雷达等）
   交互节点必须用 @connect 连接到被控制的目标节点
	8. GSAP动画节点（gsap_timeline/gsap_tween/gsap_scroll）：
	   GSAP全局已加载（gsap.min.js），无需import，直接使用gsap对象即可。
	   根据用户需求选择GSAP节点类型标注：
	   - gsap_timeline: 时间线容器，编排多个动画的先后顺序
	   - gsap_tween: 单个补间动画（from → to）
	   - gsap_scroll: 滚动触发动画（需先gsap.registerPlugin(ScrollTrigger)）
	   GSAP节点必须用 @connect 连接到被控制的目标节点

=== 2D绘图节点（GSAP + SVG）使用规则 ===
当用户描述涉及2D图形绘制时（线段、矩形、椭圆、圆形、弧线、贝塞尔曲线、曲线、顶点、四边形），使用SVG + GSAP实现：
- 使用 document.createElementNS('http://www.w3.org/2000/svg', ...) 创建SVG元素
- 创建SVG容器：const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('width','100%'); svg.style.position='absolute'; svg.style.top='0'; document.body.appendChild(svg);
- 线段 → SVG <line> 元素，用GSAP动画 x2/y2 属性
- 矩形 → SVG <rect> 元素，用GSAP动画 width/height 属性
- 椭圆 → SVG <ellipse> 元素，用GSAP动画 rx/ry 属性
- 圆形 → SVG <circle> 元素，用GSAP动画 r 属性从0到目标值
- 弧线 → SVG <path> 包含 A (弧线) 命令，用GSAP stroke-dashoffset 动画描边
- 贝塞尔曲线 → SVG <path> 包含 C (三次贝塞尔) 命令，用GSAP stroke-dashoffset 动画描边
- 曲线 → SVG <path> 包含平滑曲线命令，用GSAP stroke-dashoffset 动画描边
- 顶点 → SVG <circle> 小圆点作为控制点，用GSAP弹性缩放
- 四边形 → SVG <polygon> 多边形，用GSAP从透明渐入
- 所有2D图形节点必须标注 @node:类型=名称 和 @connect 连线
- GSAP动画通过 gsap_tween 或 gsap_timeline 节点控制2D图形的入场/变换

=== GSAP + Three.js 分工协作（极其重要） ===
当同时使用GSAP和Three.js时，必须严格遵守以下分工：

**GSAP（2D动画层 — 负责DOM/UI/2D动画）：**
- GSAP用于控制DOM元素的CSS属性动画（opacity, transform, color等）
- GSAP用于控制HTML叠加层（hud、文字标签、按钮等UI元素）
- GSAP时间线（timeline）编排多个2D动画的先后顺序和时间关系
- GSAP的ScrollTrigger处理页面滚动触发动画
- 示例：gsap.to('.hud', { opacity: 0, duration: 0.5 });

**Three.js（3D渲染层 — 负责WebGL/3D场景）：**
- Three.js负责所有WebGL渲染（场景、模型、材质、灯光）
- Three.js的requestAnimationFrame驱动3D动画循环
- 3D物体的变换（旋转、位移、缩放）在animate()中处理
- 示例：cube.rotation.x += 0.01;

**两者协作模式：**
- Three.js和GSAP各自独立运行，互不干扰
- GSAP可以控制HTML overlay的显示/隐藏（如loading动画、标题文字）
- Three.js通过renderer.domElement渲染到canvas
- GSAP通过修改DOM元素的style实现2D动画
- 两者可以在同一个requestAnimationFrame中协同：
  function animate() {
    requestAnimationFrame(animate);
    // Three.js 3D渲染
    cube.rotation.x += 0.01;
    renderer.render(scene, camera);
    // GSAP会自动更新受其控制的DOM元素
  }
- GSAP也可以控制Three.js对象的属性（如camera.position过渡），但这不是主要用途
- 当用户描述涉及\"UI动画\"、\"文字动画\"、\"加载动画\"、\"HUD\"时→使用GSAP
- 当用户描述涉及\"3D场景\"、\"3D模型\"、\"光影\"时→使用Three.js

=== 关键约束 ===
- 禁止输出 HTML、CSS、markdown
- 禁止在非 async 函数内使用 await。JS 代码运行在 <script type="module"> 中，顶层 await 可用，但回调/普通函数内的 await 会报 SyntaxError
- 所有 2D 动画/绘图/UI 效果使用 GSAP + DOM 元素实现，不使用 p5.js
- 2D 图形（线段/矩形/椭圆/圆形/弧线/贝塞尔/曲线/顶点/四边形）使用 SVG + GSAP 实现
- 代码中可包含 DOM 元素创建（用于 GSAP 绑定）和 Three.js canvas
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
    language: 'threejs',
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

const FIX_SYSTEM_PROMPT = `你是创意编程专家，既能修bug也能按指令修改代码。

=== 判断任务类型 ===
- 如果用户描述包含运行时错误信息（如 "xxx is not defined"、"Cannot read property"）→ 模式A：修bug
- 如果用户要求"调整"、"修改"、"改成"、"更新参数"、"加一个"等 → 模式B：创意修改

=== 模式A：修复运行时错误 ===
1. 仅修复报错问题，不改变艺术效果和行为
2. 检查：未定义变量、拼写错误、API兼容、缺少DOM挂载、类型错误

=== 模式B：创意修改（这是最常见的情况） ===
1. 根据用户的具体要求修改代码 —— 这是创意修改，不是修bug！
2. 改颜色/大小/速度 → 找到并修改对应数值
3. 加效果/换风格/加物体 → 添加对应代码块，并添加 @node 和 @connect 标记
4. 参数列表更新 → 找到对应变量修改值
5. 新增物体/效果必须标注 @node 和 @connect

=== 通用规则（必须严格遵守） ===
- 只输出完整可运行的 JavaScript 代码，禁止任何解释文字或 markdown
- 保留所有已有的 // @node:、// @param:、// @color:、// @interaction:、// @connect: 标记
- 代码必须是完整的（import、scene/camera/renderer、animate 全在）
- 禁止在非 async 函数内使用 await，顶层 await 可用，回调/普通函数内使用 await 会导致 SyntaxError
- Three.js: renderer 必须 appendChild 到 document.body
- GSAP 全局已加载（gsap.min.js），直接使用 gsap 对象，不需要 import
- 2D 图形使用 SVG + GSAP 实现（document.createElementNS 创建SVG元素，GSAP做入场/变换动画）
- GSAP 用于 DOM 元素/SVG 的 2D 动画，Three.js 用于 3D WebGL 渲染，两者分工明确互不干扰
- animate() 循环必须完整`;

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

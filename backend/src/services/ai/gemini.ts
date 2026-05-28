import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '../../config';
import { parseAnnotations, THREE_NODE_TYPES } from './deepseek';
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

function getGeminiModel(): GenerativeModel | null {
  if (!config.gemini.apiKey) {
    console.warn('[Gemini] API Key not configured');
    return null;
  }
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

function stripMarkdownCodeBlock(text: string): string {
  const match = text.match(/```[\w#]*\s*\n?([\s\S]*?)\n?```/);
  if (match) return match[1].trim();
  return text.trim();
}

export async function generateWithGemini(params: GenerateParams): Promise<GenerateResult> {
  const model = getGeminiModel();
  if (!model) {
    return getFallbackCode(params.prompt);
  }

  const langHint = params.language === 'auto' ? '' : `请使用 ${params.language} 来生成代码。`;

  const result = await model.generateContent({
    systemInstruction: SYSTEM_PROMPT,
    contents: [{ role: 'user', parts: [{ text: `${params.prompt}\n${langHint}` }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  });

  const rawCode = result.response.text();
  const code = stripMarkdownCodeBlock(rawCode);
  const { nodes, edges } = parseAnnotations(code);

  return { code, language: 'threejs', nodes, edges };
}

export async function fixWithGemini(params: FixParams): Promise<GenerateResult> {
  const model = getGeminiModel();
  if (!model) {
    return getFallbackCode(params.error);
  }

  const isAdjust = /调整|修改|改成|变成|换成|替换|添加|增加|删除|去掉|移除/.test(params.error);

  const task = isAdjust
    ? `任务：用户要求调整: ${params.error}\n\n原代码：\n${params.code}`
    : `错误信息：${params.error}\n\n原代码：\n${params.code}`;

  const result = await model.generateContent({
    systemInstruction: FIX_SYSTEM_PROMPT,
    contents: [{ role: 'user', parts: [{ text: task }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
  });

  const rawCode = result.response.text();
  const code = stripMarkdownCodeBlock(rawCode);
  const { nodes, edges } = parseAnnotations(code);

  return { code, language: 'threejs', nodes, edges };
}

function getFallbackCode(prompt: string): GenerateResult {
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
const geo = new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshStandardMaterial({ color: 0x4A90D9, roughness: 0.3, metalness: 0.7 });
const cube = new THREE.Mesh(geo, mat);
rootGroup.add(cube);
// @connect:根容器->旋转立方体

// @node:ambientLight=环境光
// @param:强度=0.5
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
rootGroup.add(ambientLight);
// @connect:根容器->环境光

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
  renderer.render(scene, camera);
}
animate();
// @connect:旋转动画->旋转立方体

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
`;

  const { nodes, edges } = parseAnnotations(code);
  return { code, language: 'threejs', nodes, edges };
}

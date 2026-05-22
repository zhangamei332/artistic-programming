/**
 * 代码模板 — AI 生成代码必须严格遵循的结构。
 * 此模板确保代码能正确在预览 iframe 中运行。
 */

export const THREE_JS_TEMPLATE = `
// === Three.js 代码模板 ===
// 所有代码注释标记必须保留在代码中：
//   @node:类型=名称    — 节点标记
//   @param:参数名=值    — 参数标记
//   @color:描述=#色值   — 颜色标记
//   @connect:源->目标   — 连线标记

import * as THREE from 'three';

// @node:scene=场景
// @node:camera=摄像机
// @param:视野=75
// @node:renderer=渲染器

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- 在这里创建你的 3D 对象，每个对象添加对应的 @node 标记 ---

// @node:animation=动画循环
// @param:速度=0.01

function animate() {
  requestAnimationFrame(animate);
  // 在这里更新对象
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
`;

export const P5_JS_TEMPLATE = `
// === p5.js 代码模板 ===
// 关键规则：
//   1. 不要写 import 语句，p5.js 已通过 <script> 标签全局加载
//   2. 使用 setup() 和 draw() 函数
//   3. 所有节点注释标记格式同 Three.js

// @node:setup=初始化
// @param:画布宽=800
// @param:画布高=600

function setup() {
  createCanvas(windowWidth, windowHeight);
  // 初始化设置
}

// @node:draw=绘制循环
// @param:帧率=60

function draw() {
  background(0);
  // 在这里绘制
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
`;

/** AI 生成的代码必须是纯 JavaScript，不要输出 HTML 或 markdown */
export const CODE_RULES = [
  '只输出纯 JavaScript 代码，不要包裹在 HTML 标签中',
  '不要包裹在 markdown 代码块中',
  '不要添加任何解释文字',
  '注释标记必须使用 // @node: / // @param: / @color: / @connect: 格式',
  'Three.js 代码使用 import * as THREE from \'three\' 导入',
  'p5.js 代码不需要 import，直接使用全局 p5 函数',
  '每个创建的 3D/2D 对象都要有对应的 @node 标记',
  '有数据依赖关系的节点之间必须添加 @connect 标记',
  'renderer 必须通过 document.body.appendChild 挂载到 DOM',
] as const;

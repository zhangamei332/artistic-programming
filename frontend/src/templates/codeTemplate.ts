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

const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素比保护性能
container.appendChild(renderer.domElement);

// @node:resize=视口自适应
const resizeObserver = new ResizeObserver(() => {
  const { width, height } = container.getBoundingClientRect();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});
resizeObserver.observe(container);

// --- 在这里创建你的 3D 对象，每个对象添加对应的 @node 标记 ---

// @node:animation=动画循环
// @param:速度=0.01

let animationId;
function animate() {
  animationId = requestAnimationFrame(animate);
  // 在这里更新对象
  renderer.render(scene, camera);
}
animate();

// @node:dispose=资源释放
// 注册到全局清理回调，组件卸载时自动调用
window.__disposeCallbacks.push(function dispose() {
  cancelAnimationFrame(animationId);
  resizeObserver.disconnect();
  renderer.dispose();
  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
});
`;

export const GSAP_THREEJS_TEMPLATE = `
// === GSAP + Three.js 混合模板 ===
// 分工原则：GSAP 负责 2D DOM动画，Three.js 负责 3D WebGL渲染
// GSAP 全局已通过 <script> 标签加载，无需 import

import * as THREE from 'three';

// @node:scene=3D场景
// @node:camera=摄像机
// @param:视野=75
// @node:renderer=渲染器

const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// @node:resize=视口自适应
const resizeObserver = new ResizeObserver(() => {
  const { width, height } = container.getBoundingClientRect();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});
resizeObserver.observe(container);

// === 2D DOM元素（用于GSAP动画） ===
// @node:gsap_timeline=主时间线
// @param:repeat=-1
// @param:yoyo=true
const overlay = document.createElement('div');
overlay.id = 'hud';
overlay.style.position = 'absolute';
overlay.style.top = '0';
overlay.innerHTML = '<h1 style="color:white;font-size:24px;">HUD</h1>';
container.appendChild(overlay);

// @node:gsap_tween=淡入动画
// @param:property=opacity
// @param:from=0
// @param:to=1
// @param:duration=1
// @param:ease=power2.out
// @connect:淡入动画->主时间线
const tl = gsap.timeline({ repeat: -1, yoyo: true });
tl.fromTo('#hud', { opacity: 0 }, { opacity: 1, duration: 1, ease: 'power2.out' });

// === 3D物体 ===
// @node:mesh=旋转立方体
// @param:尺寸=1.0
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x4A90D9 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// @node:animation=3D动画循环
let animationId;
function animate() {
  animationId = requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();

// @node:dispose=资源释放
window.__disposeCallbacks.push(function dispose() {
  cancelAnimationFrame(animationId);
  resizeObserver.disconnect();
  if (typeof gsap !== 'undefined') gsap.globalTimeline.clear();
  renderer.dispose();
  geometry.dispose();
  material.dispose();
  overlay.remove();
});
`;

/** AI 生成的代码必须是纯 JavaScript，不要输出 HTML 或 markdown */
export const CODE_RULES = [
  '只输出纯 JavaScript 代码，不要包裹在 HTML 标签中',
  '不要包裹在 markdown 代码块中',
  '不要添加任何解释文字',
  '注释标记必须使用 // @node: / // @param: / @color: / @connect: 格式',
  'Three.js 代码使用 import * as THREE from \'three\' 导入',
  'GSAP 全局已加载（gsap.min.js），直接使用 gsap 对象，不需要 import',
  'lil-gui 全局已加载，直接使用 lil.GUI 构造函数，不需要 import',
  'GSAP 负责 2D DOM元素动画，Three.js 负责 3D WebGL渲染，分工明确互不干扰',
  'p5.js 全局已加载，如需使用 p5.js 请用实例模式 new p5(sketch)，不要用全局模式',
  '2D 绘图/图形/线条需求优先使用 GSAP + SVG/DOM 或 p5.js 实现',
  '每个创建的 3D/2D 对象都要有对应的 @node 标记',
  '有数据依赖关系的节点之间必须添加 @connect 标记',
  'renderer.domElement 必须挂载到 container（getElementById("canvas-container")），禁止挂载到 document.body',
  '必须使用 ResizeObserver 监听 container 大小变化来自适应视口，禁止使用 window.onresize',
  '必须注册 dispose 函数到 window.__disposeCallbacks 释放所有 GPU 资源、动画帧和事件监听',
  '控制面板必须使用 lil-gui 并设置 autoPlace: false，挂载到 container 内部',
  '使用 renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) 限制像素比保护性能',
] as const;

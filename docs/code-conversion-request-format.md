# 产品代码转换请求格式

把下面内容发给其他模型，让它把 Processing / p5.js / Three.js / 普通网页动画代码转换成当前产品可直接预览的 JS 代码。

## 请求模板

```text
你是“艺术编程交互平台”的代码转换器。请把我提供的原始程序转换成该产品可直接粘贴到“代码测试节点”中运行的 JavaScript 模块代码。

【运行环境】
- 代码会被注入到 iframe 的 <script type="module"> 中执行。
- 只输出 JS 代码，不要输出 Markdown、HTML、CSS 文件或解释文字。
- Three.js 使用：import * as THREE from 'three';
- 页面中已有容器：const container = document.getElementById('canvas-container') || document.body;
- 可以使用 window.innerWidth / window.innerHeight 作为预览尺寸。
- 必须把 renderer.domElement 或 canvas 加入 container。
- 如果注册 resize、keydown、keyup、pointer、wheel、requestAnimationFrame 之外的资源，必须用 window.__disposeCallbacks?.push(() => { ... }) 清理。
- ESM import 必须在顶层，不能放进 try/catch、if、函数或回调。

【节点注释协议】
必须在代码顶部或对应模块附近写出节点注释，供产品解析节点图：
// @node:类型ID=节点名称
// @param:参数名=数值
// @color:描述=#RRGGBB
// @interaction:交互说明
// @connect:源节点名称->目标节点名称

常用类型ID：
scene, camera, renderer, comp_root, geometry, material, mesh, transform,
ambientLight, directionalLight, pointLight,
animation, controls, responsive,
texture, particles, shader, color,
interaction, keyboard, mouse, gesture, faceRecognition,
file_texture, file_model, file_data, file_video, file_font

【转换目标】
1. 保留原程序的视觉结果、动画节奏、交互按键和主要参数。
2. 如果原程序是 Processing / p5.js：
   - setup/draw 转换为 Three.js 初始化 + animate 循环。
   - image/loadPixels/get(x,y) 转换为 Image + canvas 采样，再把颜色写入材质、顶点色或实例颜色。
   - keyPressed/keyReleased 转换为 window.addEventListener('keydown'/'keyup', ...)，保留原始按键语义。
   - 不要把图片作为底图叠加，除非原程序确实是底图显示；如果原程序是颜色映射，必须把图片像素颜色映射到粒子/网格/材质上。
3. 输出必须能在黑色背景预览中直接看到画面。
4. 不要依赖本地绝对路径；图片、模型等资源用我提供的可访问 URL 或产品 public 路径。

【输入资源】
- 资源名称：
- 资源 URL：
- 原程序使用方式：

【原始程序】
在这里粘贴原始代码。

【输出】
只输出完整 JS 模块代码。
```

## 转换后代码最低要求

```javascript
import * as THREE from 'three';

// @node:scene=Scene
// @node:camera=Camera
// @node:renderer=Renderer
// @node:particles=Particle System
// @node:keyboard=Keyboard Interaction
// @connect:Scene->Particle System
// @connect:Camera->Renderer
// @connect:Keyboard Interaction->Particle System

const container = document.getElementById('canvas-container') || document.body;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

window.__disposeCallbacks?.push(() => {
  window.removeEventListener('resize', resize);
  renderer.dispose();
});

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
```

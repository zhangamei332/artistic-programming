/**
 * 节点语义映射表 — 定义每个节点类型的输入、输出、参数和文本指令模板。
 * 基于 NodeIR 参考结构，用于将可视化节点图转译为 AI 可理解的文本描述。
 *
 * 核心链路：
 *   节点 → 局部文本指令 → 连线 → 逻辑关系文本 → 参数约束
 *   → 自动合成完整生成提示词 → AI 生成代码
 */
import { completeNodeParams, getNodeSpecDefinition, getSpecNodeTypeList } from './nodeSpec.generated';

export interface NodeSemantic {
  type: string;
  label: string;
  layer: string;
  /** 输入信号/数据名称列表 */
  inputs: string[];
  /** 输出信号/数据名称列表 */
  outputs: string[];
  /** 默认参数 */
  defaultParams: Record<string, unknown>;
  /** 文本指令模板，{param} 会被替换 */
  promptTemplate: string;
  /** Three.js 代码映射（片段） */
  threejsMapping: string;
  /** p5.js 代码映射 */
  p5jsMapping: string;
}

export interface EdgeRelation {
  relation: string;
  description: string;
  /** {from} {to} 会被替换为节点名称 */
  promptRule: string;
}

// ---- 连线关系推断规则 ----
// 根据 source/target 节点类型推断关系类型
export const edgeRelationRules: Record<string, Record<string, string>> = {
  scene: {
    renderer: 'render_dependency',
    comp_root: 'parent_child',
    root_group: 'parent_child',
    camera: 'parent_child',
    '*': 'parent_child',
  },
  camera: {
    renderer: 'camera_dependency',
    webgpu_renderer: 'camera_dependency',
  },
  renderer: {
    '*': 'render_target',
  },
  comp_root: {
    '*': 'parent_child',
  },
  root_group: {
    '*': 'parent_child',
  },
  ambientLight: {
    '*': 'light_affect',
  },
  directionalLight: {
    '*': 'light_affect',
  },
  pointLight: {
    '*': 'light_affect',
  },
  geometry: {
    mesh: 'data_source',
    '*': 'data_source',
  },
  material: {
    mesh: 'material_assignment',
    geometry: 'material_assignment',
    '*': 'material_assignment',
  },
  mesh: {
    comp_root: 'child_of',
    root_group: 'child_of',
    animation: 'animation_target',
    interaction: 'control_target',
    '*': 'child_of',
  },
  transform: {
    '*': 'transform_target',
  },
  animation: {
    '*': 'animation_source',
  },
  texture: {
    material: 'texture_input',
    mesh: 'texture_input',
    '*': 'texture_input',
  },
  particles: {
    comp_root: 'child_of',
    root_group: 'child_of',
    animation: 'animation_target',
    '*': 'child_of',
  },
  shader: {
    material: 'shader_input',
    '*': 'shader_input',
  },
  color: {
    material: 'color_input',
    geometry: 'color_input',
    light: 'color_input',
    '*': 'color_input',
  },
  controls: {
    camera: 'control_target',
    '*': 'control_target',
  },
  responsive: {
    camera: 'resize_target',
    renderer: 'resize_target',
    '*': 'resize_target',
  },
  interaction: {
    '*': 'control_target',
  },
  gesture: {
    '*': 'control_target',
  },
  camera_interaction: {
    '*': 'control_target',
  },
  audioRhythm: {
    '*': 'control_target',
  },
  mp4Recognition: {
    '*': 'control_target',
  },
  faceRecognition: {
    '*': 'control_target',
  },
  keyboard: {
    '*': 'control_target',
  },
  mouse: {
    '*': 'control_target',
  },
  hardware: {
    '*': 'control_target',
  },
  // GSAP nodes
  gsap_timeline: {
    '*': 'animation_source',
  },
  gsap_tween: {
    '*': 'animation_source',
  },
  gsap_scroll: {
    '*': 'animation_source',
  },
  // 2D drawing nodes
  line: {
    vertex: 'data_source',
    gsap_tween: 'animation_target',
    gsap_timeline: 'animation_target',
    '*': 'child_of',
  },
  rect2d: {
    gsap_tween: 'animation_target',
    gsap_timeline: 'animation_target',
    '*': 'child_of',
  },
  ellipse2d: {
    gsap_tween: 'animation_target',
    gsap_timeline: 'animation_target',
    '*': 'child_of',
  },
  circle: {
    gsap_tween: 'animation_target',
    gsap_timeline: 'animation_target',
    '*': 'child_of',
  },
  arc: {
    vertex: 'data_source',
    gsap_tween: 'animation_target',
    gsap_timeline: 'animation_target',
    '*': 'child_of',
  },
  bezier: {
    vertex: 'data_source',
    gsap_tween: 'animation_target',
    gsap_timeline: 'animation_target',
    '*': 'child_of',
  },
  curve2d: {
    vertex: 'data_source',
    gsap_tween: 'animation_target',
    gsap_timeline: 'animation_target',
    '*': 'child_of',
  },
  vertex: {
    line: 'data_source',
    bezier: 'data_source',
    curve2d: 'data_source',
    quad: 'data_source',
    '*': 'child_of',
  },
  quad: {
    vertex: 'data_source',
    gsap_tween: 'animation_target',
    gsap_timeline: 'animation_target',
    '*': 'child_of',
  },
  // file nodes
  file_texture: {
    material: 'texture_input',
    mesh: 'texture_input',
    '*': 'file_reference',
  },
  file_model: {
    mesh: 'model_input',
    geometry: 'model_input',
    '*': 'file_reference',
  },
  file_data: {
    '*': 'file_reference',
  },
  file_video: {
    material: 'video_texture',
    '*': 'file_reference',
  },
  file_font: {
    text: 'file_reference',
    P5TextTextureNode: 'file_reference',
    '*': 'file_reference',
  },
};

/** 连线关系描述表 */
export const edgeRelationDescriptions: Record<string, EdgeRelation> = {
  parent_child: {
    relation: 'parent_child',
    description: '父子挂载关系，子对象挂载到父对象或根容器中',
    promptRule: '将「{to}」挂载到「{from}」中，使「{from}」统一管理「{to}」的空间变换。',
  },
  child_of: {
    relation: 'child_of',
    description: '子对象挂载到父容器',
    promptRule: '将「{to}」添加到「{from}」中，作为其子对象。',
  },
  render_dependency: {
    relation: 'render_dependency',
    description: '渲染依赖关系，渲染器需要场景参与最终输出',
    promptRule: '「{from}」作为「{to}」的渲染依赖，使「{to}」输出当前场景画面。',
  },
  camera_dependency: {
    relation: 'camera_dependency',
    description: '摄像机依赖关系，渲染器使用摄像机视角',
    promptRule: '「{from}」作为「{to}」的观察矩阵输入，提供观察视角。',
  },
  render_target: {
    relation: 'render_target',
    description: '渲染目标关系',
    promptRule: '「{to}」由「{from}」渲染输出到画布。',
  },
  light_affect: {
    relation: 'light_affect',
    description: '光照影响关系，光源影响目标对象的明暗',
    promptRule: '使用「{from}」照亮「{to}」，影响其明暗、阴影和高光。',
  },
  material_assignment: {
    relation: 'material_assignment',
    description: '材质赋值关系，材质赋予几何体或网格体',
    promptRule: '将「{from}」赋予「{to}」，作为其可视化材质。',
  },
  animation_source: {
    relation: 'animation_source',
    description: '动画驱动关系，动画循环驱动目标对象运动',
    promptRule: '使用「{from}」的帧更新驱动「{to}」的运动、旋转或状态变化。',
  },
  animation_target: {
    relation: 'animation_target',
    description: '动画目标关系，对象接受动画驱动',
    promptRule: '「{to}」接受「{from}」的动画驱动，每帧更新变换属性。',
  },
  control_target: {
    relation: 'control_target',
    description: '交互控制关系，用户事件控制对象状态',
    promptRule: '使用「{from}」控制「{to}」的状态、速度、强度或触发逻辑。',
  },
  data_source: {
    relation: 'data_source',
    description: '数据源关系，几何数据提供给网格体',
    promptRule: '「{from}」提供几何数据给「{to}」，作为其形状定义。',
  },
  texture_input: {
    relation: 'texture_input',
    description: '纹理输入关系，纹理映射到材质表面',
    promptRule: '将「{from}」作为纹理贴图应用到「{to}」的表面。',
  },
  shader_input: {
    relation: 'shader_input',
    description: '着色器输入关系',
    promptRule: '将「{from}」作为着色器代码注入「{to}」的渲染管线。',
  },
  color_input: {
    relation: 'color_input',
    description: '颜色输入关系',
    promptRule: '将「{from}」的颜色值应用到「{to}」，设置其色调。',
  },
  resize_target: {
    relation: 'resize_target',
    description: '响应式目标关系，窗口变化时更新目标',
    promptRule: '窗口尺寸变化时，使用「{from}」更新「{to}」的尺寸、比例或投影矩阵。',
  },
  transform_target: {
    relation: 'transform_target',
    description: '变换目标关系，对目标应用变换',
    promptRule: '对「{to}」应用「{from}」定义的位移、旋转和缩放变换。',
  },
  file_reference: {
    relation: 'file_reference',
    description: '文件引用关系，外部文件被节点引用',
    promptRule: '「{to}」引用「{from}」中的文件数据作为输入源。',
  },
  model_input: {
    relation: 'model_input',
    description: '模型输入关系，3D模型文件提供给网格体',
    promptRule: '将「{from}」的3D模型数据加载到「{to}」中作为几何体。',
  },
  video_texture: {
    relation: 'video_texture',
    description: '视频纹理关系，视频素材映射到材质',
    promptRule: '将「{from}」的视频帧作为动态纹理应用到「{to}」。',
  },
  default: {
    relation: 'default',
    description: '数据传递关系',
    promptRule: '将「{from}」的输出传递给「{to}」，建立数据依赖关系。',
  },
};

// ---- 节点语义注册表 ----

export const nodeSemanticRegistry: Record<string, NodeSemantic> = {
  // ========== 场景层 ==========
  scene: {
    type: 'scene',
    label: '场景',
    layer: '场景层',
    inputs: [],
    outputs: ['scene_object'],
    defaultParams: { background: '#000000' },
    promptTemplate: '创建一个三维场景，背景色为{background}，作为所有几何体、光源、摄像机和控制对象的承载空间。',
    threejsMapping: 'const scene = new THREE.Scene(); scene.background = new THREE.Color({background});',
    p5jsMapping: 'createCanvas(windowWidth, windowHeight, WEBGL); background({background});',
  },
  camera: {
    type: 'camera',
    label: '摄像机',
    layer: '场景层',
    inputs: ['scene_object', 'canvas_size'],
    outputs: ['camera_object'],
    defaultParams: { fov: 75, near: 0.1, far: 2000, positionZ: 8 },
    promptTemplate: '创建一个透视摄像机，视野角度为{fov}度，近裁剪面{near}，远裁剪面{far}，位于z={positionZ}位置，用于观察场景中心。',
    threejsMapping: 'const camera = new THREE.PerspectiveCamera({fov}, window.innerWidth/window.innerHeight, {near}, {far}); camera.position.z = {positionZ};',
    p5jsMapping: 'perspective({fov}/180*PI, width/height, {near}, {far}); camera(0,0,{positionZ}, 0,0,0, 0,1,0);',
  },
  renderer: {
    type: 'renderer',
    label: '渲染器',
    layer: '场景层',
    inputs: ['scene_object', 'camera_object', 'dom_container'],
    outputs: ['render_canvas'],
    defaultParams: { antialias: true, pixelRatio: 'devicePixelRatio' },
    promptTemplate: '创建WebGL渲染器，开启{antialias}抗锯齿，像素比使用{pixelRatio}，将场景与摄像机渲染到浏览器画布。',
    threejsMapping: 'const renderer = new THREE.WebGLRenderer({ antialias: {antialias} }); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(window.devicePixelRatio); document.body.appendChild(renderer.domElement);',
    p5jsMapping: 'p5.js 内置渲染器自动创建。',
  },
  comp_root: {
    type: 'comp_root',
    label: '根容器',
    layer: '场景层',
    inputs: ['scene_object'],
    outputs: ['root_group_object'],
    defaultParams: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    promptTemplate: '创建一个根容器Group，位于({position})，用于统一管理所有可视对象，便于整体移动、旋转和缩放。',
    threejsMapping: 'const rootGroup = new THREE.Group(); scene.add(rootGroup);',
    p5jsMapping: '通过对象数组和push()/pop()模拟根容器。',
  },

  // ========== 几何体层 ==========
  geometry: {
    type: 'geometry',
    label: '几何体',
    layer: '几何体层',
    inputs: [],
    outputs: ['geometry_object'],
    defaultParams: { type: 'box', size: [1, 1, 1], segments: [1, 1, 1] },
    promptTemplate: '创建一个{type}几何体，尺寸为{size}，分段数为{segments}，作为网格体的形状数据源。',
    threejsMapping: 'const geometry = new THREE.BoxGeometry({size}[0], {size}[1], {size}[2]);',
    p5jsMapping: '使用 p5.js 内置几何函数如 box()、sphere() 等。',
  },
  material: {
    type: 'material',
    label: '材质',
    layer: '几何体层',
    inputs: ['texture', 'color', 'shader'],
    outputs: ['material_object'],
    defaultParams: { color: '#4A90D9', roughness: 0.3, metalness: 0.2, wireframe: false },
    promptTemplate: '创建一个标准PBR材质，颜色为{color}，粗糙度{roughness}，金属度{metalness}，赋予网格体表面外观。',
    threejsMapping: 'const material = new THREE.MeshStandardMaterial({ color: {color}, roughness: {roughness}, metalness: {metalness} });',
    p5jsMapping: 'fill({color}); 或使用 specularMaterial()、ambientMaterial()。',
  },
  mesh: {
    type: 'mesh',
    label: '网格体',
    layer: '几何体层',
    inputs: ['geometry', 'material', 'parent_group'],
    outputs: ['mesh_object'],
    defaultParams: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    promptTemplate: '创建一个网格体对象，使用指定的几何体和材质，位于({position})，旋转({rotation})，缩放({scale})，挂载到父容器中。',
    threejsMapping: 'const mesh = new THREE.Mesh(geometry, material); mesh.position.set({position}); rootGroup.add(mesh);',
    p5jsMapping: 'push(); translate({position}); rotate({rotation}); scale({scale}); box({size}); pop();',
  },

  // ========== 光照层 ==========
  ambientLight: {
    type: 'ambientLight',
    label: '环境光',
    layer: '光照层',
    inputs: ['scene_object'],
    outputs: ['ambient_light_object'],
    defaultParams: { color: '#ffffff', intensity: 0.4 },
    promptTemplate: '添加环境光，颜色为{color}，强度为{intensity}，提供整体基础亮度，避免阴影区域完全变黑。',
    threejsMapping: 'const ambientLight = new THREE.AmbientLight({color}, {intensity}); scene.add(ambientLight);',
    p5jsMapping: 'ambientLight({intensity}*255);',
  },
  directionalLight: {
    type: 'directionalLight',
    label: '方向光',
    layer: '光照层',
    inputs: ['scene_object'],
    outputs: ['directional_light_object'],
    defaultParams: { color: '#ffffff', intensity: 1.0, position: [5, 5, 5], castShadow: true },
    promptTemplate: '添加主方向光源，颜色为{color}，强度为{intensity}，位于({position})，作为主要照明方向，形成明暗关系与阴影。',
    threejsMapping: 'const directionalLight = new THREE.DirectionalLight({color}, {intensity}); directionalLight.position.set({position}); scene.add(directionalLight);',
    p5jsMapping: 'directionalLight({intensity}*255, {intensity}*255, {intensity}*255, {position}[0], {position}[1], {position}[2]);',
  },
  pointLight: {
    type: 'pointLight',
    label: '点光源',
    layer: '光照层',
    inputs: ['scene_object'],
    outputs: ['point_light_object'],
    defaultParams: { color: '#ffffff', intensity: 1.0, position: [0, 2, 0], distance: 10, decay: 2 },
    promptTemplate: '添加点光源，颜色为{color}，强度为{intensity}，位于({position})，照射距离{distance}，向周围辐射照明。',
    threejsMapping: 'const pointLight = new THREE.PointLight({color}, {intensity}, {distance}, {decay}); pointLight.position.set({position}); scene.add(pointLight);',
    p5jsMapping: 'pointLight({intensity}*255, {intensity}*255, {intensity}*255, {position}[0], {position}[1], {position}[2]);',
  },

  // ========== 控制层 ==========
  transform: {
    type: 'transform',
    label: '变换',
    layer: '控制层',
    inputs: ['target_object'],
    outputs: ['transformed_object'],
    defaultParams: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    promptTemplate: '对目标对象应用变换：位移({position})、旋转({rotation})、缩放({scale})。',
    threejsMapping: 'object.position.set({position}); object.rotation.set({rotation}); object.scale.set({scale});',
    p5jsMapping: 'translate({position}); rotate({rotation}); scale({scale});',
  },
  animation: {
    type: 'animation',
    label: '动画循环',
    layer: '控制层',
    inputs: ['target_object', 'time'],
    outputs: ['animated_object'],
    defaultParams: { speedX: 0.01, speedY: 0.01, motionType: 'rotate', strength: 0.5, frequency: 1.0 },
    promptTemplate: '创建requestAnimationFrame动画循环，运动方式为{motionType}，速度X={speedX}，速度Y={speedY}，强度{strength}，频率{frequency}。根据运动方式的不同，驱动目标对象进行相应的运动变换。',
    threejsMapping: 'function animate() { requestAnimationFrame(animate); /* motionType: {motionType} */ target.rotation.x += {speedX}; target.rotation.y += {speedY}; renderer.render(scene, camera); } animate();',
    p5jsMapping: 'function draw() { ... } // p5.js 自动循环',
  },
  controls: {
    type: 'controls',
    label: '控制器',
    layer: '控制层',
    inputs: ['camera_object', 'dom_element'],
    outputs: ['orbit_controls'],
    defaultParams: { enableDamping: true, dampingFactor: 0.08, minDistance: 1, maxDistance: 50 },
    promptTemplate: '添加OrbitControls轨道控制器，阻尼系数{dampingFactor}，距离范围{minDistance}至{maxDistance}，允许用户旋转/缩放/平移场景视角。',
    threejsMapping: 'const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = {enableDamping}; controls.dampingFactor = {dampingFactor};',
    p5jsMapping: 'orbitControl(); // p5.js 内置轨道控制',
  },
  responsive: {
    type: 'responsive',
    label: '响应式',
    layer: '控制层',
    inputs: ['window_size', 'camera_object', 'renderer_object'],
    outputs: ['updated_camera_renderer'],
    defaultParams: { enabled: true, updatePixelRatio: true },
    promptTemplate: '添加窗口响应式逻辑，监听窗口变化事件，自动更新画布尺寸、摄像机宽高比和投影矩阵。',
    threejsMapping: "window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });",
    p5jsMapping: 'function windowResized() { resizeCanvas(windowWidth, windowHeight); }',
  },

  // ========== 效果层 ==========
  texture: {
    type: 'texture',
    label: '纹理',
    layer: '效果层',
    inputs: ['image_source', 'material'],
    outputs: ['texture_object'],
    defaultParams: { url: '', wrapS: 'RepeatWrapping', wrapT: 'RepeatWrapping', repeat: [1, 1] },
    promptTemplate: '加载纹理贴图（来源：{url}），包裹模式{wrapS}/{wrapT}，重复次数{repeat}，应用到目标材质表面。',
    threejsMapping: "const texture = new THREE.TextureLoader().load('{url}'); texture.wrapS = THREE.{wrapS}; texture.wrapT = THREE.{wrapT}; material.map = texture;",
    p5jsMapping: "loadImage('{url}', img => { texture(img); });",
  },
  particles: {
    type: 'particles',
    label: '粒子系统',
    layer: '效果层',
    inputs: ['parent_group'],
    outputs: ['particle_system'],
    defaultParams: { count: 500, size: 0.02, color: '#ffffff', spreadRadius: 10, rotationSpeed: 0.0005 },
    promptTemplate: '创建一个粒子系统，共{count}个粒子，尺寸{size}，颜色{color}，分布在半径{spreadRadius}的空间中，以{rotationSpeed}速度旋转。',
    threejsMapping: 'const particlesGeometry = new THREE.BufferGeometry(); const positions = new Float32Array({count} * 3); for(...) { positions[i] = (Math.random()-0.5)*{spreadRadius}; } particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions,3)); const particlesMaterial = new THREE.PointsMaterial({ color: {color}, size: {size} }); const particles = new THREE.Points(particlesGeometry, particlesMaterial);',
    p5jsMapping: '使用 Particle 类数组管理，在 draw() 中遍历更新和绘制。',
  },
  shader: {
    type: 'shader',
    label: '着色器',
    layer: '效果层',
    inputs: ['material'],
    outputs: ['shader_material'],
    defaultParams: { vertexShader: '', fragmentShader: '', uniforms: {} },
    promptTemplate: '使用自定义着色器替换默认材质渲染管线，应用自定义顶点着色器和片元着色器代码。',
    threejsMapping: 'const shaderMaterial = new THREE.ShaderMaterial({ vertexShader: `{vertexShader}`, fragmentShader: `{fragmentShader}`, uniforms: {uniforms} });',
    p5jsMapping: '使用 p5.js filter() 和自定义 shader（部分支持）。',
  },
  color: {
    type: 'color',
    label: '颜色',
    layer: '效果层',
    inputs: [],
    outputs: ['color_value'],
    defaultParams: { hex: '#4A90D9', r: 0.29, g: 0.56, b: 0.85 },
    promptTemplate: '定义颜色值为{hex}（RGB: {r}, {g}, {b}），用于设置材质、光源或背景颜色。',
    threejsMapping: 'const color = new THREE.Color({hex});',
    p5jsMapping: 'fill({hex}); stroke({hex});',
  },

  // ========== 2D绘图层（GSAP + SVG/DOM） ==========
  line: {
    type: 'line',
    label: '线段',
    layer: '2D绘图层',
    inputs: ['svg_container', 'start_point', 'end_point'],
    outputs: ['line_element'],
    defaultParams: { x1: 0, y1: 0, x2: 200, y2: 200, stroke: '#ffffff', strokeWidth: 2, duration: 1.5 },
    promptTemplate: '使用SVG创建一条线段，起点({x1},{y1})，终点({x2},{y2})，颜色{stroke}，线宽{strokeWidth}。用GSAP动画线段从起点延伸到终点，持续{duration}秒。使用document.createElementNS创建SVG元素，GSAP全局已加载直接使用gsap对象。',
    threejsMapping: "const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('width','100%'); svg.setAttribute('height','100%'); svg.style.position='absolute'; svg.style.top='0'; svg.style.left='0'; document.body.appendChild(svg); const line = document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',{x1}); line.setAttribute('y1',{y1}); line.setAttribute('x2',{x2}); line.setAttribute('y2',{y2}); line.setAttribute('stroke',{stroke}); line.setAttribute('stroke-width',{strokeWidth}); svg.appendChild(line); gsap.from(line, { attr: { x2: {x1}, y2: {y1} }, duration: {duration}, ease: 'power2.out' });",
    p5jsMapping: '',
  },
  rect2d: {
    type: 'rect2d',
    label: '矩形',
    layer: '2D绘图层',
    inputs: ['svg_container'],
    outputs: ['rect_element'],
    defaultParams: { x: 0, y: 0, width: 150, height: 100, fill: '#4A90D9', stroke: '#ffffff', strokeWidth: 1, rx: 0, duration: 1 },
    promptTemplate: '使用SVG创建一个矩形，位置({x},{y})，尺寸{width}x{height}，填充色{fill}，描边{stroke}，圆角{rx}。用GSAP从无到有绘制出现，持续{duration}秒。使用document.createElementNS创建SVG元素。',
    threejsMapping: "const rect = document.createElementNS('http://www.w3.org/2000/svg','rect'); rect.setAttribute('x',{x}); rect.setAttribute('y',{y}); rect.setAttribute('width',{width}); rect.setAttribute('height',{height}); rect.setAttribute('fill',{fill}); rect.setAttribute('stroke',{stroke}); rect.setAttribute('rx',{rx}); svg.appendChild(rect); gsap.from(rect, { attr: { width: 0, height: 0 }, duration: {duration}, ease: 'power2.out' });",
    p5jsMapping: '',
  },
  ellipse2d: {
    type: 'ellipse2d',
    label: '椭圆',
    layer: '2D绘图层',
    inputs: ['svg_container'],
    outputs: ['ellipse_element'],
    defaultParams: { cx: 200, cy: 150, rx: 100, ry: 60, fill: '#4A90D9', stroke: '#ffffff', strokeWidth: 1, duration: 1 },
    promptTemplate: '使用SVG创建一个椭圆，中心({cx},{cy})，x半径{rx}，y半径{ry}，填充{fill}，描边{stroke}。用GSAP从中心缩放出现，持续{duration}秒。使用document.createElementNS创建SVG元素。',
    threejsMapping: "const ellipse = document.createElementNS('http://www.w3.org/2000/svg','ellipse'); ellipse.setAttribute('cx',{cx}); ellipse.setAttribute('cy',{cy}); ellipse.setAttribute('rx',{rx}); ellipse.setAttribute('ry',{ry}); ellipse.setAttribute('fill',{fill}); ellipse.setAttribute('stroke',{stroke}); svg.appendChild(ellipse); gsap.from(ellipse, { attr: { rx: 0, ry: 0 }, duration: {duration}, ease: 'elastic.out(1,0.5)' });",
    p5jsMapping: '',
  },
  circle: {
    type: 'circle',
    label: '圆形',
    layer: '2D绘图层',
    inputs: ['svg_container'],
    outputs: ['circle_element'],
    defaultParams: { cx: 200, cy: 150, r: 80, fill: '#4A90D9', stroke: '#ffffff', strokeWidth: 1, duration: 1 },
    promptTemplate: '使用SVG创建一个圆形，中心({cx},{cy})，半径{r}，填充{fill}，描边{stroke}。用GSAP从0半径缩放到{r}，持续{duration}秒。使用document.createElementNS创建SVG元素。',
    threejsMapping: "const circle = document.createElementNS('http://www.w3.org/2000/svg','circle'); circle.setAttribute('cx',{cx}); circle.setAttribute('cy',{cy}); circle.setAttribute('r',{r}); circle.setAttribute('fill',{fill}); circle.setAttribute('stroke',{stroke}); svg.appendChild(circle); gsap.from(circle, { attr: { r: 0 }, duration: {duration}, ease: 'back.out(1.7)' });",
    p5jsMapping: '',
  },
  arc: {
    type: 'arc',
    label: '弧线',
    layer: '2D绘图层',
    inputs: ['svg_container'],
    outputs: ['arc_element'],
    defaultParams: { cx: 200, cy: 150, r: 80, startAngle: 0, endAngle: 180, fill: 'none', stroke: '#ffffff', strokeWidth: 2, duration: 1.5 },
    promptTemplate: '使用SVG path绘制弧线，中心({cx},{cy})，半径{r}，从{startAngle}度到{endAngle}度，颜色{stroke}，线宽{strokeWidth}。用GSAP drawSVG动画逐渐描边出现，持续{duration}秒。使用document.createElementNS创建SVG元素。',
    threejsMapping: "const arcPath = document.createElementNS('http://www.w3.org/2000/svg','path'); const startRad = {startAngle}*Math.PI/180; const endRad = {endAngle}*Math.PI/180; const ax1 = {cx}+{r}*Math.cos(startRad); const ay1 = {cy}+{r}*Math.sin(startRad); const ax2 = {cx}+{r}*Math.cos(endRad); const ay2 = {cy}+{r}*Math.sin(endRad); const largeArc = ({endAngle}-{startAngle})>180?1:0; arcPath.setAttribute('d','M '+ax1+' '+ay1+' A '+{r}+' '+{r}+' 0 '+largeArc+' 1 '+ax2+' '+ay2); arcPath.setAttribute('fill','none'); arcPath.setAttribute('stroke',{stroke}); arcPath.setAttribute('stroke-width',{strokeWidth}); svg.appendChild(arcPath); const arcLen = arcPath.getTotalLength(); gsap.from(arcPath, { attr: { 'stroke-dashoffset': arcLen }, strokeDasharray: arcLen, duration: {duration}, ease: 'power2.inOut' });",
    p5jsMapping: '',
  },
  bezier: {
    type: 'bezier',
    label: '贝塞尔曲线',
    layer: '2D绘图层',
    inputs: ['svg_container', 'control_points'],
    outputs: ['bezier_path'],
    defaultParams: { x1: 100, y1: 300, cp1x: 150, cp1y: 100, cp2x: 350, cp2y: 100, x2: 400, y2: 300, stroke: '#ffffff', strokeWidth: 2, duration: 2 },
    promptTemplate: '使用SVG path创建三次贝塞尔曲线，起点({x1},{y1})，控制点1({cp1x},{cp1y})，控制点2({cp2x},{cp2y})，终点({x2},{y2})，颜色{stroke}。用GSAP drawSVG动画逐渐描边出现，持续{duration}秒。',
    threejsMapping: "const bezierPath = document.createElementNS('http://www.w3.org/2000/svg','path'); bezierPath.setAttribute('d','M {x1} {y1} C {cp1x} {cp1y} {cp2x} {cp2y} {x2} {y2}'); bezierPath.setAttribute('fill','none'); bezierPath.setAttribute('stroke',{stroke}); bezierPath.setAttribute('stroke-width',{strokeWidth}); svg.appendChild(bezierPath); const bezLen = bezierPath.getTotalLength(); gsap.from(bezierPath, { attr: { 'stroke-dashoffset': bezLen }, strokeDasharray: bezLen, duration: {duration}, ease: 'power2.inOut' });",
    p5jsMapping: '',
  },
  curve2d: {
    type: 'curve2d',
    label: '曲线',
    layer: '2D绘图层',
    inputs: ['svg_container', 'control_points'],
    outputs: ['curve_path'],
    defaultParams: { points: '100,300 200,100 300,300 400,100', stroke: '#ffffff', strokeWidth: 2, tension: 0.5, duration: 2 },
    promptTemplate: '使用SVG path创建平滑曲线，控制点{points}，张力{tension}，颜色{stroke}。用GSAP drawSVG动画逐渐描边，持续{duration}秒。使用Catmull-Rom曲线转换为SVG path的d属性。',
    threejsMapping: "const curvePath = document.createElementNS('http://www.w3.org/2000/svg','path'); curvePath.setAttribute('d','M {points}'); curvePath.setAttribute('fill','none'); curvePath.setAttribute('stroke',{stroke}); curvePath.setAttribute('stroke-width',{strokeWidth}); svg.appendChild(curvePath); const curveLen = curvePath.getTotalLength(); gsap.from(curvePath, { attr: { 'stroke-dashoffset': curveLen }, strokeDasharray: curveLen, duration: {duration}, ease: 'power2.inOut' });",
    p5jsMapping: '',
  },
  vertex: {
    type: 'vertex',
    label: '顶点',
    layer: '2D绘图层',
    inputs: ['svg_container'],
    outputs: ['vertex_point'],
    defaultParams: { x: 200, y: 150, r: 4, fill: '#ffffff', stroke: '#4A90D9', strokeWidth: 1, duration: 0.5 },
    promptTemplate: '使用SVG创建一个顶点/控制点，位置({x},{y})，半径{r}，填充{fill}。用于构建贝塞尔或多边形路径的控制点。用GSAP弹性缩放入场，持续{duration}秒。',
    threejsMapping: "const vertex = document.createElementNS('http://www.w3.org/2000/svg','circle'); vertex.setAttribute('cx',{x}); vertex.setAttribute('cy',{y}); vertex.setAttribute('r',{r}); vertex.setAttribute('fill',{fill}); vertex.setAttribute('stroke',{stroke}); svg.appendChild(vertex); gsap.from(vertex, { attr: { r: 0 }, duration: {duration}, ease: 'elastic.out(1,0.5)' });",
    p5jsMapping: '',
  },
  quad: {
    type: 'quad',
    label: '四边形',
    layer: '2D绘图层',
    inputs: ['svg_container', 'vertices'],
    outputs: ['quad_element'],
    defaultParams: { points: '100,50 300,50 350,200 150,200', fill: '#4A90D9', stroke: '#ffffff', strokeWidth: 1, opacity: 0.8, duration: 1 },
    promptTemplate: '使用SVG polygon创建四边形，顶点{points}，填充{fill}，描边{stroke}，不透明度{opacity}。用GSAP从不透明0渐入，持续{duration}秒。使用document.createElementNS创建SVG元素。',
    threejsMapping: "const quad = document.createElementNS('http://www.w3.org/2000/svg','polygon'); quad.setAttribute('points','{points}'); quad.setAttribute('fill',{fill}); quad.setAttribute('stroke',{stroke}); quad.setAttribute('opacity',0); svg.appendChild(quad); gsap.to(quad, { attr: { opacity: {opacity} }, duration: {duration}, ease: 'power2.out' });",
    p5jsMapping: '',
  },

  // ========== 交互层 ==========
  interaction: {
    type: 'interaction',
    label: '交互',
    layer: '交互层',
    inputs: ['target_object', 'dom_event'],
    outputs: ['interaction_state'],
    defaultParams: { mode: 'hover', description: '鼠标悬停时触发' },
    promptTemplate: '为用户交互事件创建响应逻辑，交互模式为{mode}，描述：{description}。',
    threejsMapping: '使用 Raycaster 检测鼠标与对象交互。',
    p5jsMapping: '使用 mouseIsPressed、mouseX、mouseY 等全局变量。',
  },

  // 新增交互类型
  gesture: {
    type: 'gesture',
    label: '手势交互',
    layer: '交互层',
    inputs: ['touch_events', 'target_object'],
    outputs: ['gesture_state'],
    defaultParams: { gestureType: 'swipe', sensitivity: 1.0, description: '滑动手势控制对象旋转' },
    promptTemplate: '创建手势识别交互逻辑，识别{gestureType}手势（灵敏度{sensitivity}），描述：{description}。使用前端内置识别数据控制目标对象。',
    threejsMapping: "禁止自行加载摄像头或模型；使用 window.__previewVision.subscribe('gesture', callback) 获取手势数据并控制对象变换。",
    p5jsMapping: '使用 touches[] 数组和 touchMoved()、touchStarted() 等函数。',
  },
  camera_interaction: {
    type: 'camera_interaction',
    label: '摄像头交互',
    layer: '交互层',
    inputs: ['video_stream', 'target_object'],
    outputs: ['camera_state'],
    defaultParams: { mode: 'motion_detect', sensitivity: 0.5, description: '摄像头运动检测控制粒子运动' },
    promptTemplate: '创建摄像头交互逻辑，模式为{mode}（灵敏度{sensitivity}），描述：{description}。通过getUserMedia获取摄像头画面，分析帧间差异来控制目标对象。',
    threejsMapping: '使用 navigator.mediaDevices.getUserMedia() 获取摄像头流，绑定到video元素，用canvas逐帧分析像素差异。',
    p5jsMapping: '使用 createCapture(VIDEO) 获取摄像头，在 draw() 中分析 video.pixels。',
  },
  audioRhythm: {
    type: 'audioRhythm',
    label: '声音节奏交互',
    layer: '交互层',
    inputs: ['audio_source', 'target_object'],
    outputs: ['audio_reactive_state'],
    defaultParams: { source: 'microphone', frequencyBand: 'bass', sensitivity: 1.0, description: '低频节奏驱动粒子脉冲' },
    promptTemplate: '创建声音节奏交互逻辑，音频来源{source}，分析{频率范围}频段的节奏和幅度（灵敏度{sensitivity}），描述：{description}。将音频频谱数据映射到目标对象的变换参数。',
    threejsMapping: '使用 AudioContext + AnalyserNode 分析音频频谱，将频率数据映射到对象的 scale/position/color 等属性。',
    p5jsMapping: '使用 p5.AudioIn() 或 loadSound() + fft.analyze() 获取频谱数据。',
  },
  mp4Recognition: {
    type: 'mp4Recognition',
    label: 'MP4内容识别',
    layer: '交互层',
    inputs: ['video_source', 'target_object'],
    outputs: ['video_content_data'],
    defaultParams: { source: '', analysisType: 'color_palette', frameRate: 15, description: '分析视频帧颜色控制场景色调' },
    promptTemplate: '创建MP4视频内容识别逻辑，来源{source}，分析类型为{analysisType}，采样帧率{frameRate}fps，描述：{description}。逐帧读取视频内容，提取颜色/亮度/运动信息并映射到目标对象。',
    threejsMapping: '使用 video 元素播放视频，通过 canvas 逐帧采样像素数据，分析颜色分布、运动向量等。',
    p5jsMapping: '使用 createVideo() 加载视频，在 draw() 中读取 video.pixels 进行分析。',
  },
  faceRecognition: {
    type: 'faceRecognition',
    label: '人脸识别',
    layer: '交互层',
    inputs: ['video_stream', 'target_object'],
    outputs: ['face_tracking_data'],
    defaultParams: { mode: 'tracking', trackPoints: ['eyes', 'nose', 'mouth'], sensitivity: 1.0, description: '追踪人脸位置控制摄像机视角' },
    promptTemplate: '创建人脸识别交互逻辑，模式为{mode}，追踪点{trackPoints}（灵敏度{sensitivity}），描述：{description}。通过摄像头检测人脸关键点位置，映射到目标对象的变换参数。',
    threejsMapping: "禁止自行加载摄像头或模型；使用 window.__previewVision.subscribe('face', callback) 获取人脸动作数据并控制 Three.js 对象。",
    p5jsMapping: '使用 ml5.js faceApi 或 clmtrackr 进行人脸检测和追踪。',
  },
  keyboard: {
    type: 'keyboard',
    label: '键盘交互',
    layer: '交互层',
    inputs: ['keyboard_event', 'target_object'],
    outputs: ['keyboard_state'],
    defaultParams: { keys: ['Space'], mode: 'press_hold', multiplier: 1.0, description: '按键控制对象运动' },
    promptTemplate: '创建键盘交互逻辑，监听{keys}按键（模式{mode}，倍率{multiplier}），描述：{description}。按键时改变目标对象的运动状态、速度或触发切换逻辑。',
    threejsMapping: "window.addEventListener('keydown', (e) => { if ([{keys}].includes(e.key)) { ... } }); window.addEventListener('keyup', (e) => { ... });",
    p5jsMapping: 'function keyPressed() { if ([{keys}].includes(key)) { ... } } function keyReleased() { ... }',
  },
  mouse: {
    type: 'mouse',
    label: '鼠标交互',
    layer: '交互层',
    inputs: ['mouse_event', 'target_object'],
    outputs: ['mouse_state'],
    defaultParams: { mode: 'position_track', sensitivity: 1.0, description: '鼠标位置控制光源方向' },
    promptTemplate: '创建鼠标交互逻辑，模式为{mode}（灵敏度{sensitivity}），描述：{description}。将鼠标位置/移动/点击映射到目标对象的参数控制。',
    threejsMapping: "window.addEventListener('mousemove', (e) => { const mx = (e.clientX/window.innerWidth)*2-1; const my = -(e.clientY/window.innerHeight)*2+1; ... });",
    p5jsMapping: '使用 mouseX、mouseY、mouseIsPressed 变量，或 mouseMoved()、mousePressed() 函数。',
  },
  hardware: {
    type: 'hardware',
    label: '硬件交互',
    layer: '交互层',
    inputs: ['hardware_device', 'target_object'],
    outputs: ['hardware_state'],
    defaultParams: { device: 'LeapMotion', protocol: 'websocket', sensitivity: 1.0, description: 'LeapMotion手势控制3D模型' },
    promptTemplate: '创建硬件交互逻辑，设备为{device}（协议{protocol}，灵敏度{sensitivity}），描述：{description}。连接外部硬件设备（Kinect/LeapMotion/雷达等），将传感器数据映射到目标对象的参数控制。',
    threejsMapping: '通过 WebSocket/WebHID/WebUSB 连接硬件设备，解析传感器数据流，映射到 Three.js 对象的变换属性。',
    p5jsMapping: '通过 WebSocket 或串口通信接收传感器数据，在 draw() 中更新对象状态。',
  },

  // ========== 文件资源节点 ==========
  file_texture: {
    type: 'file_texture',
    label: '纹理文件',
    layer: '文件资源',
    inputs: [],
    outputs: ['texture_data'],
    defaultParams: { url: '', type: 'image' },
    promptTemplate: '加载纹理文件{url}（类型{type}），作为材质贴图或背景纹理使用。',
    threejsMapping: "new THREE.TextureLoader().load('{url}');",
    p5jsMapping: "loadImage('{url}');",
  },
  file_model: {
    type: 'file_model',
    label: '3D模型',
    layer: '文件资源',
    inputs: [],
    outputs: ['model_data'],
    defaultParams: { url: '', format: 'glb' },
    promptTemplate: '加载3D模型文件{url}（格式{format}），导入场景中作为网格体使用。',
    threejsMapping: "使用 GLTFLoader/OBJLoader 加载 '{url}' 文件。",
    p5jsMapping: "loadModel('{url}');",
  },
  file_data: {
    type: 'file_data',
    label: '数据文件',
    layer: '文件资源',
    inputs: [],
    outputs: ['parsed_data'],
    defaultParams: { url: '', format: 'json' },
    promptTemplate: '加载数据文件{url}（格式{format}），解析其中的结构化数据用于驱动参数和动画。',
    threejsMapping: "fetch('{url}').then(r => r.json()) 在 animate 中读取数据。",
    p5jsMapping: "loadJSON('{url}'); 或 loadTable('{url}');",
  },
  file_video: {
    type: 'file_video',
    label: '视频素材',
    layer: '文件资源',
    inputs: [],
    outputs: ['video_texture'],
    defaultParams: { url: '', loop: true, muted: true },
    promptTemplate: '加载视频素材{url}（循环{loop}，静音{muted}），将视频帧作为动态纹理使用。',
    threejsMapping: "使用 VideoTexture 从 video 元素创建动态纹理。",
    p5jsMapping: "createVideo('{url}'); video.loop(); video.hide();",
  },
  file_font: {
    type: 'file_font',
    label: '字体文件',
    layer: '文件资源',
    inputs: [],
    outputs: ['font_data'],
    defaultParams: { fileName: '', format: 'ttf' },
    promptTemplate: '加载字体文件{fileName}（格式{format}），用于文字几何或文字纹理节点。',
    threejsMapping: '使用 FontLoader 或浏览器 FontFace API 加载 TTF/OTF 字体。',
    p5jsMapping: "loadFont('{fileName}');",
  },

  // ========== GSAP 动画节点 ==========
  gsap_timeline: {
    type: 'gsap_timeline',
    label: 'GSAP时间线',
    layer: '控制层',
    inputs: [],
    outputs: ['timeline_object'],
    defaultParams: { repeat: -1, yoyo: true, paused: false, description: '主时间线' },
    promptTemplate: '创建GSAP时间线，重复模式{repeat}，往复{yoyo}，暂停{paused}，描述：{description}。时间线用于编排多个动画的先后顺序和时间关系。GSAP全局已加载，直接使用gsap.timeline()即可。',
    threejsMapping: 'const tl = gsap.timeline({ repeat: {repeat}, yoyo: {yoyo}, paused: {paused} });',
    p5jsMapping: 'const tl = gsap.timeline({ repeat: {repeat}, yoyo: {yoyo}, paused: {paused} });',
  },
  gsap_tween: {
    type: 'gsap_tween',
    label: 'GSAP动画',
    layer: '控制层',
    inputs: ['target_object', 'timeline_object'],
    outputs: ['tween_object'],
    defaultParams: { target: '', property: 'opacity', from: 0, to: 1, duration: 1, ease: 'power2.out', delay: 0 },
    promptTemplate: '创建GSAP补间动画，目标{target}，属性{property}，从{from}到{to}，持续{duration}秒，缓动{ease}，延迟{delay}秒。添加到时间线或直接执行。GSAP全局已加载，使用gsap.to()/gsap.from()/gsap.fromTo()。',
    threejsMapping: 'gsap.to({target}, { {property}: {to}, duration: {duration}, ease: "{ease}", delay: {delay} });',
    p5jsMapping: 'gsap.to({target}, { {property}: {to}, duration: {duration}, ease: "{ease}", delay: {delay} });',
  },
  gsap_scroll: {
    type: 'gsap_scroll',
    label: 'GSAP滚动触发',
    layer: '控制层',
    inputs: ['target_object'],
    outputs: ['scroll_trigger'],
    defaultParams: { trigger: 'body', start: 'top 80%', end: 'bottom 20%', scrub: true, description: '滚动触发动画' },
    promptTemplate: '创建GSAP滚动触发器，触发元素{trigger}，开始位置{start}，结束位置{end}，跟随滚动{scrub}，描述：{description}。GSAP全局已加载，使用gsap.registerPlugin(ScrollTrigger)后创建ScrollTrigger。',
    threejsMapping: 'gsap.registerPlugin(ScrollTrigger); ScrollTrigger.create({ trigger: "{trigger}", start: "{start}", end: "{end}", scrub: {scrub}, animation: tl });',
    p5jsMapping: 'gsap.registerPlugin(ScrollTrigger); ScrollTrigger.create({ trigger: "{trigger}", start: "{start}", end: "{end}", scrub: {scrub} });',
  },

};

// ---- 辅助函数 ----

/** 获取节点语义定义（带回退） */
export function getNodeSemantic(nodeType: string): NodeSemantic | null {
  return nodeSemanticRegistry[nodeType] || null;
}

/** 推断两个节点之间的连线关系类型 */
export function inferEdgeRelation(
  sourceType: string,
  targetType: string,
): EdgeRelation {
  const srcRules = edgeRelationRules[sourceType];
  if (srcRules) {
    const relationKey = srcRules[targetType] || srcRules['*'];
    if (relationKey) {
      return edgeRelationDescriptions[relationKey] || edgeRelationDescriptions['default'];
    }
  }
  return edgeRelationDescriptions['default'];
}

/** 将参数值格式化为可读字符串 */
export function formatParamValue(value: unknown): string {
  if (typeof value === 'number') return value.toFixed(2);
  if (Array.isArray(value)) return `[${value.map((v) => (typeof v === 'number' ? v.toFixed(1) : String(v))).join(', ')}]`;
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value).slice(0, 30);
}

/** 生成单个节点的文本指令（替换模板参数） */
export function nodeToTextInstruction(
  nodeType: string,
  nodeLabel: string,
  params: Record<string, unknown>,
): string {
  if (nodeType.startsWith('gsap_')) {
    return `[${nodeLabel}] 这是旧版 GSAP 节点，生成时必须迁移为 Signal 节点（Time/Lerp/Sequence/Trigger 等），禁止输出 gsap 代码。`;
  }

  const spec = getNodeSpecDefinition(nodeType);
  if (spec) {
    const completeParams = completeNodeParams(nodeType, params);
    const paramStr = Object.entries(completeParams)
      .map(([key, value]) => `${key}=${formatParamValue(value)}`)
      .join(', ');
    const inputList = spec.params.length > 0
      ? spec.params.map((param) => param.id).join(', ')
      : '无参数';
    return `[${nodeLabel}] 使用 ${spec.op} 节点（family=${spec.family}），必须按规格路径生成，并补齐参数：${paramStr || inputList}。`;
  }

  const sem = getNodeSemantic(nodeType);
  if (!sem) {
    // 回退：简单的节点描述
    const paramStr = Object.entries(params)
      .filter(([k]) => k !== 'interaction')
      .map(([k, v]) => `${k}=${formatParamValue(v)}`)
      .join(', ');
    return `[${nodeLabel}] 创建一个${nodeType}节点${paramStr ? `，参数：${paramStr}` : ''}。`;
  }

  let text = sem.promptTemplate;

  // 替换参数占位符
  for (const [key, val] of Object.entries(params)) {
    if (key === 'interaction') continue;
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), formatParamValue(val));
  }

  // 替换默认参数中未被用户覆盖的占位符
  for (const [key, val] of Object.entries(sem.defaultParams)) {
    if (params[key] !== undefined) continue; // 已被用户参数替换
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    if (regex.test(text)) {
      text = text.replace(regex, formatParamValue(val));
    }
  }

  // 清除未替换的占位符
  text = text.replace(/\{[a-zA-Z_]+\}/g, '(默认)');

  return `[${nodeLabel}] ${text}`;
}

// ---- 动画运动方式 ----

export const ANIMATION_MOTION_TYPES: Record<string, string> = {
  sine: 'Sine 正弦波',
  pulse: 'Pulse 脉冲波',
  saw: 'Saw 锯齿波',
  ramp: 'Ramp 斜坡',
  triangle: 'Triangle 三角波',
  noise: 'Noise 噪波',
  spring: 'Spring 弹簧',
  collPulse: 'Coll Pulse 密集脉冲',
  constant: 'Constant 恒定值',
  rotate: '持续旋转',
  fastRotate: '快速旋转',
  slowMove: '缓慢移动',
  bounce: '跳动/弹跳',
  sineWave: '正弦波动',
  noiseMotion: '噪波运动',
  randomDisplace: '随机位移',
  scalePulse: '缩放脉冲',
  orbit: '轨道环绕',
  pendulum: '钟摆运动',
  spiral: '螺旋上升',
  float: '漂浮摆动',
};

/**
 * 从节点图构建完整的文本描述，按语义分段组织。
 * 这是核心函数 — 连线时自动形成文本框架，点"应用"时交给AI生成代码。
 */
export interface GraphTextInput {
  nodes: Array<{ id: string; type: string; label: string; params: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string }>;
  language: 'threejs';
}

export interface GraphTextOutput {
  /** 完整文本（直接发给AI） */
  fullText: string;
  /** 分段的文本 */
  sections: Record<string, string[]>;
}

export function buildGraphText(input: GraphTextInput): GraphTextOutput {
  const { nodes, edges, language } = input;

  // 构建邻接表
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e.target);
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e.source);
  }

  const familyOf = (nodeType: string) => getNodeSpecDefinition(nodeType)?.family || '';

  // 找出每类节点
  const sceneNodes = nodes.filter((n) => familyOf(n.type) === 'SCENE' || ['scene', 'camera', 'renderer', 'comp_root'].includes(n.type));
  const geometryNodes = nodes.filter((n) => ['GEOMETRY', 'MATERIAL'].includes(familyOf(n.type)) || ['geometry', 'material', 'mesh'].includes(n.type));
  const lightNodes = nodes.filter((n) => ['AmbientLight', 'DirectionalLight', 'PointLight', 'ambientLight', 'directionalLight', 'pointLight'].includes(n.type));
  const controlNodes = nodes.filter((n) => familyOf(n.type) === 'SIGNAL' || ['transform', 'animation', 'controls', 'responsive'].includes(n.type));
  const effectNodes = nodes.filter((n) => ['TEXTURE', 'PARTICLE', 'P5_TEXTURE'].includes(familyOf(n.type)) || ['texture', 'particles', 'shader', 'color'].includes(n.type));
  const interactionNodes = nodes.filter((n) =>
    ['interaction', 'gesture', 'camera_interaction', 'audioRhythm', 'mp4Recognition', 'faceRecognition', 'keyboard', 'mouse', 'hardware'].includes(n.type),
  );
  const drawingNodes = nodes.filter((n) =>
    familyOf(n.type) === 'SVG' ||
    ['line', 'rect2d', 'ellipse2d', 'circle', 'arc', 'bezier', 'curve2d', 'vertex', 'quad'].includes(n.type),
  );
  const fileNodes = nodes.filter((n) => familyOf(n.type) === 'DATA' || n.type.startsWith('file_'));

  const sections: Record<string, string[]> = {};

  // 1. 项目概述
  const projectLines: string[] = [];
  projectLines.push('使用 Three.js 作为唯一主渲染 Runtime；Signal 节点负责动画/交互数据流；p5.js 只允许作为可选动态纹理并转成 THREE.CanvasTexture；禁止使用 GSAP。');
  sections['项目概述'] = projectLines;

  // 2. 场景结构
  const sceneLines: string[] = [];
  for (const n of sceneNodes) {
    sceneLines.push(nodeToTextInstruction(n.type, n.label, n.params));
  }
  if (sceneLines.length > 0) sections['场景结构'] = sceneLines;

  // 3. 几何体与网格
  const geoLines: string[] = [];
  for (const n of geometryNodes) {
    geoLines.push(nodeToTextInstruction(n.type, n.label, n.params));
  }
  if (geoLines.length > 0) sections['几何体与网格'] = geoLines;

  // 4. 光照
  const lightLines: string[] = [];
  for (const n of lightNodes) {
    lightLines.push(nodeToTextInstruction(n.type, n.label, n.params));
  }
  if (lightLines.length > 0) sections['光照系统'] = lightLines;

  // 5. 效果
  const effectLines: string[] = [];
  for (const n of effectNodes) {
    effectLines.push(nodeToTextInstruction(n.type, n.label, n.params));
  }
  if (effectLines.length > 0) sections['效果与纹理'] = effectLines;

  // 5.5 2D绘图
  const drawingLines: string[] = [];
  for (const n of drawingNodes) {
    drawingLines.push(nodeToTextInstruction(n.type, n.label, n.params));
  }
  if (drawingLines.length > 0) sections['2D绘图元素'] = drawingLines;

  // 6. 交互
  const interactionLines: string[] = [];
  for (const n of interactionNodes) {
    interactionLines.push(nodeToTextInstruction(n.type, n.label, n.params));
  }
  if (interactionLines.length > 0) sections['交互控制'] = interactionLines;

  // 7. 动画与控制
  const controlLines: string[] = [];
  for (const n of controlNodes) {
    controlLines.push(nodeToTextInstruction(n.type, n.label, n.params));
  }
  if (controlLines.length > 0) sections['动画与控制'] = controlLines;

  // 8. 文件资源
  const fileLines: string[] = [];
  for (const n of fileNodes) {
    fileLines.push(nodeToTextInstruction(n.type, n.label, n.params));
  }
  if (fileLines.length > 0) sections['文件资源'] = fileLines;

  // 10. 连线关系
  const edgeLines: string[] = [];
  const connectedNodeIds = new Set<string>();
  for (const e of edges) {
    const srcNode = nodes.find((n) => n.id === e.source);
    const tgtNode = nodes.find((n) => n.id === e.target);
    if (!srcNode || !tgtNode) continue;
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);

    const relation = inferEdgeRelation(srcNode.type, tgtNode.type);
    const text = relation.promptRule
      .replace(/\{from\}/g, srcNode.label)
      .replace(/\{to\}/g, tgtNode.label);
    edgeLines.push(text);
  }

  // 11. 无连线节点的独立描述
  const orphanNodes = nodes.filter((n) => !connectedNodeIds.has(n.id));
  if (orphanNodes.length > 0) {
    const orphanLines: string[] = [];
    for (const n of orphanNodes) {
      orphanLines.push(nodeToTextInstruction(n.type, n.label, n.params));
    }
    sections['独立元素'] = orphanLines;
  }

  // 连线放在"数据流关系"段
  if (edgeLines.length > 0) {
    sections['数据流关系'] = edgeLines;
  }

  // 组装完整文本
  const fullParts: string[] = [];
  const sectionOrder = [
    '项目概述', '场景结构', '几何体与网格', '光照系统',
    '效果与纹理', '2D绘图元素', '文件资源', '动画与控制',
    '交互控制', '数据流关系', '独立元素',
  ];

  fullParts.push('=== 代码生成指令 ===');
  fullParts.push('目标语言: Three.js (WebGL) + Signal Runtime；p5.js 仅可作为动态纹理');
  fullParts.push('请根据以下节点图和参数生成完整可运行的代码。');
  fullParts.push('代码必须包含所有 @node:type=name、@param:paramId=value 和 @connect:source->target 注释标记。');
  fullParts.push(`允许节点类型: ${getSpecNodeTypeList().join(', ')}`);

  for (const section of sectionOrder) {
    const lines = sections[section];
    if (!lines || lines.length === 0) continue;
    fullParts.push(`\n--- ${section} ---`);
    for (const line of lines) {
      fullParts.push(`  ${line}`);
    }
  }

  fullParts.push('\n=== 关键约束 ===');
  fullParts.push('- 只输出纯JavaScript代码，不包含HTML标签和markdown代码块');
  fullParts.push('- Three.js: 必须有scene/camera/renderer/animate完整结构');
  fullParts.push('- 所有物体挂载到根容器rootGroup下，重复对象使用ArrayList或InstancedMesh');
  fullParts.push('- 两个及以上独立能力必须拆为单文件组合模块：每项能力使用createXxx(context)，返回所需的root/update/resize/dispose钩子');
  fullParts.push('- 使用唯一共享context与modules数组；只能有一个scene、renderer、ResizeObserver、requestAnimationFrame和全局清理入口');
  fullParts.push('- 按节点连线与依赖顺序创建模块，统一animate分发module.update，统一dispose逆序清理；局部调整不得重写无关模块');
  fullParts.push('- 禁止使用GSAP；动画用Time/LFO/NoiseSignal/Timer等Signal节点驱动目标参数');
  fullParts.push('- p5.js只允许离屏绘制动态纹理，并作为THREE.CanvasTexture输入材质/粒子/平面');
  fullParts.push('- 每个节点必须按规格表补齐全部@param，使用英文paramId');
  fullParts.push('- 保留所有 @node、@param、@color、@interaction、@connect 注释标记');

  return {
    fullText: fullParts.join('\n'),
    sections,
  };
}

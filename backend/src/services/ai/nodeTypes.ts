export const THREE_NODE_TYPES: Record<string, string> = {
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

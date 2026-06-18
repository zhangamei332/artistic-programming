export const parameterSchemas = {
  "perlin-noise": {
    scale: { type: "number", label: "噪声尺度", min: 0.002, max: 0.05, step: 0.001, default: 0.012 },
    speed: { type: "number", label: "流动速度", min: 0, max: 2, step: 0.01, default: 0.22 },
    octaves: { type: "integer", label: "噪声层数", min: 1, max: 8, step: 1, default: 5 },
    pixelSize: { type: "integer", label: "采样像素", min: 1, max: 12, step: 1, default: 4 },
    seed: { type: "integer", label: "随机种子", min: 0, max: 9999, step: 1, default: 11 }
  },
  "random-walk": {
    walkers: { type: "integer", label: "游走数量", min: 1, max: 100, step: 1, default: 10 },
    step: { type: "number", label: "移动步长", min: 0.5, max: 30, step: 0.5, default: 5 },
    fade: { type: "number", label: "拖尾消退", min: 0.005, max: 0.3, step: 0.005, default: 0.04 },
    lineWidth: { type: "number", label: "线宽", min: 0.5, max: 8, step: 0.5, default: 1.5 }
  },
  "flow-field": {
    count: { type: "integer", label: "粒子数量", min: 50, max: 5000, step: 50, default: 700 },
    speed: { type: "number", label: "运动速度", min: 1, max: 200, step: 1, default: 45 },
    scale: { type: "number", label: "场尺度", min: 0.001, max: 0.05, step: 0.001, default: 0.006 },
    trail: { type: "number", label: "拖尾消退", min: 0.005, max: 0.4, step: 0.005, default: 0.08 },
    seed: { type: "integer", label: "随机种子", min: 0, max: 9999, step: 1, default: 9 }
  },
  "particle-attractor": {
    count: { type: "integer", label: "粒子数量", min: 20, max: 5000, step: 20, default: 500 },
    force: { type: "number", label: "吸引力", min: 0, max: 5000, step: 10, default: 950 },
    damping: { type: "number", label: "阻尼", min: 0.8, max: 1, step: 0.001, default: 0.99 },
    maxSpeed: { type: "number", label: "最大速度", min: 10, max: 600, step: 5, default: 180 },
    pointer: { type: "boolean", label: "鼠标交互", default: true }
  },
  "boids-flocking": {
    count: { type: "integer", label: "数量", min: 20, max: 400, step: 10, default: 160 },
    perception: { type: "number", label: "感知半径", min: 10, max: 180, step: 1, default: 55 },
    separationRadius: { type: "number", label: "分离半径", min: 2, max: 80, step: 1, default: 22 },
    separation: { type: "number", label: "分离", min: 0, max: 4, step: 0.05, default: 1.5 },
    alignment: { type: "number", label: "对齐", min: 0, max: 4, step: 0.05, default: 1 },
    cohesion: { type: "number", label: "聚合", min: 0, max: 4, step: 0.05, default: 0.85 },
    maxSpeed: { type: "number", label: "最大速度", min: 10, max: 250, step: 5, default: 90 },
    maxForce: { type: "number", label: "最大转向力", min: 1, max: 150, step: 1, default: 45 }
  },
  "game-of-life": {
    cellSize: { type: "integer", label: "单元尺寸", min: 2, max: 20, step: 1, default: 6 },
    density: { type: "number", label: "初始密度", min: 0.02, max: 0.8, step: 0.01, default: 0.24 },
    stepsPerSecond: { type: "integer", label: "演化速度", min: 1, max: 60, step: 1, default: 14 }
  },
  "reaction-diffusion": {
    resolution: { type: "integer", label: "模拟分辨率", min: 2, max: 8, step: 1, default: 3 },
    feed: { type: "number", label: "供给率", min: 0.01, max: 0.1, step: 0.001, default: 0.055 },
    kill: { type: "number", label: "消亡率", min: 0.01, max: 0.1, step: 0.001, default: 0.062 },
    dA: { type: "number", label: "物质 A 扩散", min: 0, max: 2, step: 0.05, default: 1 },
    dB: { type: "number", label: "物质 B 扩散", min: 0, max: 2, step: 0.05, default: 0.5 },
    iterations: { type: "integer", label: "每帧迭代", min: 1, max: 20, step: 1, default: 7 }
  },
  "l-system-tree": {
    depth: { type: "integer", label: "递归深度", min: 2, max: 11, step: 1, default: 8 },
    angle: { type: "number", label: "分支角度", min: 5, max: 70, step: 1, default: 25 },
    length: { type: "number", label: "主干长度", min: 0.05, max: 0.6, step: 0.01, default: 0.24 },
    shrink: { type: "number", label: "分支缩放", min: 0.4, max: 0.9, step: 0.01, default: 0.72 },
    speed: { type: "number", label: "生长速度", min: 0.02, max: 2, step: 0.01, default: 0.22 }
  },
  "voronoi": {
    sites: { type: "integer", label: "中心点数量", min: 2, max: 100, step: 1, default: 24 },
    resolution: { type: "integer", label: "采样分辨率", min: 2, max: 12, step: 1, default: 4 },
    speed: { type: "number", label: "移动速度", min: 0, max: 100, step: 1, default: 18 }
  },
  "circle-packing": {
    maxCircles: { type: "integer", label: "最大圆数", min: 10, max: 1000, step: 10, default: 180 },
    growth: { type: "number", label: "生长速度", min: 1, max: 100, step: 1, default: 18 },
    maxRadius: { type: "number", label: "最大半径", min: 2, max: 100, step: 1, default: 28 },
    attemptsPerFrame: { type: "integer", label: "每帧尝试", min: 1, max: 30, step: 1, default: 6 },
    gap: { type: "number", label: "间距", min: 0, max: 20, step: 0.5, default: 2 }
  },
  "spring-grid": {
    cols: { type: "integer", label: "列数", min: 4, max: 80, step: 1, default: 24 },
    rows: { type: "integer", label: "行数", min: 4, max: 60, step: 1, default: 15 },
    stiffness: { type: "number", label: "弹性", min: 1, max: 200, step: 1, default: 52 },
    damping: { type: "number", label: "阻尼", min: 0.5, max: 0.999, step: 0.001, default: 0.88 },
    pointerForce: { type: "number", label: "交互作用力", min: -20000, max: 20000, step: 100, default: 7000 },
    radius: { type: "number", label: "交互半径", min: 10, max: 400, step: 5, default: 100 }
  },
  "lorenz-attractor": {
    sigma: { type: "number", label: "Sigma", min: 0, max: 30, step: 0.1, default: 10 },
    rho: { type: "number", label: "Rho", min: 0, max: 60, step: 0.1, default: 28 },
    beta: { type: "number", label: "Beta", min: 0, max: 10, step: 0.01, default: 2.6667 },
    dt: { type: "number", label: "积分步长", min: 0.001, max: 0.02, step: 0.001, default: 0.006 },
    steps: { type: "integer", label: "每帧步数", min: 1, max: 50, step: 1, default: 7 },
    scale: { type: "number", label: "显示缩放", min: 1, max: 15, step: 0.1, default: 5 }
  }
};

export function getParameterSchema(id) {
  const schema = parameterSchemas[id];
  if (!schema) throw new Error(`Unknown algorithm schema: ${id}`);
  return schema;
}

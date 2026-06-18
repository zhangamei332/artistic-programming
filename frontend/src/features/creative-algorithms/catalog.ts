export type CreativeAlgorithmCategory = 'generator' | 'simulator' | 'field' | 'modifier';

export interface CreativeAlgorithmCatalogItem {
  id: string;
  name: string;
  category: CreativeAlgorithmCategory;
  categoryLabel: string;
  preview: string;
  entry: string;
  pack: string;
}

export const CREATIVE_ALGORITHMS: CreativeAlgorithmCatalogItem[] = [
  { id: 'perlin-noise', name: '柏林噪声', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/perlin-noise.gif', entry: './algorithms/PerlinNoise.js', pack: 'V1' },
  { id: 'random-walk', name: '随机游走', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/random-walk.gif', entry: './algorithms/RandomWalk.js', pack: 'V1' },
  { id: 'flow-field', name: '流场', category: 'field', categoryLabel: '力场', preview: '/creative-algorithms/previews/flow-field.gif', entry: './algorithms/FlowField.js', pack: 'V1' },
  { id: 'particle-attractor', name: '粒子吸引器', category: 'field', categoryLabel: '力场', preview: '/creative-algorithms/previews/particle-attractor.gif', entry: './algorithms/ParticleAttractor.js', pack: 'V1' },
  { id: 'boids-flocking', name: '鱼群涌现', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/boids-flocking.gif', entry: './algorithms/BoidsFlocking.js', pack: 'V1' },
  { id: 'game-of-life', name: '康威生命游戏', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/game-of-life.gif', entry: './algorithms/GameOfLife.js', pack: 'V1' },
  { id: 'reaction-diffusion', name: '反应扩散', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/reaction-diffusion.gif', entry: './algorithms/ReactionDiffusion.js', pack: 'V1' },
  { id: 'l-system-tree', name: 'L-System 分形树', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/l-system-tree.gif', entry: './algorithms/LSystemTree.js', pack: 'V1' },
  { id: 'voronoi', name: 'Voronoi 泰森多边形', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/voronoi.gif', entry: './algorithms/Voronoi.js', pack: 'V1' },
  { id: 'circle-packing', name: '圆形堆积', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/circle-packing.gif', entry: './algorithms/CirclePacking.js', pack: 'V1' },
  { id: 'spring-grid', name: '弹簧网格', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/spring-grid.gif', entry: './algorithms/SpringGrid.js', pack: 'V1' },
  { id: 'lorenz-attractor', name: '洛伦兹吸引子', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/lorenz-attractor.gif', entry: './algorithms/LorenzAttractor.js', pack: 'V1' },
  { id: 'simplex-noise', name: '单纯形噪声', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/simplex-noise.gif', entry: './algorithms/SimplexNoise.js', pack: 'V2' },
  { id: 'worley-noise', name: 'Worley 细胞噪声', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/worley-noise.gif', entry: './algorithms/WorleyNoise.js', pack: 'V2' },
  { id: 'domain-warping', name: '域扭曲', category: 'modifier', categoryLabel: '修改器', preview: '/creative-algorithms/previews/domain-warping.gif', entry: './algorithms/DomainWarping.js', pack: 'V2' },
  { id: 'curl-noise', name: 'Curl Noise 旋流', category: 'field', categoryLabel: '力场', preview: '/creative-algorithms/previews/curl-noise.gif', entry: './algorithms/CurlNoise.js', pack: 'V2' },
  { id: 'dla-growth', name: '扩散限制聚集', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/dla-growth.gif', entry: './algorithms/DLAGrowth.js', pack: 'V2' },
  { id: 'slime-mold', name: '黏菌网络', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/slime-mold.gif', entry: './algorithms/SlimeMold.js', pack: 'V2' },
  { id: 'poisson-disk', name: '泊松圆盘采样', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/poisson-disk.gif', entry: './algorithms/PoissonDisk.js', pack: 'V2' },
  { id: 'delaunay', name: 'Delaunay 三角剖分', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/delaunay.gif', entry: './algorithms/DelaunayTriangulation.js', pack: 'V2' },
  { id: 'julia-set', name: 'Julia 集', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/julia-set.gif', entry: './algorithms/JuliaSet.js', pack: 'V2' },
  { id: 'mandelbrot-set', name: '曼德博集合', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/mandelbrot-set.gif', entry: './algorithms/MandelbrotSet.js', pack: 'V2' },
  { id: 'verlet-cloth', name: 'Verlet 布料', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/verlet-cloth.gif', entry: './algorithms/VerletCloth.js', pack: 'V2' },
  { id: 'pixel-sorting', name: '像素排序', category: 'modifier', categoryLabel: '修改器', preview: '/creative-algorithms/previews/pixel-sorting.gif', entry: './algorithms/PixelSorting.js', pack: 'V2' },
  { id: 'marching-squares-metaballs', name: 'Marching Squares 元球', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/marching-squares-metaballs.gif', entry: './algorithms/MarchingSquaresMetaballs.js', pack: 'V3' },
  { id: 'wave-function-collapse', name: '波函数坍缩', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/wave-function-collapse.gif', entry: './algorithms/WaveFunctionCollapse.js', pack: 'V3' },
  { id: 'maze-backtracker', name: '深度优先迷宫', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/maze-backtracker.gif', entry: './algorithms/MazeBacktracker.js', pack: 'V3' },
  { id: 'hilbert-curve', name: 'Hilbert 空间填充曲线', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/hilbert-curve.gif', entry: './algorithms/HilbertCurve.js', pack: 'V3' },
  { id: 'fourier-epicycles', name: '傅里叶旋转圆绘图', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/fourier-epicycles.gif', entry: './algorithms/FourierEpicycles.js', pack: 'V3' },
  { id: 'spirograph', name: '万花尺曲线', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/spirograph.gif', entry: './algorithms/Spirograph.js', pack: 'V3' },
  { id: 'chladni-pattern', name: '克拉尼振型', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/chladni-pattern.gif', entry: './algorithms/ChladniPattern.js', pack: 'V3' },
  { id: 'moire-pattern', name: '莫尔干涉纹', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/moire-pattern.gif', entry: './algorithms/MoirePattern.js', pack: 'V3' },
  { id: 'elementary-cellular-automata', name: '一维元胞自动机', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/elementary-cellular-automata.gif', entry: './algorithms/ElementaryCellularAutomata.js', pack: 'V3' },
  { id: 'abelian-sandpile', name: '阿贝尔沙堆', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/abelian-sandpile.gif', entry: './algorithms/AbelianSandpile.js', pack: 'V3' },
  { id: 'forest-fire', name: '森林火灾模型', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/forest-fire.gif', entry: './algorithms/ForestFire.js', pack: 'V3' },
  { id: 'fabrik-ik', name: 'FABRIK 反向运动学', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/fabrik-ik.gif', entry: './algorithms/FabrikIK.js', pack: 'V3' },
  { id: 'space-colonization-tree', name: '空间殖民树', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/space-colonization-tree.gif', entry: './algorithms/SpaceColonizationTree.js', pack: 'V4' },
  { id: 'ant-colony-trails', name: '蚁群信息素轨迹', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/ant-colony-trails.gif', entry: './algorithms/AntColonyTrails.js', pack: 'V4' },
  { id: 'predator-prey', name: '捕食者与猎物', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/predator-prey.gif', entry: './algorithms/PredatorPrey.js', pack: 'V4' },
  { id: 'steering-behaviors', name: '转向行为组合', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/steering-behaviors.gif', entry: './algorithms/SteeringBehaviors.js', pack: 'V4' },
  { id: 'n-body-gravity', name: 'N 体引力', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/n-body-gravity.gif', entry: './algorithms/NBodyGravity.js', pack: 'V4' },
  { id: 'double-pendulum', name: '双摆混沌', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/double-pendulum.gif', entry: './algorithms/DoublePendulum.js', pack: 'V4' },
  { id: 'ripple-simulation', name: '二维水波', category: 'simulator', categoryLabel: '模拟器', preview: '/creative-algorithms/previews/ripple-simulation.gif', entry: './algorithms/RippleSimulation.js', pack: 'V4' },
  { id: 'gerstner-waves', name: 'Gerstner 海浪', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/gerstner-waves.gif', entry: './algorithms/GerstnerWaves.js', pack: 'V4' },
  { id: 'truchet-tiles', name: 'Truchet 随机铺砌', category: 'generator', categoryLabel: '生成器', preview: '/creative-algorithms/previews/truchet-tiles.gif', entry: './algorithms/TruchetTiles.js', pack: 'V4' },
  { id: 'floyd-steinberg-dithering', name: 'Floyd-Steinberg 抖动', category: 'modifier', categoryLabel: '修改器', preview: '/creative-algorithms/previews/floyd-steinberg-dithering.gif', entry: './algorithms/FloydSteinbergDithering.js', pack: 'V4' },
  { id: 'halftone', name: '半色调网点', category: 'modifier', categoryLabel: '修改器', preview: '/creative-algorithms/previews/halftone.gif', entry: './algorithms/Halftone.js', pack: 'V4' },
  { id: 'sdf-morphing', name: 'SDF 形状融合', category: 'modifier', categoryLabel: '修改器', preview: '/creative-algorithms/previews/sdf-morphing.gif', entry: './algorithms/SDFMorphing.js', pack: 'V4' },
];

export function getCreativeAlgorithm(id: string): CreativeAlgorithmCatalogItem | undefined {
  return CREATIVE_ALGORITHMS.find((item) => item.id === id);
}

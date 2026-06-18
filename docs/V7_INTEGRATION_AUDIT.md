# V7 指导文件逐项集成审计

本审计对应 `节点文本参考结构文件/AI_Visual_Editor_Codex_Guide_v7`。状态说明：

- **已落实**：已进入现有产品代码路径。
- **验证基准**：用于约束实现和自动验证，不需要原样复制到产品。
- **兼容边界**：已明确阅读，但受现有产品架构限制，本轮未做破坏式替换。

## 顶层任务与交接文件

| 文件 | 状态 | 产品落实 |
|---|---|---|
| `AGENTS.md` | 验证基准 | 按最小改动、逐项验证执行。 |
| `CODEX_TASK_V3.md` | 已落实 | Preview 参数检查器只展示真实 CreativeControls 参数。 |
| `CODEX_TASK_V4.md` | 已落实 | 引入类型化节点、边和运行时策略模块。 |
| `CODEX_TASK_V5.md` | 已落实 | 产品侧使用内置布局、基础运动和粒子运动定义。 |
| `CODEX_TASK_V7.md` | 已落实 | Preview 创作门面、三类内容管线、九类运动曲线、真实曲线路由和事务回执已接入。 |
| `README_交接说明.md` | 验证基准 | 用于确认 V3-V7 的累积目标与交接边界。 |
| `VALIDATION_V6.md` | 验证基准 | 粒子运动、渲染与曲线组合由 V7 core tests 覆盖。 |
| `VALIDATION_V7.md` | 验证基准 | 用于本次验收清单与遗漏审计。 |

## 设计文档

| 文件 | 状态 | 产品落实 |
|---|---|---|
| `docs/BUILTIN_NODE_CODE_V5.md` | 已落实 | 复制并接入布局、运动、粒子运动等内置实现。 |
| `docs/PARTICLE_MOTION_RENDERER_CURVES_V6.md` | 已落实 | 粒子运动菜单与曲线参数进入 Preview 创作门面。 |
| `docs/PREVIEW_LAYOUT_MOTION_CURVES_V7.md` | 已落实 | 单体、阵列、粒子管线；曲线作用对象；模式切换参数保留。 |
| `docs/TOUCHDESIGNER_STYLE_NODE_RUNTIME_V4.md` | 已落实 | 产品侧建立真实 graph nodes/edges 和参数门面写入。 |
| `docs/VISUAL_NODE_PARAMETER_INSPECTOR_V3.md` | 已落实 | 检查器使用中文可视参数，不显示库名式节点参数。 |

## 示例、Schema 与运行时代码

| 类别 | 状态 | 产品落实 |
|---|---|---|
| `examples/ai-intent-resolution-v4.json` | 验证基准 | 核对 AI 意图到节点类型与参数的映射。 |
| `examples/runtime-node-registry-v4.json` | 验证基准 | 核对运行时 Registry 结构。 |
| `examples/visual-node-parameter-catalog-v3.json` | 验证基准 | 核对中文可视参数目录。 |
| `examples/preview-node-parameter-resolution-v3.json` | 验证基准 | 核对 Preview 到可检查节点的解析。 |
| `examples/node-registry-v6.json` | 验证基准 | 核对粒子运动与渲染节点定义。 |
| `examples/node-registry-v7.json` | 验证基准 | 核对 V7 布局、曲线和 Preview 定义。 |
| `examples/preview-creative-inspector-v7.json` | 验证基准 | 核对 Preview 创作门面分组和参数路由。 |
| `schemas/runtime-node-registry-v4.schema.json` | 验证基准 | 核对 Registry 数据形态；现有产品仍保留自身 NodeData 类型。 |
| `schemas/visual-inspector-v3.schema.json` | 验证基准 | 核对 Inspector 数据形态。 |
| `runtime-node-code-v7/src/core` | 已落实 | 复制到 `frontend/src/visual-runtime/core`。 |
| `runtime-node-code-v7/src/curves` | 已落实 | 运动菜单和节点缩略图统一由曲线求值器采样生成。 |
| `runtime-node-code-v7/src/layouts` | 已落实 | 进入产品运行时模块。 |
| `runtime-node-code-v7/src/motions` | 已落实 | 基础运动与粒子运动进入产品运行时模块。 |
| `runtime-node-code-v7/src/nodes` | 已落实 | 节点定义进入产品运行时模块。 |
| `runtime-node-code-v7/src/runtime` | 已落实 | GraphRuntime、Facade 和策略注册进入产品运行时模块。 |
| `runtime-node-code-v7/src/ui` | 已落实 | `MotionCurveMenu` 接入 Preview 参数检查器。 |
| `runtime-node-code-v7/src/adapters/three` | 兼容边界 | 已逐一阅读；当前 Three.js 位于隔离 Preview iframe，未复制到前端主线程。 |
| `runtime-node-code-v7/src/index.ts` | 兼容边界 | 该总入口包含 Three adapters；产品只接入不依赖 npm `three` 的 `core-index.ts`。 |
| `runtime-node-code-v7/examples` | 验证基准 | 用于核对三类管线、曲线路由和 Three.js 接入方式。 |
| `runtime-node-code-v7/tests/core.test.mjs` | 验证基准 | 已使用项目 TypeScript 编译器执行并通过。 |
| `runtime-node-code-v7/dist-core` | 验证基准 | 作为源代码编译产物一致性参考，不复制生成文件。 |

## 当前兼容边界

1. 现有产品仍以 AI 返回的完整 Three.js 代码驱动 Preview iframe；V7 graph 已成为参数检查器中的真实事务图，但尚未替代整个生成与预览主流程。
2. 参数门面更新真实节点和边，同时保留调用现有 `onParamChange` 的兼容桥，以便当前生成代码仍能响应参数调整。
3. V7 `adapters/three` 未直接复制到前端主线程。当前 Three.js 只存在于隔离 Preview iframe，前端也没有 npm `three` 依赖；直接接入会破坏现有沙箱边界。
4. 摄像机双视口与导出渲染器架构未在本轮重写。现有 Preview 的摄像机、画面和导出页签继续保留。

以上兼容边界是下一阶段将 Graph 升级为整个产品唯一事实源时需要处理的架构迁移项。

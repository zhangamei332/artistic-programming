# AGENTS.md — AI 助手指引

## 项目概况

**项目名称**：艺术编程交互平台  
**项目路径**：`d:\艺术编程Artistic programming\`  
**定位**：面向非编程用户的网页端 AI 艺术编程工具，通过自然语言生成 GSAP + Three.js 代码，并以 TouchDesigner 风格的可视化节点系统呈现和编辑。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite |
| 节点画布 | React Flow |
| 代码编辑器 | Monaco Editor |
| UI 组件 | Ant Design |
| 样式 | CSS Modules + CSS 变量 |
| 后端 | Node.js + Express + TypeScript |
| AI | DeepSeek API（通过 OpenAI 兼容接口） |
| 3D | Three.js 0.160 |
| 2D动画 | GSAP 3.12（GreenSock Animation Platform） |
| 版本控制 | GitHub: zhangamei332/artistic-programming |

## Andrej Karpathy 四大原则（必须严格遵守）

所有代码生成、修改和架构决策必须遵守以下四大原则：

### 原则 1：先思考，再编码（Think Before Coding）

- **明确假设**：在开始写代码之前，明确陈述所有假设条件和前提。如果用户描述存在多义性，先列出 2-3 种可能的解释，再选择最合理的一种执行。
- **多解释呈现**：当需求模糊时，不要自行臆断。用简短的要点列出不同的理解方式，让用户或上下文决定方向。
- **合理反驳**：如果用户的需求在技术上不合理（如性能不可行、安全有隐患、架构矛盾），应当指出问题并给出替代方案，而非盲目执行。
- **困惑时停止**：当遇到不明确的需求、陌生的概念、或与现有架构冲突的指令时，停下来请求澄清，不要猜测后继续。

### 原则 2：简洁至上（Simplicity First）

- **不多做**：只实现用户明确要求的功能，不添加任何未经请求的特性、选项或"可能以后有用"的代码。
- **不过度抽象**：不要为单次使用的代码创建抽象层、基类、工具函数或 helper。三个相似代码块再考虑抽取，在此之前保持重复。
- **不处理不可能场景**：不要为不可能发生的状态添加错误处理、回退逻辑或边界检查。信任内部代码和框架的保证，只在系统边界（用户输入、外部 API）做校验。
- **重写臃肿代码**：如果发现现有代码过度抽象、层级过多或逻辑冗余，用更简洁的方式重写它。

### 原则 3：手术式修改（Surgical Changes）

- **不改相邻代码**：不要顺手改进、重构或格式化与当前任务无关的代码。即使是错误的缩进、不规范的命名或缺失的类型声明，只要不在本次任务范围内，都不要碰。
- **不改注释和格式**：不要修改与任务无关的注释、空行或代码风格。保持 diff 最小化。
- **匹配现有风格**：新增代码必须完全匹配周围代码的风格、缩进、命名约定和文件结构（即使那些风格并不理想）。一致性比正确性更重要。
- **每行改动可追溯**：每一行被修改的代码都必须能直接追溯到用户的具体请求。如果某行改动无法对应用户的一句话，那就不该改。

### 原则 4：目标驱动执行（Goal-Driven Execution）

- **将指令转化为目标**：把用户的祈使句指令（"加一个按钮"）转化为声明式的目标描述（"需要让用户能够触发 X 操作"），然后用目标来指导实现。
- **验证闭环**：每次实现后用验证循环确认目标达成。先定义验证步骤（"测试：点击按钮应该看到 X"），再执行。
- **测试优先思维**：在写实现代码之前，先明确判断标准——什么情况算成功、什么算失败。无法明确判断标准的任务先澄清。
- **陈述计划与验证步骤**：对于非平凡任务，简要陈述实施计划和对应的验证步骤，确保实现正确且不遗漏。

## 核心架构与数据流

### 生成流程（最重要）
```
用户输入 prompt → 前端 POST /api/generate/text → 后端 DeepSeek API
  → AI 返回带 @node/@connect 注释的 JS 代码
  → 后端 parseAnnotations() 提取 nodes + edges
  → 前端 filterRelevantNodes() 过滤无用节点
  → VerifierIframe（隐藏iframe）验证代码可运行
  → 验证成功 → 存入 history → 显示在 PreviewWindow + NodeCanvas
  → 验证失败 → 自动调用 /api/generate/fix 修复（最多3次）
```

### 调整/修改流程
```
用户输入调整指令 → adjustCode() → POST /api/generate/fix
  → 后端 fixWithDeepSeek() 把用户指令作为修改任务发给 AI
  → AI 返回修改后的完整代码
  → 后端 parseAnnotations() 提取新的 nodes + edges
  → 前端更新 finalCode + finalNodes + finalEdges
  → 预览刷新 + 节点画布刷新 + 存入历史记录
```

### 参数调整流程
```
用户在 ParamPanel 修改滑块/色盘 → updateNodeParams() 更新本地状态
  → 点击"应用参数" → regenerateFromParams()
  → buildGraphDescription() 生成参数描述 → POST /api/generate/fix
  → 同上调整流程
```

## GSAP + Three.js 分工协作（极其重要）

### 核心原则

**GSAP（2D动画层 — 负责DOM/UI/2D动画）：**
- GSAP用于控制DOM元素的CSS属性动画（opacity, transform, color等）
- GSAP用于控制HTML叠加层（hud、文字标签、按钮等UI元素）
- GSAP时间线（timeline）编排多个2D动画的先后顺序和时间关系
- GSAP的ScrollTrigger处理页面滚动触发动画
- 示例：`gsap.to('.hud', { opacity: 0, duration: 0.5 });`
- GSAP通过修改DOM元素的style实现2D动画

**Three.js（3D渲染层 — 负责WebGL/3D场景）：**
- Three.js负责所有WebGL渲染（场景、模型、材质、灯光）
- Three.js的requestAnimationFrame驱动3D动画循环
- 3D物体的变换（旋转、位移、缩放）在animate()中处理
- 示例：`cube.rotation.x += 0.01;`
- Three.js通过renderer.domElement渲染到canvas

**两者协作模式：**
- Three.js和GSAP各自独立运行，互不干扰
- GSAP控制HTML overlay的显示/隐藏（如loading动画、标题文字）
- Two.js通过renderer.domElement渲染到canvas
- 两者可以在同一个requestAnimationFrame中协同运行
- GSAP也可以控制Three.js对象的属性（如camera.position过渡），但主要用于DOM元素
- 当用户描述涉及"UI动画"、"文字动画"、"加载动画"、"HUD"时→使用GSAP
- 当用户描述涉及"3D场景"、"3D模型"、"光影"时→使用Three.js

### GSAP 节点类型

| 节点类型 | 中文名 | 作用 |
|----------|--------|------|
| gsap_timeline | GSAP时间线 | 编排多个动画的先后顺序和时间关系 |
| gsap_tween | GSAP补间 | 单个补间动画（from → to），控制任意DOM属性 |
| gsap_scroll | GSAP滚动触发 | 滚动位置触发动画（ScrollTrigger） |

GSAP全局已通过 `<script src="gsap.min.js">` 加载到预览iframe中，代码中直接使用 `gsap` 对象，无需 import。

### 预览 iframe 资源加载

预览iframe按以下顺序加载CDN资源：
1. Three.js 0.160（importmap）
2. **GSAP 3.12**（script标签，全局gsap对象）

## 注释标记系统（核心协议）

AI 生成的代码必须包含以下注释标记，这是前端节点画布和后端解析之间的协议：

```javascript
// @node:类型ID=节点名称          → 定义一个节点
// @param:参数名=数值              → 参数（挂在最近的 @node 上）
// @color:描述=#色值              → 颜色参数
// @interaction:描述              → 交互方式描述
// @connect:源节点名称->目标节点名称 → 连线关系（用节点名称匹配，非ID）
```

### 节点类型 ID 列表
- 场景层：scene, camera, renderer, comp_root
- 几何层：geometry, material, mesh, transform
- 光照层：ambientLight, directionalLight, pointLight
- 控制层：animation, controls, responsive, gsap_timeline, gsap_tween, gsap_scroll
- 效果层：texture, particles, shader, color
- 交互层：interaction, keyboard, mouse, gesture, camera_interaction, audioRhythm, mp4Recognition, faceRecognition, hardware
- 文件资源：file_texture, file_model, file_data, file_video

## 关键文件地图

### 前端核心
| 文件 | 职责 |
|------|------|
| `frontend/src/hooks/useAutoFix.ts` | **全流程状态机**：生成、验证、修复、历史管理 |
| `frontend/src/components/layout/AppLayout.tsx` | 主布局：对话栏、工具箱、画布、参数面板、预览 |
| `frontend/src/components/nodes/NodeCanvas.tsx` | ReactFlow 画布，渲染节点和连线 |
| `frontend/src/components/nodes/TDNodes.tsx` | 6大类自定义节点组件（场景/几何/光照/控制/效果/交互）+ GSAP动画节点 |
| `frontend/src/components/nodes/NodeToolbox.tsx` | 可拖拽节点工具箱 |
| `frontend/src/components/preview/PreviewWindow.tsx` | iframe 预览窗口，将 JS 代码包装为完整 HTML |
| `frontend/src/components/preview/VerifierIframe.tsx` | 隐藏 iframe，在后台验证代码可运行 |
| `frontend/src/components/common/ParamPanel.tsx` | 参数编辑面板（滑块/色盘/按键录制） |
| `frontend/src/components/common/InputPanel.tsx` | 用户输入面板 + 文件上传槽 |
| `frontend/src/components/common/HistoryPanel.tsx` | 历史记录列表 |
| `frontend/src/templates/codeTemplate.ts` | AI 生成代码的强制模板规则 |
| `frontend/src/utils/generateCodeFromGraph.ts` | 从节点图构建代码修改请求 |
| `frontend/src/utils/generateVerificationHTML.ts` | 构建验证用的 HTML 页面 |

### 后端核心
| 文件 | 职责 |
|------|------|
| `backend/src/services/ai/deepseek.ts` | **AI 核心**：SYSTEM_PROMPT、代码生成、解析注释、修复 |
| `backend/src/controllers/generateController.ts` | API 路由处理 + zod 输入校验 |
| `backend/src/config.ts` | 配置（API Key、端口等） |

## 代码生成框架：父子级 + ArrayList 阵列

所有 AI 生成的 Three.js 代码默认使用此结构：
- **根容器**：所有物体放在 `THREE.Group`（comp_root）下，通过 `scene.add(rootGroup)`
- **ArrayList 阵列**：重复物体用数组管理 `const cubes = []; for(...) { cubes.push(mesh); }`
- **遍历更新**：动画中用 `cubes.forEach(item => {...})` 更新
- **连线规则**：所有物体通过 @connect 连到根容器，无父级容器的物体被过滤
- **好处**：方便扩展到复杂系统，结构清晰，参数调整容易定位

## 常见问题与解决方案

### 1. 调整指令后预览黑屏
**根因**：后端 `FIX_SYSTEM_PROMPT` 把"调整/修改"当成"修bug"，AI 不理解意图。
**解决**：FIX_SYSTEM_PROMPT 分为两种模式 — A模式修bug、B模式创意修改。
- 用户说"改成蓝色" → B模式，直接改颜色值
- 用户说"xxx is not defined" → A模式，修复代码错误
- 修改指令 format：`任务：用户要求调整: xxx`（不是 `错误信息：xxx`）

### 2. 调整后节点画布不更新
**根因**：`/fix` 接口只返回 `{ code }` 不返回 `nodes/edges`。
**解决**：fixWithDeepSeek 现在也会对返回代码调用 `parseAnnotations()`，返回 nodes 和 edges。

### 3. AI 生成代码无法运行
**常见原因**：
- 代码被包裹在 markdown 代码块中 → `stripMarkdownCodeBlock()` 处理
- Three.js 代码没有 `document.body.appendChild(renderer.domElement)` → SYSTEM_PROMPT 强调
- GSAP 代码不需要 import，GSAP 已全局加载 → SYSTEM_PROMPT 强调
- 代码中有 HTML 标签 → SYSTEM_PROMPT 禁止输出 HTML
- `<script type="module">` 中 `try/catch` 包裹 `import` → **ESM import 必须是顶级语句**，不能放在 try/catch 内

### 4. 无关节点出现
**过滤规则**（在 `filterRelevantNodes` 中）：
- 基础设施节点永久保留：scene, camera, renderer, animation
- 有 @connect 连线的节点保留
- 有可编辑参数（除 interaction 外）的节点保留
- 其余节点删除
- 引用被删节点的 edge 也删除

### 5. Zod 校验导致请求静默失败
**教训**：Zod schema 的 max 限制必须足够大。
- `error` 字段从 max(2000) → max(10000)，因为参数调整请求可能包含大量节点描述
- `code` 字段 max(50000) 容纳完整代码

## 开发注意事项

### 状态管理：useRef vs useState
- `useAutoFix` 中使用 `useRef` 存储高频变化的运行时状态（code、nodes、edges、language）
- `useState` 用于触发 React 重渲染（finalCode、finalNodes、phase 等）
- `useCallback` 的依赖数组如果为空 `[]`，内部只能用 ref 而不能用 state，否则读到过期闭包值

### 预览 iframe 渲染
- 代码包装在 `<script type="module">` 中
- Three.js 通过 importmap 加载（unpkg CDN）
- GSAP 通过 `<script src>` 全局加载
- iframe sandbox 只允许 `allow-scripts`（安全约束）
- 错误捕获使用 `addEventListener('error', ..., true)` 捕获阶段，而非 `window.onerror`

### 面板拖拽调整
- `useResizeHandle` hook 控制面板宽度，返回 [width, onMouseDown, isActive]
- 每个 resizeHandle 控制它**左边**的面板宽度
- 拖拽中给 layout 添加 `.resizing` class 禁止文本选择
- resizeHandle 的 cursor 设置为 `col-resize !important` 覆盖 ReactFlow 的 grab 光标
- 删除画布与参数抽屉之间的冗余边界（原来有2条，现在只保留参数抽屉右侧1条）

### 参数编辑系统
- **局部保存**：「保存调整局部参数」按钮仅保存当前节点参数到本地，不触发 API 或刷新预览
- **全局应用**：「应用全部参数并预览」按钮在右侧工具栏，收集所有节点的参数修改，调用 regenerateFromParams 重新生成代码并刷新预览
- 键盘/鼠标交互参数：通过 Modal 录制按键，修改后也通过全局应用生效
- 工作流：逐个节点调整参数（局部保存）→ 统一应用全部参数（全局刷新）

### 历史记录系统
- **树形结构**：支持 parentId 字段，子级记录缩进显示在父级下方，带连接图标
- **拖拽排序**：拖拽历史记录到另一条记录上 → 形成父子级关系（onMoveToParent）
- **橙色高亮**：点击记录 → 变为橙色基准（activeBase），`itemActive` CSS class
- **子级生成**：基准激活状态下调整/参数应用 → 新记录自动成为该基准的子级
- **差异对比**：子级自动计算与父级的参数差异（computeNodeDiff），青色 diffBadge 显示
- **取消选择**：再次点击同一个激活记录 → 取消基准，回到顶层列表模式
- 最多保存 50 条

### 文件资源系统
- **文件上传**：支持 png/jpg/svg/txt/csv/xlsx/mp4/obj/glb/gltf，拖拽或点击上传
- **文件夹链接**：「文件夹链接」按钮选择本地文件夹批量导入
- **文件节点**：AI 生成代码中使用 file_texture/file_model/file_data/file_video 节点类型
- **文件连线**：文件节点通过 @connect 连接到使用它的节点（如纹理→材质）
- 文件节点在画布中显示为青色虚线边框卡片

## 常用命令

```bash
# 前端
cd frontend && npm run dev        # localhost:5173
cd frontend && npm run build

# 后端
cd backend && npm run dev         # localhost:3001
cd backend && npm run build
```

## 关键约束

1. **API Key 绝不暴露到前端** — AI 调用必须通过后端代理
2. **预览沙箱隔离** — iframe sandbox 不允许 `allow-same-origin`
3. **禁止 any 类型** — 所有 TypeScript 代码必须有明确类型
4. **ESM import 必须是顶级语句** — 不能在 try/catch、if/else、函数体中使用 import
5. **所有 AI 交互都用中文** — SYSTEM_PROMPT 和用户消息都用中文
6. **每次 AI 代码生成必须带 @node/@connect 注释** — 否则节点画布为空
7. **previewKey 变化触发 iframe 重载** — 修改代码后必须 `setPreviewKey(k => k + 1)`
8. **generationKey 变化触发 NodeCanvas 重载** — 修改节点后必须 `setGenerationKey(k => k + 1)`

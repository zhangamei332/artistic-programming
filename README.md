# 艺术编程交互平台

面向非编程用户的网页端 AI 艺术编程工具。输入文字或上传图片，AI 自动生成 Three.js + GSAP 高交互艺术代码，并通过 TouchDesigner 风格的可视化节点系统轻松调整效果。

## AI 协同引擎规范（三智能体协同机制）

本平台由三个 AI Agent 协同工作，完成从用户意图到高性能渲染的完整闭环：

### Agent 1 — 产品/架构师（Product & Architecture）
- **意图发掘**：将用户的非专业词汇（"闪亮"、"流动"、"梦幻"）转化为精确的图形学参数
- **UI 控制面板补全**：为每个生成效果自动补全控制参数（Speed、Density、Color、Size 等），并生成至少 3 个预设（Presets）供用户快速切换
- **节点图编排**：设计节点之间的数据流关系，确保参数可调、连线合理

### Agent 2 — 图形/代码（Graphics & Code）
- **高性能代码生成**：熟练运用 Three.js（WebGL 3D 渲染）、GSAP（2D DOM 动画）、PixiJS 或 HTML5 Canvas
- **遵守工程约束**：所有代码必须满足下方「强制性前端工程约束」中的每一条规则
- **节点注释标记**：生成的代码必须包含 `@node`、`@param`、`@color`、`@connect` 注释标记，用于驱动可视化节点画布

### Agent 3 — QA/调试员（Quality Assurance & Debug）
- **性能审计**：检查生成的代码是否满足 60 FPS 满帧运行要求
- **Bug 修复**：自动检测并修复运行时报错（最多 3 次自动修复循环）
- **内存泄漏检测**：确保 dispose() 函数完整释放 GPU 资源、动画帧、定时器和事件监听

---

## 强制性前端工程约束

所有 Agent 2 生成的代码必须严格满足以下约束。违反任何一条的代码将被 Agent 3 拦截并要求修复。

### 1. 容器绑定
```
禁止：将 Canvas 直接挂载到 document.body
强制：挂载到平台指定的容器元素内
```

生成的代码中，Three.js renderer 必须挂载到 `#canvas-container`：
```javascript
const container = document.getElementById('canvas-container');
container.appendChild(renderer.domElement);
```

### 2. 视口自适应
```
禁止：使用 window.onresize / window.addEventListener('resize', ...)
强制：使用 ResizeObserver 监听容器大小变化
```

```javascript
const resizeObserver = new ResizeObserver(() => {
  const { width, height } = container.getBoundingClientRect();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});
resizeObserver.observe(container);
```

### 3. 内存释放
```
强制：每个生成的图形逻辑必须提供 dispose() 销毁函数
用途：在 React 组件卸载（Unmount）时清理所有资源
```

dispose() 必须释放：
- **WebGL 上下文**：`renderer.dispose()`、`geometry.dispose()`、`material.dispose()`、`texture.dispose()`
- **动画帧**：所有 `requestAnimationFrame` 的 ID 必须用 `cancelAnimationFrame` 取消
- **定时器**：所有 `setInterval`/`setTimeout` 必须用 `clearInterval`/`clearTimeout` 清除
- **事件监听**：所有 `addEventListener` 必须在 dispose 中 `removeEventListener`
- **GSAP 动画**：`gsap.globalTimeline.clear()` 或具体 tween/timeline 的 `.kill()`
- **ResizeObserver**：`resizeObserver.disconnect()`

```javascript
function dispose() {
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
  if (typeof gsap !== 'undefined') gsap.globalTimeline.clear();
}
```

### 4. UI 统一
```
强制：控制面板（如 lil-gui）的 DOM 元素必须设置为绝对定位
约束：限制在 #canvas-container 容器内部，不得溢出到容器外
```

```javascript
const gui = new lil.GUI({ autoPlace: false, width: 260 });
gui.domElement.style.position = 'absolute';
gui.domElement.style.top = '8px';
gui.domElement.style.right = '8px';
gui.domElement.style.zIndex = '10';
container.appendChild(gui.domElement);
```

---

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
| 3D 渲染 | Three.js 0.160 |
| 2D 动画 | GSAP 3.12 |
| 控制面板 | lil-gui 0.19 |
| 版本控制 | GitHub: zhangamei332/artistic-programming |

## 快速开始

### 前端
```bash
cd frontend
npm install
npm run dev        # 默认启动在 http://localhost:5173
```

### 后端
```bash
cd backend
npm install
npm run dev        # 默认启动在 http://localhost:3001
```

### 预览与调试
1. 启动前端和后端后，浏览器打开 `http://localhost:5173`
2. 在左侧对话框输入创作描述（例如："旋转的彩色立方体，背景是星空"）
3. 点击"生成"按钮，AI 将自动生成代码并在预览区展示
4. 使用节点画布查看和编辑生成效果的结构
5. 修改参数面板中的滑块/色盘，点击"应用全部参数并预览"查看效果变化

## 项目文档

完整文档在 `docs/` 目录：
- [需求规格](docs/requirements.md)
- [技术架构](docs/architecture.md)
- [设计规范](docs/design-spec.md)
- [开发计划](docs/development-plan.md)
- [编码规范](docs/coding-standards.md)
- [API 规范](docs/api-spec.md)

## 开发日志

每日开发记录在 `dev-logs/` 目录。

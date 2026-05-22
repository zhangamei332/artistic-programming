# CLAUDE.md — AI 助手指引

## 项目概况

**项目名称**：艺术编程交互平台  
**项目路径**：`d:\艺术编程Artistic programming\`  
**一句话**：面向非编程用户的网页端 AI 艺术编程工具，通过自然语言/图片生成 Three.js/p5.js 代码，并以可视化节点系统呈现。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite |
| 状态管理 | Zustand |
| 节点画布 | React Flow |
| 代码编辑器 | Monaco Editor |
| UI 组件 | Ant Design |
| 样式 | CSS Modules + CSS 变量 |
| 后端 | Node.js + Express + TypeScript |
| ORM | Prisma |
| 数据库 | PostgreSQL |

---

## 标准文档路径索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求规格 | `docs/requirements.md` | 功能需求、优先级、约束 |
| 技术架构 | `docs/architecture.md` | 技术选型、数据流、安全设计 |
| 设计规范 | `docs/design-spec.md` | 色彩、字体、布局、组件规范 |
| 开发计划 | `docs/development-plan.md` | 分阶段计划、里程碑 |
| 编码规范 | `docs/coding-standards.md` | 命名、结构、Git 规范 |
| API 规范 | `docs/api-spec.md` | 接口定义、请求响应格式 |

---

## 开发日志

- **位置**：`dev-logs/YYYY-MM-DD.md`
- **每次开发会话结束时**必须更新当日日志
- 模板：`dev-logs/TEMPLATE.md`
- 日志内容：今日完成、问题、关键决策、明日待办、进度

---

## 工作流

### 每次开发前
1. 阅读 `dev-logs/` 最新日志，了解当前进度
2. 对照 `docs/development-plan.md` 确认当前阶段任务
3. 更新 TODO 列表

### 开发中
1. 遵循 `docs/coding-standards.md`
2. UI 相关参照 `docs/design-spec.md`
3. API 相关参照 `docs/api-spec.md`
4. 架构决策时参照 `docs/architecture.md`

### 每次开发后
1. 更新 `dev-logs/YYYY-MM-DD.md`
2. 如有新决策，更新对应 docs 文档
3. 如有进度变化，更新 `docs/development-plan.md` 勾选状态

---

## 常用命令

### 前端（frontend/）
```bash
npm run dev          # 启动开发服务器 (localhost:5173)
npm run build        # 生产构建
npm run lint         # 代码检查
```

### 后端（backend/）
```bash
npm run dev          # 启动开发服务器 (localhost:3001)
npm run build        # 编译 TypeScript
npx prisma generate  # 生成 Prisma 客户端
npx prisma migrate dev  # 数据库迁移
```

---

## 关键约束

1. **API Key 绝不暴露到前端** — AI 调用必须通过后端代理
2. **预览沙箱隔离** — iframe sandbox 不允许 `allow-same-origin`
3. **禁止 any 类型** — 所有 TypeScript 代码必须有明确类型
4. **先跑通再优化** — MVP 阶段不过度设计
5. **每阶段验收** — 达到验收标准后再进入下一阶段

---

## 当前状态

- **阶段**：第 0 阶段 — 项目初始化
- **目标**：搭建项目骨架、文档体系、基础 UI 框架

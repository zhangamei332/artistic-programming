# 编码规范

## 1. 通用规范

- 语言：TypeScript，禁止使用 `any`（除非确有必要）
- 缩进：2 空格
- 行尾：LF
- 字符串：单引号 `'`
- 分号：必须
- 文件命名：kebab-case（如 `code-parser.ts`）
- 组件命名：PascalCase（如 `NodeCanvas.tsx`）
- 变量/函数：camelCase（如 `parseCodeToNodes`）

---

## 2. 前端规范

### 2.1 React 组件

```typescript
// 组件结构顺序
// 1. imports (React → 第三方 → 内部)
// 2. types/interfaces
// 3. component function
// 4. hooks (state → effect → callback)
// 5. render (JSX)
// 6. export default
```

- 优先使用函数组件 + Hooks
- 单文件不超过 200 行
- 组件 Props 必须定义 interface
- 避免内联样式，使用 CSS Modules

### 2.2 状态管理 (Zustand)

- Store 按功能域拆分（editor, nodes, user, project）
- 不要在组件中直接修改 store，通过 store 提供的方法修改

### 2.3 样式

- 使用 CSS Modules（`*.module.css`）
- 全局变量定义在 `styles/variables.css`
- 颜色使用 CSS 变量，不硬编码色值

---

## 3. 后端规范

### 3.1 项目结构

```
src/
├── routes/        # 仅定义路由 + 参数校验
├── controllers/   # 请求/响应处理
├── services/      # 业务逻辑（核心）
├── models/        # Prisma 模型
├── middleware/     # 中间件
└── config/        # 配置
```

### 3.2 函数规范

- 单一职责：每个函数只做一件事
- 不超过 50 行
- 异步函数明确标注返回类型 `Promise<T>`
- 错误统一 throw，由上层 catch 处理

### 3.3 API 规范

- 请求参数在 controller 层校验（使用 zod）
- Service 层不接触 req/res
- 错误响应统一格式

---

## 4. Git 提交规范

```
<type>: <subject>

类型：
  feat:     新功能
  fix:      修复
  refactor: 重构
  style:    样式
  docs:     文档
  chore:    杂项

示例：
  feat: 添加文生代码 API
  fix: 修复预览窗口 iframe 跨域问题
  docs: 更新 API 接口文档
```

---

## 5. 禁止事项

- 禁止在前端代码中硬编码 API Key
- 禁止使用 `console.log`（使用统一的 logger）
- 禁止使用 `!important`
- 禁止提交 `node_modules`
- 禁止直接操作 DOM（使用 React 方式）
- 禁止在 iframe 中允许 `allow-same-origin`

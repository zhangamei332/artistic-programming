# 艺术编程交互平台 — API 调用文档

## 基础信息

| 项目 | 值 |
|------|------|
| 后端地址 | `http://localhost:3001` |
| 前端地址 | `http://localhost:5173` |
| CORS 允许 | `http://localhost:5173` |
| 请求体大小限制 | 10 MB |
| 响应格式 | `{ success: boolean, data?: {...}, error?: string }` |

---

## 一、生成接口 `/api/generate`

### 1.1 文本生成代码 `POST /api/generate/text`

根据用户自然语言描述生成 Three.js 代码和节点图。

**请求体：**
```json
{
  "prompt": "一个旋转的彩色立方体，背景是星空",
  "model": "deepseekv4",
  "language": "auto"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | 是 | 用户描述，1-2000 字符 |
| `model` | enum | 否 | 模型选择：`deepseekv4` / `chatgpt5.5` / `gemini3.5`，默认 `deepseekv4` |
| `language` | enum | 否 | 代码类型：`auto` / `threejs`，默认 `auto` |

**成功响应 (200)：**
```json
{
  "success": true,
  "data": {
    "code": "import * as THREE from 'three';\n// @node:Scene=3D场景\n...",
    "language": "threejs",
    "nodes": [
      {
        "id": "node_1717000000000_0",
        "type": "Scene",
        "label": "3D场景",
        "params": { "backgroundColor": "#1a1a2e" },
        "position": { "x": 0, "y": 0 }
      }
    ],
    "edges": [
      { "id": "edge_0", "source": "node_1717000000000_0", "target": "node_1717000000000_1" }
    ]
  }
}
```

**错误响应 (400/500)：**
```json
{
  "success": false,
  "error": "参数错误: prompt 不能为空"
}
```

---

### 1.2 修复/调整代码 `POST /api/generate/fix`

根据错误信息自动修复代码，或根据用户指令调整代码。

**请求体：**
```json
{
  "code": "import * as THREE from 'three';\n...",
  "error": "Uncaught ReferenceError: cube is not defined",
  "language": "threejs",
  "model": "deepseekv4"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | 原始代码，1-50000 字符 |
| `error` | string | 是 | 错误信息或调整指令，1-10000 字符 |
| `language` | enum | 是 | 固定为 `threejs` |
| `model` | enum | 否 | 同 text 接口，默认 `deepseekv4` |

**调整模式判断：** 如果 `error` 字段包含"调整/修改/改成/变成/添加/删除"等中文关键词，后端使用创意修改模式；否则使用 bug 修复模式。

**成功响应 (200)：** 格式与 `/api/generate/text` 相同。

---

### 1.3 图片转代码 `POST /api/generate/image-to-code`

上传参考图片，AI 根据图片内容和文字指令生成代码。

**请求体：**
```json
{
  "image": "data:image/png;base64,iVBORw0KGgo...",
  "instruction": "参考这个配色方案生成几何动画",
  "model": "chatgpt5.5"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image` | string | 是 | Base64 Data URL，最大约 10MB |
| `instruction` | string | 是 | 生成指令，1-2000 字符 |
| `model` | enum | 否 | 同 text 接口，默认 `deepseekv4` |

**注意：** 图片识别需要模型支持 vision 能力。目前仅 `chatgpt5.5` 支持（DeepSeek V4 不支持）。

**成功响应 (200)：** 格式与 `/api/generate/text` 相同。

---

## 二、预览接口 `/api/preview`

### 2.1 保存预览 `POST /api/preview/save`

将生成的 JS 代码构建为完整 HTML 文件并保存到 `.live-preview/index.html`。

**请求体：**
```json
{
  "code": "import * as THREE from 'three';\n..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | JS 代码，1-100000 字符 |

**成功响应 (200)：**
```json
{
  "success": true,
  "path": ".live-preview/index.html"
}
```

**说明：** 后端自动包装为完整 HTML 页面，包含：
- Three.js 0.160（importmap CDN）
- GSAP 3.12（script 标签全局加载）
- p5.js 1.9（importmap）
- lil-gui 0.19（importmap）
- 错误捕获 + `__disposeCallbacks` 资源释放

---

## 三、健康检查 `GET /api/health`

**响应：**
```json
{
  "status": "ok",
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

---

## 四、AI 模型配置

### 4.1 模型列表

| 前端模型值 | 后端路由 | API 供应商 | 实际模型名 | 说明 |
|-----------|---------|-----------|-----------|------|
| `deepseekv4` | DeepSeek | api.deepseek.com | `deepseek-chat` | DeepSeek 官方 API |
| `chatgpt5.5` | aiyiwei | aiyiwei.vip | `gpt-5.5` | OpenAI 兼容接口 |
| `gemini3.5` | aiyiwei | aiyiwei.vip | `gemini-3.5-flash` | ⚠️ 当前该 API 无 Gemini 模型 |

### 4.2 供应商详情

#### DeepSeek（deepseekv4）
- **API 基础 URL：** `https://api.deepseek.com`
- **模型：** `deepseek-chat`
- **SDK：** OpenAI 兼容 SDK
- **环境变量：** `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`

#### aiyiwei（chatgpt5.5 / gemini3.5）
- **API 基础 URL：** `https://aiyiwei.vip/v1`
- **接口格式：** OpenAI 兼容 (`/v1/chat/completions`)
- **模型：** `gpt-5.5`（已测试可用）、`gemini-3.5-flash`（暂不可用）
- **SDK：** OpenAI 兼容 SDK
- **环境变量：** `AIYIWEI_API_KEY`, `AIYIWEI_BASE_URL`

---

## 五、环境变量

| 变量 | 必填 | 说明 | 示例值 |
|------|------|------|--------|
| `PORT` | 否 | 后端端口 | `3001` |
| `DEEPSEEK_API_KEY` | 是 | DeepSeek API 密钥 | `sk-xxx` |
| `DEEPSEEK_BASE_URL` | 否 | DeepSeek 基础 URL | `https://api.deepseek.com` |
| `AIYIWEI_API_KEY` | 是 | aiyiwei API 密钥 | `sk-xxx` |
| `AIYIWEI_BASE_URL` | 否 | aiyiwei 基础 URL | `https://aiyiwei.vip/v1` |
| `GEMINI_API_KEY` | 否 | Google Gemini API 密钥（备用） | `AIzaSy...` |

---

## 六、注释标记协议

AI 生成的代码必须包含以下注释标记：

```javascript
// @node:类型ID=节点名称          → 定义一个节点（名称用中文）
// @param:参数名=数值              → 参数（挂在最近的 @node 上）
// @color:描述=#色值              → 颜色参数
// @interaction:描述              → 交互方式描述
// @connect:源节点名称->目标节点名称 → 连线关系（用节点名称匹配）
```

---

## 七、数据流

```
前端 InputPanel
  → POST /api/generate/text { prompt, model }
  → 后端路由到对应 AI 服务（DeepSeek / aiyiwei）
  → AI 返回带 @node/@connect 注释的 JS 代码
  → parseAnnotations() 提取 nodes + edges
  → 响应返回 { code, nodes, edges }
  → 前端 filterRelevantNodes() 过滤
  → VerifierIframe 验证可运行
  → 成功 → 存入 history → PreviewWindow + NodeCanvas 显示
  → 失败 → 自动调用 /api/generate/fix 修复（最多 3 次）
```

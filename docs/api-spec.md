# API 接口规范

## 通用说明

- Base URL：`http://localhost:3001/api`
- 认证方式：`Authorization: Bearer <jwt_token>`（第 4 阶段后启用）
- 请求 Content-Type：`application/json`（文件上传除外）
- 响应格式：

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

---

## 1. AI 生成

### 1.1 文生代码

```
POST /api/generate/text
```

**请求：**
```json
{
  "prompt": "一个旋转的彩色立方体，背景是星空",
  "model": "deepseek",          // deepseek | gemini | gpt
  "language": "auto"            // auto | threejs | p5js
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "gen_xxx",
    "code": "// Three.js 完整代码...",
    "language": "threejs",
    "nodes": [
      {
        "id": "node_1",
        "type": "parameter",
        "label": "旋转速度",
        "params": { "speed": 0.01 },
        "position": { "x": 100, "y": 200 }
      }
    ],
    "creditsUsed": 10
  }
}
```

### 1.2 图生代码

```
POST /api/generate/image
Content-Type: multipart/form-data
```

**请求：** image (file) + model (string) + language (string, optional)

**响应：** 同文生代码

---

## 2. 代码解析

### 2.1 解析代码为节点

```
POST /api/parse/code
```

**请求：**
```json
{
  "code": "// Three.js 代码...",
  "language": "threejs"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "nodes": [...]
  }
}
```

---

## 3. 用户（第 4 阶段）

### 3.1 注册

```
POST /api/auth/register
```

**请求：** `{ "email": "...", "password": "...", "name": "..." }`

**响应：** `{ "token": "jwt...", "user": { "id": "...", "email": "..." } }`

### 3.2 登录

```
POST /api/auth/login
```

**请求：** `{ "email": "...", "password": "..." }`

**响应：** `{ "token": "jwt...", "user": { ... } }`

---

## 4. 项目（第 4 阶段）

### 4.1 项目列表

```
GET /api/projects?page=1&limit=20
```

### 4.2 项目详情

```
GET /api/projects/:id
```

### 4.3 创建项目

```
POST /api/projects
```

**请求：** `{ "name": "我的作品", "code": "...", "nodes": [...], "language": "threejs" }`

### 4.4 更新项目

```
PUT /api/projects/:id
```

### 4.5 删除项目

```
DELETE /api/projects/:id
```

---

## 5. 通用错误码

| HTTP Status | 含义 |
|-------------|------|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 未登录 |
| 403 | 积分不足 |
| 429 | 请求过于频繁 |
| 500 | 服务器错误 |

错误响应格式：

```json
{
  "success": false,
  "error": "积分不足，请充值",
  "code": "INSUFFICIENT_CREDITS"
}
```

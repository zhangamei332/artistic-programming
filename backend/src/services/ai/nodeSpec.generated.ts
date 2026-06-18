// Generated from node reference spec.
// Do not hand-edit parameter tables here; regenerate from the markdown spec.

export type SpecNodeFamily = 'SCENE' | 'SIGNAL' | 'GEOMETRY' | 'MATERIAL' | 'TEXTURE' | 'SVG' | 'PARTICLE' | 'P5_TEXTURE' | 'DATA' | 'AI';

export type ParamVisibility = 'public' | 'advanced' | 'locked' | 'hidden' | 'internal';

export type ParamRole = 'creative' | 'system' | 'performance' | 'debug' | 'layout' | 'material' | 'animation';

export type NodeVisibility = 'public' | 'advanced' | 'system' | 'hidden';

export type InspectorMode = 'normal' | 'advanced' | 'developer';

export interface SpecNodeParam {
  id: string;
  label: string;
  type: string;
  defaultValue: unknown;
  min?: number;
  max?: number;
  options?: string[];
  range?: string;
  description?: string;
  /** 参数暴露等级，默认 public */
  visibility?: ParamVisibility;
  /** AI 是否可修改此参数 */
  aiEditable?: boolean;
  /** 用户是否可在 Inspector 中编辑 */
  userEditable?: boolean;
  /** 语义分类，用于分组和过滤 */
  role?: ParamRole;
}

export interface SpecNodeDefinition {
  op: string;
  family: SpecNodeFamily;
  label: string;
  params: SpecNodeParam[];
  /** 节点在节点库中的可见性 */
  visibility?: NodeVisibility;
  /** 系统节点自动创建，不进入普通节点库 */
  system?: boolean;
  /** AI 是否可直接创建此节点 */
  aiCreatable?: boolean;
  /** 用户是否可删除此节点 */
  deletable?: boolean;
  /** 用户是否可在普通 Inspector 中编辑 */
  editable?: boolean;
}

export const SPEC_NODE_DEFINITIONS: Record<string, SpecNodeDefinition> = {
  "Scene": {
    "op": "Scene",
    "family": "SCENE",
    "label": "主场景并接收 O",
    "params": [
      {
        "id": "useFog",
        "label": "是否开启雾",
        "type": "boolean",
        "defaultValue": false,
        "description": "是否开启雾"
      },
      {
        "id": "fogColor",
        "label": "雾颜色",
        "type": "color",
        "defaultValue": "#000000",
        "description": "雾颜色"
      },
      {
        "id": "fogNear",
        "label": "雾起始距离",
        "type": "number",
        "defaultValue": 10,
        "range": "0–10000",
        "description": "雾起始距离"
      },
      {
        "id": "fogFar",
        "label": "雾结束距离",
        "type": "number",
        "defaultValue": 1000,
        "range": "1–100000",
        "description": "雾结束距离"
      },
      {
        "id": "backgroundMode",
        "label": "背景模式",
        "type": "select",
        "defaultValue": "color",
        "options": [
          "color",
          "texture",
          "transparent"
        ],
        "range": "`color`, `texture`, `transparent`",
        "description": "背景模式"
      }
    ]
  },
  "PerspectiveCamera": {
    "op": "PerspectiveCamera",
    "family": "SCENE",
    "label": "透视相机",
    "params": [
      {
        "id": "fov",
        "label": "视角",
        "type": "number",
        "defaultValue": 60,
        "range": "1–179",
        "description": "视角"
      },
      {
        "id": "near",
        "label": "近裁剪面",
        "type": "number",
        "defaultValue": 0.1,
        "range": "0.001–1000",
        "description": "近裁剪面"
      },
      {
        "id": "far",
        "label": "远裁剪面",
        "type": "number",
        "defaultValue": 3000,
        "range": "1–100000",
        "description": "远裁剪面"
      },
      {
        "id": "position",
        "label": "初始位置",
        "type": "vec3",
        "defaultValue": [
          0,
          2,
          10
        ],
        "description": "初始位置"
      },
      {
        "id": "rotation",
        "label": "初始旋转",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "description": "初始旋转"
      },
      {
        "id": "autoLookAt",
        "label": "是否自动朝向目标",
        "type": "boolean",
        "defaultValue": false,
        "description": "是否自动朝向目标"
      },
      {
        "id": "lookAtTarget",
        "label": "朝向点",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "description": "朝向点"
      }
    ]
  },
  "OrthographicCamera": {
    "op": "OrthographicCamera",
    "family": "SCENE",
    "label": "正交相机",
    "params": [
      {
        "id": "left",
        "label": "左边界",
        "type": "number",
        "defaultValue": -10,
        "range": "-10000–0",
        "description": "左边界"
      },
      {
        "id": "right",
        "label": "右边界",
        "type": "number",
        "defaultValue": 10,
        "range": "0–10000",
        "description": "右边界"
      },
      {
        "id": "top",
        "label": "上边界",
        "type": "number",
        "defaultValue": 10,
        "range": "0–10000",
        "description": "上边界"
      },
      {
        "id": "bottom",
        "label": "下边界",
        "type": "number",
        "defaultValue": -10,
        "range": "-10000–0",
        "description": "下边界"
      },
      {
        "id": "near",
        "label": "近裁剪面",
        "type": "number",
        "defaultValue": 0.1,
        "range": "0.001–1000",
        "description": "近裁剪面"
      },
      {
        "id": "far",
        "label": "远裁剪面",
        "type": "number",
        "defaultValue": 3000,
        "range": "1–100000",
        "description": "远裁剪面"
      },
      {
        "id": "zoom",
        "label": "缩放倍率",
        "type": "number",
        "defaultValue": 1,
        "range": "0.01–100",
        "description": "缩放倍率"
      }
    ]
  },
  "DirectionalLight": {
    "op": "DirectionalLight",
    "family": "SCENE",
    "label": "平行光",
    "params": [
      {
        "id": "color",
        "label": "颜色",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": "颜色"
      },
      {
        "id": "intensity",
        "label": "强度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–20",
        "description": "强度"
      },
      {
        "id": "position",
        "label": "位置",
        "type": "vec3",
        "defaultValue": [
          5,
          10,
          5
        ],
        "description": "位置"
      },
      {
        "id": "castShadow",
        "label": "是否投影",
        "type": "boolean",
        "defaultValue": true,
        "description": "是否投影"
      },
      {
        "id": "shadowMapSize",
        "label": "阴影贴图尺寸",
        "type": "number",
        "defaultValue": 2048,
        "range": "256–8192",
        "description": "阴影贴图尺寸"
      }
    ]
  },
  "AmbientLight": {
    "op": "AmbientLight",
    "family": "SCENE",
    "label": "环境光",
    "params": [
      {
        "id": "color",
        "label": "颜色",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": "颜色"
      },
      {
        "id": "intensity",
        "label": "强度",
        "type": "number",
        "defaultValue": 0.3,
        "range": "0–5",
        "description": "强度"
      }
    ]
  },
  "PointLight": {
    "op": "PointLight",
    "family": "SCENE",
    "label": "点光源",
    "params": [
      {
        "id": "color",
        "label": "颜色",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": "颜色"
      },
      {
        "id": "intensity",
        "label": "强度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–20",
        "description": "强度"
      },
      {
        "id": "distance",
        "label": "照射距离",
        "type": "number",
        "defaultValue": 0,
        "range": "0–100000",
        "description": "照射距离"
      },
      {
        "id": "decay",
        "label": "衰减",
        "type": "number",
        "defaultValue": 2,
        "range": "0–10",
        "description": "衰减"
      },
      {
        "id": "position",
        "label": "位置",
        "type": "vec3",
        "defaultValue": [
          0,
          5,
          0
        ],
        "description": "位置"
      },
      {
        "id": "castShadow",
        "label": "是否投影",
        "type": "boolean",
        "defaultValue": false,
        "description": "是否投影"
      }
    ]
  },
  "Group": {
    "op": "Group",
    "family": "SCENE",
    "label": "象分组",
    "params": [
      {
        "id": "position",
        "label": "组位置",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "组位置",
        "description": "组位置"
      },
      {
        "id": "rotation",
        "label": "组旋转",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "组旋转",
        "description": "组旋转"
      },
      {
        "id": "scale",
        "label": "组缩放",
        "type": "vec3",
        "defaultValue": [
          1,
          1,
          1
        ],
        "range": "组缩放",
        "description": "组缩放"
      }
    ]
  },
  "Render": {
    "op": "Render",
    "family": "SCENE",
    "label": "场景渲染出口",
    "params": [
      {
        "id": "rendererType",
        "label": "渲染器类型",
        "type": "select",
        "defaultValue": "webgl",
        "options": [
          "webgl",
          "webgpu",
          "auto"
        ],
        "range": "`webgl`, `webgpu`, `auto`",
        "description": "渲染器类型"
      },
      {
        "id": "antialias",
        "label": "抗锯齿",
        "type": "boolean",
        "defaultValue": true,
        "description": "抗锯齿"
      },
      {
        "id": "alpha",
        "label": "透明背景",
        "type": "boolean",
        "defaultValue": true,
        "description": "透明背景"
      },
      {
        "id": "pixelRatio",
        "label": "像素比",
        "type": "number",
        "defaultValue": 1,
        "range": "0.5–3",
        "description": "像素比"
      },
      {
        "id": "toneMapping",
        "label": "色调映射",
        "type": "select",
        "defaultValue": "ACESFilmic",
        "options": [
          "None",
          "Linear",
          "Reinhard",
          "ACESFilmic"
        ],
        "range": "`None`, `Linear`, `Reinhard`, `ACESFilmic`",
        "description": "色调映射"
      },
      {
        "id": "exposure",
        "label": "曝光",
        "type": "number",
        "defaultValue": 1,
        "range": "0–5",
        "description": "曝光"
      },
      {
        "id": "outputColorSpace",
        "label": "输出色彩空间",
        "type": "select",
        "defaultValue": "srgb",
        "options": [
          "srgb",
          "linear"
        ],
        "range": "`srgb`, `linear`",
        "description": "输出色彩空间"
      }
    ]
  },
  "Time": {
    "op": "Time",
    "family": "SIGNAL",
    "label": "时间与帧信息",
    "params": [
      {
        "id": "speed",
        "label": "时间倍率",
        "type": "number",
        "defaultValue": 1,
        "range": "-10–10",
        "description": "时间倍率"
      },
      {
        "id": "loop",
        "label": "是否循环",
        "type": "boolean",
        "defaultValue": false,
        "description": "是否循环"
      },
      {
        "id": "loopLength",
        "label": "循环时长",
        "type": "number",
        "defaultValue": 10,
        "range": "0.01–100000",
        "description": "循环时长"
      }
    ]
  },
  "Constant": {
    "op": "Constant",
    "family": "SIGNAL",
    "label": "常数",
    "params": [
      {
        "id": "value",
        "label": "常数值",
        "type": "number",
        "defaultValue": 0,
        "range": "-100000–100000",
        "description": "常数值"
      }
    ]
  },
  "BooleanConstant": {
    "op": "BooleanConstant",
    "family": "SIGNAL",
    "label": "布尔值",
    "params": [
      {
        "id": "value",
        "label": "布尔常量",
        "type": "boolean",
        "defaultValue": false,
        "range": "布尔常量",
        "description": "布尔常量"
      }
    ]
  },
  "LFO": {
    "op": "LFO",
    "family": "SIGNAL",
    "label": "生成周期波形",
    "params": [
      {
        "id": "waveform",
        "label": "波形",
        "type": "select",
        "defaultValue": "sine",
        "options": [
          "sine",
          "triangle",
          "square",
          "saw",
          "noise"
        ],
        "range": "`sine`, `triangle`, `square`, `saw`, `noise`",
        "description": "波形"
      },
      {
        "id": "frequency",
        "label": "频率",
        "type": "number",
        "defaultValue": 1,
        "range": "0–100",
        "description": "频率"
      },
      {
        "id": "amplitude",
        "label": "振幅",
        "type": "number",
        "defaultValue": 1,
        "range": "-100000–100000",
        "description": "振幅"
      },
      {
        "id": "offset",
        "label": "偏移",
        "type": "number",
        "defaultValue": 0,
        "range": "-100000–100000",
        "description": "偏移"
      },
      {
        "id": "phase",
        "label": "相位",
        "type": "number",
        "defaultValue": 0,
        "range": "0–6.28318",
        "description": "相位"
      }
    ]
  },
  "NoiseSignal": {
    "op": "NoiseSignal",
    "family": "SIGNAL",
    "label": "随时间变化的噪声",
    "params": [
      {
        "id": "scale",
        "label": "噪声尺度",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–1000",
        "description": "噪声尺度"
      },
      {
        "id": "speed",
        "label": "变化速度",
        "type": "number",
        "defaultValue": 1,
        "range": "-100–100",
        "description": "变化速度"
      },
      {
        "id": "amplitude",
        "label": "振幅",
        "type": "number",
        "defaultValue": 1,
        "range": "-100000–100000",
        "description": "振幅"
      },
      {
        "id": "offset",
        "label": "偏移",
        "type": "number",
        "defaultValue": 0,
        "range": "-100000–100000",
        "description": "偏移"
      },
      {
        "id": "seed",
        "label": "种子",
        "type": "number",
        "defaultValue": 1,
        "range": "0–999999",
        "description": "种子"
      }
    ]
  },
  "MouseInput": {
    "op": "MouseInput",
    "family": "SIGNAL",
    "label": "鼠标数据",
    "params": [
      {
        "id": "normalize",
        "label": "是否归一化到",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否归一化到 0~1 或 -1~1",
        "description": "是否归一化到 0~1 或 -1~1"
      },
      {
        "id": "centered",
        "label": "是否以画布中心为原点",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否以画布中心为原点",
        "description": "是否以画布中心为原点"
      },
      {
        "id": "clamp",
        "label": "是否限制在范围内",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否限制在范围内",
        "description": "是否限制在范围内"
      }
    ]
  },
  "KeyboardInput": {
    "op": "KeyboardInput",
    "family": "SIGNAL",
    "label": "按键状态",
    "params": [
      {
        "id": "key",
        "label": "监听键名",
        "type": "string",
        "defaultValue": "Space",
        "options": [
          "KeyW",
          "ShiftLeft",
          "Digit1"
        ],
        "range": "监听键名，如 `KeyW`, `ShiftLeft`, `Digit1`",
        "description": "监听键名，如 `KeyW`, `ShiftLeft`, `Digit1`"
      },
      {
        "id": "mode",
        "label": "模式",
        "type": "select",
        "defaultValue": "hold",
        "options": [
          "hold",
          "down",
          "up",
          "toggle"
        ],
        "range": "`hold`, `down`, `up`, `toggle`",
        "description": "`hold`, `down`, `up`, `toggle`"
      }
    ]
  },
  "Trigger": {
    "op": "Trigger",
    "family": "SIGNAL",
    "label": "事件触发器",
    "params": [
      {
        "id": "pulseDuration",
        "label": "脉冲持续时间",
        "type": "number",
        "defaultValue": 0.1,
        "range": "0.001–10",
        "description": "脉冲持续时间"
      }
    ]
  },
  "Toggle": {
    "op": "Toggle",
    "family": "SIGNAL",
    "label": "接收到事件后切换",
    "params": [
      {
        "id": "initialState",
        "label": "初始状态",
        "type": "boolean",
        "defaultValue": false,
        "range": "初始状态",
        "description": "初始状态"
      }
    ]
  },
  "Timer": {
    "op": "Timer",
    "family": "SIGNAL",
    "label": "生成 0~1 进",
    "params": [
      {
        "id": "duration",
        "label": "动画时长",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–100000",
        "description": "动画时长（秒）"
      },
      {
        "id": "loop",
        "label": "是否循环",
        "type": "boolean",
        "defaultValue": false,
        "description": "是否循环"
      },
      {
        "id": "autoStart",
        "label": "启动即运行",
        "type": "boolean",
        "defaultValue": false,
        "description": "启动即运行"
      }
    ]
  },
  "Lerp": {
    "op": "Lerp",
    "family": "SIGNAL",
    "label": "线性插值",
    "params": []
  },
  "Damp": {
    "op": "Damp",
    "family": "SIGNAL",
    "label": "阻尼缓动",
    "params": [
      {
        "id": "initialValue",
        "label": "初始值",
        "type": "number",
        "defaultValue": 0,
        "range": "-100000–100000",
        "description": "初始值"
      },
      {
        "id": "lambda",
        "label": "阻尼系数",
        "type": "number",
        "defaultValue": 8,
        "range": "0.001–100",
        "description": "阻尼系数"
      }
    ]
  },
  "MapRange": {
    "op": "MapRange",
    "family": "SIGNAL",
    "label": "数值映射",
    "params": [
      {
        "id": "inMin",
        "label": "输入最小值",
        "type": "number",
        "defaultValue": 0,
        "range": "-100000–100000",
        "description": "输入最小值"
      },
      {
        "id": "inMax",
        "label": "输入最大值",
        "type": "number",
        "defaultValue": 1,
        "range": "-100000–100000",
        "description": "输入最大值"
      },
      {
        "id": "outMin",
        "label": "输出最小值",
        "type": "number",
        "defaultValue": 0,
        "range": "-100000–100000",
        "description": "输出最小值"
      },
      {
        "id": "outMax",
        "label": "输出最大值",
        "type": "number",
        "defaultValue": 1,
        "range": "-100000–100000",
        "description": "输出最大值"
      },
      {
        "id": "clamp",
        "label": "是否截断",
        "type": "boolean",
        "defaultValue": true,
        "description": "是否截断"
      }
    ]
  },
  "Clamp": {
    "op": "Clamp",
    "family": "SIGNAL",
    "label": "限制数值范围",
    "params": [
      {
        "id": "min",
        "label": "min",
        "type": "number",
        "defaultValue": 0,
        "range": "-100000–100000",
        "description": "-100000–100000"
      },
      {
        "id": "max",
        "label": "max",
        "type": "number",
        "defaultValue": 1,
        "range": "-100000–100000",
        "description": "-100000–100000"
      }
    ]
  },
  "Easing": {
    "op": "Easing",
    "family": "SIGNAL",
    "label": "0~1 进度进行",
    "params": [
      {
        "id": "mode",
        "label": "模式",
        "type": "select",
        "defaultValue": "easeInOutCubic",
        "options": [
          "linear",
          "easeInSine",
          "easeOutSine",
          "easeInOutSine",
          "easeInCubic",
          "easeOutCubic",
          "easeInOutCubic",
          "easeInExpo",
          "easeOutExpo",
          "easeInOutExpo"
        ],
        "range": "`linear`, `easeInSine`, `easeOutSine`, `easeInOutSine`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInExpo`, `easeOutExpo`, `easeInOutExpo`",
        "description": "`linear`, `easeInSine`, `easeOutSine`, `easeInOutSine`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInExpo`, `easeOutExpo`, `easeInOutExpo`"
      }
    ]
  },
  "Sequence": {
    "op": "Sequence",
    "family": "SIGNAL",
    "label": "多阶段时间顺序控",
    "params": [
      {
        "id": "durations",
        "label": "各阶段时长",
        "type": "string",
        "defaultValue": "1,1,1",
        "range": "各阶段时长，逗号分隔",
        "description": "各阶段时长，逗号分隔"
      },
      {
        "id": "loop",
        "label": "是否循环",
        "type": "boolean",
        "defaultValue": false,
        "range": "是否循环",
        "description": "是否循环"
      }
    ]
  },
  "StateMachine": {
    "op": "StateMachine",
    "family": "SIGNAL",
    "label": "状态机管理",
    "params": [
      {
        "id": "states",
        "label": "状态列表",
        "type": "string",
        "defaultValue": "idle,active",
        "range": "状态列表",
        "description": "状态列表"
      },
      {
        "id": "initialState",
        "label": "初始状态",
        "type": "string",
        "defaultValue": "idle",
        "range": "初始状态",
        "description": "初始状态"
      },
      {
        "id": "transitionMode",
        "label": "transitionMode",
        "type": "select",
        "defaultValue": "cycle",
        "options": [
          "cycle",
          "explicit"
        ],
        "range": "`cycle`, `explicit`",
        "description": "`cycle`, `explicit`"
      }
    ]
  },
  "BoxGeometry": {
    "op": "BoxGeometry",
    "family": "GEOMETRY",
    "label": "几何节点",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–10000",
        "description": "0.001–10000"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–10000",
        "description": "0.001–10000"
      },
      {
        "id": "depth",
        "label": "深度",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–10000",
        "description": "0.001–10000"
      },
      {
        "id": "widthSegments",
        "label": "widthSegments",
        "type": "number",
        "defaultValue": 1,
        "range": "1–256",
        "description": "1–256"
      },
      {
        "id": "heightSegments",
        "label": "heightSegments",
        "type": "number",
        "defaultValue": 1,
        "range": "1–256",
        "description": "1–256"
      },
      {
        "id": "depthSegments",
        "label": "depthSegments",
        "type": "number",
        "defaultValue": 1,
        "range": "1–256",
        "description": "1–256"
      }
    ]
  },
  "SphereGeometry": {
    "op": "SphereGeometry",
    "family": "GEOMETRY",
    "label": "几何节点",
    "params": [
      {
        "id": "radius",
        "label": "半径",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–10000",
        "description": "0.001–10000"
      },
      {
        "id": "widthSegments",
        "label": "widthSegments",
        "type": "number",
        "defaultValue": 32,
        "range": "3–512",
        "description": "3–512"
      },
      {
        "id": "heightSegments",
        "label": "heightSegments",
        "type": "number",
        "defaultValue": 16,
        "range": "2–512",
        "description": "2–512"
      },
      {
        "id": "phiStart",
        "label": "phiStart",
        "type": "number",
        "defaultValue": 0,
        "range": "0–6.28318",
        "description": "0–6.28318"
      },
      {
        "id": "phiLength",
        "label": "phiLength",
        "type": "number",
        "defaultValue": 6.28318,
        "range": "0–6.28318",
        "description": "0–6.28318"
      },
      {
        "id": "thetaStart",
        "label": "thetaStart",
        "type": "number",
        "defaultValue": 0,
        "range": "0–3.14159",
        "description": "0–3.14159"
      },
      {
        "id": "thetaLength",
        "label": "thetaLength",
        "type": "number",
        "defaultValue": 3.14159,
        "range": "0–3.14159",
        "description": "0–3.14159"
      }
    ]
  },
  "PlaneGeometry": {
    "op": "PlaneGeometry",
    "family": "GEOMETRY",
    "label": "几何节点",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–10000",
        "description": "0.001–10000"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–10000",
        "description": "0.001–10000"
      },
      {
        "id": "widthSegments",
        "label": "widthSegments",
        "type": "number",
        "defaultValue": 1,
        "range": "1–512",
        "description": "1–512"
      },
      {
        "id": "heightSegments",
        "label": "heightSegments",
        "type": "number",
        "defaultValue": 1,
        "range": "1–512",
        "description": "1–512"
      }
    ]
  },
  "GridGeometry": {
    "op": "GridGeometry",
    "family": "GEOMETRY",
    "label": "规则网格点或面",
    "params": [
      {
        "id": "rows",
        "label": "rows",
        "type": "number",
        "defaultValue": 10,
        "range": "1–1000",
        "description": "1–1000"
      },
      {
        "id": "cols",
        "label": "cols",
        "type": "number",
        "defaultValue": 10,
        "range": "1–1000",
        "description": "1–1000"
      },
      {
        "id": "spacingX",
        "label": "spacingX",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–10000",
        "description": "0.001–10000"
      },
      {
        "id": "spacingY",
        "label": "spacingY",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–10000",
        "description": "0.001–10000"
      },
      {
        "id": "centered",
        "label": "居中",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      }
    ]
  },
  "FileGeometry": {
    "op": "FileGeometry",
    "family": "GEOMETRY",
    "label": "导入 OBJ /",
    "params": [
      {
        "id": "fileType",
        "label": "fileType",
        "type": "select",
        "defaultValue": "glb",
        "options": [
          "obj",
          "gltf",
          "glb"
        ],
        "range": "`obj`, `gltf`, `glb`",
        "description": "`obj`, `gltf`, `glb`"
      },
      {
        "id": "url",
        "label": "文件地址",
        "type": "string",
        "defaultValue": "",
        "range": "文件地址",
        "description": "文件地址"
      },
      {
        "id": "center",
        "label": "自动居中",
        "type": "boolean",
        "defaultValue": true,
        "range": "自动居中",
        "description": "自动居中"
      },
      {
        "id": "scale",
        "label": "初始缩放",
        "type": "vec3",
        "defaultValue": [
          1,
          1,
          1
        ],
        "range": "初始缩放",
        "description": "初始缩放"
      },
      {
        "id": "position",
        "label": "初始位置",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "初始位置",
        "description": "初始位置"
      },
      {
        "id": "rotation",
        "label": "初始旋转",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "初始旋转",
        "description": "初始旋转"
      }
    ]
  },
  "TransformGeometry": {
    "op": "TransformGeometry",
    "family": "GEOMETRY",
    "label": "几何做变换",
    "params": [
      {
        "id": "position",
        "label": "平移",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "平移",
        "description": "平移"
      },
      {
        "id": "rotation",
        "label": "旋转",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "旋转（弧度）",
        "description": "旋转（弧度）"
      },
      {
        "id": "scale",
        "label": "缩放",
        "type": "vec3",
        "defaultValue": [
          1,
          1,
          1
        ],
        "range": "缩放",
        "description": "缩放"
      }
    ]
  },
  "MergeGeometry": {
    "op": "MergeGeometry",
    "family": "GEOMETRY",
    "label": "几何节点",
    "params": []
  },
  "Mesh": {
    "op": "Mesh",
    "family": "GEOMETRY",
    "label": "将几何与材质组合",
    "params": [
      {
        "id": "position",
        "label": "物体位置",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "物体位置",
        "description": "物体位置"
      },
      {
        "id": "rotation",
        "label": "物体旋转",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "物体旋转",
        "description": "物体旋转"
      },
      {
        "id": "scale",
        "label": "物体缩放",
        "type": "vec3",
        "defaultValue": [
          1,
          1,
          1
        ],
        "range": "物体缩放",
        "description": "物体缩放"
      },
      {
        "id": "castShadow",
        "label": "是否投影",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否投影",
        "description": "是否投影"
      },
      {
        "id": "receiveShadow",
        "label": "是否接收投影",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否接收投影",
        "description": "是否接收投影"
      },
      {
        "id": "visible",
        "label": "是否可见",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否可见",
        "description": "是否可见"
      }
    ]
  },
  "LineObject": {
    "op": "LineObject",
    "family": "GEOMETRY",
    "label": "线对象",
    "params": [
      {
        "id": "position",
        "label": "位置",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "description": ""
      },
      {
        "id": "rotation",
        "label": "旋转",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "description": ""
      },
      {
        "id": "scale",
        "label": "缩放",
        "type": "vec3",
        "defaultValue": [
          1,
          1,
          1
        ],
        "description": ""
      },
      {
        "id": "visible",
        "label": "可见",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      }
    ]
  },
  "PointsObject": {
    "op": "PointsObject",
    "family": "GEOMETRY",
    "label": "点对象",
    "params": [
      {
        "id": "position",
        "label": "位置",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "description": ""
      },
      {
        "id": "rotation",
        "label": "旋转",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "description": ""
      },
      {
        "id": "scale",
        "label": "缩放",
        "type": "vec3",
        "defaultValue": [
          1,
          1,
          1
        ],
        "description": ""
      },
      {
        "id": "visible",
        "label": "可见",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      }
    ]
  },
  "InstanceMesh": {
    "op": "InstanceMesh",
    "family": "GEOMETRY",
    "label": "实例化网格",
    "params": [
      {
        "id": "count",
        "label": "数量",
        "type": "number",
        "defaultValue": 100,
        "range": "1–1000000",
        "description": "1–1000000"
      },
      {
        "id": "layoutMode",
        "label": "layoutMode",
        "type": "select",
        "defaultValue": "grid",
        "options": [
          "grid",
          "line",
          "circle",
          "custom"
        ],
        "range": "`grid`, `line`, `circle`, `custom`",
        "description": "`grid`, `line`, `circle`, `custom`"
      },
      {
        "id": "spacing",
        "label": "间距",
        "type": "vec3",
        "defaultValue": [
          1,
          1,
          1
        ],
        "range": "间距",
        "description": "间距"
      },
      {
        "id": "gridCols",
        "label": "gridCols",
        "type": "number",
        "defaultValue": 10,
        "range": "1–10000",
        "description": "1–10000"
      },
      {
        "id": "radius",
        "label": "半径",
        "type": "number",
        "defaultValue": 5,
        "range": "0.001–100000",
        "description": "0.001–100000"
      },
      {
        "id": "randomOffset",
        "label": "随机偏移范围",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "随机偏移范围",
        "description": "随机偏移范围"
      }
    ]
  },
  "BasicMaterial": {
    "op": "BasicMaterial",
    "family": "MATERIAL",
    "label": "材质节点",
    "params": [
      {
        "id": "color",
        "label": "基础颜色",
        "type": "color",
        "defaultValue": "#ffffff",
        "range": "基础颜色",
        "description": "基础颜色"
      },
      {
        "id": "wireframe",
        "label": "线框",
        "type": "boolean",
        "defaultValue": false,
        "range": "线框",
        "description": "线框"
      },
      {
        "id": "transparent",
        "label": "透明",
        "type": "boolean",
        "defaultValue": false,
        "range": "透明",
        "description": "透明"
      },
      {
        "id": "opacity",
        "label": "透明度",
        "type": "number",
        "defaultValue": 1,
        "range": "透明度",
        "description": "透明度"
      },
      {
        "id": "side",
        "label": "渲染面",
        "type": "select",
        "defaultValue": "front",
        "options": [
          "front",
          "back",
          "double"
        ],
        "range": "`front`, `back`, `double`",
        "description": "`front`, `back`, `double`"
      }
    ]
  },
  "StandardMaterial": {
    "op": "StandardMaterial",
    "family": "MATERIAL",
    "label": "材质节点",
    "params": [
      {
        "id": "color",
        "label": "颜色",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": ""
      },
      {
        "id": "roughness",
        "label": "粗糙度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "metalness",
        "label": "金属度",
        "type": "number",
        "defaultValue": 0,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "displacementScale",
        "label": "displacementScale",
        "type": "number",
        "defaultValue": 0,
        "range": "-1000–1000",
        "description": "-1000–1000"
      },
      {
        "id": "transparent",
        "label": "透明",
        "type": "boolean",
        "defaultValue": false,
        "description": ""
      },
      {
        "id": "opacity",
        "label": "透明度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "side",
        "label": "渲染面",
        "type": "select",
        "defaultValue": "front",
        "options": [
          "front",
          "back",
          "double"
        ],
        "range": "`front`, `back`, `double`",
        "description": "`front`, `back`, `double`"
      }
    ]
  },
  "PhysicalMaterial": {
    "op": "PhysicalMaterial",
    "family": "MATERIAL",
    "label": "材质节点",
    "params": [
      {
        "id": "color",
        "label": "颜色",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": ""
      },
      {
        "id": "roughness",
        "label": "粗糙度",
        "type": "number",
        "defaultValue": 0.5,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "metalness",
        "label": "金属度",
        "type": "number",
        "defaultValue": 0,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "transmission",
        "label": "transmission",
        "type": "number",
        "defaultValue": 0,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "thickness",
        "label": "thickness",
        "type": "number",
        "defaultValue": 0.5,
        "range": "0–10",
        "description": "0–10"
      },
      {
        "id": "clearcoat",
        "label": "clearcoat",
        "type": "number",
        "defaultValue": 0,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "transparent",
        "label": "透明",
        "type": "boolean",
        "defaultValue": false,
        "description": ""
      },
      {
        "id": "opacity",
        "label": "透明度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–1",
        "description": "0–1"
      }
    ]
  },
  "ShaderMaterial": {
    "op": "ShaderMaterial",
    "family": "MATERIAL",
    "label": "材质节点",
    "params": [
      {
        "id": "vertexShader",
        "label": "顶点着色器源码",
        "type": "string",
        "defaultValue": "",
        "range": "顶点着色器源码",
        "description": "顶点着色器源码"
      },
      {
        "id": "fragmentShader",
        "label": "片元着色器源码",
        "type": "string",
        "defaultValue": "",
        "range": "片元着色器源码",
        "description": "片元着色器源码"
      },
      {
        "id": "transparent",
        "label": "是否透明",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否透明",
        "description": "是否透明"
      },
      {
        "id": "wireframe",
        "label": "线框",
        "type": "boolean",
        "defaultValue": false,
        "range": "线框",
        "description": "线框"
      },
      {
        "id": "depthWrite",
        "label": "深度写入",
        "type": "boolean",
        "defaultValue": true,
        "range": "深度写入",
        "description": "深度写入"
      },
      {
        "id": "blending",
        "label": "blending",
        "type": "select",
        "defaultValue": "normal",
        "options": [
          "normal",
          "additive",
          "subtractive",
          "multiply"
        ],
        "range": "`normal`, `additive`, `subtractive`, `multiply`",
        "description": "`normal`, `additive`, `subtractive`, `multiply`"
      }
    ]
  },
  "LineMaterial": {
    "op": "LineMaterial",
    "family": "MATERIAL",
    "label": "材质节点",
    "params": [
      {
        "id": "color",
        "label": "颜色",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": ""
      },
      {
        "id": "linewidth",
        "label": "linewidth",
        "type": "number",
        "defaultValue": 1,
        "range": "0.1–100",
        "description": "0.1–100"
      },
      {
        "id": "transparent",
        "label": "透明",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      },
      {
        "id": "opacity",
        "label": "透明度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "dashed",
        "label": "dashed",
        "type": "boolean",
        "defaultValue": false,
        "description": ""
      },
      {
        "id": "dashSize",
        "label": "dashSize",
        "type": "number",
        "defaultValue": 1,
        "range": "0–1000",
        "description": "0–1000"
      },
      {
        "id": "gapSize",
        "label": "gapSize",
        "type": "number",
        "defaultValue": 1,
        "range": "0–1000",
        "description": "0–1000"
      }
    ]
  },
  "PointMaterial": {
    "op": "PointMaterial",
    "family": "MATERIAL",
    "label": "材质节点",
    "params": [
      {
        "id": "color",
        "label": "颜色",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": ""
      },
      {
        "id": "size",
        "label": "尺寸",
        "type": "number",
        "defaultValue": 10,
        "range": "0.001–1000",
        "description": "0.001–1000"
      },
      {
        "id": "sizeAttenuation",
        "label": "sizeAttenuation",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      },
      {
        "id": "transparent",
        "label": "透明",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      },
      {
        "id": "opacity",
        "label": "透明度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "alphaTest",
        "label": "alphaTest",
        "type": "number",
        "defaultValue": 0,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "blending",
        "label": "blending",
        "type": "select",
        "defaultValue": "normal",
        "options": [
          "normal",
          "additive",
          "subtractive",
          "multiply"
        ],
        "range": "`normal`, `additive`, `subtractive`, `multiply`",
        "description": "`normal`, `additive`, `subtractive`, `multiply`"
      }
    ]
  },
  "GlowMaterial": {
    "op": "GlowMaterial",
    "family": "MATERIAL",
    "label": "为发光表现做预设",
    "params": [
      {
        "id": "color",
        "label": "颜色",
        "type": "color",
        "defaultValue": "#00ffff",
        "description": ""
      },
      {
        "id": "intensity",
        "label": "强度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–50",
        "description": "0–50"
      },
      {
        "id": "falloff",
        "label": "falloff",
        "type": "number",
        "defaultValue": 2,
        "range": "0.01–20",
        "description": "0.01–20"
      },
      {
        "id": "transparent",
        "label": "透明",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      },
      {
        "id": "opacity",
        "label": "透明度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–1",
        "description": "0–1"
      }
    ]
  },
  "ImageTexture": {
    "op": "ImageTexture",
    "family": "TEXTURE",
    "label": "纹理节点",
    "params": [
      {
        "id": "url",
        "label": "图片地址",
        "type": "string",
        "defaultValue": "",
        "range": "图片地址",
        "description": "图片地址"
      },
      {
        "id": "flipY",
        "label": "是否翻转",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否翻转 Y",
        "description": "是否翻转 Y"
      },
      {
        "id": "repeat",
        "label": "纹理重复",
        "type": "vec2",
        "defaultValue": [
          1,
          1
        ],
        "range": "纹理重复",
        "description": "纹理重复"
      },
      {
        "id": "offset",
        "label": "偏移",
        "type": "vec2",
        "defaultValue": [
          0,
          0
        ],
        "range": "偏移",
        "description": "偏移"
      },
      {
        "id": "rotation",
        "label": "旋转",
        "type": "number",
        "defaultValue": 0,
        "range": "旋转",
        "description": "旋转"
      }
    ]
  },
  "VideoTexture": {
    "op": "VideoTexture",
    "family": "TEXTURE",
    "label": "纹理节点",
    "params": [
      {
        "id": "url",
        "label": "视频地址",
        "type": "string",
        "defaultValue": "",
        "range": "视频地址",
        "description": "视频地址"
      },
      {
        "id": "autoplay",
        "label": "自动播放",
        "type": "boolean",
        "defaultValue": true,
        "range": "自动播放",
        "description": "自动播放"
      },
      {
        "id": "loop",
        "label": "循环",
        "type": "boolean",
        "defaultValue": true,
        "range": "循环",
        "description": "循环"
      },
      {
        "id": "muted",
        "label": "静音",
        "type": "boolean",
        "defaultValue": true,
        "range": "静音",
        "description": "静音"
      },
      {
        "id": "playsInline",
        "label": "行内播放",
        "type": "boolean",
        "defaultValue": true,
        "range": "行内播放",
        "description": "行内播放"
      },
      {
        "id": "playbackRate",
        "label": "播放倍率",
        "type": "number",
        "defaultValue": 1,
        "range": "播放倍率",
        "description": "播放倍率"
      }
    ]
  },
  "CanvasTextureNode": {
    "op": "CanvasTextureNode",
    "family": "TEXTURE",
    "label": "接收 canva",
    "params": [
      {
        "id": "autoUpdate",
        "label": "每帧更新",
        "type": "boolean",
        "defaultValue": true,
        "range": "每帧更新",
        "description": "每帧更新"
      },
      {
        "id": "flipY",
        "label": "翻转",
        "type": "boolean",
        "defaultValue": false,
        "range": "翻转 Y",
        "description": "翻转 Y"
      }
    ]
  },
  "NoiseTexture": {
    "op": "NoiseTexture",
    "family": "TEXTURE",
    "label": "生成程序噪声纹理",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "scale",
        "label": "缩放",
        "type": "number",
        "defaultValue": 8,
        "range": "0.001–1000",
        "description": "0.001–1000"
      },
      {
        "id": "speed",
        "label": "速度",
        "type": "number",
        "defaultValue": 0.25,
        "range": "-100–100",
        "description": "-100–100"
      },
      {
        "id": "seed",
        "label": "种子",
        "type": "number",
        "defaultValue": 1,
        "range": "0–999999",
        "description": "0–999999"
      },
      {
        "id": "grayscale",
        "label": "grayscale",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      },
      {
        "id": "contrast",
        "label": "contrast",
        "type": "number",
        "defaultValue": 1,
        "range": "0–10",
        "description": "0–10"
      }
    ]
  },
  "RampTexture": {
    "op": "RampTexture",
    "family": "TEXTURE",
    "label": "纹理节点",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "colorA",
        "label": "起始色",
        "type": "color",
        "defaultValue": "#000000",
        "range": "起始色",
        "description": "起始色"
      },
      {
        "id": "colorB",
        "label": "结束色",
        "type": "color",
        "defaultValue": "#ffffff",
        "range": "结束色",
        "description": "结束色"
      },
      {
        "id": "direction",
        "label": "direction",
        "type": "select",
        "defaultValue": "horizontal",
        "options": [
          "horizontal",
          "vertical",
          "radial"
        ],
        "range": "`horizontal`, `vertical`, `radial`",
        "description": "`horizontal`, `vertical`, `radial`"
      }
    ]
  },
  "FeedbackTexture": {
    "op": "FeedbackTexture",
    "family": "TEXTURE",
    "label": "反馈/拖影纹理",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "decay",
        "label": "衰减",
        "type": "number",
        "defaultValue": 0.95,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "mixAmount",
        "label": "mixAmount",
        "type": "number",
        "defaultValue": 0.5,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "offset",
        "label": "反馈偏移",
        "type": "vec2",
        "defaultValue": [
          0,
          0
        ],
        "range": "反馈偏移",
        "description": "反馈偏移"
      },
      {
        "id": "blurAmount",
        "label": "blurAmount",
        "type": "number",
        "defaultValue": 0,
        "range": "0–100",
        "description": "0–100"
      }
    ]
  },
  "TransformTexture": {
    "op": "TransformTexture",
    "family": "TEXTURE",
    "label": "纹理节点",
    "params": [
      {
        "id": "repeat",
        "label": "repeat",
        "type": "vec2",
        "defaultValue": [
          1,
          1
        ],
        "description": ""
      },
      {
        "id": "offset",
        "label": "偏移",
        "type": "vec2",
        "defaultValue": [
          0,
          0
        ],
        "description": ""
      },
      {
        "id": "rotation",
        "label": "旋转",
        "type": "number",
        "defaultValue": 0,
        "description": ""
      }
    ]
  },
  "CompositeTexture": {
    "op": "CompositeTexture",
    "family": "TEXTURE",
    "label": "纹理节点",
    "params": [
      {
        "id": "mode",
        "label": "模式",
        "type": "select",
        "defaultValue": "normal",
        "options": [
          "normal",
          "add",
          "multiply",
          "screen",
          "overlay",
          "difference"
        ],
        "range": "`normal`, `add`, `multiply`, `screen`, `overlay`, `difference`",
        "description": "`normal`, `add`, `multiply`, `screen`, `overlay`, `difference`"
      },
      {
        "id": "opacity",
        "label": "透明度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–1",
        "description": "0–1"
      }
    ]
  },
  "RenderTargetTexture": {
    "op": "RenderTargetTexture",
    "family": "TEXTURE",
    "label": "将场景渲染到离屏",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "useDepth",
        "label": "useDepth",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      },
      {
        "id": "samples",
        "label": "samples",
        "type": "number",
        "defaultValue": 0,
        "range": "0–8",
        "description": "0–8"
      }
    ]
  },
  "SVGLoaderNode": {
    "op": "SVGLoaderNode",
    "family": "SVG",
    "label": "SVG节点",
    "params": [
      {
        "id": "url",
        "label": "文件地址",
        "type": "string",
        "defaultValue": "",
        "range": "SVG 文件地址",
        "description": "SVG 文件地址"
      },
      {
        "id": "flipY",
        "label": "坐标翻转",
        "type": "boolean",
        "defaultValue": true,
        "range": "坐标翻转",
        "description": "坐标翻转"
      },
      {
        "id": "center",
        "label": "居中处理",
        "type": "boolean",
        "defaultValue": true,
        "range": "居中处理",
        "description": "居中处理"
      },
      {
        "id": "scale",
        "label": "整体缩放",
        "type": "number",
        "defaultValue": 1,
        "range": "整体缩放",
        "description": "整体缩放"
      }
    ]
  },
  "SVGPathNode": {
    "op": "SVGPathNode",
    "family": "SVG",
    "label": "SVG节点",
    "params": [
      {
        "id": "pathIndex",
        "label": "选择第几个",
        "type": "number",
        "defaultValue": 0,
        "range": "选择第几个 path，-1 表示全部",
        "description": "选择第几个 path，-1 表示全部"
      },
      {
        "id": "includeHoles",
        "label": "是否保留孔洞",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否保留孔洞",
        "description": "是否保留孔洞"
      }
    ]
  },
  "SVGShapeGeometry": {
    "op": "SVGShapeGeometry",
    "family": "SVG",
    "label": "SVG节点",
    "params": [
      {
        "id": "pathIndex",
        "label": "pathIndex",
        "type": "number",
        "defaultValue": -1,
        "range": "-1 表示全部",
        "description": "-1 表示全部"
      },
      {
        "id": "curveSegments",
        "label": "curveSegments",
        "type": "number",
        "defaultValue": 12,
        "range": "1–256",
        "description": "1–256"
      },
      {
        "id": "fillRule",
        "label": "fillRule",
        "type": "select",
        "defaultValue": "nonzero",
        "options": [
          "nonzero",
          "evenodd"
        ],
        "range": "`nonzero`, `evenodd`",
        "description": "`nonzero`, `evenodd`"
      }
    ]
  },
  "SVGExtrudeGeometry": {
    "op": "SVGExtrudeGeometry",
    "family": "SVG",
    "label": "SVG节点",
    "params": [
      {
        "id": "pathIndex",
        "label": "pathIndex",
        "type": "number",
        "defaultValue": -1,
        "range": "-1=全部",
        "description": "-1=全部"
      },
      {
        "id": "depth",
        "label": "深度",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–10000",
        "description": "0.001–10000"
      },
      {
        "id": "bevelEnabled",
        "label": "bevelEnabled",
        "type": "boolean",
        "defaultValue": false,
        "description": ""
      },
      {
        "id": "bevelThickness",
        "label": "bevelThickness",
        "type": "number",
        "defaultValue": 0.1,
        "range": "0–1000",
        "description": "0–1000"
      },
      {
        "id": "bevelSize",
        "label": "bevelSize",
        "type": "number",
        "defaultValue": 0.1,
        "range": "0–1000",
        "description": "0–1000"
      },
      {
        "id": "curveSegments",
        "label": "curveSegments",
        "type": "number",
        "defaultValue": 12,
        "range": "1–256",
        "description": "1–256"
      }
    ]
  },
  "SVGStrokeLines": {
    "op": "SVGStrokeLines",
    "family": "SVG",
    "label": "将 SVG 描边",
    "params": [
      {
        "id": "pathIndex",
        "label": "选择路径",
        "type": "number",
        "defaultValue": -1,
        "range": "选择路径",
        "description": "选择路径"
      },
      {
        "id": "sampleCount",
        "label": "每条路径采样数",
        "type": "number",
        "defaultValue": 200,
        "range": "每条路径采样数",
        "description": "每条路径采样数"
      },
      {
        "id": "closeLoop",
        "label": "是否闭合",
        "type": "boolean",
        "defaultValue": false,
        "range": "是否闭合",
        "description": "是否闭合"
      },
      {
        "id": "mergePaths",
        "label": "是否合并为一个几何",
        "type": "boolean",
        "defaultValue": true,
        "range": "是否合并为一个几何",
        "description": "是否合并为一个几何"
      }
    ]
  },
  "SVGPathGrowth": {
    "op": "SVGPathGrowth",
    "family": "SVG",
    "label": "路径生长动画几何",
    "params": [
      {
        "id": "pathIndex",
        "label": "选择路径",
        "type": "number",
        "defaultValue": -1,
        "description": "选择路径"
      },
      {
        "id": "mode",
        "label": "生长方式",
        "type": "select",
        "defaultValue": "headToTail",
        "options": [
          "headToTail",
          "centerOut",
          "tailToHead",
          "segment"
        ],
        "range": "`headToTail`, `centerOut`, `tailToHead`, `segment`",
        "description": "生长方式"
      },
      {
        "id": "sampleCount",
        "label": "采样数",
        "type": "number",
        "defaultValue": 300,
        "range": "2–5000",
        "description": "采样数"
      },
      {
        "id": "segmentLength",
        "label": "当",
        "type": "number",
        "defaultValue": 0.2,
        "range": "0–1",
        "description": "当 mode=segment 时的显示长度"
      },
      {
        "id": "fadeTail",
        "label": "是否尾部渐隐",
        "type": "boolean",
        "defaultValue": false,
        "description": "是否尾部渐隐"
      }
    ]
  },
  "SVGRegionFill": {
    "op": "SVGRegionFill",
    "family": "SVG",
    "label": "将 SVG 区域",
    "params": [
      {
        "id": "pathIndex",
        "label": "选择区域",
        "type": "number",
        "defaultValue": -1,
        "range": "选择区域",
        "description": "选择区域"
      },
      {
        "id": "separateMeshes",
        "label": "是否拆分每个",
        "type": "boolean",
        "defaultValue": false,
        "range": "是否拆分每个 path",
        "description": "是否拆分每个 path"
      },
      {
        "id": "position",
        "label": "位置",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "位置",
        "description": "位置"
      },
      {
        "id": "rotation",
        "label": "旋转",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "旋转",
        "description": "旋转"
      },
      {
        "id": "scale",
        "label": "缩放",
        "type": "vec3",
        "defaultValue": [
          1,
          1,
          1
        ],
        "range": "缩放",
        "description": "缩放"
      }
    ]
  },
  "SVGPointSampler": {
    "op": "SVGPointSampler",
    "family": "SVG",
    "label": "沿 SVG 路径",
    "params": [
      {
        "id": "pathIndex",
        "label": "pathIndex",
        "type": "number",
        "defaultValue": -1,
        "description": ""
      },
      {
        "id": "sampleCount",
        "label": "sampleCount",
        "type": "number",
        "defaultValue": 1000,
        "range": "1–1000000",
        "description": "1–1000000"
      },
      {
        "id": "mode",
        "label": "模式",
        "type": "select",
        "defaultValue": "uniform",
        "options": [
          "uniform",
          "byLength"
        ],
        "range": "`uniform`, `byLength`",
        "description": "`uniform`, `byLength`"
      },
      {
        "id": "jitter",
        "label": "jitter",
        "type": "number",
        "defaultValue": 0,
        "range": "0–1000",
        "description": "0–1000"
      }
    ]
  },
  "ParticleInit": {
    "op": "ParticleInit",
    "family": "PARTICLE",
    "label": "初始化粒子点集",
    "params": [
      {
        "id": "count",
        "label": "数量",
        "type": "number",
        "defaultValue": 1000,
        "range": "1–1000000",
        "description": "1–1000000"
      },
      {
        "id": "shape",
        "label": "形状",
        "type": "select",
        "defaultValue": "box",
        "options": [
          "box",
          "sphere",
          "plane",
          "line"
        ],
        "range": "`box`, `sphere`, `plane`, `line`",
        "description": "`box`, `sphere`, `plane`, `line`"
      },
      {
        "id": "bounds",
        "label": "初始分布范围",
        "type": "vec3",
        "defaultValue": [
          10,
          10,
          10
        ],
        "range": "初始分布范围",
        "description": "初始分布范围"
      },
      {
        "id": "seed",
        "label": "种子",
        "type": "number",
        "defaultValue": 1,
        "range": "0–999999",
        "description": "0–999999"
      }
    ]
  },
  "ParticleForce": {
    "op": "ParticleForce",
    "family": "PARTICLE",
    "label": "粒子节点",
    "params": [
      {
        "id": "mode",
        "label": "模式",
        "type": "select",
        "defaultValue": "constant",
        "options": [
          "constant",
          "attractor",
          "noise",
          "curlNoise"
        ],
        "range": "`constant`, `attractor`, `noise`, `curlNoise`",
        "description": "`constant`, `attractor`, `noise`, `curlNoise`"
      },
      {
        "id": "strength",
        "label": "strength",
        "type": "number",
        "defaultValue": 1,
        "range": "-1000–1000",
        "description": "-1000–1000"
      },
      {
        "id": "direction",
        "label": "力方向",
        "type": "vec3",
        "defaultValue": [
          0,
          1,
          0
        ],
        "range": "力方向",
        "description": "力方向"
      },
      {
        "id": "center",
        "label": "吸引中心",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "吸引中心",
        "description": "吸引中心"
      },
      {
        "id": "radius",
        "label": "半径",
        "type": "number",
        "defaultValue": 10,
        "range": "0.001–100000",
        "description": "0.001–100000"
      },
      {
        "id": "falloff",
        "label": "falloff",
        "type": "number",
        "defaultValue": 1,
        "range": "0–100",
        "description": "0–100"
      },
      {
        "id": "speed",
        "label": "速度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–100",
        "description": "0–100"
      },
      {
        "id": "noiseScale",
        "label": "noiseScale",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–1000",
        "description": "0.001–1000"
      }
    ]
  },
  "PointRender": {
    "op": "PointRender",
    "family": "PARTICLE",
    "label": "粒子节点",
    "params": [
      {
        "id": "position",
        "label": "平移",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "平移",
        "description": "平移"
      },
      {
        "id": "rotation",
        "label": "旋转",
        "type": "vec3",
        "defaultValue": [
          0,
          0,
          0
        ],
        "range": "旋转",
        "description": "旋转"
      },
      {
        "id": "scale",
        "label": "缩放",
        "type": "vec3",
        "defaultValue": [
          1,
          1,
          1
        ],
        "range": "缩放",
        "description": "缩放"
      }
    ]
  },
  "LineConnect": {
    "op": "LineConnect",
    "family": "PARTICLE",
    "label": "按距离连接点",
    "params": [
      {
        "id": "maxDistance",
        "label": "maxDistance",
        "type": "number",
        "defaultValue": 1,
        "range": "0.001–100000",
        "description": "0.001–100000"
      },
      {
        "id": "maxConnectionsPerPoint",
        "label": "maxConnectionsPerPoint",
        "type": "number",
        "defaultValue": 4,
        "range": "1–128",
        "description": "1–128"
      },
      {
        "id": "opacityByDistance",
        "label": "opacityByDistance",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      }
    ]
  },
  "TrailBuffer": {
    "op": "TrailBuffer",
    "family": "PARTICLE",
    "label": "粒子拖尾",
    "params": [
      {
        "id": "historyLength",
        "label": "historyLength",
        "type": "number",
        "defaultValue": 20,
        "range": "1–1000",
        "description": "1–1000"
      },
      {
        "id": "sampleEveryNFrames",
        "label": "sampleEveryNFrames",
        "type": "number",
        "defaultValue": 1,
        "range": "1–60",
        "description": "1–60"
      },
      {
        "id": "closeLoop",
        "label": "closeLoop",
        "type": "boolean",
        "defaultValue": false,
        "description": ""
      }
    ]
  },
  "P5SketchTextureNode": {
    "op": "P5SketchTextureNode",
    "family": "P5_TEXTURE",
    "label": "通用 p5 代码",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "transparent",
        "label": "透明背景",
        "type": "boolean",
        "defaultValue": true,
        "range": "透明背景",
        "description": "透明背景"
      },
      {
        "id": "fpsLimit",
        "label": "fpsLimit",
        "type": "number",
        "defaultValue": 60,
        "range": "1–240",
        "description": "1–240"
      },
      {
        "id": "pixelDensity",
        "label": "pixelDensity",
        "type": "number",
        "defaultValue": 1,
        "range": "0.5–2",
        "description": "0.5–2"
      },
      {
        "id": "clearEachFrame",
        "label": "每帧是否清空",
        "type": "boolean",
        "defaultValue": true,
        "range": "每帧是否清空",
        "description": "每帧是否清空"
      },
      {
        "id": "backgroundColor",
        "label": "背景色",
        "type": "color",
        "defaultValue": "#000000",
        "range": "背景色",
        "description": "背景色"
      },
      {
        "id": "sketchCode",
        "label": "sketchCode",
        "type": "string",
        "defaultValue": "",
        "range": "p5 草图代码片段",
        "description": "p5 草图代码片段"
      }
    ]
  },
  "P5NoiseTextureNode": {
    "op": "P5NoiseTextureNode",
    "family": "P5_TEXTURE",
    "label": "p5 生成噪声纹",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "scale",
        "label": "缩放",
        "type": "number",
        "defaultValue": 0.01,
        "range": "0.000001–100",
        "description": "0.000001–100"
      },
      {
        "id": "speed",
        "label": "速度",
        "type": "number",
        "defaultValue": 0.01,
        "range": "-10–10",
        "description": "-10–10"
      },
      {
        "id": "contrast",
        "label": "contrast",
        "type": "number",
        "defaultValue": 1,
        "range": "0–10",
        "description": "0–10"
      },
      {
        "id": "grayscale",
        "label": "grayscale",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      },
      {
        "id": "invert",
        "label": "invert",
        "type": "boolean",
        "defaultValue": false,
        "description": ""
      },
      {
        "id": "seed",
        "label": "种子",
        "type": "number",
        "defaultValue": 1,
        "range": "0–999999",
        "description": "0–999999"
      }
    ]
  },
  "P5FlowFieldTextureNode": {
    "op": "P5FlowFieldTextureNode",
    "family": "P5_TEXTURE",
    "label": "流场线条纹理",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "particleCount",
        "label": "particleCount",
        "type": "number",
        "defaultValue": 1000,
        "range": "1–100000",
        "description": "1–100000"
      },
      {
        "id": "fieldScale",
        "label": "fieldScale",
        "type": "number",
        "defaultValue": 0.01,
        "range": "0.000001–10",
        "description": "0.000001–10"
      },
      {
        "id": "speed",
        "label": "速度",
        "type": "number",
        "defaultValue": 1,
        "range": "0–100",
        "description": "0–100"
      },
      {
        "id": "lineLength",
        "label": "lineLength",
        "type": "number",
        "defaultValue": 10,
        "range": "1–1000",
        "description": "1–1000"
      },
      {
        "id": "strokeWeight",
        "label": "strokeWeight",
        "type": "number",
        "defaultValue": 1,
        "range": "0.1–100",
        "description": "0.1–100"
      },
      {
        "id": "strokeColor",
        "label": "strokeColor",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": ""
      },
      {
        "id": "fadeBackground",
        "label": "fadeBackground",
        "type": "number",
        "defaultValue": 10,
        "range": "0–255",
        "description": "0–255"
      },
      {
        "id": "wrapEdges",
        "label": "wrapEdges",
        "type": "boolean",
        "defaultValue": true,
        "description": ""
      }
    ]
  },
  "P5TrailTextureNode": {
    "op": "P5TrailTextureNode",
    "family": "P5_TEXTURE",
    "label": "拖尾纹理",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "trailLength",
        "label": "trailLength",
        "type": "number",
        "defaultValue": 20,
        "range": "1–1000",
        "description": "1–1000"
      },
      {
        "id": "strokeWeight",
        "label": "strokeWeight",
        "type": "number",
        "defaultValue": 4,
        "range": "0.1–100",
        "description": "0.1–100"
      },
      {
        "id": "strokeColor",
        "label": "strokeColor",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": ""
      },
      {
        "id": "fadeAmount",
        "label": "fadeAmount",
        "type": "number",
        "defaultValue": 20,
        "range": "0–255",
        "description": "0–255"
      },
      {
        "id": "smoothing",
        "label": "smoothing",
        "type": "number",
        "defaultValue": 0.2,
        "range": "0–1",
        "description": "0–1"
      }
    ]
  },
  "P5AlphaMaskTextureNode": {
    "op": "P5AlphaMaskTextureNode",
    "family": "P5_TEXTURE",
    "label": "动态透明遮罩",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "mode",
        "label": "模式",
        "type": "select",
        "defaultValue": "noise",
        "options": [
          "noise",
          "radial",
          "brush",
          "reveal",
          "stripe"
        ],
        "range": "`noise`, `radial`, `brush`, `reveal`, `stripe`",
        "description": "`noise`, `radial`, `brush`, `reveal`, `stripe`"
      },
      {
        "id": "threshold",
        "label": "threshold",
        "type": "number",
        "defaultValue": 0.5,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "invert",
        "label": "invert",
        "type": "boolean",
        "defaultValue": false,
        "description": ""
      },
      {
        "id": "softness",
        "label": "softness",
        "type": "number",
        "defaultValue": 0.1,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "progress",
        "label": "progress",
        "type": "number",
        "defaultValue": 0,
        "range": "0–1",
        "description": "0–1"
      }
    ]
  },
  "P5TextTextureNode": {
    "op": "P5TextTextureNode",
    "family": "P5_TEXTURE",
    "label": "文字纹理",
    "params": [
      {
        "id": "width",
        "label": "纹理宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "纹理宽度",
        "description": "纹理宽度"
      },
      {
        "id": "height",
        "label": "纹理高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "纹理高度",
        "description": "纹理高度"
      },
      {
        "id": "text",
        "label": "文字内容",
        "type": "string",
        "defaultValue": "HELLO",
        "range": "文字内容",
        "description": "文字内容"
      },
      {
        "id": "fontSize",
        "label": "字号",
        "type": "number",
        "defaultValue": 128,
        "range": "字号",
        "description": "字号"
      },
      {
        "id": "fontFamily",
        "label": "字体",
        "type": "string",
        "defaultValue": "sans-serif",
        "range": "字体",
        "description": "字体"
      },
      {
        "id": "fontColor",
        "label": "字色",
        "type": "color",
        "defaultValue": "#ffffff",
        "range": "字色",
        "description": "字色"
      },
      {
        "id": "backgroundColor",
        "label": "背景色",
        "type": "color",
        "defaultValue": "#000000",
        "range": "背景色",
        "description": "背景色"
      },
      {
        "id": "alignX",
        "label": "alignX",
        "type": "select",
        "defaultValue": "center",
        "options": [
          "left",
          "center",
          "right"
        ],
        "range": "`left`, `center`, `right`",
        "description": "`left`, `center`, `right`"
      },
      {
        "id": "alignY",
        "label": "alignY",
        "type": "select",
        "defaultValue": "center",
        "options": [
          "top",
          "center",
          "bottom"
        ],
        "range": "`top`, `center`, `bottom`",
        "description": "`top`, `center`, `bottom`"
      },
      {
        "id": "animateMode",
        "label": "animateMode",
        "type": "select",
        "defaultValue": "none",
        "options": [
          "none",
          "scrollX",
          "scrollY",
          "typewriter",
          "pulse"
        ],
        "range": "`none`, `scrollX`, `scrollY`, `typewriter`, `pulse`",
        "description": "`none`, `scrollX`, `scrollY`, `typewriter`, `pulse`"
      },
      {
        "id": "speed",
        "label": "动画速度",
        "type": "number",
        "defaultValue": 1,
        "range": "动画速度",
        "description": "动画速度"
      }
    ]
  },
  "P5ParticleSpriteTextureNode": {
    "op": "P5ParticleSpriteTextureNode",
    "family": "P5_TEXTURE",
    "label": "粒子精灵贴图",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 256,
        "range": "1–2048",
        "description": "1–2048"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 256,
        "range": "1–2048",
        "description": "1–2048"
      },
      {
        "id": "shape",
        "label": "形状",
        "type": "select",
        "defaultValue": "softCircle",
        "options": [
          "softCircle",
          "star",
          "spark",
          "ring",
          "smoke",
          "inkDrop"
        ],
        "range": "`softCircle`, `star`, `spark`, `ring`, `smoke`, `inkDrop`",
        "description": "`softCircle`, `star`, `spark`, `ring`, `smoke`, `inkDrop`"
      },
      {
        "id": "color",
        "label": "颜色",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": ""
      },
      {
        "id": "glowColor",
        "label": "glowColor",
        "type": "color",
        "defaultValue": "#ffffff",
        "description": ""
      },
      {
        "id": "glowSize",
        "label": "glowSize",
        "type": "number",
        "defaultValue": 0.5,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "softness",
        "label": "softness",
        "type": "number",
        "defaultValue": 0.5,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "innerRadius",
        "label": "innerRadius",
        "type": "number",
        "defaultValue": 0.1,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "outerRadius",
        "label": "outerRadius",
        "type": "number",
        "defaultValue": 0.45,
        "range": "0–1",
        "description": "0–1"
      }
    ]
  },
  "P5FeedbackTextureNode": {
    "op": "P5FeedbackTextureNode",
    "family": "P5_TEXTURE",
    "label": "二维反馈残影纹理",
    "params": [
      {
        "id": "width",
        "label": "宽度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "height",
        "label": "高度",
        "type": "number",
        "defaultValue": 1024,
        "range": "1–8192",
        "description": "1–8192"
      },
      {
        "id": "decay",
        "label": "衰减",
        "type": "number",
        "defaultValue": 0.95,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "mixAmount",
        "label": "mixAmount",
        "type": "number",
        "defaultValue": 0.5,
        "range": "0–1",
        "description": "0–1"
      },
      {
        "id": "blurAmount",
        "label": "blurAmount",
        "type": "number",
        "defaultValue": 0,
        "range": "0–100",
        "description": "0–100"
      },
      {
        "id": "mirror",
        "label": "mirror",
        "type": "boolean",
        "defaultValue": false,
        "description": ""
      },
      {
        "id": "kaleidoscopeSegments",
        "label": "kaleidoscopeSegments",
        "type": "number",
        "defaultValue": 1,
        "range": "1–64",
        "description": "1–64"
      },
      {
        "id": "offset",
        "label": "偏移",
        "type": "vec2",
        "defaultValue": [
          0,
          0
        ],
        "range": "偏移",
        "description": "偏移"
      }
    ]
  },
  "JSONData": {
    "op": "JSONData",
    "family": "DATA",
    "label": "数据节点",
    "params": [
      {
        "id": "jsonText",
        "label": "jsonText",
        "type": "string",
        "defaultValue": "{}",
        "range": "JSON 文本",
        "description": "JSON 文本"
      }
    ]
  },
  "TextData": {
    "op": "TextData",
    "family": "DATA",
    "label": "数据节点",
    "params": [
      {
        "id": "text",
        "label": "文字内容",
        "type": "string",
        "defaultValue": "",
        "description": ""
      }
    ]
  },
  "CSVData": {
    "op": "CSVData",
    "family": "DATA",
    "label": "数据节点",
    "params": [
      {
        "id": "csvText",
        "label": "csvText",
        "type": "string",
        "defaultValue": "",
        "description": ""
      }
    ]
  },
  "CodeBlock": {
    "op": "CodeBlock",
    "family": "DATA",
    "label": "数据节点",
    "params": [
      {
        "id": "language",
        "label": "语言",
        "type": "select",
        "defaultValue": "glsl",
        "options": [
          "glsl",
          "javascript",
          "json",
          "p5"
        ],
        "range": "`glsl`, `javascript`, `json`, `p5`",
        "description": "`glsl`, `javascript`, `json`, `p5`"
      },
      {
        "id": "code",
        "label": "代码内容",
        "type": "string",
        "defaultValue": "",
        "range": "代码内容",
        "description": "代码内容"
      }
    ]
  },
  "PromptNode": {
    "op": "PromptNode",
    "family": "AI",
    "label": "AI节点",
    "params": [
      {
        "id": "prompt",
        "label": "prompt",
        "type": "string",
        "defaultValue": "",
        "description": ""
      }
    ]
  },
  "CodeGenNode": {
    "op": "CodeGenNode",
    "family": "AI",
    "label": "AI节点",
    "params": [
      {
        "id": "target",
        "label": "目标",
        "type": "select",
        "defaultValue": "preview",
        "options": [
          "preview",
          "export"
        ],
        "range": "`preview`, `export`",
        "description": "`preview`, `export`"
      },
      {
        "id": "renderer",
        "label": "renderer",
        "type": "select",
        "defaultValue": "auto",
        "options": [
          "auto",
          "webgl",
          "webgpu"
        ],
        "range": "`auto`, `webgl`, `webgpu`",
        "description": "`auto`, `webgl`, `webgpu`"
      }
    ]
  },
  "DebugNode": {
    "op": "DebugNode",
    "family": "AI",
    "label": "AI节点",
    "params": []
  }
};

export const NODE_TYPE_ALIASES: Record<string, string> = {
  "scene": "Scene",
  "camera": "PerspectiveCamera",
  "renderer": "Render",
  "comp_root": "Group",
  "ambientLight": "AmbientLight",
  "directionalLight": "DirectionalLight",
  "pointLight": "PointLight",
  "geometry": "BoxGeometry",
  "material": "StandardMaterial",
  "mesh": "Mesh",
  "transform": "TransformGeometry",
  "animation": "Time",
  "controls": "MouseInput",
  "responsive": "Render",
  "texture": "ImageTexture",
  "particles": "ParticleInit",
  "shader": "ShaderMaterial",
  "color": "BasicMaterial",
  "interaction": "Trigger",
  "keyboard": "KeyboardInput",
  "mouse": "MouseInput",
  "gesture": "MouseInput",
  "camera_interaction": "MouseInput",
  "audioRhythm": "NoiseSignal",
  "mp4Recognition": "VideoTexture",
  "faceRecognition": "MouseInput",
  "hardware": "Trigger",
  "file_texture": "ImageTexture",
  "file_model": "FileGeometry",
  "file_data": "JSONData",
  "file_video": "VideoTexture",
  "line": "LineObject",
  "rect2d": "PlaneGeometry",
  "ellipse2d": "SVGShapeGeometry",
  "circle": "SVGShapeGeometry",
  "arc": "SVGPathNode",
  "bezier": "SVGPathNode",
  "curve2d": "SVGPathNode",
  "vertex": "SVGPointSampler",
  "quad": "PlaneGeometry"
};

export function resolveSpecNodeType(nodeType: string): string {
  return SPEC_NODE_DEFINITIONS[nodeType] ? nodeType : (NODE_TYPE_ALIASES[nodeType] || nodeType);
}

export function getNodeSpecDefinition(nodeType: string): SpecNodeDefinition | null {
  return SPEC_NODE_DEFINITIONS[resolveSpecNodeType(nodeType)] || null;
}

export function getNodeParamSpec(nodeType: string, paramId: string): SpecNodeParam | null {
  const definition = getNodeSpecDefinition(nodeType);
  if (!definition) return null;
  return definition.params.find((param) => param.id === paramId || param.label === paramId) || null;
}

export function getDefaultNodeParams(nodeType: string): Record<string, unknown> {
  const definition = getNodeSpecDefinition(nodeType);
  if (!definition) return {};
  return Object.fromEntries(definition.params.map((param) => [param.id, param.defaultValue]));
}

export function completeNodeParams(nodeType: string, params: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...getDefaultNodeParams(nodeType), ...params };
}

export function getSpecNodeTypeList(): string[] {
  return [...Object.keys(SPEC_NODE_DEFINITIONS), ...Object.keys(NODE_TYPE_ALIASES)];
}

// ============================================================
// Visibility Policy — parameter exposure grading & system node hiding
// Reference: node_visibility_policy_patch.json
// ============================================================

/** Per-node visibility overrides (applied on top of SPEC_NODE_DEFINITIONS) */
const NODE_VISIBILITY_OVERRIDES: Record<string, Partial<SpecNodeDefinition>> = {
  Scene: {
    visibility: 'system',
    system: true,
    aiCreatable: false,
    deletable: false,
    editable: false,
  },
  Render: {
    visibility: 'system',
    system: true,
    aiCreatable: false,
    deletable: false,
    editable: false,
  },
};

/** Per-node per-param visibility overrides */
const PARAM_VISIBILITY_OVERRIDES: Record<string, Record<string, Partial<SpecNodeParam>>> = {
  Scene: {
    backgroundColor: { visibility: 'advanced', aiEditable: false, userEditable: true, role: 'system' },
    backgroundMode: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'system' },
    useFog: { visibility: 'advanced', aiEditable: false, userEditable: true, role: 'system' },
    fogColor: { visibility: 'advanced', aiEditable: false, userEditable: true, role: 'system' },
    fogNear: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'system' },
    fogFar: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'system' },
  },
  Render: {
    rendererType: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'system' },
    antialias: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'performance' },
    pixelRatio: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'performance' },
    toneMapping: { visibility: 'advanced', aiEditable: false, userEditable: true, role: 'system' },
    exposure: { visibility: 'advanced', aiEditable: true, userEditable: true, role: 'system' },
    outputColorSpace: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'system' },
    alpha: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'system' },
  },
  PerspectiveCamera: {
    position: { visibility: 'public', aiEditable: true, userEditable: true, role: 'creative' },
    rotation: { visibility: 'public', aiEditable: true, userEditable: true, role: 'creative' },
    fov: { visibility: 'public', aiEditable: true, userEditable: true, role: 'creative' },
    near: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'system' },
    far: { visibility: 'hidden', aiEditable: false, userEditable: false, role: 'system' },
    autoLookAt: { visibility: 'advanced', aiEditable: false, userEditable: true, role: 'system' },
    lookAtTarget: { visibility: 'advanced', aiEditable: false, userEditable: true, role: 'system' },
  },
};

/** Apply visibility overrides to a node definition (returns a new object, does not mutate) */
export function getEffectiveNodeDefinition(nodeType: string): SpecNodeDefinition | null {
  const base = getNodeSpecDefinition(nodeType);
  if (!base) return null;
  const overrides = NODE_VISIBILITY_OVERRIDES[base.op] || {};
  return { ...base, ...overrides };
}

/** Apply visibility overrides to a param within a node */
export function getEffectiveParamSpec(nodeType: string, paramId: string): SpecNodeParam | null {
  const base = getNodeParamSpec(nodeType, paramId);
  if (!base) return null;
  const resolvedType = resolveSpecNodeType(nodeType);
  const def = SPEC_NODE_DEFINITIONS[resolvedType];
  if (!def) return base;
  const nodeOverrides = PARAM_VISIBILITY_OVERRIDES[def.op] || {};
  const paramOverrides = nodeOverrides[paramId] || {};
  return { ...base, ...paramOverrides };
}

/** Get all effective params for a node with visibility applied */
export function getEffectiveParams(nodeType: string): SpecNodeParam[] {
  const def = getEffectiveNodeDefinition(nodeType);
  if (!def) return [];
  return def.params.map((p) => getEffectiveParamSpec(nodeType, p.id) || p);
}

/** Should this node appear in the node library at the given inspector mode? */
export function shouldShowNodeInLibrary(nodeType: string, mode: InspectorMode): boolean {
  const def = getEffectiveNodeDefinition(nodeType);
  if (!def) return false;
  if (def.system) return false;
  const visibility = def.visibility || 'public';
  if (visibility === 'hidden' || visibility === 'system') return false;
  if (mode === 'normal') return visibility === 'public';
  if (mode === 'advanced') return visibility === 'public' || visibility === 'advanced';
  if (mode === 'developer') return true; // all non-hidden, non-system nodes visible
  return false;
}

/** Should this param appear in the inspector at the given mode? */
export function shouldShowParam(param: SpecNodeParam, mode: InspectorMode): boolean {
  const visibility = param.visibility || 'public';
  if (visibility === 'internal') return false;
  if (mode === 'normal') return visibility === 'public' && param.userEditable !== false;
  if (mode === 'advanced') return (visibility === 'public' || visibility === 'advanced') && param.userEditable !== false;
  if (mode === 'developer') return true; // all non-internal params visible
  return false;
}

/** Is this param readonly in the given inspector mode? */
export function isReadonlyParam(param: SpecNodeParam, _mode: InspectorMode): boolean {
  if (param.userEditable === false) return true;
  if (param.visibility === 'locked') return true;
  return false;
}

/** Can AI edit this parameter? */
export function canAIEditParam(param: SpecNodeParam): boolean {
  if (param.aiEditable === false) return false;
  const visibility = param.visibility || 'public';
  if (visibility === 'locked' || visibility === 'hidden' || visibility === 'internal') return false;
  if (param.role === 'system' || param.role === 'performance' || param.role === 'debug') return false;
  return true;
}

/** Get default visibility for a param based on its ID/type (used for nodes without explicit overrides) */
export function getDefaultParamVisibility(paramId: string, _paramType: string): ParamVisibility {
  // System params that should default to hidden
  const hiddenParams = ['rendererType', 'antialias', 'pixelRatio', 'outputColorSpace', 'near', 'far', 'shadowMapType', 'backgroundMode', 'alpha', 'renderTargetSamples', 'internalResolutionScale'];
  if (hiddenParams.includes(paramId)) return 'hidden';
  // Advanced params
  const advancedParams = ['curveSegments', 'bevelSize', 'bevelThickness', 'shadowIntensity', 'exposure', 'toneMapping', 'useFog', 'lookAtTarget', 'autoLookAt', 'alphaTest', 'depthWrite', 'blendMode', 'fpsLimit', 'pixelDensity'];
  if (advancedParams.includes(paramId)) return 'advanced';
  return 'public';
}

import { memo, useCallback, useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { getMotionWaveform } from '../../utils/motionWaveforms';
import styles from './TDNodes.module.css';

export interface TDNodeData {
  label: string;
  nodeType: string;
  params?: Record<string, unknown>;
  activePreviewId?: string;
  onParamUpdate?: (nodeId: string, key: string, value: unknown) => void;
  onInteractionPromptSubmit?: (nodeId: string, nodeType: string, prompt: string, model: string) => void;
  onOpenSvgEditor?: (nodeId: string) => void;
  onOpenTextEditor?: (nodeId: string) => void;
  onOpenBatchRename?: (nodeId: string) => void;
  onOpenSmartCutout?: (nodeId: string) => void;
}

function catFromType(nt: string): string {
  if (/^(interaction|gesture|camera_interaction|audioRhythm|mp4Recognition|faceRecognition|keyboard|mouse|hardware)$/.test(nt)) return 'interaction';
  if (/^file_/.test(nt)) return 'file';
  if (/^comp_root$/.test(nt)) return 'scene';
  if (/^scene$|^camera$|^renderer$/.test(nt)) return 'scene';
  if (/^geometry$|^material$|^mesh$/.test(nt)) return 'geometry';
  if (/Light$/.test(nt)) return 'light';
  if (/^transform$|^animation$|^controls$|^responsive$|^LFO$|^NoiseSignal$|^Time$/.test(nt)) return 'control';
  if (/^gsap_/.test(nt)) return 'control';
  if (/^texture$|^particles$|^shader$|^color$/.test(nt)) return 'effect';
  if (/^(line|rect2d|ellipse2d|circle|arc|bezier|curve2d|vertex|quad)$/.test(nt)) return 'drawing';
  if (nt === 'typography.textEditor') return 'drawing';
  if (nt === 'image.smartCutout') return 'effect';
  if (nt === 'utility.batchRename') return 'file';
  if (nt === 'vector.svgEditor') return 'drawing';
  if (nt === 'creative-algorithm') return 'effect';
  return 'scene';
}

const catStyles: Record<string, string> = {
  scene: styles.nodeScene,
  geometry: styles.nodeGeometry,
  light: styles.nodeLight,
  control: styles.nodeControl,
  effect: styles.nodeEffect,
  interaction: styles.nodeInteraction,
  drawing: styles.nodeDrawing,
  file: styles.nodeFile,
};

export const categoryLabels: Record<string, string> = {
  scene: '场景层',
  geometry: '几何层',
  light: '光照层',
  control: '控制层',
  effect: '效果层',
  interaction: '交互层',
  drawing: '2D绘图层',
  file: '文件资源',
};

export const tdNodeTypes: Record<string, string> = {
  comp_root: '根容器',
  scene: '场景', camera: '摄像机', renderer: '渲染器',
  geometry: '几何体', material: '材质', mesh: '网格体',
  ambientLight: '环境光', directionalLight: '方向光', pointLight: '点光源',
  transform: '变换', animation: '动画', controls: '控制器', responsive: '响应式',
  gsap_timeline: 'GSAP时间线', gsap_tween: 'GSAP补间', gsap_scroll: 'GSAP滚动触发',
  texture: '纹理', particles: '粒子', shader: '着色器', color: '颜色',
  interaction: '交互', keyboard: '键盘交互', mouse: '鼠标交互', gesture: '手势识别', camera_interaction: '摄像头交互', audioRhythm: '声音节奏交互',
  mp4Recognition: 'MP4内容识别', faceRecognition: '人脸识别', hardware: '硬件交互',
  line: '线段', rect2d: '矩形', ellipse2d: '椭圆', circle: '圆形', arc: '弧线', bezier: '贝塞尔曲线', curve2d: '曲线', vertex: '顶点', quad: '四边形',
  file_texture: '纹理文件', file_model: '3D模型', file_data: '数据文件', file_video: '视频素材', file_font: '字体文件',
  'vector.svgEditor': 'SVG 编辑器',
  'typography.textEditor': '文字编辑 / 转 SVG',
  'utility.batchRename': '批量重命名',
  'image.smartCutout': '一键抠图',
  'creative-algorithm': '样式算法',
};

export function getNodeDisplayLabel(nodeType: string, label?: string): string {
  return label || tdNodeTypes[nodeType] || nodeType;
}

export function getParamDisplayLabel(_nodeType: string, key: string): string {
  return key;
}

export function getParamDisplayValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return value.toFixed(2);
  if (Array.isArray(value)) return value.join(',');
  return String(value).slice(0, 12);
}

interface LandmarkPoint { x: number; y: number; z?: number }
interface HandResult { landmarks?: LandmarkPoint[][]; worldLandmarks?: LandmarkPoint[][]; handedness?: Array<Array<{ categoryName?: string }>> }
interface FaceBlendshapeCategory { categoryName: string; score: number }
interface FaceResult {
  faceLandmarks?: LandmarkPoint[][];
  faceBlendshapes?: Array<{ categories?: FaceBlendshapeCategory[] }>;
  facialTransformationMatrixes?: unknown[];
}
interface HandLandmarkerInstance { detectForVideo(video: HTMLVideoElement, timestamp: number): HandResult; close?: () => void }
interface FaceLandmarkerInstance { detectForVideo(video: HTMLVideoElement, timestamp: number): FaceResult; close?: () => void }
interface VisionModule {
  FilesetResolver: { forVisionTasks(wasmUrl: string): Promise<unknown> };
  HandLandmarker?: {
    createFromOptions(vision: unknown, options: Record<string, unknown>): Promise<HandLandmarkerInstance>;
    createFromModelBuffer?: (vision: unknown, model: Uint8Array) => Promise<HandLandmarkerInstance>;
  };
  FaceLandmarker?: {
    createFromOptions(vision: unknown, options: Record<string, unknown>): Promise<FaceLandmarkerInstance>;
    createFromModelBuffer?: (vision: unknown, model: Uint8Array) => Promise<FaceLandmarkerInstance>;
  };
}

const VISION_CDN = [
  ['https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs', 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'],
  ['https://unpkg.com/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs', 'https://unpkg.com/@mediapipe/tasks-vision@0.10.35/wasm'],
] as const;
const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
let visionRuntimePromise: Promise<{ mod: VisionModule; vision: unknown }> | null = null;
const modelBufferCache = new Map<string, Promise<Uint8Array>>();
const HAND_LINES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]] as const;
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109] as const;
const LEFT_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7] as const;
const RIGHT_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382] as const;
const LEFT_BROW = [70, 63, 105, 66, 107] as const;
const RIGHT_BROW = [336, 296, 334, 293, 300] as const;
const OUTER_LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95] as const;
const INNER_LIPS = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95] as const;
const NOSE = [168, 197, 5, 4, 1, 2, 98, 327] as const;

type HandGestureInfo = {
  gesture: string;
  label: string;
  digit: number | null;
  sceneCommand: string;
  pinch: number;
  palmX: number;
  palmY: number;
  palmZ: number;
};

type FaceMotionInfo = {
  label: string;
  rawMotion: string;
  sceneCommand: string;
  browScore: number;
  mouthScore: number;
  yaw: number;
  pitch: number;
};

type VisionInteractionInfo = {
  label: string;
  command: string;
  digit?: number | null;
  pinch?: number;
  palmX?: number;
  palmY?: number;
  palmZ?: number;
  browScore?: number;
  mouthScore?: number;
  yaw?: number;
  pitch?: number;
};

function isInteractionNodeActive(data: TDNodeData): boolean {
  const sourcePreviewId = data.params?.autoSourcePreviewId;
  return typeof sourcePreviewId === 'string' && sourcePreviewId === data.activePreviewId;
}

function getKeyboardKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys = value.filter((item): item is string => typeof item === 'string' && item.length > 0).map((item) => item.toUpperCase());
  return Array.from(new Set(keys));
}

function getKeyboardKeyDetails(keys: string[], params?: Record<string, unknown>): Array<{ key: string; detail: string }> {
  const interaction = typeof params?.interaction === 'string' ? params.interaction : '';
  return keys.map((key) => ({
    key,
    detail: interaction.match(new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：]\\s*([^,，;；\\n]+)`, 'i'))?.[1]?.trim()
      || interaction
      || `${key} 键交互`,
  }));
}

function getMouseButtons(params?: Record<string, unknown>): Array<{ id: number; label: string; detail: string }> {
  const interaction = typeof params?.interaction === 'string' ? params.interaction : '';
  const lower = interaction.toLowerCase();
  const buttons = [
    { id: 0, label: '左键', detail: interaction || '主要点击交互', patterns: ['左键', 'left', 'click', '点击'] },
    { id: 1, label: '中键', detail: interaction || '滚轮或缩放交互', patterns: ['中键', '滚轮', 'middle', 'wheel', '缩放', '滚动'] },
    { id: 2, label: '右键', detail: interaction || '辅助点击交互', patterns: ['右键', 'right', 'context'] },
  ];
  const used = buttons.filter((button) => button.patterns.some((pattern) => lower.includes(pattern.toLowerCase()) || interaction.includes(pattern)));
  return (used.length ? used : buttons).map(({ id, label, detail }) => ({ id, label, detail }));
}

function visionLabelText(label: string): string {
  const labels: Record<string, string> = {
    NONE: '无',
    HAND: '手部',
    DIGIT_1: '数字 1',
    DIGIT_2: '数字 2',
    DIGIT_3: '数字 3',
    DIGIT_4: '数字 4',
    OPEN_HAND: '张开手掌',
    PINCH: '捏合',
    FIST: '握拳',
    CAMERA_FAR: '镜头拉远',
    NEUTRAL: '自然',
    BROW_RAISE: '抬眉',
    MOUTH_OPEN: '张嘴',
    HEAD_SHAKE: '摇头',
    HEAD_NOD: '点头',
  };
  return labels[label] || label;
}

function isFontFile(file: File): boolean {
  return /\.(ttf|otf)$/i.test(file.name);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

function dist(a?: LandmarkPoint, b?: LandmarkPoint): number {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function getPalmCenter(landmarks: LandmarkPoint[]): LandmarkPoint {
  const ids = [0, 5, 9, 13, 17];
  const sum = ids.reduce((acc, id) => {
    const p = landmarks[id];
    return {
      x: acc.x + (p?.x || 0),
      y: acc.y + (p?.y || 0),
      z: acc.z + (p?.z || 0),
    };
  }, { x: 0, y: 0, z: 0 });
  return { x: sum.x / ids.length, y: sum.y / ids.length, z: sum.z / ids.length };
}

function analyzeSingleHand(landmarks: LandmarkPoint[]): Omit<HandGestureInfo, 'sceneCommand' | 'palmX' | 'palmY' | 'palmZ'> & { handScale: number } {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const handScale = Math.max(dist(wrist, middleMcp), 0.001);
  const pinch = clamp(1 - dist(landmarks[4], landmarks[8]) / (handScale * 0.95), 0, 1);
  const fingers = {
    thumb: dist(landmarks[4], landmarks[9]) > dist(landmarks[3], landmarks[9]) * 1.18,
    index: dist(wrist, landmarks[8]) > dist(wrist, landmarks[6]) * 1.12,
    middle: dist(wrist, landmarks[12]) > dist(wrist, landmarks[10]) * 1.12,
    ring: dist(wrist, landmarks[16]) > dist(wrist, landmarks[14]) * 1.12,
    pinky: dist(wrist, landmarks[20]) > dist(wrist, landmarks[18]) * 1.12,
  };
  const openCount = Object.values(fingers).filter(Boolean).length;
  let digit: number | null = null;
  let gesture = 'HAND';
  let label = 'HAND';
  if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
    digit = 1;
    gesture = 'DIGIT_1';
    label = 'DIGIT_1';
  } else if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
    digit = 2;
    gesture = 'DIGIT_2';
    label = 'DIGIT_2';
  } else if (fingers.index && fingers.middle && fingers.ring && !fingers.pinky) {
    digit = 3;
    gesture = 'DIGIT_3';
    label = 'DIGIT_3';
  } else if (fingers.index && fingers.middle && fingers.ring && fingers.pinky && !fingers.thumb) {
    digit = 4;
    gesture = 'DIGIT_4';
    label = 'DIGIT_4';
  } else if (openCount >= 4) {
    digit = 5;
    gesture = 'OPEN_HAND';
    label = 'OPEN_HAND';
  } else if (pinch > 0.62) {
    gesture = 'PINCH';
    label = 'PINCH';
  } else if (openCount <= 1) {
    gesture = 'FIST';
    label = 'FIST';
  }
  return { gesture, label, digit, pinch, handScale };
}

function analyzeHandScene(hands: LandmarkPoint[][]): HandGestureInfo {
  if (!hands.length) {
    return { gesture: 'NONE', label: 'NONE', digit: null, sceneCommand: 'NONE', pinch: 0, palmX: 0, palmY: 0, palmZ: 0 };
  }
  const handInfos = hands.map(analyzeSingleHand);
  const primary = handInfos[0];
  const palm = getPalmCenter(hands[0]);
  let sceneCommand = primary.gesture;
  let label = primary.label;
  if (hands.length >= 2) {
    const palm0 = getPalmCenter(hands[0]);
    const palm1 = getPalmCenter(hands[1]);
    const bothOpen = handInfos[0].gesture === 'OPEN_HAND' && handInfos[1].gesture === 'OPEN_HAND';
    if (bothOpen && Math.hypot(palm0.x - palm1.x, palm0.y - palm1.y) > 0.42) {
      sceneCommand = 'CAMERA_FAR';
      label = 'CAMERA_FAR';
    }
  }
  if (sceneCommand !== 'CAMERA_FAR' && primary.gesture === 'OPEN_HAND' && primary.handScale < 0.075) {
    sceneCommand = 'CAMERA_FAR';
    label = 'CAMERA_FAR';
  }
  return {
    gesture: primary.gesture,
    label,
    digit: primary.digit,
    sceneCommand,
    pinch: primary.pinch,
    palmX: (palm.x - 0.5) * -2,
    palmY: (palm.y - 0.5) * 2,
    palmZ: palm.z || 0,
  };
}

function faceBlendMap(result: FaceResult): Record<string, number> {
  const categories = result.faceBlendshapes?.[0]?.categories || [];
  return categories.reduce<Record<string, number>>((acc, item) => {
    acc[item.categoryName] = item.score;
    return acc;
  }, {});
}

function analyzeFaceMotion(
  result: FaceResult,
  baselineRef: MutableRefObject<{ ready: boolean; sampleCount: number; browGeom: number; mouthOpenRatio: number; yaw: number; pitch: number }>,
  poseHistoryRef: MutableRefObject<Array<{ t: number; yaw: number; pitch: number }>>,
  headHoldRef: MutableRefObject<{ motion: string; until: number }>,
): FaceMotionInfo {
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks) {
    return { label: 'NONE', rawMotion: 'NONE', sceneCommand: 'NONE', browScore: 0, mouthScore: 0, yaw: 0, pitch: 0 };
  }
  const blend = faceBlendMap(result);
  const faceHeight = Math.max(dist(landmarks[10], landmarks[152]), 0.001);
  const eyeDist = Math.max(dist(landmarks[33], landmarks[263]), 0.001);
  const mouthOpenRatio = dist(landmarks[13], landmarks[14]) / faceHeight;
  const browGeom = (((landmarks[159]?.y || 0) - (landmarks[105]?.y || 0)) + ((landmarks[386]?.y || 0) - (landmarks[334]?.y || 0))) / faceHeight * 0.5;
  const browBlend = ((blend.browInnerUp || 0) + (blend.browOuterUpLeft || 0) + (blend.browOuterUpRight || 0)) / 3;
  const jawOpen = blend.jawOpen || 0;
  const eyeCenter = {
    x: ((landmarks[33]?.x || 0) + (landmarks[263]?.x || 0)) * 0.5,
    y: ((landmarks[33]?.y || 0) + (landmarks[263]?.y || 0)) * 0.5,
  };
  const nose = landmarks[4];
  const yawRaw = ((nose?.x || 0) - eyeCenter.x) / eyeDist;
  const pitchRaw = ((nose?.y || 0) - eyeCenter.y) / faceHeight;
  const baseline = baselineRef.current;
  if (!baseline.ready) {
    baseline.sampleCount += 1;
    baseline.browGeom = lerp(baseline.browGeom || browGeom, browGeom, 0.12);
    baseline.mouthOpenRatio = lerp(baseline.mouthOpenRatio || mouthOpenRatio, mouthOpenRatio, 0.12);
    baseline.yaw = lerp(baseline.yaw || yawRaw, yawRaw, 0.12);
    baseline.pitch = lerp(baseline.pitch || pitchRaw, pitchRaw, 0.12);
    if (baseline.sampleCount > 30) baseline.ready = true;
  }
  const browScore = Math.max(browBlend, clamp((browGeom - baseline.browGeom) * 9, 0, 1));
  const mouthScore = Math.max(jawOpen, clamp((mouthOpenRatio - baseline.mouthOpenRatio) * 18, 0, 1));
  const yaw = yawRaw - baseline.yaw;
  const pitch = pitchRaw - baseline.pitch;
  const now = performance.now();
  poseHistoryRef.current = [...poseHistoryRef.current, { t: now, yaw, pitch }].filter((p) => now - p.t <= 1100);
  const yawValues = poseHistoryRef.current.map((p) => p.yaw);
  const pitchValues = poseHistoryRef.current.map((p) => p.pitch);
  const yawRange = yawValues.length ? Math.max(...yawValues) - Math.min(...yawValues) : 0;
  const pitchRange = pitchValues.length ? Math.max(...pitchValues) - Math.min(...pitchValues) : 0;
  const maxAbsYaw = yawValues.length ? Math.max(...yawValues.map((v) => Math.abs(v))) : 0;
  const maxAbsPitch = pitchValues.length ? Math.max(...pitchValues.map((v) => Math.abs(v))) : 0;
  const headShake = yawRange > 0.08 && maxAbsYaw > 0.05;
  const headNod = pitchRange > 0.055 && maxAbsPitch > 0.032;
  if (headShake || headNod) {
    const shakeScore = clamp((yawRange - 0.055) / 0.12, 0, 1);
    const nodScore = clamp((pitchRange - 0.04) / 0.09, 0, 1);
    headHoldRef.current = { motion: shakeScore >= nodScore ? 'HEAD_SHAKE' : 'HEAD_NOD', until: now + 520 };
  }
  let rawMotion = 'NEUTRAL';
  if (now < headHoldRef.current.until) rawMotion = headHoldRef.current.motion;
  else if (browScore > 0.38) rawMotion = 'BROW_RAISE';
  else if (mouthScore > 0.22 || mouthOpenRatio > Math.max(baseline.mouthOpenRatio + 0.028, 0.038)) rawMotion = 'MOUTH_OPEN';
  return {
    label: rawMotion,
    rawMotion,
    sceneCommand: rawMotion,
    browScore,
    mouthScore,
    yaw,
    pitch,
  };
}

async function fetchModelBuffer(url: string): Promise<Uint8Array> {
  const cached = modelBufferCache.get(url);
  if (cached) return cached;
  const request = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`model fetch ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } finally {
      window.clearTimeout(timer);
    }
  })();
  modelBufferCache.set(url, request);
  request.catch(() => modelBufferCache.delete(url));
  return request;
}

async function loadVisionModule(): Promise<{ mod: VisionModule; vision: unknown }> {
  if (visionRuntimePromise) return visionRuntimePromise;
  visionRuntimePromise = (async () => {
    let lastError: unknown = null;
    for (const [moduleUrl, wasmUrl] of VISION_CDN) {
      try {
        const mod = await import(/* @vite-ignore */ moduleUrl) as VisionModule;
        const vision = await mod.FilesetResolver.forVisionTasks(wasmUrl);
        return { mod, vision };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('MediaPipe unavailable');
  })();
  visionRuntimePromise.catch(() => {
    visionRuntimePromise = null;
  });
  return visionRuntimePromise;
}

function drawHand(ctx: CanvasRenderingContext2D, hands: LandmarkPoint[][]) {
  ctx.strokeStyle = '#83ffbf';
  ctx.fillStyle = '#83ffbf';
  ctx.lineWidth = 2;
  hands.forEach((landmarks) => {
    const pts = landmarks.map((p) => ({ x: (1 - p.x) * ctx.canvas.width, y: p.y * ctx.canvas.height }));
    HAND_LINES.forEach(([from, to]) => {
      const a = pts[from];
      const b = pts[to];
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function drawFace(ctx: CanvasRenderingContext2D, faces: LandmarkPoint[][]) {
  ctx.strokeStyle = '#70d7ff';
  ctx.fillStyle = '#70d7ff';
  faces.forEach((landmarks) => {
    landmarks.forEach((p, index) => {
      if (index % 3 !== 0) return;
      ctx.beginPath();
      ctx.arc((1 - p.x) * ctx.canvas.width, p.y * ctx.canvas.height, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
    [[33, 133], [362, 263], [61, 291], [10, 152], [234, 454]].forEach(([from, to]) => {
      const a = landmarks[from];
      const b = landmarks[to];
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo((1 - a.x) * ctx.canvas.width, a.y * ctx.canvas.height);
      ctx.lineTo((1 - b.x) * ctx.canvas.width, b.y * ctx.canvas.height);
      ctx.stroke();
    });
  });
}

function drawInteractiveHand(ctx: CanvasRenderingContext2D, hands: LandmarkPoint[][], handedness?: Array<Array<{ categoryName?: string }>>) {
  ctx.save();
  hands.forEach((landmarks, handIndex) => {
    const pts = landmarks.map((p) => ({ x: (1 - p.x) * ctx.canvas.width, y: p.y * ctx.canvas.height, z: p.z || 0 }));
    HAND_LINES.forEach(([from, to]) => {
      const a = pts[from];
      const b = pts[to];
      if (!a || !b) return;
      const depth = clamp(1 - Math.abs((a.z + b.z) * 0.5) * 4, 0.35, 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 3.2 * depth;
      ctx.strokeStyle = 'rgba(255, 226, 150, 0.92)';
      ctx.shadowColor = 'rgba(255, 190, 80, 0.72)';
      ctx.shadowBlur = 12;
      ctx.stroke();
    });
    [5, 9, 13, 17, 0].forEach((pointIndex, i, arr) => {
      if (i === 0) {
        ctx.beginPath();
        ctx.moveTo(pts[pointIndex].x, pts[pointIndex].y);
      } else ctx.lineTo(pts[pointIndex].x, pts[pointIndex].y);
      if (i === arr.length - 1) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(112, 215, 255, 0.055)';
        ctx.strokeStyle = 'rgba(112, 215, 255, 0.46)';
        ctx.fill();
        ctx.stroke();
      }
    });
    pts.forEach((p, index) => {
      const isTip = [4, 8, 12, 16, 20].includes(index);
      ctx.beginPath();
      ctx.arc(p.x, p.y, isTip ? 6.8 : 4.8, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? 'rgba(112, 215, 255, 0.98)' : 'rgba(255, 234, 170, 0.96)';
      ctx.shadowColor = isTip ? 'rgba(112, 215, 255, 0.95)' : 'rgba(255, 210, 120, 0.85)';
      ctx.shadowBlur = isTip ? 18 : 11;
      ctx.fill();
    });
    const info = analyzeSingleHand(landmarks);
    const thumb = pts[4];
    const index = pts[8];
    if (thumb && index) {
      ctx.beginPath();
      ctx.moveTo(thumb.x, thumb.y);
      ctx.lineTo(index.x, index.y);
      ctx.lineWidth = 2 + info.pinch * 7;
      ctx.strokeStyle = `rgba(255, 93, 143, ${0.18 + info.pinch * 0.82})`;
      ctx.shadowColor = 'rgba(255, 93, 143, 0.95)';
      ctx.shadowBlur = 12 + info.pinch * 24;
      ctx.stroke();
    }
    const palm = getPalmCenter(landmarks);
    const palmX = (1 - palm.x) * ctx.canvas.width;
    const palmY = palm.y * ctx.canvas.height;
    const side = handedness?.[handIndex]?.[0]?.categoryName || `Hand ${handIndex + 1}`;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(palmX - 74, palmY - 46, 148, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fillText(`${side} / ${info.gesture}`, palmX, palmY - 26);
  });
  ctx.restore();
}

function drawFacePath(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, indices: readonly number[], color: string, width = 2, closed = false) {
  const first = pts[indices[0]];
  if (!first) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  indices.slice(1).forEach((index) => {
    const p = pts[index];
    if (p) ctx.lineTo(p.x, p.y);
  });
  if (closed) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
}

function drawInteractiveFace(ctx: CanvasRenderingContext2D, landmarks: LandmarkPoint[], motion: FaceMotionInfo) {
  const pts = landmarks.map((p) => ({ x: (1 - p.x) * ctx.canvas.width, y: p.y * ctx.canvas.height }));
  drawFacePath(ctx, pts, FACE_OVAL, 'rgba(255, 226, 150, 0.80)', 2.2);
  drawFacePath(ctx, pts, LEFT_EYE, 'rgba(112, 215, 255, 0.80)', 1.8, true);
  drawFacePath(ctx, pts, RIGHT_EYE, 'rgba(112, 215, 255, 0.80)', 1.8, true);
  drawFacePath(ctx, pts, LEFT_BROW, 'rgba(255, 93, 143, 0.78)', 2.2);
  drawFacePath(ctx, pts, RIGHT_BROW, 'rgba(255, 93, 143, 0.78)', 2.2);
  drawFacePath(ctx, pts, OUTER_LIPS, 'rgba(255, 226, 150, 0.90)', 2.1, true);
  drawFacePath(ctx, pts, INNER_LIPS, 'rgba(255, 93, 143, 0.82)', 1.8, true);
  drawFacePath(ctx, pts, NOSE, 'rgba(255,255,255,0.45)', 1.4);
  const important = new Set([...FACE_OVAL, ...LEFT_EYE, ...RIGHT_EYE, ...LEFT_BROW, ...RIGHT_BROW, ...OUTER_LIPS, ...INNER_LIPS, ...NOSE, 4, 13, 14, 152]);
  ctx.save();
  important.forEach((index) => {
    const p = pts[index];
    if (!p) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 235, 170, 0.88)';
    ctx.shadowColor = 'rgba(255, 210, 120, 0.75)';
    ctx.shadowBlur = 8;
    ctx.fill();
  });
  const nose = pts[4];
  const leftEye = pts[33];
  const rightEye = pts[263];
  if (nose && leftEye && rightEye) {
    ctx.beginPath();
    ctx.moveTo((leftEye.x + rightEye.x) * 0.5, (leftEye.y + rightEye.y) * 0.5);
    ctx.lineTo(nose.x, nose.y);
    ctx.strokeStyle = 'rgba(112,215,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const label = pts[10] || pts[4];
  if (label) {
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(label.x - 80, label.y - 38, 160, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(motion.rawMotion, label.x, label.y - 19);
  }
  ctx.restore();
}

function FontFilePreview({ id, data }: { id?: string; data: TDNodeData }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileName = typeof data.params?.fileName === 'string' ? data.params.fileName : '';
  const format = typeof data.params?.format === 'string' ? data.params.format : '';
  const acceptFile = (file: File) => {
    if (!id || !isFontFile(file)) return;
    data.onParamUpdate?.(id, 'fileName', file.name);
    data.onParamUpdate?.(id, 'format', file.name.split('.').pop()?.toLowerCase() || '');
  };
  return (
    <div className={styles.fontFilePreview}>
      <div className={`${styles.fontDropZone} nodrag nowheel`} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) acceptFile(file); }}>
        <input ref={inputRef} type="file" accept=".ttf,.otf" className={styles.hiddenInput} onChange={(event) => { const file = event.target.files?.[0]; if (file) acceptFile(file); event.target.value = ''; }} />
        <div className={styles.fontHint}>支持 TTF / OTF 字体文件</div>
        <div className={styles.fontFileName}>{fileName || '拖拽字体文件到这里'}</div>
        <div className={styles.fontFormat}>{format ? format.toUpperCase() : 'TTF / OTF'}</div>
      </div>
      <button type="button" className={`${styles.fontEditButton} nodrag nowheel`} onClick={() => id && data.onOpenTextEditor?.(id)}>
        <strong>字体内容编辑</strong>
        <span>打开文字编辑节点内容</span>
      </button>
    </div>
  );
}

function KeyboardInteractionPreview({ id, data }: { id?: string; data: TDNodeData }) {
  const active = isInteractionNodeActive(data);
  const [keys, setKeys] = useState(getKeyboardKeys(data.params?.keys));
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [listening, setListening] = useState(false);

  useEffect(() => setKeys(getKeyboardKeys(data.params?.keys)), [data.params?.keys]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      if (listening) {
        setKeys((current) => {
          if (current.includes(key)) return current;
          const next = [...current, key];
          if (id) data.onParamUpdate?.(id, 'keys', next);
          return next;
        });
        setListening(false);
        return;
      }
      if (active) setPressed((current) => new Set(current).add(key));
    };
    const up = (event: KeyboardEvent) => {
      if (!active) return;
      const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      setPressed((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [active, data, id, listening]);

  const renderKey = (key: string) => <button key={key} type="button" className={`${styles.keyCap} ${pressed.has(key) ? styles.keyCapPressed : ''}`}>{key}</button>;
  const keyDetails = getKeyboardKeyDetails(keys, data.params);
  return (
    <>
      <div className={`${styles.keyboardPad} nodrag nowheel`}>
        {keys.map(renderKey)}
        <button type="button" className={`${styles.keyCap} ${styles.addKeyCap} ${listening ? styles.keyCapListening : ''}`} onClick={() => setListening(true)}>{listening ? '|' : '+'}</button>
      </div>
      <div className={styles.keyboardLegend}>
        {keyDetails.map((item) => (
          <div key={item.key}><span>{item.key}</span><strong>{item.detail}</strong></div>
        ))}
      </div>
    </>
  );
}

function MouseInteractionPreview({ active, data }: { active: boolean; data: TDNodeData }) {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [buttons, setButtons] = useState<Set<number>>(new Set());
  const [wheelActive, setWheelActive] = useState(false);
  const mouseButtons = getMouseButtons(data.params);
  const updatePos = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(rect.width - 8, event.clientX - rect.left)), y: Math.max(8, Math.min(rect.height - 8, event.clientY - rect.top)) });
  };
  return (
    <>
      <div className={`${styles.mousePad} nodrag nowheel`} onPointerMove={updatePos} onPointerDown={(event) => { if (!active) return; updatePos(event); setButtons((current) => new Set(current).add(event.button)); }} onPointerUp={(event) => setButtons((current) => { const next = new Set(current); next.delete(event.button); return next; })} onWheel={(event) => { event.stopPropagation(); if (!active) return; setWheelActive(true); window.setTimeout(() => setWheelActive(false), 180); }} onContextMenu={(event) => event.preventDefault()}>
        <div className={styles.mouseTrack} />
        <div className={styles.mousePointer} style={{ left: pos.x, top: pos.y }} />
        <div className={styles.mouseDevice} style={{ left: pos.x, top: pos.y }}><span className={buttons.has(0) ? styles.mouseButtonActive : ''} /><span className={wheelActive || buttons.has(1) ? styles.mouseButtonActive : ''} /><span className={buttons.has(2) ? styles.mouseButtonActive : ''} /></div>
      </div>
      <div className={styles.mouseButtonRow}>
        {mouseButtons.map((button) => (
          <button key={button.id} type="button" className={(button.id === 1 && wheelActive) || buttons.has(button.id) ? styles.mouseButtonActive : ''}>{button.label}</button>
        ))}
      </div>
      <div className={styles.mouseLegend}>
        {mouseButtons.map((button) => (
          <div key={button.id}><span>{button.label}</span><strong>{button.detail}</strong></div>
        ))}
      </div>
    </>
  );
}

function CameraVisionPreview({ mode, active }: { mode: 'face' | 'gesture'; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const handRef = useRef<HandLandmarkerInstance | null>(null);
  const faceRef = useRef<FaceLandmarkerInstance | null>(null);
  const loadingRef = useRef(false);
  const lastDetectRef = useRef(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [status, setStatus] = useState('等待授权');

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = window.requestAnimationFrame(drawFrame);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const now = performance.now();
    if (now - lastDetectRef.current < 50) {
      rafRef.current = window.requestAnimationFrame(drawFrame);
      return;
    }
    lastDetectRef.current = now;
    canvas.width = canvas.clientWidth || 188;
    canvas.height = canvas.clientHeight || 120;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === 'gesture' && handRef.current) {
      const result = handRef.current.detectForVideo(video, now);
      if (result.landmarks?.length) { drawHand(ctx, result.landmarks); setStatus(`识别手数 ${result.landmarks.length}`); }
      else setStatus('把手放到摄像头前');
    } else if (mode === 'face' && faceRef.current) {
      const result = faceRef.current.detectForVideo(video, now);
      if (result.faceLandmarks?.length) { drawFace(ctx, result.faceLandmarks); setStatus(`识别人脸 ${result.faceLandmarks.length}`); }
      else setStatus('把脸移动到摄像头前');
    } else {
      ctx.strokeStyle = mode === 'face' ? '#70d7ff' : '#83ffbf';
      for (let x = 0; x < canvas.width; x += 18) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
      for (let y = 0; y < canvas.height; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
      setStatus(loadingRef.current ? '模型加载中' : '摄像头已打开，等待模型');
    }
    rafRef.current = window.requestAnimationFrame(drawFrame);
  }, [mode]);

  const startCamera = useCallback(() => {
    if (!active) { setStatus('请先点击对应预览节点'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('浏览器不支持摄像头'); return; }
    void navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); }
        setCameraActive(true);
        setStatus('摄像头已打开');
        rafRef.current = window.requestAnimationFrame(drawFrame);
        if (loadingRef.current) return;
        loadingRef.current = true;
        void (async () => {
          try {
            const { mod, vision } = await loadVisionModule();
            if (mode === 'gesture' && mod.HandLandmarker) {
              handRef.current = await mod.HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'CPU' }, runningMode: 'VIDEO', numHands: 2 });
              setStatus('手势模型已加载');
              return;
            }
            if (mode === 'face' && mod.FaceLandmarker) {
              faceRef.current = await mod.FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
              setStatus('人脸模型已加载');
              return;
            }
            throw new Error('missing landmarker');
          } catch {
            setStatus('模型加载失败，请检查网络或模型地址');
          } finally {
            loadingRef.current = false;
          }
        })();
      })
      .catch(() => setStatus('摄像头未授权'));
  }, [active, drawFrame, mode]);

  useEffect(() => {
    if (active) return;
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, [active]);

  useEffect(() => () => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    handRef.current?.close?.();
    faceRef.current?.close?.();
  }, []);

  return (
    <>
      <div className={`${styles.cameraPreview} nodrag nowheel`}><video ref={videoRef} muted playsInline /><canvas ref={canvasRef} className={styles.visionCanvas} />{!cameraActive && <button type="button" className={styles.cameraAuthorize} data-state={active ? '打开摄像头授权' : '先点击预览节点'} onClick={startCamera}>camera</button>}<div className={styles.cameraStatus}>{status}</div></div>
      <div className={styles.cameraStateList}><div><span>模式</span><strong>{mode === 'face' ? '人脸网格' : '手部骨骼'}</strong></div><div><span>授权</span><strong>{cameraActive ? '摄像头已打开' : '等待授权'}</strong></div><div><span>监听</span><strong>{active ? '当前预览' : '未激活预览'}</strong></div></div>
    </>
  );
}

function CameraVisionPreviewV2({ mode, active }: { mode: 'face' | 'gesture'; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const handRef = useRef<HandLandmarkerInstance | null>(null);
  const faceRef = useRef<FaceLandmarkerInstance | null>(null);
  const loadingRef = useRef(false);
  const cameraRequestRef = useRef(false);
  const activeRef = useRef(active);
  const lastFpsRef = useRef(performance.now());
  const lastVisionDetectRef = useRef(0);
  const frameCountRef = useRef(0);
  const stableLabelRef = useRef('NONE');
  const candidateLabelRef = useRef('NONE');
  const candidateFramesRef = useRef(0);
  const baselineRef = useRef({ ready: false, sampleCount: 0, browGeom: 0, mouthOpenRatio: 0, yaw: 0, pitch: 0 });
  const poseHistoryRef = useRef<Array<{ t: number; yaw: number; pitch: number }>>([]);
  const headHoldRef = useRef({ motion: 'NONE', until: 0 });
  const [cameraActive, setCameraActive] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [status, setStatus] = useState('等待摄像头授权');
  const [detectedCount, setDetectedCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [interactionInfo, setInteractionInfo] = useState<VisionInteractionInfo>({ label: 'NONE', command: 'NONE' });

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const updateFps = useCallback(() => {
    frameCountRef.current += 1;
    const now = performance.now();
    if (now - lastFpsRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsRef.current = now;
    }
  }, []);

  const stabilizeLabel = useCallback((rawLabel: string) => {
    if (rawLabel === candidateLabelRef.current) candidateFramesRef.current += 1;
    else {
      candidateLabelRef.current = rawLabel;
      candidateFramesRef.current = 1;
    }
    if (candidateFramesRef.current >= 3) stableLabelRef.current = rawLabel;
    return stableLabelRef.current;
  }, []);

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = window.requestAnimationFrame(drawFrame);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const now = performance.now();
    if (now - lastVisionDetectRef.current < 50) {
      rafRef.current = window.requestAnimationFrame(drawFrame);
      return;
    }
    lastVisionDetectRef.current = now;
    canvas.width = canvas.clientWidth || 188;
    canvas.height = canvas.clientHeight || 120;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateFps();

    if (mode === 'gesture' && handRef.current) {
      const result = handRef.current.detectForVideo(video, now);
      const hands = result.landmarks || [];
      setDetectedCount(hands.length);
      if (hands.length) {
        drawInteractiveHand(ctx, hands, result.handedness);
        const analyzed = analyzeHandScene(hands);
        const stableLabel = stabilizeLabel(analyzed.label);
        setInteractionInfo({
          label: stableLabel,
          command: analyzed.sceneCommand,
          digit: analyzed.digit,
          pinch: analyzed.pinch,
          palmX: analyzed.palmX,
          palmY: analyzed.palmY,
          palmZ: analyzed.palmZ,
        });
        setStatus(`手势：${visionLabelText(stableLabel)}`);
      } else {
        const stableLabel = stabilizeLabel('NONE');
        setInteractionInfo({ label: stableLabel, command: 'NONE', pinch: 0, palmX: 0, palmY: 0, palmZ: 0 });
        setStatus('请把手放到摄像头前');
      }
    } else if (mode === 'face' && faceRef.current) {
      const result = faceRef.current.detectForVideo(video, now);
      const faces = result.faceLandmarks || [];
      setDetectedCount(faces.length);
      if (faces.length) {
        const motion = analyzeFaceMotion(result, baselineRef, poseHistoryRef, headHoldRef);
        const stableLabel = stabilizeLabel(motion.rawMotion);
        drawInteractiveFace(ctx, faces[0], { ...motion, rawMotion: stableLabel });
        setInteractionInfo({
          label: stableLabel,
          command: motion.sceneCommand,
          browScore: motion.browScore,
          mouthScore: motion.mouthScore,
          yaw: motion.yaw,
          pitch: motion.pitch,
        });
        setStatus(`人脸动作：${visionLabelText(stableLabel)}`);
      } else {
        const stableLabel = stabilizeLabel('NONE');
        setInteractionInfo({ label: stableLabel, command: 'NONE', browScore: 0, mouthScore: 0, yaw: 0, pitch: 0 });
        setStatus('请把脸移动到摄像头前');
      }
    } else {
      ctx.strokeStyle = mode === 'face' ? '#70d7ff' : '#83ffbf';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      setDetectedCount(0);
      setInteractionInfo({ label: 'NONE', command: 'NONE' });
      setStatus(loadingRef.current ? '正在加载 MediaPipe 模型' : '摄像头已打开，等待模型');
    }
    rafRef.current = window.requestAnimationFrame(drawFrame);
  }, [mode, stabilizeLabel, updateFps]);

  const loadModel = useCallback(async () => {
    if (modelReady || loadingRef.current) return;
    loadingRef.current = true;
    setStatus('正在加载 MediaPipe 模型');
    try {
      const { mod, vision } = await loadVisionModule();
      if (mode === 'gesture' && mod.HandLandmarker) {
        try {
          const buffer = await fetchModelBuffer(HAND_MODEL_URL);
          handRef.current = await mod.HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetBuffer: buffer, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 2,
          });
        } catch {
          handRef.current = await mod.HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 2,
          });
        }
      } else if (mode === 'face' && mod.FaceLandmarker) {
        try {
          const buffer = await fetchModelBuffer(FACE_MODEL_URL);
          faceRef.current = await mod.FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetBuffer: buffer, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
          });
        } catch {
          faceRef.current = await mod.FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
          });
        }
      } else {
        throw new Error('MediaPipe landmarker is missing');
      }
      setModelReady(true);
      setStatus(mode === 'face' ? '人脸模型已就绪' : '手势模型已就绪');
    } catch {
      setStatus('模型加载失败，请检查网络');
    } finally {
      loadingRef.current = false;
    }
  }, [mode, modelReady]);

  const startCamera = useCallback(() => {
    if (!active || cameraActive || cameraRequestRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('浏览器不支持摄像头 API');
      return;
    }
    cameraRequestRef.current = true;
    void navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    }).then((stream) => {
      if (!activeRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        cameraRequestRef.current = false;
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play();
      }
      setCameraActive(true);
      cameraRequestRef.current = false;
      setStatus('摄像头授权成功');
      rafRef.current = window.requestAnimationFrame(drawFrame);
      void loadModel();
    }).catch(() => {
      cameraRequestRef.current = false;
      setStatus('摄像头未授权');
    });
  }, [active, cameraActive, drawFrame, loadModel]);

  useEffect(() => {
    const handlePermissionRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: string }>).detail;
      if (!active || detail?.mode !== mode) return;
      startCamera();
    };
    window.addEventListener('interaction-vision-permission-request', handlePermissionRequest);
    return () => window.removeEventListener('interaction-vision-permission-request', handlePermissionRequest);
  }, [active, mode, startCamera]);

  useEffect(() => {
    if (!active) return;
    window.dispatchEvent(new CustomEvent('preview-vision-data', {
      detail: { mode, payload: interactionInfo },
    }));
  }, [active, interactionInfo, mode]);

  useEffect(() => {
    if (active) return;
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
    setDetectedCount(0);
    setFps(0);
    setInteractionInfo({ label: 'NONE', command: 'NONE' });
  }, [active]);

  useEffect(() => () => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    handRef.current?.close?.();
    faceRef.current?.close?.();
  }, []);

  const title = mode === 'face' ? '人脸识别' : '手势识别';
  const primaryLabel = mode === 'face' ? '识别人脸' : '识别手部';
  const motionLabel = visionLabelText(interactionInfo.label || 'NONE');
  const commandLabel = visionLabelText(interactionInfo.command || 'NONE');

  return (
    <>
      <div className={`${styles.cameraPreview} nodrag nowheel`}>
        <video ref={videoRef} muted playsInline />
        {!cameraActive && (
          <div className={styles.cameraStaticIcon} aria-hidden="true">
            <svg viewBox="0 0 120 90">
              <rect x="24" y="28" width="58" height="38" rx="8" />
              <path d="M82 39 L104 29 V65 L82 55 Z" />
              <circle cx="53" cy="47" r="11" />
            </svg>
          </div>
        )}
        <canvas ref={canvasRef} className={styles.visionCanvas} />
        {!cameraActive && active && (
          <button
            type="button"
            className={styles.cameraAuthorize}
            data-state="打开摄像机"
            onClick={startCamera}
          >
            打开摄像机
          </button>
        )}
        <div className={styles.cameraStatus}>{status}</div>
      </div>
      <div className={styles.visionHudGrid}>
        <div className={styles.visionPanel}>
          <div className={styles.visionPanelTitle}>系统</div>
          <div><span>运行</span><strong>{cameraActive ? '实时' : active ? '实时' : '静态'}</strong></div>
          <div><span>摄像机</span><strong>{cameraActive ? '已打开' : '等待'}</strong></div>
          <div><span>模型</span><strong>{modelReady ? '就绪' : '加载中'}</strong></div>
          <div><span>帧率</span><strong>{fps}</strong></div>
        </div>
        <div className={styles.visionPanel}>
          <div className={styles.visionPanelTitle}>{title}</div>
          <div><span>{primaryLabel}</span><strong>{detectedCount}</strong></div>
          <div><span>动作</span><strong>{motionLabel}</strong></div>
          <div><span>指令</span><strong>{commandLabel}</strong></div>
          {mode === 'gesture' ? (
            <>
              <div><span>数字</span><strong>{interactionInfo.digit ?? '无'}</strong></div>
              <div><span>捏合</span><strong>{(interactionInfo.pinch || 0).toFixed(2)}</strong></div>
            </>
          ) : (
            <>
              <div><span>眉毛</span><strong>{(interactionInfo.browScore || 0).toFixed(2)}</strong></div>
              <div><span>嘴部</span><strong>{(interactionInfo.mouthScore || 0).toFixed(2)}</strong></div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function InteractionPreview({ id, data }: { id?: string; data: TDNodeData }) {
  const active = isInteractionNodeActive(data);
  if (data.nodeType === 'keyboard') return <KeyboardInteractionPreview id={id} data={data} />;
  if (data.nodeType === 'mouse') return <MouseInteractionPreview active={active} data={data} />;
  if (data.nodeType === 'faceRecognition') return <CameraVisionPreviewV2 mode="face" active={active} />;
  if (data.nodeType === 'gesture') return <CameraVisionPreviewV2 mode="gesture" active={active} />;
  return null;
}

function InteractionPromptBox({ id, data }: { id?: string; data: TDNodeData }) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('deepSeekV4');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!id || !prompt.trim()) return;
    data.onInteractionPromptSubmit?.(id, data.nodeType, prompt.trim(), model);
    setPrompt('');
  };

  return (
    <form className={`${styles.interactionPromptBox} nodrag nowheel`} onSubmit={submit}>
      <textarea
        value={prompt}
        placeholder="输入交互提示词"
        onChange={(event) => setPrompt(event.target.value)}
      />
      <div className={styles.interactionPromptActions}>
        <select value={model} onChange={(event) => setModel(event.target.value)}>
          <option value="deepSeekV4">deepSeekV4</option>
          <option value="chatgpt5.5">chatgpt5.5</option>
          <option value="gemini3.5">gemini3.5</option>
          <option value="mimo-v2.5-pro">mimo-v2.5-pro</option>
        </select>
        <button type="submit" disabled={!prompt.trim() || !data.onInteractionPromptSubmit}>生成</button>
      </div>
    </form>
  );
}

function TDNodeBase({ data, rfType, id }: { data: TDNodeData; rfType: string; id?: string }) {
  const cat = catFromType(data.nodeType || rfType);
  const cls = catStyles[cat] || styles.nodeScene;
  const catLabel = categoryLabels[cat] || '场景层';
  const params = data.params || {};
  const paramEntries = Object.entries(params).filter(([k]) => k !== 'interaction' && k !== 'keys' && k !== 'autoSourcePreviewId');
  const isInteraction = cat === 'interaction';
  const isFontNode = data.nodeType === 'file_font';
  const isSvgEditorNode = data.nodeType === 'vector.svgEditor';
  const isTextToolNode = data.nodeType === 'typography.textEditor';
  const isBatchRenameNode = data.nodeType === 'utility.batchRename';
  const isSmartCutoutNode = data.nodeType === 'image.smartCutout';
  const isCreativeAlgorithmNode = data.nodeType === 'creative-algorithm';
  const motionWaveform = getMotionWaveform(params, data.nodeType);

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('application/interaction-node', JSON.stringify({ nodeId: id || '', nodeType: data.nodeType || rfType, label: data.label }));
    e.dataTransfer.effectAllowed = 'link';
  };

  return (
    <div className={`${styles.node} ${cls}`}>
      <Handle type="target" position={Position.Left} style={{ width: 8, height: 8 }} />
      <div className={styles.header}>{catLabel}</div>
      <div className={styles.label}>{getNodeDisplayLabel(data.nodeType || rfType, data.label)}</div>
      {motionWaveform && (
        <div className={styles.motionNodePreview}>
          <svg viewBox="0 0 110 48" preserveAspectRatio="none" aria-hidden="true">
            <path d={motionWaveform.path} />
            <circle r="2.8">
              <animateMotion dur={`${Math.max(0.35, 2 / Number(params.speed || params.frequency || 1))}s`} repeatCount="indefinite" path={motionWaveform.path} />
            </circle>
          </svg>
          <div className={styles.motionNodeMeta}>
            <span>{motionWaveform.label}</span>
            <b>速度 {getParamDisplayValue(params.speed || params.frequency || 1)}</b>
            <b>振幅 {getParamDisplayValue(params.amplitude || 1)}</b>
          </div>
          {motionWaveform.id === 'spring' && (
            <div className={styles.springMeta}>
              <span>强度 {getParamDisplayValue(params.springConstant || 0.5)}</span>
              <span>质量 {getParamDisplayValue(params.mass || 1)}</span>
              <span>阻尼 {getParamDisplayValue(params.damping || 0.2)}</span>
            </div>
          )}
        </div>
      )}
      {isFontNode && <FontFilePreview id={id} data={data} />}
      {isTextToolNode && (
        <div className={styles.utilityPreview}>
          <div>
            <strong>{typeof params.text === 'string' && params.text ? params.text.slice(0, 24) : 'TextDocument'}</strong>
            <span>编辑文字、导入字体并转换 SVG 轮廓</span>
          </div>
          <button type="button" className="nodrag nowheel" onClick={() => id && data.onOpenTextEditor?.(id)}>
            打开工具
          </button>
        </div>
      )}
      {isBatchRenameNode && (
        <div className={styles.utilityPreview}>
          <div>
            <strong>{Number(params.selectedCount || 0)} 项 / {Number(params.ruleCount || 0)} 条规则</strong>
            <span>预览冲突、虚拟重命名或导出 ZIP</span>
          </div>
          <button type="button" className="nodrag nowheel" onClick={() => id && data.onOpenBatchRename?.(id)}>
            打开工具
          </button>
        </div>
      )}
      {isSmartCutoutNode && (
        <div className={styles.utilityPreview}>
          <div>
            <strong>{typeof params.sourceName === 'string' ? params.sourceName : 'ImageAsset'}</strong>
            <span>{params.metadata ? '已生成透明 PNG / AlphaMask' : 'AI 抠图、裁切、透明 PNG 输出'}</span>
          </div>
          <button type="button" className="nodrag nowheel" onClick={() => id && data.onOpenSmartCutout?.(id)}>
            打开工具
          </button>
        </div>
      )}
      {isCreativeAlgorithmNode && (
        <div className={styles.algorithmPreview}>
          {typeof params.preview === 'string' && <img src={params.preview} alt={data.label} />}
          <div>
            <strong>{typeof params.algorithmName === 'string' ? params.algorithmName : data.label}</strong>
            <span>{typeof params.categoryLabel === 'string' ? params.categoryLabel : '样式算法'} · {typeof params.pack === 'string' ? params.pack : 'Creative'}</span>
            <small>输出 Canvas / Texture / ImageBitmap</small>
          </div>
        </div>
      )}
      {isSvgEditorNode && (
        <div className={styles.svgEditorPreview}>
          <div>
            <strong>{typeof params.svgString === 'string' && params.svgString ? '已生成 SVG 输出' : 'VectorDocument 空白画布'}</strong>
            <span>双击节点或点击按钮进入编辑器</span>
          </div>
          <button type="button" className="nodrag nowheel" onClick={() => id && data.onOpenSvgEditor?.(id)}>
            打开编辑器
          </button>
        </div>
      )}
      {isInteraction && <InteractionPreview id={id} data={data} />}
      {isInteraction && ['keyboard', 'mouse', 'gesture', 'faceRecognition'].includes(data.nodeType) && (
        <InteractionPromptBox id={id} data={data} />
      )}
      {!isInteraction && paramEntries.length > 0 && <div className={styles.params}>{paramEntries.slice(0, motionWaveform ? 2 : 3).map(([key, val]) => <div key={key} className={styles.paramRow} title="点击编辑参数"><span className={styles.paramKey}>{key}</span><span className={styles.paramVal}>{getParamDisplayValue(val)}</span></div>)}</div>}
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8 }} />
      {isInteraction && <div className={styles.dragHandle} draggable onDragStart={handleDragStart} title="拖拽到右侧参数面板创建交互连线">↗</div>}
    </div>
  );
}

export const SceneNode = memo((props: NodeProps) => <TDNodeBase data={props.data as TDNodeData} rfType="scene" id={props.id} />);
export const GeometryNode = memo((props: NodeProps) => <TDNodeBase data={props.data as TDNodeData} rfType="geometry" id={props.id} />);
export const LightNode = memo((props: NodeProps) => <TDNodeBase data={props.data as TDNodeData} rfType="light" id={props.id} />);
export const ControlNode = memo((props: NodeProps) => <TDNodeBase data={props.data as TDNodeData} rfType="control" id={props.id} />);
export const EffectNode = memo((props: NodeProps) => <TDNodeBase data={props.data as TDNodeData} rfType="effect" id={props.id} />);
export const InteractionNode = memo((props: NodeProps) => <TDNodeBase data={props.data as TDNodeData} rfType="interaction" id={props.id} />);
export const FileNode = memo((props: NodeProps) => <TDNodeBase data={props.data as TDNodeData} rfType="file" id={props.id} />);
export const DrawingNode = memo((props: NodeProps) => <TDNodeBase data={props.data as TDNodeData} rfType="drawing" id={props.id} />);

export const nodeTypesMap = {
  scene: SceneNode,
  geometry: GeometryNode,
  light: LightNode,
  control: ControlNode,
  effect: EffectNode,
  interaction: InteractionNode,
  drawing: DrawingNode,
  file: FileNode,
};

export { catFromType as categoryFromNodeType };

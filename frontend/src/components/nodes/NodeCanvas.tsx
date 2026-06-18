import { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AppstoreOutlined,
  AimOutlined,
  BgColorsOutlined,
  BorderOuterOutlined,
  ColumnHeightOutlined,
  ColumnWidthOutlined,
  CodeOutlined,
  CopyOutlined,
  DownOutlined,
  DownloadOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GroupOutlined,
  LinkOutlined,
  MinusOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  UngroupOutlined,
} from '@ant-design/icons';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  useUpdateNodeInternals,
  type Node,
  type Edge,
  Handle,
  Position,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from 'reactflow';
import dagre from 'dagre';
import { categoryFromNodeType, getNodeDisplayLabel, getParamDisplayLabel, nodeTypesMap } from './TDNodes';
import type { TDNodeData } from './TDNodes';
import { completeNodeParams, getNodeParamSpec } from '../../utils/nodeSpec.generated';
import { PreviewWindow } from '../preview/PreviewWindow';
import { SvgEditorNode, SvgEditorNodeAdapter, createEmptyDocument, type SvgDocument } from '../../svg-editor-v9';
import {
  BatchRenameToolOverlay,
  SmartCutoutToolOverlay,
  TextEditorToolOverlay,
} from '../tools/NodeUtilityOverlays';
import type { TextDocument } from '../../text-editor-v10';
import { processRenamePlan, type BatchRenameDocument, type RenameAsset } from '../../batch-rename-v11';
import type { SmartCutoutDocument, SmartCutoutResult } from '../../smart-cutout-v12';
import {
  CanvasSnapshotFrameSource,
  createDefaultVideoExportDocument,
  VideoExportController,
  VideoExportDialog,
  type VideoExportDocument,
  type VideoExportProgress,
} from '../../video-export-v13';
import { getTemplate, savePersonalTemplate } from '../../features/creative-node-templates/templateRegistry';
import { resolveTemplateNodeType } from '../../features/creative-node-templates/templateNodeTypeAliases';
import type { CreativeTemplate, TemplateEdge, TemplateNode } from '../../features/creative-node-templates/templateTypes';
import 'reactflow/dist/style.css';
import styles from './NodeCanvas.module.css';

const PREVIEW_NODE_ID = '__preview_node__';
const PREVIEW_NODE_PREFIX = '__preview_node_';
const INTERNAL_NODE_PREFIX = '__';
const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 80;
const IMAGE_SOURCE_NODE_WIDTH = 460;
const IMAGE_SOURCE_NODE_HEIGHT = 330;
const PREVIEW_NODE_WIDTH = 370;
const PREVIEW_NODE_HEIGHT = 236;
const CODE_TEST_NODE_WIDTH = 860;
const CODE_TEST_NODE_HEIGHT = 460;
const ADD_MENU_WIDTH = 620;
const ADD_MENU_HEIGHT = 560;
const GROUP_PADDING = 10;
const SELECTION_FRAME_PADDING = 10;
const GROUP_NODE_TYPE = 'groupFrame';

function templateRuntimeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function templateNodesCenter(nodes: TemplateNode[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function templateEdgeLabel(edge: TemplateEdge): string | undefined {
  const mapped = edge.mappings
    .filter((mapping) => mapping.mode !== 'direct')
    .slice(0, 2)
    .map((mapping) => mapping.label);
  if (mapped.length > 0) return mapped.join(' · ');
  return edge.label || undefined;
}

function cloneTemplateParams(params: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!params) return {};
  try {
    return JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isPersonalTemplate(template: CreativeTemplate): boolean {
  return template.id.startsWith('personal-') || !!template.tags?.includes('personal');
}

const GROUP_COLORS = [
  'transparent',
  'rgba(255, 63, 58, 0.16)',
  'rgba(255, 149, 0, 0.16)',
  'rgba(255, 204, 0, 0.16)',
  'rgba(52, 199, 89, 0.16)',
  'rgba(50, 215, 205, 0.16)',
  'rgba(10, 132, 255, 0.16)',
  'rgba(94, 92, 230, 0.16)',
  'rgba(255, 45, 146, 0.16)',
  'rgba(174, 174, 178, 0.16)',
];

const NODE_MODEL_POINT_COST: Record<string, number> = {
  'chatgpt5.5': 26,
  'gemini3.5': 32,
  'mimo-v2.5-pro': 26,
  deepSeekV4: 18,
};
const NODE_MODEL_OPTIONS = ['deepSeekV4', 'chatgpt5.5', 'gemini3.5', 'mimo-v2.5-pro'];

interface SelectionFrameState {
  x: number;
  y: number;
  w: number;
  h: number;
  nodeIds: string[];
}

interface GroupFrameNodeData {
  label: string;
  color: string;
  nodeCount: number;
}

export interface NodeData {
  id: string;
  type: string;
  label: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
  primaryContentNodeId?: string;
  inspectableNodeIds?: string[];
  inspectableNodes?: NodeData[];
  onPreviewParamChange?: (nodeId: string, key: string, value: unknown) => void;
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
}

interface PreviewTaskResult {
  code: string;
  language?: 'threejs';
  nodes?: NodeData[];
  edges?: EdgeData[];
  refreshKey?: number;
}

interface InteractionIntent {
  nodeType: 'keyboard' | 'mouse' | 'gesture' | 'faceRecognition';
  label: string;
  params: Record<string, unknown>;
}

interface NodeCanvasProps {
  nodes: NodeData[];
  edges?: EdgeData[];
  previewNode?: {
    code: string;
    refreshKey?: number;
    referenceActive: boolean;
    referenceBackgroundUrl: string;
    isProcessing: boolean;
    generationStatus?: {
      model: string;
      message: string;
      codeLength: number;
    };
    onActivate: () => void;
    onDeactivate: () => void;
    onFullscreen: () => void;
    onSendAnnotation?: (imageFile: File, instruction: string, model?: string) => void;
  };
  /** 每次生成完成时自增，用于触发画布 fitView */
  generationKey?: number;
  onImageToCode?: (imageFile: File, instruction: string, model?: string) => void;
  onGenerateText?: (
    prompt: string,
    model: string,
    files: File[],
    apiPrompt?: string,
    baseCode?: string,
  ) => Promise<PreviewTaskResult | void> | void;
  onExpandChat?: () => void;
  onNodeSelect?: (node: NodeData | null) => void;
  onNodeSelectionChange?: (nodes: NodeData[]) => void;
  /** Called whenever the graph changes so the parent can sync global state */
  onGraphChange?: (nodes: NodeData[], edges: EdgeData[]) => void;
  onParamChange?: (nodeId: string, key: string, value: unknown) => void;
  onLiveParamsChange?: () => void;
}

interface PreviewNodeData {
  label: string;
  nodeType: 'preview';
  code: string;
  refreshKey?: number;
  referenceActive: boolean;
  referenceBackgroundUrl: string;
  isProcessing: boolean;
  generationStatus?: {
    model: string;
    message: string;
    codeLength: number;
  };
  isLivePreview?: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onFullscreen: () => void;
  onSendAnnotation?: (imageFile: File, instruction: string, model?: string) => void;
  onStartReferenceDrag?: (sourceId: string) => void;
  onOpenReferenceMenu?: (sourceId: string, clientX: number, clientY: number) => void;
  generatedNodes?: NodeData[];
  generatedEdges?: EdgeData[];
}

type AnnotationTool = 'pen' | 'rect' | 'ellipse';

interface PreviewAnnotation {
  id: number;
  tool: AnnotationTool;
  points: Array<{ x: number; y: number }>;
  text: string;
  runtimeMs: number;
}

interface ImageSourceNodeData {
  label: string;
  nodeType: 'imageSource';
  file?: File;
  previewUrl?: string;
  openPromptToken?: number;
  onFileChange: (nodeId: string, file: File, previewUrl: string) => void;
  onSubmit: (nodeId: string, file: File | undefined, instruction: string, model: string, resolution: string) => void;
  onExpandChat?: () => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface TextSourceNodeData {
  label: string;
  nodeType: 'textSource';
  fileName: string;
  content: string;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface ImageToCodeNodeData {
  label: string;
  nodeType: 'imageToCode';
  linkedFile?: File;
  linkedPreviewUrl?: string;
  onSubmit: (nodeId: string, file: File | undefined, instruction: string, model: string, resolution: string) => void;
  onExpandChat?: () => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface CodeTestNodeData {
  label: string;
  nodeType: 'codeTest';
  params?: Record<string, unknown>;
  onCodeChange?: (nodeId: string, code: string) => void;
  onRun?: (nodeId: string, code: string) => void;
}

type AssetCodeKind = 'vector' | 'data' | 'model3d' | 'audio';

interface AssetToCodeNodeData {
  label: string;
  nodeType: 'assetToCode';
  assetKind: AssetCodeKind;
  accept: string;
  file?: File;
  previewUrl?: string;
  onFileChange: (nodeId: string, file: File, previewUrl: string) => void;
  onSubmit: (nodeId: string, file: File | undefined, instruction: string, model: string, assetKind: AssetCodeKind) => void;
  onExpandChat?: () => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface TextChoiceNodeData {
  label: string;
  nodeType: 'textChoice';
  onCreateEditor: (sourceId: string, x: number, y: number) => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface TextEditorNodeData {
  label: string;
  nodeType: 'textEditor';
  content?: string;
  onSubmit: (nodeId: string, prompt: string, model: string, files: File[]) => void;
  onContentChange: (nodeId: string, content: string) => void;
  onExpandChat?: () => void;
  onStartReferenceDrag: (sourceId: string) => void;
  onOpenReferenceMenu: (sourceId: string, clientX: number, clientY: number) => void;
}

interface AddMenuState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  sourceId?: string;
}

interface ReferenceMenuState extends AddMenuState {
  sourceId: string;
}

interface CanvasMapNodeItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind: 'preview' | 'image' | 'text' | 'group' | 'default';
  imageUrl?: string;
}

interface CanvasMapLineItem {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface CanvasMapFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SvgEditorSession {
  nodeId: string;
  document: SvgDocument;
}

interface TextToolSession {
  nodeId: string;
  document?: TextDocument;
}

interface BatchRenameSession {
  nodeId: string;
  document?: BatchRenameDocument;
}

interface SmartCutoutSession {
  nodeId: string;
  document?: SmartCutoutDocument;
}

const CANVAS_MAP_WIDTH = 224;
const CANVAS_MAP_HEIGHT = 164;
const CANVAS_MAP_PADDING = 14;

const DEFAULT_CODE_TEST_CODE = `import * as THREE from 'three';

// @node:scene=Code Test Scene
// @node:camera=Camera
// @node:renderer=Renderer
// @node:mesh=Test Cube
// @node:animation=Rotate
// @connect:Code Test Scene->Test Cube
// @connect:Camera->Renderer

const container = document.getElementById('canvas-container') || document.body;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050607);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.2, 1.2),
  new THREE.MeshNormalMaterial()
);
scene.add(cube);

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
window.__disposeCallbacks?.push(() => {
  window.removeEventListener('resize', resize);
  renderer.dispose();
});

function animate() {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.014;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();`;

function isInternalNodeId(id: string): boolean {
  return id.startsWith(INTERNAL_NODE_PREFIX);
}

function isTextFile(file: File): boolean {
  return file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt');
}

function isFontFile(file: File): boolean {
  return /\.(ttf|otf)$/i.test(file.name);
}

function fontFormat(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function assetKindFromFile(file: File): AssetCodeKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.svg') || name.endsWith('.ai') || name.endsWith('.eps')) return 'vector';
  if (name.endsWith('.csv') || name.endsWith('.json') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'data';
  if (name.endsWith('.obj') || name.endsWith('.glb') || name.endsWith('.gltf')) return 'model3d';
  if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/.test(name)) return 'audio';
  return null;
}

function placeAddMenu(bounds: DOMRect, clientX: number, clientY: number): { x: number; y: number } {
  return {
    x: Math.max(12, Math.min(clientX - bounds.left, bounds.width - ADD_MENU_WIDTH - 12)),
    y: Math.max(12, Math.min(clientY - bounds.top, bounds.height - ADD_MENU_HEIGHT - 12)),
  };
}

function nodeWidth(node: Node): number {
  if (typeof node.width === 'number') return node.width;
  const styleWidth = node.style?.width;
  if (typeof styleWidth === 'number') return styleWidth;
  if (node.type === 'imageSource') return IMAGE_SOURCE_NODE_WIDTH;
  if (node.type === 'preview') return PREVIEW_NODE_WIDTH;
  if (node.type === 'codeTest') return CODE_TEST_NODE_WIDTH;
  return DEFAULT_NODE_WIDTH;
}

function nodeHeight(node: Node): number {
  if (typeof node.height === 'number') return node.height;
  const styleHeight = node.style?.height;
  if (typeof styleHeight === 'number') return styleHeight;
  if (node.type === 'imageSource') return IMAGE_SOURCE_NODE_HEIGHT;
  if (node.type === 'preview') return PREVIEW_NODE_HEIGHT;
  if (node.type === 'codeTest') return CODE_TEST_NODE_HEIGHT;
  return DEFAULT_NODE_HEIGHT;
}

function isGroupNode(node: Node): boolean {
  return node.type === GROUP_NODE_TYPE || node.type === 'group';
}

function canSelectForGroup(node: Node): boolean {
  return !node.parentNode && node.id !== PREVIEW_NODE_ID;
}

function resolvePreviewInspectionBinding(previewId: string, nodes: Node[], edges: Edge[]): {
  primaryContentNodeId?: string;
  inspectableNodeIds: string[];
} {
  const incomingByTarget = new Map<string, string[]>();
  edges.forEach((edge) => {
    incomingByTarget.set(edge.target, [...(incomingByTarget.get(edge.target) || []), edge.source]);
  });

  const directSources = incomingByTarget.get(previewId) || [];
  const visited = new Set<string>();
  const queue = [...directSources];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    queue.push(...(incomingByTarget.get(nodeId) || []));
  }

  const actualNodeIds = new Set(nodes.filter((node) => !isInternalNodeId(node.id)).map((node) => node.id));
  const inspectableNodeIds = [...visited].filter((nodeId) => actualNodeIds.has(nodeId));
  return {
    primaryContentNodeId: directSources.find((nodeId) => actualNodeIds.has(nodeId)) || inspectableNodeIds[0],
    inspectableNodeIds,
  };
}

function nodesBounds(nodes: Node[]): { x: number; y: number; w: number; h: number } | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + nodeWidth(node)));
  const maxY = Math.max(...nodes.map((node) => node.position.y + nodeHeight(node)));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Convert ReactFlow nodes back to plain NodeData (reverse of createFlowNodes) */
function flowNodesToNodeData(rfNodes: Node[]): NodeData[] {
  return rfNodes.filter((n) => !isInternalNodeId(n.id)).map((n) => {
    const data = n.data as TDNodeData;
    return {
      id: n.id,
      type: data.nodeType || '',
      label: data.label || '',
      params: data.params || {},
      position: n.positionAbsolute || n.position,
    };
  });
}

/** Convert ReactFlow edges back to plain EdgeData (reverse of createFlowEdges) */
function flowEdgesToEdgeData(rfEdges: Edge[]): EdgeData[] {
  return rfEdges
    .filter((e) => !isInternalNodeId(e.source) && !isInternalNodeId(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));
}

function isSvgDocument(value: unknown): value is SvgDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<SvgDocument>;
  return document.version === 9
    && typeof document.width === 'number'
    && typeof document.height === 'number'
    && Array.isArray(document.viewBox)
    && Array.isArray(document.rootIds)
    && typeof document.nodes === 'object';
}

function isTextDocument(value: unknown): value is TextDocument {
  return !!value && typeof value === 'object' && (value as Partial<TextDocument>).version === 10;
}

function isBatchRenameDocument(value: unknown): value is BatchRenameDocument {
  return !!value && typeof value === 'object' && (value as Partial<BatchRenameDocument>).version === 11;
}

function isSmartCutoutDocument(value: unknown): value is SmartCutoutDocument {
  return !!value && typeof value === 'object' && (value as Partial<SmartCutoutDocument>).version === 12;
}

function dagreLayout(rfNodes: Node[], rfEdges: Edge[]): Node[] {
  if (rfEdges.length === 0) return rfNodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 180, marginx: 40, marginy: 40 });

  for (const node of rfNodes) {
    g.setNode(node.id, { width: 150, height: 80 });
  }
  for (const edge of rfEdges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return rfNodes.map((node) => {
    const pos = g.node(node.id);
    if (pos) {
      return { ...node, position: { x: pos.x - 75, y: pos.y - 40 } };
    }
    return node;
  });
}

function createFlowNodes(apiNodes: NodeData[]): Node[] {
  return apiNodes.map((n) => {
    if (n.type === 'codeTest') {
      return {
        id: n.id,
        type: 'codeTest',
        position: n.position,
        data: {
          label: n.label,
          nodeType: 'codeTest',
          params: n.params,
        } satisfies CodeTestNodeData,
      };
    }
    const cat = categoryFromNodeType(n.type);
    return {
      id: n.id,
      type: cat,
      position: n.position,
      data: {
        label: n.label,
        nodeType: n.type,
        params: n.params,
      } satisfies TDNodeData,
    };
  });
}

function createFlowEdges(apiEdges: EdgeData[]): Edge[] {
  return apiEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: '#999', strokeWidth: 2 },
  }));
}

function getLiveNumberRange(nodeType: string, key: string, value: number): { min: number; max: number; step: number } {
  const spec = getNodeParamSpec(nodeType, key);
  const rangeMatch = spec?.range?.match(/(-?\d+(?:\.\d+)?)\s*[–-]\s*(-?\d+(?:\.\d+)?)/);
  const min = spec?.min ?? (rangeMatch ? Number(rangeMatch[1]) : Math.min(0, value - 10));
  const max = spec?.max ?? (rangeMatch ? Number(rangeMatch[2]) : Math.max(10, value + 10));
  const span = Math.abs(max - min);
  const step = span <= 1 ? 0.001 : span <= 20 ? 0.1 : 1;
  return { min, max, step };
}

function normalizeLiveParamValue(originalValue: unknown, rawValue: string): unknown {
  if (typeof originalValue === 'number') return Number(rawValue);
  if (typeof originalValue === 'boolean') return rawValue === 'true';
  return rawValue;
}

function liveParamKey(nodeId: string, key: string): string {
  return `${nodeId}::${key}`;
}

function sameLiveParamValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, data] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
}

async function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('preview video frame failed to load'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width || 1;
  canvas.height = image.naturalHeight || image.height || 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function formatRuntime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function getPreviewStaticKind(code: string): 'face' | 'gesture' | 'preview' {
  if (/faceRecognition|FaceLandmarker|faceLandmarks|人脸/i.test(code)) return 'face';
  if (/gesture|HandLandmarker|hand_landmarker|landmarks|手势|手部/i.test(code)) return 'gesture';
  return 'preview';
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`无法读取文件: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** 将文本内容编码为 data URL（UTF-8 安全） */
function textToDataURL(content: string, fileName: string): string {
  const mime = fileName.endsWith('.json') ? 'application/json'
    : fileName.endsWith('.csv') ? 'text/csv'
    : fileName.endsWith('.xml') ? 'application/xml'
    : 'text/plain';
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
}

interface ConnectedFile {
  name: string;
  dataUrl: string;
  mimeType: string;
}

/** 从连接到当前节点的上游节点中收集文件资源 */
async function collectConnectedFiles(
  nodeId: string,
  flowNodes: Node[],
  flowEdges: Edge[],
): Promise<ConnectedFile[]> {
  const incomingEdges = flowEdges.filter((e) => e.target === nodeId);
  const files: ConnectedFile[] = [];

  for (const edge of incomingEdges) {
    const sourceNode = flowNodes.find((n) => n.id === edge.source);
    if (!sourceNode) continue;
    const nd = sourceNode.data as Record<string, unknown>;
    // 允许携带文件资源的内部节点（图片/文本源等），仅跳过不提供文件数据的内部节点
    const isFileProvider = nd.nodeType === 'imageSource' || nd.nodeType === 'textSource' || nd.nodeType === 'textEditor' || nd.nodeType === 'imageToCode' || nd.nodeType === 'assetToCode';
    if (isInternalNodeId(sourceNode.id) && !isFileProvider) continue;

    try {
      // 文本源节点 — 使用 content + fileName
      if (nd.nodeType === 'textSource' && typeof nd.content === 'string' && nd.content.trim()) {
        const fileName = typeof nd.fileName === 'string' ? nd.fileName : 'data.txt';
        files.push({ name: fileName, dataUrl: textToDataURL(nd.content, fileName), mimeType: 'text/plain' });
      }
      // 文本编辑器节点 — 使用 content
      else if (nd.nodeType === 'textEditor' && typeof nd.content === 'string' && nd.content.trim()) {
        files.push({ name: 'editor-content.txt', dataUrl: textToDataURL(nd.content, 'editor-content.txt'), mimeType: 'text/plain' });
      }
      // 图片源 / 图生代码 / 资产生代码节点 — 读取 File 对象
      else if (nd.file instanceof File) {
        const dataUrl = await readFileAsDataURL(nd.file as File);
        files.push({ name: (nd.file as File).name, dataUrl, mimeType: (nd.file as File).type });
      }
      // 图片节点的 linkedFile（无独立 file 时尝试 linkedFile）
      else if (nd.linkedFile instanceof File) {
        const dataUrl = await readFileAsDataURL(nd.linkedFile as File);
        files.push({ name: (nd.linkedFile as File).name, dataUrl, mimeType: (nd.linkedFile as File).type });
      }
    } catch (err) {
      // 单个文件读取失败不中断收集
      console.warn('collectConnectedFiles: failed to read file from node', sourceNode.id, err);
    }
  }

  return files;
}

/** 在代码前注入文件资源，使其像 Processing data 文件夹一样可用 */
function injectFilesIntoCode(code: string, files: ConnectedFile[]): string {
  if (files.length === 0) return code;
  const filesJson = JSON.stringify(files);
  return `// === 连线文件资源 ${files.length}个（Processing data 风格） ===
// 使用 window.__loadAsset('文件名') 获取 data URL
// 也可以直接遍历 window.__previewFiles 数组，每项 { name, dataUrl, mimeType }
window.__previewFiles = ${filesJson};
window.__loadAsset = function(name) {
  var found = window.__previewFiles.find(function(f) { return f.name === name; });
  return found ? found.dataUrl : null;
};

${code}`;
}

function detectInteractionIntents(instruction: string): InteractionIntent[] {
  const text = instruction.trim();
  const intents: InteractionIntent[] = [];
  const keySet = new Set<string>();
  if (/wasd/i.test(text)) ['W', 'A', 'S', 'D'].forEach((key) => keySet.add(key));
  Array.from(text.matchAll(/(?:按下|按住|按键|键盘|key)\s*([a-zA-Z0-9])/gi)).forEach((match) => keySet.add(match[1].toUpperCase()));
  Array.from(text.matchAll(/([a-zA-Z0-9])\s*(?:键|key)/gi)).forEach((match) => keySet.add(match[1].toUpperCase()));
  const keys = Array.from(keySet);
  if (keys.length > 0) {
    intents.push({
      nodeType: 'keyboard',
      label: `键盘交互 ${keys.join(' ')}`,
      params: {
        keys,
        key: keys[0],
        interaction: text,
      },
    });
  }
  if (keys.length === 0 && /鼠标|mouse|点击|双击|拖拽|位移/i.test(text)) {
    intents.push({
      nodeType: 'mouse',
      label: '鼠标交互',
      params: { interaction: text },
    });
  }
  if (/人脸|脸部|面部|face/i.test(text)) {
    intents.push({
      nodeType: 'faceRecognition',
      label: '人脸识别',
      params: { interaction: text },
    });
  }
  if (/手势|手部|手掌|骨骼|骨架|gesture|hand|skeleton/i.test(text)) {
    intents.push({
      nodeType: 'gesture',
      label: '手势识别',
      params: { interaction: text },
    });
  }
  return intents;
}

function getFlowNodeWidth(node: Node): number {
  if (typeof node.width === 'number') return node.width;
  if (node.type === 'codeTest') return CODE_TEST_NODE_WIDTH;
  if (node.type === 'textEditor' || node.type === 'imageToCode' || node.type === 'assetToCode') return 620;
  if (node.type === 'imageSource') return 620;
  if (node.type === 'textSource') return 320;
  return 370;
}

function isLiveAdjustableParam(nodeType: string, key: string, value: unknown): boolean {
  if (key === 'interaction' || key === 'keys' || key === 'key') return false;
  const spec = getNodeParamSpec(nodeType, key);
  if (spec?.options?.length) return true;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return true;
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

const PreviewFlowNode = memo((props: NodeProps<PreviewNodeData>) => {
  const { id, data } = props;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>('pen');
  const [captureRequestId, setCaptureRequestId] = useState(0);
  const [capture, setCapture] = useState<{ imageDataUrl: string | null; runtimeMs: number } | null>(null);
  const [annotations, setAnnotations] = useState<PreviewAnnotation[]>([]);
  const [draft, setDraft] = useState<PreviewAnnotation | null>(null);
  const [textEditor, setTextEditor] = useState<{ x: number; y: number; shape: PreviewAnnotation; text: string } | null>(null);
  const [codeMode, setCodeMode] = useState(false);
  const [codeVisible, setCodeVisible] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPreset, setExportPreset] = useState('3840x2160');
  const [exportRatio, setExportRatio] = useState('16:9');
  const [exportTransparent, setExportTransparent] = useState(false);
  const [videoExportOpen, setVideoExportOpen] = useState(false);
  const [videoExportDocument, setVideoExportDocument] = useState<VideoExportDocument>(() => createDefaultVideoExportDocument());
  const [videoExportProgress, setVideoExportProgress] = useState<VideoExportProgress | undefined>();
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [stillImage, setStillImage] = useState<string | null>(null);
  const committingAnnotationRef = useRef(false);
  const videoExportControllerRef = useRef<VideoExportController | null>(null);
  const shouldRenderInlinePreview = !!data.code && (!!data.isLivePreview || !stillImage) && !fullscreenOpen;
  const staticKind = getPreviewStaticKind(data.code || '');

  useEffect(() => {
    setCodeCopied(false);
  }, [data.code, codeVisible]);

  useEffect(() => {
    if (!shouldRenderInlinePreview) return undefined;
    const randomFrameDelay = 900 + Math.round(Math.random() * 2400);
    const timers = [480, randomFrameDelay].map((delay) => window.setTimeout(() => setCaptureRequestId(Date.now()), delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [data.refreshKey, shouldRenderInlinePreview]);

  useEffect(() => {
    if (!fullscreenOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreenOpen(false);
        setAnnotationOpen(false);
        setDraft(null);
        setTextEditor(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenOpen]);

  const handleActivate = useCallback(() => {
    data.onActivate();
  }, [data]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (codeMode) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setFullscreenOpen(true);
    setAnnotationOpen(false);
  }, [codeMode]);

  const handleAuxClick = useCallback((event: React.MouseEvent) => {
    if (codeMode) return;
    if (event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    setFullscreenOpen(true);
    setAnnotationOpen(false);
  }, [codeMode]);

  const handleExport = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExportOpen((open) => !open);
    setCodeMode(false);
    setCaptureRequestId(Date.now());
  }, []);

  const downloadPreview = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const source = capture?.imageDataUrl || stillImage;
    if (!source) {
      setCaptureRequestId(Date.now());
      return;
    }
    const [presetWidth, presetHeight] = exportPreset.split('x').map(Number);
    const baseWidth = presetWidth || 3840;
    const baseHeight = presetHeight || 2160;
    const [width, height] = exportRatio === '1:1'
      ? [baseWidth, baseWidth]
      : exportRatio === '4:3'
        ? [baseWidth, Math.round(baseWidth * 3 / 4)]
        : exportRatio === '9:16'
          ? [Math.round(baseWidth * 9 / 16), baseWidth]
          : [baseWidth, baseHeight];
    const image = new Image();
    image.src = source;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('preview export image failed to load'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = width || 3840;
    canvas.height = height || 2160;
    const context = canvas.getContext('2d');
    if (!context) return;
    if (!exportTransparent) {
      context.fillStyle = '#000000';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const anchor = document.createElement('a');
    anchor.href = canvas.toDataURL('image/png');
    anchor.download = `visual-preview-${canvas.width}x${canvas.height}.png`;
    anchor.click();
  }, [capture?.imageDataUrl, exportPreset, exportRatio, exportTransparent, stillImage]);

  const openVideoExport = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExportOpen(false);
    setVideoExportOpen(true);
    setCaptureRequestId(Date.now());
  }, []);

  const startVideoExport = useCallback(() => {
    const source = capture?.imageDataUrl || stillImage;
    if (!source) {
      setCaptureRequestId(Date.now());
      setVideoExportProgress({
        stage: 'error',
        frameIndex: 0,
        frameCount: 0,
        progress: 0,
        elapsedMs: 0,
        estimatedRemainingMs: null,
        message: '请等待预览画面捕获完成后再导出视频',
      });
      return;
    }
    const controller = new VideoExportController({
      preview: {
        width: 1920,
        height: 1080,
        timelineDuration: videoExportDocument.range.durationSeconds,
      },
      async createFrameSource(document) {
        const canvas = await dataUrlToCanvas(source);
        return new CanvasSnapshotFrameSource(canvas, document.range.durationSeconds, document.size.fit);
      },
      onProgress: setVideoExportProgress,
    });
    videoExportControllerRef.current = controller;
    void controller.export(videoExportDocument).catch((error) => {
      setVideoExportProgress({
        stage: error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'error',
        frameIndex: 0,
        frameCount: 0,
        progress: 0,
        elapsedMs: 0,
        estimatedRemainingMs: null,
        message: error instanceof Error ? error.message : '视频导出失败',
      });
    });
  }, [capture?.imageDataUrl, stillImage, videoExportDocument]);

  const cancelVideoExport = useCallback(() => {
    videoExportControllerRef.current?.cancel();
  }, []);

  const handleFullscreenClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setFullscreenOpen(true);
    setAnnotationOpen(false);
  }, []);

  const handleCodeModeClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setCodeMode((open) => !open);
  }, []);

  const handleCopyCode = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!codeVisible || !data.code) return;
    void copyTextToClipboard(data.code).then((copied) => {
      if (!copied) return;
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1400);
    }).catch(() => undefined);
  }, [codeVisible, data.code]);

  const requestCapture = useCallback((event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setAnnotationOpen((open) => !open);
    setCaptureRequestId(Date.now());
  }, []);

  const closeAnnotation = useCallback((event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    setAnnotationOpen(false);
    setDraft(null);
    setTextEditor(null);
  }, []);

  const pointFromEvent = useCallback((event: React.PointerEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    };
  }, []);

  const startDraw = useCallback((event: React.PointerEvent) => {
    if (!annotationOpen || textEditor) return;
    if (annotations.length >= 8) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    const next: PreviewAnnotation = {
      id: annotations.length + 1,
      tool: annotationTool,
      points: [point],
      text: '',
      runtimeMs: capture?.runtimeMs || 0,
    };
    setDraft(next);
    try {
      if (event.currentTarget.isConnected) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } catch {
      // The annotation layer can be replaced while drawing; ignore stale pointer ids.
    }
  }, [annotationOpen, annotationTool, annotations.length, capture?.runtimeMs, pointFromEvent, textEditor]);

  const updateDraw = useCallback((event: React.PointerEvent) => {
    if (!draft) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event);
    setDraft((current) => {
      if (!current) return null;
      if (current.tool === 'pen') return { ...current, points: [...current.points, point] };
      return { ...current, points: [current.points[0], point] };
    });
  }, [draft, pointFromEvent]);

  const finishDraw = useCallback((event: React.PointerEvent) => {
    if (!draft) return;
    event.preventDefault();
    event.stopPropagation();
    const last = draft.points[draft.points.length - 1] || draft.points[0];
    setTextEditor({ x: last.x, y: last.y, shape: draft, text: '' });
    setDraft(null);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore stale pointer ids after React replaces the annotation layer.
    }
  }, [draft]);

  const buildAnnotatedFile = useCallback(async (nextAnnotations: PreviewAnnotation[]) => {
    if (!capture?.imageDataUrl || !viewportRef.current) return null;
    const rect = viewportRef.current.getBoundingClientRect();
    const img = new Image();
    img.src = capture.imageDataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('preview image failed to load'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2f80ed';
    ctx.fillStyle = '#2f80ed';
    ctx.font = '14px sans-serif';
    ctx.fillText(`运行时间 ${formatRuntime(capture.runtimeMs)}`, 12, 22);

    nextAnnotations.forEach((item) => {
      const first = item.points[0];
      const last = item.points[item.points.length - 1] || first;
      ctx.strokeStyle = '#2f80ed';
      ctx.fillStyle = '#2f80ed';
      ctx.beginPath();
      if (item.tool === 'pen') {
        item.points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
      } else if (item.tool === 'rect') {
        ctx.rect(first.x, first.y, last.x - first.x, last.y - first.y);
      } else {
        ctx.ellipse((first.x + last.x) / 2, (first.y + last.y) / 2, Math.abs(last.x - first.x) / 2, Math.abs(last.y - first.y) / 2, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(last.x, last.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(String(item.id), last.x - 4, last.y + 5);
      ctx.fillStyle = '#2f80ed';
      ctx.fillText(`${item.id}. ${item.text}`, last.x + 16, last.y + 5);
    });

    return dataUrlToFile(canvas.toDataURL('image/png'), `preview-annotation-${Date.now()}.png`);
  }, [capture]);

  const commitText = useCallback(async () => {
    if (committingAnnotationRef.current) return;
    if (!textEditor || !textEditor.text.trim()) {
      setTextEditor(null);
      return;
    }
    committingAnnotationRef.current = true;
    const nextAnnotation = { ...textEditor.shape, text: textEditor.text.trim() };
    const nextAnnotations = [...annotations, nextAnnotation];
    setAnnotations(nextAnnotations);
    setTextEditor(null);

    let file: File | null = null;
    try {
      file = await buildAnnotatedFile(nextAnnotations);
    } finally {
      committingAnnotationRef.current = false;
    }
    if (!file || !data.onSendAnnotation) return;
    const instruction = [
      '这是预览节点截图和用户注释，请根据编号标注理解用户想修改的位置与要求。',
      `运行时间：${formatRuntime(nextAnnotation.runtimeMs)}`,
      ...nextAnnotations.map((item) => `${item.id}. ${item.text}`),
    ].join('\n');
    data.onSendAnnotation(file, instruction, 'deepseekv4');
  }, [annotations, buildAnnotatedFile, data, textEditor]);

  const renderAnnotation = useCallback((item: PreviewAnnotation, isDraft = false) => {
    const first = item.points[0];
    const last = item.points[item.points.length - 1] || first;
    if (!first) return null;
    const stroke = isDraft ? '#7ab7ff' : '#2f80ed';
    if (item.tool === 'pen') {
      return (
        <polyline
          key={`${item.id}-${isDraft ? 'draft' : 'done'}`}
          points={item.points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
    if (item.tool === 'rect') {
      return (
        <rect
          key={`${item.id}-${isDraft ? 'draft' : 'done'}`}
          x={Math.min(first.x, last.x)}
          y={Math.min(first.y, last.y)}
          width={Math.abs(last.x - first.x)}
          height={Math.abs(last.y - first.y)}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
        />
      );
    }
    return (
      <ellipse
        key={`${item.id}-${isDraft ? 'draft' : 'done'}`}
        cx={(first.x + last.x) / 2}
        cy={(first.y + last.y) / 2}
        rx={Math.abs(last.x - first.x) / 2}
        ry={Math.abs(last.y - first.y) / 2}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
      />
    );
  }, []);

  const textEditorStyle = useMemo(() => {
    if (!textEditor) return undefined;
    const width = viewportRef.current?.clientWidth || window.innerWidth;
    const height = viewportRef.current?.clientHeight || window.innerHeight;
    return {
      left: Math.min(Math.max(12, textEditor.x + 12), Math.max(12, width - 560)),
      top: Math.min(Math.max(12, textEditor.y + 12), Math.max(12, height - 76)),
    };
  }, [textEditor]);

  const annotationLayer = (
    <div className={`${styles.annotationLayer} nodrag nowheel`}>
      <div className={styles.annotationToolbar}>
        <button type="button" className={annotationTool === 'pen' ? styles.annotationToolActive : ''} onClick={() => setAnnotationTool('pen')}>&#9998;</button>
        <button type="button" className={annotationTool === 'rect' ? styles.annotationToolActive : ''} onClick={() => setAnnotationTool('rect')}>&#9633;</button>
        <button type="button" className={annotationTool === 'ellipse' ? styles.annotationToolActive : ''} onClick={() => setAnnotationTool('ellipse')}>&#9675;</button>
        <button type="button" className={styles.annotationCloseButton} onClick={closeAnnotation} aria-label="关闭">&#215;</button>
      </div>
      <div className={styles.annotationRuntime}>Run {formatRuntime(capture?.runtimeMs || 0)}</div>
      <svg
        className={styles.annotationSvg}
        onPointerDown={startDraw}
        onPointerMove={updateDraw}
        onPointerUp={finishDraw}
        onPointerCancel={finishDraw}
      >
        {annotations.map((item) => (
          <g key={item.id}>
            {renderAnnotation(item)}
            <circle
              cx={(item.points[item.points.length - 1] || item.points[0]).x}
              cy={(item.points[item.points.length - 1] || item.points[0]).y}
              r="12"
              fill="#2f80ed"
            />
            <text
              x={(item.points[item.points.length - 1] || item.points[0]).x}
              y={(item.points[item.points.length - 1] || item.points[0]).y + 5}
              textAnchor="middle"
              fill="#fff"
              fontSize="14"
              fontWeight="700"
            >
              {item.id}
            </text>
          </g>
        ))}
        {draft && renderAnnotation(draft, true)}
      </svg>
      {textEditor && (
        <div className={styles.annotationCommentBar} style={textEditorStyle}>
          <span className={styles.annotationCommentBadge}>{textEditor.shape.id}</span>
          <div className={styles.annotationCommentInputWrap}>
            <span className={styles.annotationSliderIcon}>&#8984;</span>
            <textarea
              autoFocus
              className={styles.annotationTextInput}
              value={textEditor.text}
              placeholder="Add comment..."
              onChange={(event) => setTextEditor((current) => (current ? { ...current, text: event.target.value } : current))}
              onBlur={commitText}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  commitText();
                }
              }}
            />
            <span className={styles.annotationMicIcon}>&#9834;</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
    <div
      className={`${styles.previewNode} nowheel ${data.referenceActive ? styles.previewNodeActive : ''}`}
      onClick={handleActivate}
      onAuxClick={handleAuxClick}
      onWheel={handleWheel}
      onWheelCapture={handleWheel}
    >
      <Handle type="target" position={Position.Left} className={styles.largeHandle} />
      {data.onStartReferenceDrag && data.onOpenReferenceMenu && (
        <Handle
          type="source"
          position={Position.Right}
          className={styles.largeHandle}
          onMouseDown={() => data.onStartReferenceDrag?.(id)}
          onClick={(event) => data.onOpenReferenceMenu?.(id, event.clientX + 64, event.clientY)}
        />
      )}
      {exportOpen ? (
        <div className={`${styles.previewExportBar} nodrag`}>
          <DownloadOutlined />
          <select value={exportPreset} onChange={(event) => setExportPreset(event.target.value)} aria-label="下载像素">
            <option value="1920x1080">1920 × 1080</option>
            <option value="2560x1440">2560 × 1440</option>
            <option value="3840x2160">3840 × 2160</option>
          </select>
          <select value={exportRatio} onChange={(event) => setExportRatio(event.target.value)} aria-label="下载比例">
            <option value="16:9">16:9</option>
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
            <option value="9:16">9:16</option>
          </select>
          <label>
            <input type="checkbox" checked={exportTransparent} onChange={(event) => setExportTransparent(event.target.checked)} />
            透明底图
          </label>
          <button type="button" title="确认下载" onClick={downloadPreview}><DownloadOutlined /></button>
          <button type="button" title="下载视频" onClick={openVideoExport}>视频</button>
          <button type="button" title="关闭下载选项" onClick={handleExport}>×</button>
        </div>
      ) : (
        <>
          <div className={styles.previewTitle}>
            <span>{data.label}</span>
            <span>{data.isProcessing ? '运行中' : '预览'}</span>
          </div>
          <div className={`${styles.previewToolbar} nodrag`}>
            <button
              type="button"
              title="代码模式"
              className={codeMode ? styles.previewToolbarActive : ''}
              onClick={handleCodeModeClick}
            >
              <CodeOutlined />
            </button>
            <button type="button" title="下载画面" onClick={handleExport}><DownloadOutlined /></button>
            <button type="button" title="全屏扩大" onClick={handleFullscreenClick}>↗</button>
          </div>
        </>
      )}
      <div className={styles.previewViewport} onAuxClick={handleAuxClick} onWheel={handleWheel} onWheelCapture={handleWheel}>
        {shouldRenderInlinePreview ? (
          <PreviewWindow
            code={data.code}
            refreshKey={data.refreshKey}
            referenceActive={data.referenceActive}
            referenceBackgroundUrl={data.referenceBackgroundUrl}
            captureRequestId={captureRequestId}
            onCapture={(payload) => {
              setCapture({ imageDataUrl: payload.imageDataUrl, runtimeMs: payload.runtimeMs });
              if (payload.imageDataUrl) setStillImage(payload.imageDataUrl);
            }}
          />
        ) : (
          <div className={styles.previewIdleFrame}>
            {stillImage ? (
              <img src={stillImage} alt="preview still" />
            ) : (
              <div className={styles.previewStaticIconFrame}>
                {staticKind === 'gesture' && (
                  <svg viewBox="0 0 120 90" aria-hidden="true">
                    <polyline points="22,70 34,50 44,32 52,18 60,34 68,16 76,38 86,24 90,52 104,48" />
                    {[22, 34, 44, 52, 60, 68, 76, 86, 90, 104].map((x, index) => (
                      <circle key={x} cx={x} cy={[70, 50, 32, 18, 34, 16, 38, 24, 52, 48][index]} r="4" />
                    ))}
                  </svg>
                )}
                {staticKind === 'face' && (
                  <svg viewBox="0 0 120 90" aria-hidden="true">
                    <ellipse cx="60" cy="45" rx="34" ry="38" />
                    <circle cx="47" cy="39" r="4" />
                    <circle cx="73" cy="39" r="4" />
                    <polyline points="58,46 54,56 63,56" />
                    <path d="M47 65 Q60 73 73 65" />
                  </svg>
                )}
                <strong>{data.code ? '静止预览' : '等待代码'}</strong>
                <span>{data.code ? '实时渲染已暂停' : '生成后自动实时渲染'}</span>
              </div>
            )}
          </div>
        )}
        {data.isProcessing && (
          <div className={styles.previewProcessing}>
            <div className={styles.previewSpinner} />
            <strong>{data.generationStatus?.model || 'deepSeekV4'}</strong>
            <span>{data.generationStatus?.message || 'AI 正在生成代码...'}</span>
            <small>{data.generationStatus?.codeLength || 0} 字符已返回</small>
          </div>
        )}
        {codeMode && (
          <div className={`${styles.previewCodeMode} nodrag nowheel`} data-preview-code-mode="true">
            <div className={styles.previewCodeActions}>
              <button
                type="button"
                title={codeVisible ? '隐藏代码' : '显示代码'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setCodeVisible((visible) => !visible);
                }}
              >
                {codeVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              </button>
              {codeVisible && (
                <button type="button" className={codeCopied ? styles.previewCopyButtonDone : ''} title="复制代码" onClick={handleCopyCode}>
                  {codeCopied ? '已复制' : <CopyOutlined />}
                </button>
              )}
            </div>
            <pre className={codeVisible ? styles.previewCodeText : `${styles.previewCodeText} ${styles.previewCodeBlurred}`}>
              {data.code || '暂无生成代码'}
            </pre>
          </div>
        )}
        {annotationOpen && !fullscreenOpen && (
          <div className={`${styles.annotationLayer} nodrag nowheel`}>
            <div className={styles.annotationToolbar}>
              <button type="button" className={annotationTool === 'pen' ? styles.annotationToolActive : ''} onClick={() => setAnnotationTool('pen')}>✎</button>
              <button type="button" className={annotationTool === 'rect' ? styles.annotationToolActive : ''} onClick={() => setAnnotationTool('rect')}>▢</button>
              <button type="button" className={annotationTool === 'ellipse' ? styles.annotationToolActive : ''} onClick={() => setAnnotationTool('ellipse')}>○</button>
              <button type="button" className={styles.annotationCloseButton} onClick={closeAnnotation} aria-label="关闭">&#215;</button>
            </div>
      <div className={styles.annotationRuntime}>Run {formatRuntime(capture?.runtimeMs || 0)}</div>
            <svg
              className={styles.annotationSvg}
              onPointerDown={startDraw}
              onPointerMove={updateDraw}
              onPointerUp={finishDraw}
              onPointerCancel={finishDraw}
            >
              {annotations.map((item) => (
                <g key={item.id}>
                  {renderAnnotation(item)}
                  <circle
                    cx={(item.points[item.points.length - 1] || item.points[0]).x}
                    cy={(item.points[item.points.length - 1] || item.points[0]).y}
                    r="12"
                    fill="#2f80ed"
                  />
                  <text
                    x={(item.points[item.points.length - 1] || item.points[0]).x}
                    y={(item.points[item.points.length - 1] || item.points[0]).y + 5}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="14"
                    fontWeight="700"
                  >
                    {item.id}
                  </text>
                </g>
              ))}
              {draft && renderAnnotation(draft, true)}
            </svg>
            {textEditor && (
              <div className={styles.annotationCommentBar}>
                <span className={styles.annotationCommentBadge}>{textEditor.shape.id}</span>
                <div className={styles.annotationCommentInputWrap}>
                  <span className={styles.annotationSliderIcon}>⌘</span>
                  <textarea
                    autoFocus
                    className={styles.annotationTextInput}
                    value={textEditor.text}
              placeholder="Add comment..."
                    onChange={(event) => setTextEditor((current) => (current ? { ...current, text: event.target.value } : current))}
                    onBlur={commitText}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        commitText();
                      }
                    }}
                  />
                  <span className={styles.annotationMicIcon}>♩</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div className={`${styles.previewHitArea} nowheel nodrag`} onAuxClick={handleAuxClick} onWheel={handleWheel} onWheelCapture={handleWheel} />
      </div>
    </div>
    <VideoExportDialog
      open={videoExportOpen}
      document={videoExportDocument}
      previewWidth={1920}
      previewHeight={1080}
      timelineDuration={videoExportDocument.range.durationSeconds}
      progress={videoExportProgress}
      onChange={setVideoExportDocument}
      onStart={startVideoExport}
      onCancel={cancelVideoExport}
      onClose={() => setVideoExportOpen(false)}
    />
    {fullscreenOpen && createPortal((
      <div
        className={styles.previewPureFullscreen}
        ref={viewportRef}
        onWheel={handleWheel}
        onWheelCapture={handleWheel}
      >
        <PreviewWindow
          code={data.code}
          refreshKey={data.refreshKey}
          referenceActive={data.referenceActive}
          referenceBackgroundUrl={data.referenceBackgroundUrl}
          captureRequestId={captureRequestId}
          onCapture={(payload) => {
            setCapture({ imageDataUrl: payload.imageDataUrl, runtimeMs: payload.runtimeMs });
            if (payload.imageDataUrl) setStillImage(payload.imageDataUrl);
          }}
        />
        <div className={styles.previewFullscreenToolbar}>
          <button
            type="button"
            className={annotationOpen ? styles.previewFullscreenActive : ''}
            onClick={requestCapture}
            title="注释"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setFullscreenOpen(false);
              setAnnotationOpen(false);
              setDraft(null);
              setTextEditor(null);
            }}
            title="退出"
          >
            ×
          </button>
        </div>
        {annotationOpen && annotationLayer}
      </div>
  ), document.body)}
    </>
  );
});

const CodeTestFlowNode = memo((props: NodeProps<CodeTestNodeData>) => {
  const { id, data } = props;
  const { getNodes, getEdges } = useReactFlow();
  const initialDraft = typeof data.params?.draftCode === 'string'
    ? data.params.draftCode
    : typeof data.params?.code === 'string'
      ? data.params.code
      : DEFAULT_CODE_TEST_CODE;
  const [draftCode, setDraftCode] = useState(initialDraft);
  const [localCode, setLocalCode] = useState(typeof data.params?.code === 'string' ? data.params.code : '');
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [connectedFiles, setConnectedFiles] = useState<ConnectedFile[]>([]);
  // 文件注入代码仅保存在 ref 中，不存入持久化参数（避免 base64 污染文本编辑器）
  const fileInjectionRef = useRef('');
  const [fileInjectionVer, setFileInjectionVer] = useState(0);
  // runningCode = 文件注入 + 用户代码（注入始终从 ref 读取，不依赖被污染的 params）
  const runningCode = useMemo(() => {
    const baseCode = (typeof data.params?.code === 'string' && data.params.code.trim())
      ? data.params.code
      : localCode;
    if (!baseCode) return '';
    void fileInjectionVer;
    return fileInjectionRef.current + baseCode;
  }, [data.params?.code, localCode, fileInjectionVer]);
  const refreshKey = typeof data.params?.refreshKey === 'number' ? data.params.refreshKey : localRefreshKey;

  // 仅在 draftCode 确实是用户输入（不含注入标记）时同步
  useEffect(() => {
    if (typeof data.params?.draftCode === 'string') {
      const v = data.params.draftCode;
      // 如果参数里的 draftCode 已被注入污染（以注入注释开头），忽略同步
      if (v.startsWith('// === 连线文件资源') || v.startsWith('window.__previewFiles')) return;
      setDraftCode(v);
    }
  }, [data.params?.draftCode]);

  // edges 变化或首次挂载时自动重新收集文件注入（页面刷新后也能恢复）
  useEffect(() => {
    let cancelled = false;
    const allNodes = getNodes();
    const allEdges = getEdges();
    collectConnectedFiles(id, allNodes, allEdges).then((files) => {
      if (cancelled) return;
      fileInjectionRef.current = injectFilesIntoCode('', files);
      setFileInjectionVer((v) => v + 1);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id, getNodes, getEdges]);

  // 监听 iframe 发来的 preview-error 消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'preview-error') return;
      const msg = String(event.data.message || 'Unknown error');
      setPreviewError(msg);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 检测已连接的资源节点变化，显示连接指示
  const updateConnectedFiles = useCallback(() => {
    const allNodes = getNodes();
    const allEdges = getEdges();
    const incoming = allEdges.filter((e) => e.target === id);
    const names: ConnectedFile[] = [];
    for (const edge of incoming) {
      const src = allNodes.find((n) => n.id === edge.source);
      if (!src) continue;
      const nd = src.data as Record<string, unknown>;
      // 允许携带文件资源的内部节点（图片/文本源等），仅跳过不提供文件数据的内部节点
      const isFileProvider = nd.nodeType === 'imageSource' || nd.nodeType === 'textSource' || nd.nodeType === 'textEditor' || nd.nodeType === 'imageToCode' || nd.nodeType === 'assetToCode';
      if (isInternalNodeId(src.id) && !isFileProvider) continue;
      const getFileName = (file: File | unknown): string | null => {
        if (file instanceof File) return file.name;
        if (typeof file === 'string' && file) {
          // 去掉 blob: 或 data: 前缀，只保留实际文件名部分
          const stripped = file.replace(/^blob:|^data:[^,]+,/, '').replace(/\?.*$/, '');
          const segments = stripped.split('/');
          return segments[segments.length - 1] || null;
        }
        return null;
      };
      const fileName = getFileName(nd.file ?? nd.linkedFile);
      if (nd.nodeType === 'textSource' && typeof nd.fileName === 'string') {
        names.push({ name: nd.fileName as string, dataUrl: '', mimeType: 'text/plain' });
      } else if (fileName) {
        const mime = nd.file instanceof File ? (nd.file as File).type : (nd.linkedFile instanceof File ? (nd.linkedFile as File).type : 'application/octet-stream');
        names.push({ name: fileName, dataUrl: '', mimeType: mime });
      } else if (nd.nodeType === 'textEditor') {
        names.push({ name: 'editor-content.txt', dataUrl: '', mimeType: 'text/plain' });
      }
    }
    setConnectedFiles(names);
  }, [id, getNodes, getEdges]);

  // 当边变化时刷新连接指示
  useEffect(() => {
    updateConnectedFiles();
  }, [updateConnectedFiles]);

  const updateDraft = useCallback((value: string) => {
    setDraftCode(value);
    data.onCodeChange?.(id, value);
  }, [data, id]);

  const runCode = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setPreviewError(null);

    const allNodes = getNodes();
    const allEdges = getEdges();

    // 从连线节点收集文件资源
    let fileInjection = '';
    try {
      const files = await collectConnectedFiles(id, allNodes, allEdges);
      fileInjection = injectFilesIntoCode('', files);
      updateConnectedFiles();
    } catch (err) {
      console.warn('CodeTest: file collection failed', err);
    }

    fileInjectionRef.current = fileInjection;
    setFileInjectionVer((v) => v + 1);
    const codeToRun = fileInjection + draftCode;
    setLocalCode(codeToRun);
    setLocalRefreshKey(Date.now());
    // 只传递干净的用户代码给 onRun，注入代码仅在 ref 中运行
    data.onRun?.(id, draftCode);
  }, [data, draftCode, id, getNodes, getEdges, updateConnectedFiles]);

  const resetCode = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setPreviewError(null);
    updateDraft(DEFAULT_CODE_TEST_CODE);
  }, [updateDraft]);

  return (
    <div className={styles.codeTestNode}>
      <Handle type="target" position={Position.Left} className={`${styles.largeHandle} ${connectedFiles.length ? styles.codeTestHandleConnected : ''}`} />
      <Handle type="source" position={Position.Right} className={styles.largeHandle} />
      <div className={styles.codeTestHeader}>
        <div>
          <strong>{data.label || '代码测试节点'}</strong>
          <span>
            粘贴产品 JS 代码，点击播放预览
            {connectedFiles.length > 0 && (
              <span className={styles.codeTestDataHint}>
                · 已连接 {connectedFiles.length} 个文件：{connectedFiles.map((f) => f.name).join(', ')}
              </span>
            )}
          </span>
        </div>
        <div className={`${styles.codeTestActions} nodrag nowheel`}>
          <button type="button" onClick={resetCode}>重置</button>
          <button type="button" className={styles.codeTestPlayButton} onClick={runCode}>
            <PlayCircleOutlined />
            播放
          </button>
        </div>
      </div>
      <div className={styles.codeTestBody}>
        <textarea
          className={`${styles.codeTestEditor} nodrag nowheel`}
          value={draftCode}
          spellCheck={false}
          onChange={(event) => updateDraft(event.target.value)}
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          placeholder="把其他模型转换出的产品 JS 代码粘贴到这里"
        />
        <div className={styles.codeTestPreview}>
          {runningCode.trim() ? (
            <PreviewWindow code={runningCode} refreshKey={refreshKey} referenceActive={false} referenceBackgroundUrl="" />
          ) : (
            <div className={styles.codeTestEmpty}>点击播放后显示预览</div>
          )}
          {previewError && (
            <div className={styles.codeTestError} onClick={() => setPreviewError(null)} title="点击关闭">
              <div className={styles.codeTestErrorHeader}>
                <span>⚠ 运行错误</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewError(null); }}>×</button>
              </div>
              <pre className={styles.codeTestErrorMessage}>{previewError}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const ImageSourceFlowNode = memo((props: NodeProps<ImageSourceNodeData>) => {
  const { id, data } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('deepSeekV4');
  const [resolution, setResolution] = useState('16:9 · 2K');
  const [modelOpen, setModelOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);

  const acceptFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    data.onFileChange(id, file, URL.createObjectURL(file));
  }, [data, id]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  }, [acceptFile]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [expanded, id, updateNodeInternals]);

  useEffect(() => {
    if (data.openPromptToken) {
      setExpanded(true);
    }
  }, [data.openPromptToken]);

  const submit = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    data.onSubmit(id, data.file, prompt, model, resolution);
  }, [data, id, prompt, model, resolution]);

  const toggleExpanded = useCallback(() => {
    setExpanded((open) => !open);
  }, []);

  return (
    <div
      className={`${styles.imageSourceNode} ${expanded ? styles.imageSourceNodeExpanded : ''}`}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
    >
      <div className={styles.imageSourceFrame} onClick={toggleExpanded}>
        <Handle type="target" position={Position.Left} className={styles.largeHandle} />
        <Handle
          type="source"
          position={Position.Right}
          className={styles.largeHandle}
          onMouseDown={() => data.onStartReferenceDrag(id)}
          onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
        />
        <div className={styles.imageNodeTitle}>图片节点</div>
        <button
          type="button"
          className={`${styles.uploadPill} nodrag`}
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          上传
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) acceptFile(file);
            event.target.value = '';
          }}
        />
        {data.previewUrl ? (
          <img src={data.previewUrl} alt={data.file?.name || 'image'} className={styles.imagePreview} />
        ) : (
          <div className={styles.imagePlaceholder}>
            <div className={styles.imageGlyph}>▰</div>
            <div className={styles.imageHint}>拖入图片或点击上传</div>
          </div>
        )}
      </div>
      {expanded && (
        <div className={styles.imagePromptPanel} onClick={(event) => event.stopPropagation()}>
          <button type="button" className={`${styles.expandNodeBtn} nodrag`} onClick={data.onExpandChat}>
            ↗
          </button>
          <div className={styles.nodePromptTools}>
            <button type="button">风格</button>
            <button type="button">标记</button>
            <button type="button">聚焦</button>
            {data.previewUrl && (
              <img src={data.previewUrl} alt="linked" className={styles.linkedThumb} />
            )}
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className={styles.imagePrompt}
            placeholder="描述你想要生成的画面内容，按/呼出指令，@引用素材"
          />
          <div className={styles.nodeBottomBar}>
            <button type="button" onClick={() => setModelOpen((open) => !open)}>
              {model}
            </button>
            <button type="button" onClick={() => setResolutionOpen((open) => !open)}>
              {resolution}
            </button>
            <button type="button">摄像机</button>
            <span>1张</span>
            <button type="button" className={styles.submitNodeBtn} onClick={submit}>&uarr;</button>
          </div>
          {modelOpen && (
            <div className={styles.modelMenu}>
              {NODE_MODEL_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === model ? styles.menuSelected : ''}
                  onClick={() => {
                    setModel(item);
                    setModelOpen(false);
                  }}
                >
                  <span>{item}</span>
                  <small>{item === 'deepSeekV4' ? '30s' : '45s'}</small>
                </button>
              ))}
            </div>
          )}
          {resolutionOpen && (
            <div className={styles.resolutionMenu}>
              <div className={styles.menuCaption}>分辨率</div>
              <div className={styles.segmentRow}>
                {['1K', '2K', '4K'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={resolution.includes(item) ? styles.menuSelected : ''}
                    onClick={() => setResolution((current) => current.replace(/1K|2K|4K/, item))}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className={styles.menuCaption}>比例</div>
              <div className={styles.ratioGrid}>
                {['自适应', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={resolution.startsWith(item) ? styles.menuSelected : ''}
                    onClick={() => {
                      const size = resolution.match(/1K|2K|4K/)?.[0] || '2K';
                      setResolution(`${item} · ${size}`);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const TextSourceFlowNode = memo((props: NodeProps<TextSourceNodeData>) => {
  const { id, data } = props;
  const excerpt = data.content.trim().slice(0, 180);

  return (
    <div className={styles.textSourceNode}>
      <Handle type="target" position={Position.Left} className={styles.largeHandle} />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.largeHandle}
        onMouseDown={() => data.onStartReferenceDrag(id)}
        onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
      />
      <div className={styles.textSourceTitle}>文本节点</div>
      <div className={styles.textSourceName}>{data.fileName}</div>
      <div className={styles.textSourceExcerpt}>{excerpt || '空文本文件'}</div>
    </div>
  );
});

const ImageToCodeFlowNode = memo((props: NodeProps<ImageToCodeNodeData>) => {
  const { id, data } = props;
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('deepSeekV4');
  const [resolution, setResolution] = useState('16:9 · 2K');
  const [modelOpen, setModelOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);

  const submit = useCallback(() => {
    data.onSubmit(id, data.linkedFile, prompt, model, resolution);
  }, [data, id, prompt, model, resolution]);

  return (
    <div className={styles.imageToCodeNode}>
      <Handle type="target" position={Position.Left} className={styles.largeHandle} />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.largeHandle}
        onMouseDown={() => data.onStartReferenceDrag(id)}
        onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
      />
      <button type="button" className={`${styles.expandNodeBtn} nodrag`} onClick={data.onExpandChat}>
        ↗
      </button>
      <div className={styles.nodePromptTools}>
        <button type="button">风格</button>
        <button type="button">标记</button>
        <button type="button">聚焦</button>
        {data.linkedPreviewUrl && (
          <img src={data.linkedPreviewUrl} alt="linked" className={styles.linkedThumb} />
        )}
      </div>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        className={styles.imagePrompt}
        placeholder="描述你想要生成的画面内容，按/呼出指令，@引用素材"
      />
      <div className={styles.nodeBottomBar}>
        <button type="button" onClick={() => setModelOpen((open) => !open)}>
          {model}
        </button>
        <button type="button" onClick={() => setResolutionOpen((open) => !open)}>
          {resolution}
        </button>
        <button type="button">摄像机</button>
        <span>1张</span>
        <button type="button" className={styles.submitNodeBtn} onClick={submit}>&uarr;</button>
      </div>
      {modelOpen && (
        <div className={styles.modelMenu}>
          {NODE_MODEL_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === model ? styles.menuSelected : ''}
              onClick={() => {
                setModel(item);
                setModelOpen(false);
              }}
            >
              <span>{item}</span>
              <small>{item === 'deepSeekV4' ? '30s' : '45s'}</small>
            </button>
          ))}
        </div>
      )}
      {resolutionOpen && (
        <div className={styles.resolutionMenu}>
          <div className={styles.menuCaption}>分辨率</div>
          <div className={styles.segmentRow}>
            {['1K', '2K', '4K'].map((item) => (
              <button
                key={item}
                type="button"
                className={resolution.includes(item) ? styles.menuSelected : ''}
                onClick={() => setResolution((current) => current.replace(/1K|2K|4K/, item))}
              >
                {item}
              </button>
            ))}
          </div>
          <div className={styles.menuCaption}>比例</div>
          <div className={styles.ratioGrid}>
            {['自适应', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9'].map((item) => (
              <button
                key={item}
                type="button"
                className={resolution.startsWith(item) ? styles.menuSelected : ''}
                onClick={() => {
                  const size = resolution.match(/1K|2K|4K/)?.[0] || '2K';
                  setResolution(`${item} · ${size}`);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

const assetKindConfig: Record<AssetCodeKind, { title: string; hint: string; icon: string }> = {
  vector: { title: '矢量图形', hint: '拖入 SVG / AI / EPS，生成矢量动画代码', icon: '▧' },
  data: { title: '数据', hint: '拖入 TXT / CSV / JSON，生成数据可视化代码', icon: '≡' },
  model3d: { title: '3D模型', hint: '拖入 OBJ / GLB / GLTF，生成三维场景代码', icon: '◻' },
  audio: { title: '音频', hint: '拖入音频，生成声音驱动的可视化代码', icon: '≋' },
};

const AssetToCodeFlowNode = memo((props: NodeProps<AssetToCodeNodeData>) => {
  const { id, data } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('deepSeekV4');
  const [modelOpen, setModelOpen] = useState(false);
  const config = assetKindConfig[data.assetKind];

  const acceptFile = useCallback((file: File) => {
    data.onFileChange(id, file, URL.createObjectURL(file));
  }, [data, id]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  }, [acceptFile]);

  const submit = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    data.onSubmit(id, data.file, prompt || config.hint, model, data.assetKind);
  }, [config.hint, data, id, model, prompt]);

  return (
    <div className={styles.assetToCodeNode} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
      <Handle type="target" position={Position.Left} className={styles.largeHandle} />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.largeHandle}
        onMouseDown={() => data.onStartReferenceDrag(id)}
        onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
      />
      <button type="button" className={`${styles.expandNodeBtn} nodrag`} onClick={data.onExpandChat}>↗</button>
      <div className={styles.assetHeader}>
        <span>{config.icon}</span>
        <strong>{config.title}</strong>
        <button
          type="button"
          className={`${styles.uploadPill} nodrag`}
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          上传
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={data.accept}
        className={styles.hiddenInput}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) acceptFile(file);
          event.target.value = '';
        }}
      />
      <div className={styles.assetPreview}>
        {data.file ? (
          data.assetKind === 'audio' && data.previewUrl ? (
            <audio src={data.previewUrl} controls className={styles.audioPreview} />
          ) : (
            <>
              <span className={styles.assetPreviewIcon}>{config.icon}</span>
              <span>{data.file.name}</span>
            </>
          )
        ) : (
          <span>{config.hint}</span>
        )}
      </div>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        className={styles.imagePrompt}
        placeholder={config.hint}
      />
      <div className={styles.nodeBottomBar}>
        <button type="button" onClick={() => setModelOpen((open) => !open)}>{model}</button>
        <span>{config.title}</span>
        <button type="button" className={styles.submitNodeBtn} onClick={submit}>↑</button>
      </div>
      {modelOpen && (
        <div className={styles.modelMenu}>
          {NODE_MODEL_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === model ? styles.menuSelected : ''}
              onClick={() => {
                setModel(item);
                setModelOpen(false);
              }}
            >
              <span>{item}</span>
              <small>{item === 'deepSeekV4' ? '30s' : '45s'}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

const TextChoiceFlowNode = memo((props: NodeProps<TextChoiceNodeData>) => {
  const { id, data } = props;

  return (
    <div className={styles.textChoiceNode}>
      <Handle type="target" position={Position.Left} className={styles.largeHandle} />
      <Handle
        type="source"
        position={Position.Right}
        className={styles.largeHandle}
        onMouseDown={() => data.onStartReferenceDrag(id)}
        onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
      />
      <div className={styles.textNodeTitle}>文本节点</div>
      <div className={styles.textNodeIcon}>☰</div>
      <div className={styles.textTryLabel}>尝试:</div>
      <button
        type="button"
        className={`${styles.textChoiceItem} nodrag`}
        onClick={() => data.onCreateEditor(id, props.xPos, props.yPos)}
      >
        <span>▤</span>自己编辑内容
      </button>
      <button type="button" className={`${styles.textChoiceItem} nodrag`}>
        <span>▶</span>文生视频
      </button>
      <button type="button" className={`${styles.textChoiceItem} nodrag`}>
        <span>▧</span>图片反推提示词
      </button>
      <button type="button" className={`${styles.textChoiceItem} nodrag`}>
        <span>♩</span>文字生音乐
      </button>
    </div>
  );
});

const TextEditorFlowNode = memo((props: NodeProps<TextEditorNodeData>) => {
  const { id, data } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(data.content || '');
  const [model, setModel] = useState('deepSeekV4');
  const [modelOpen, setModelOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    setContent(data.content || '');
  }, [data.content]);

  const submit = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    data.onSubmit(id, content, model, files);
  }, [content, data, files, id, model]);

  return (
    <div className={styles.textEditorWrap}>
      <div className={`${styles.textToolbar} nodrag`}>
        <button type="button">⊘</button>
        <button type="button">H1</button>
        <button type="button">H2</button>
        <button type="button">H3</button>
        <button type="button">¶</button>
        <button type="button">B</button>
        <button type="button">I</button>
        <button type="button">☷</button>
        <button type="button">☰</button>
        <button type="button">─</button>
        <button type="button">□</button>
        <button type="button" onClick={data.onExpandChat}>↗</button>
      </div>
      <div className={styles.textEditorTitle}>▤ 文本节点</div>
      <div
        className={styles.textEditorNode}
      >
        <Handle type="target" position={Position.Left} className={styles.largeHandle} />
        <Handle
          type="source"
          position={Position.Right}
          className={styles.largeHandle}
          onMouseDown={() => data.onStartReferenceDrag(id)}
          onClick={(event) => data.onOpenReferenceMenu(id, event.clientX + 64, event.clientY)}
        />
        <textarea
          className={`${styles.textEditorArea} nodrag`}
          value={content}
          placeholder="输入内容..."
          onChange={(event) => {
            setContent(event.target.value);
            data.onContentChange(id, event.target.value);
          }}
        />
      </div>
      <div className={styles.textPromptPanel} onClick={(event) => event.stopPropagation()}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className={styles.hiddenInput}
          onChange={(event) => {
            setFiles(Array.from(event.target.files || []));
            event.target.value = '';
          }}
        />
        <div className={styles.nodePromptTools}>
          <button type="button" onClick={() => fileInputRef.current?.click()}>上传内容</button>
          <button type="button">标记</button>
          <button type="button">引用</button>
          {files.length > 0 && <span className={styles.textFileCount}>{files.length} 个文件</span>}
        </div>
        <div className={styles.nodeBottomBar}>
          <button type="button" onClick={() => setModelOpen((open) => !open)}>
            {model}
          </button>
          <span className={styles.nodePointCost}>{NODE_MODEL_POINT_COST[model]}</span>
          <button type="button">文本</button>
          <span>{content.trim().length || 0}字</span>
          <button
            type="button"
            className={styles.submitNodeBtn}
            onClick={submit}
            disabled={!content.trim()}
          >&uarr;</button>
        </div>
        {modelOpen && (
          <div className={styles.modelMenu}>
            {NODE_MODEL_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={item === model ? styles.menuSelected : ''}
                onClick={() => {
                  setModel(item);
                  setModelOpen(false);
                }}
              >
                <span>{item}</span>
                <small>{item === 'deepSeekV4' ? '30s' : '45s'}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

const GroupFrameFlowNode = memo((props: NodeProps<GroupFrameNodeData>) => {
  const { data, selected } = props;
  return (
    <div
      className={`${styles.groupFrameNode} ${selected ? styles.groupFrameNodeSelected : ''}`}
      style={{ background: data.color || 'rgba(255, 255, 255, 0.08)' }}
    >
      <div className={styles.groupFrameLabel}>{data.nodeCount ? data.label : '分组'}</div>
    </div>
  );
});

function createPreviewFlowNode(previewNode: NonNullable<NodeCanvasProps['previewNode']>, apiNodes: NodeData[]): Node<PreviewNodeData> {
  const maxX = apiNodes.reduce((acc, node) => Math.max(acc, node.position.x), 160);
  const minY = apiNodes.reduce((acc, node) => Math.min(acc, node.position.y), 120);

  return {
    id: PREVIEW_NODE_ID,
    type: 'preview',
    position: { x: maxX + 320, y: minY },
    draggable: true,
    deletable: false,
    data: {
      label: '预览输出',
      nodeType: 'preview',
      ...previewNode,
    },
  };
}

function isFileValue(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

function compactContextText(value: string, maxLength = 1600): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function summarizeGeneratedCodeContext(code: string): string {
  const lines = code.split('\n').map((line) => line.trim()).filter(Boolean);
  const imports = lines.filter((line) => line.startsWith('import ')).slice(0, 8);
  const annotations = lines.filter((line) => line.startsWith('// @')).slice(0, 36);
  const keyLines = lines.filter((line) => (
    /OrbitControls|controls\.|new THREE\.(Scene|PerspectiveCamera|WebGLRenderer|Group|Mesh|InstancedMesh|Points|ShaderMaterial)|renderer\.|camera\.|scene\.|rootGroup|requestAnimationFrame|function animate|const \w+\s*=\s*\[\]|addEventListener\(['"](keydown|keyup|mousedown|mouseup|mousemove|pointerdown|pointermove|pointerup|wheel)|__previewVision|navigator\.mediaDevices|getUserMedia|MediaPipe|HandLandmarker|FaceLandmarker|hand_landmarker|face_landmarker|detectForVideo|landmarks|faceLandmarks|transform:\s*['"]scaleX\(-1\)|scaleX\(-1\)/.test(line)
  )).slice(0, 72);

  return [
    '【上游预览代码压缩上下文】',
    '用途：把这段代码当作本次生成/调整的基底，复用视觉风格、对象命名、数据语义和相机交互；不要逐字照抄无关细节。',
    '继承要求：新增键盘、鼠标、手势识别或人脸识别时，必须保留现有对象、动画循环和已有交互监听，只在此基础上叠加新的控制逻辑。',
    "摄像头要求：前端已内置识别运行时。禁止 import MediaPipe、禁止调用 getUserMedia、禁止创建 video/p5 capture；人脸使用 window.__previewVision.subscribe('face', callback)，手势使用 window.__previewVision.subscribe('gesture', callback)。",
    imports.length ? `imports:\n${imports.join('\n')}` : '',
    annotations.length ? `node annotations:\n${annotations.join('\n')}` : '',
    keyLines.length ? `key code lines:\n${compactContextText(keyLines.join('\n'), 3200)}` : '',
  ].filter(Boolean).join('\n');
}

function describeConnectedNode(node: Node): string {
  const data = node.data as Record<string, unknown>;
  const nodeType = typeof data.nodeType === 'string' ? data.nodeType : node.type || 'unknown';
  const label = typeof data.label === 'string' ? data.label : node.id;

  if (nodeType === 'preview') {
    const code = typeof data.code === 'string' ? summarizeGeneratedCodeContext(data.code) : '';
    const generatedNodes = Array.isArray(data.generatedNodes)
      ? compactContextText(JSON.stringify(data.generatedNodes), 2400)
      : '';
    return `- 预览节点 ${label} (${node.id})\n  数据类型: code\n  传输方式: 右侧输出端口会把完整代码作为连续调整基底传给下游节点\n  当前参数快照: ${generatedNodes || '暂无'}\n  ${code || '暂无已生成代码'}`;
  }

  if (nodeType === 'textEditor') {
    const content = typeof data.content === 'string' ? compactContextText(data.content, 1600) : '';
    return `- 对话指令 ${label} (${node.id})\n  内容: ${content || '暂无'}`;
  }

  if (nodeType === 'textSource') {
    const fileName = typeof data.fileName === 'string' ? data.fileName : 'text';
    const content = typeof data.content === 'string' ? compactContextText(data.content, 1200) : '';
    return `- 文本资料 ${label} (${node.id})\n  文件: ${fileName}\n  内容: ${content || '暂无'}`;
  }

  if (nodeType === 'imageSource') {
    const file = isFileValue(data.file) ? data.file.name : '未上传';
    return `- 图片资料 ${label} (${node.id})\n  文件: ${file}\n  数据类型: image`;
  }

  if (nodeType === 'assetToCode') {
    const file = isFileValue(data.file) ? data.file.name : '未上传';
    const assetKind = typeof data.assetKind === 'string' ? data.assetKind : 'asset';
    return `- 生成素材 ${label} (${node.id})\n  数据类型: ${assetKind}\n  文件: ${file}`;
  }

  const params = data.params && typeof data.params === 'object'
    ? compactContextText(JSON.stringify(data.params), 900)
    : '';
  return `- 节点 ${label} (${node.id})\n  类型: ${nodeType}${params ? `\n  参数: ${params}` : ''}`;
}

function CanvasInner({
  nodes,
  edges,
  previewNode,
  generationKey,
  onImageToCode,
  onGenerateText,
  onExpandChat,
  onNodeSelect,
  onNodeSelectionChange,
  onGraphChange,
  onParamChange,
  onLiveParamsChange,
}: NodeCanvasProps) {
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [contextMenu, setContextMenu] = useState<AddMenuState | null>(null);
  const [referenceMenu, setReferenceMenu] = useState<ReferenceMenuState | null>(null);
  const connectSourceRef = useRef<string | null>(null);
  const [liveParamDrafts, setLiveParamDrafts] = useState<Record<string, unknown>>({});
  const [confirmedLiveParamKeys, setConfirmedLiveParamKeys] = useState<Set<string>>(new Set());
  const [hasConfirmedLiveParams, setHasConfirmedLiveParams] = useState(false);
  const [svgEditorSession, setSvgEditorSession] = useState<SvgEditorSession | null>(null);
  const [textToolSession, setTextToolSession] = useState<TextToolSession | null>(null);
  const [batchRenameSession, setBatchRenameSession] = useState<BatchRenameSession | null>(null);
  const [smartCutoutSession, setSmartCutoutSession] = useState<SmartCutoutSession | null>(null);
  const svgEditorAdapter = useMemo(() => new SvgEditorNodeAdapter(), []);

  // ---- selection box state (right-click drag) ----
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectionFrame, setSelectionFrame] = useState<SelectionFrameState | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [arrangeMenuOpen, setArrangeMenuOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [canvasMapOpen, setCanvasMapOpen] = useState(false);
  const [gridSnapActive, setGridSnapActive] = useState(false);
  const [organizeConfirmOpen, setOrganizeConfirmOpen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(21);
  const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [lastSubmitSourceNodeId, setLastSubmitSourceNodeId] = useState<string | null>(null);
  const [activePreviewBackdrop, setActivePreviewBackdrop] = useState<{
    nodeId: string;
    code: string;
    refreshKey?: number;
    referenceBackgroundUrl: string;
  } | null>(null);
  const [latestPreviewId, setLatestPreviewId] = useState(PREVIEW_NODE_ID);
  const [, setPendingPreviewId] = useState<string | null>(null);
  const selStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSelecting = useRef(false);
  const hasSelectionDrag = useRef(false);
  const ignoreNextContextMenu = useRef(false);
  const skipNextPaneClickRef = useRef(false);

  // stale-closure insurance: always-current refs for flowNodes / flowEdges
  const flowNodesRef = useRef<Node[]>([]);
  const flowEdgesRef = useRef<Edge[]>([]);
  const imageSubmitInFlightRef = useRef(false);
  const pendingInteractionSourceRef = useRef(new Map<string, string>());
  const previewParamTimersRef = useRef(new Map<string, number>());

  const nodeTypes = useMemo(
    () => ({
      ...nodeTypesMap,
      preview: PreviewFlowNode,
      codeTest: CodeTestFlowNode,
      imageSource: ImageSourceFlowNode,
      textSource: TextSourceFlowNode,
      imageToCode: ImageToCodeFlowNode,
      assetToCode: AssetToCodeFlowNode,
      textChoice: TextChoiceFlowNode,
      textEditor: TextEditorFlowNode,
      [GROUP_NODE_TYPE]: GroupFrameFlowNode,
    }),
    [],
  );
  const initialNodes = useMemo(() => createFlowNodes(nodes), [nodes]);
  const initialEdges = useMemo(() => createFlowEdges(edges || []), [edges]);

  const layoutedNodes = useMemo(() => {
    return dagreLayout(initialNodes, initialEdges);
  }, [initialNodes, initialEdges]);

  const [flowNodes, setFlowNodes] = useNodesState(layoutedNodes);
  const [flowEdges, setFlowEdges] = useEdgesState(initialEdges);

  useEffect(() => {
    setFlowNodes((current) => {
      const internalNodes = current.filter((node) => isInternalNodeId(node.id));
      return [...layoutedNodes, ...internalNodes];
    });
    setFlowEdges((current) => {
      const internalEdges = current.filter((edge) => (
        isInternalNodeId(edge.source) || isInternalNodeId(edge.target)
      ));
      return [...initialEdges, ...internalEdges];
    });
  }, [layoutedNodes, initialEdges, setFlowNodes, setFlowEdges]);

  // 每次 generationKey 变化时自动 fitView，确保生成后的预览节点在可视区域内
  useEffect(() => {
    if (generationKey === undefined) return;
    // 延迟 50ms 等待 ReactFlow 完成布局
    const timer = setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50);
    return () => clearTimeout(timer);
  }, [generationKey, fitView]);

  // keep refs current to avoid stale closures in event listeners
  flowNodesRef.current = flowNodes;
  flowEdgesRef.current = flowEdges;

  useEffect(() => {
    setLiveParamDrafts({});
    setConfirmedLiveParamKeys(new Set());
    setHasConfirmedLiveParams(false);
    setLatestPreviewId(PREVIEW_NODE_ID);
    setPendingPreviewId(null);
  }, [previewNode?.refreshKey]);

  useEffect(() => {
    if (!previewNode?.isProcessing) {
      imageSubmitInFlightRef.current = false;
    }
  }, [previewNode?.isProcessing]);

  const activatePreviewNode = useCallback((nodeId: string) => {
    const node = flowNodesRef.current.find((item) => item.id === nodeId);
    const data = node?.data as PreviewNodeData | undefined;
    setActivePreviewBackdrop({
      nodeId,
      code: data?.code || '',
      refreshKey: data?.refreshKey,
      referenceBackgroundUrl: data?.referenceBackgroundUrl || '',
    });
    previewNode?.onActivate();
    setLatestPreviewId(nodeId);
  }, [previewNode]);

  const updateLocalPreviewNode = useCallback((previewId: string, result: PreviewTaskResult) => {
    const refreshKey = result.refreshKey || Date.now();
    const interactionSourceId = pendingInteractionSourceRef.current.get(previewId);
    pendingInteractionSourceRef.current.delete(previewId);
    setLatestPreviewId(previewId);
    setPendingPreviewId(null);
    previewNode?.onActivate();
    setFlowNodes((current) => current.map((node) => {
      if (node.id === interactionSourceId) {
        const data = node.data as TDNodeData;
        return {
          ...node,
          data: {
            ...data,
            params: {
              ...(data.params || {}),
              autoSourcePreviewId: previewId,
            },
          },
        };
      }
      if (node.id !== previewId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          code: result.code,
          refreshKey,
          isProcessing: false,
          generatedNodes: result.nodes || [],
          generatedEdges: result.edges || [],
        },
      };
    }));
    setActivePreviewBackdrop((current) => {
      return {
        nodeId: previewId,
        code: result.code,
        refreshKey,
        referenceBackgroundUrl: current?.referenceBackgroundUrl || previewNode?.referenceBackgroundUrl || '',
      };
    });
  }, [previewNode, setFlowNodes]);

  const updatePreviewGeneratedParam = useCallback((previewId: string, nodeId: string, key: string, value: unknown) => {
    setFlowNodes((current) => current.map((node) => {
      if (node.id !== previewId) return node;
      const data = node.data as PreviewNodeData;
      return {
        ...node,
        data: {
          ...data,
          generatedNodes: (data.generatedNodes || []).map((generatedNode) => (
            generatedNode.id === nodeId
              ? { ...generatedNode, params: { ...generatedNode.params, [key]: value } }
              : generatedNode
          )),
        },
      };
    }));

    const timerKey = `${previewId}:${nodeId}:${key}`;
    const previousTimer = previewParamTimersRef.current.get(timerKey);
    if (previousTimer) window.clearTimeout(previousTimer);
    const timer = window.setTimeout(async () => {
      previewParamTimersRef.current.delete(timerKey);
      const preview = flowNodesRef.current.find((node) => node.id === previewId);
      const data = preview?.data as PreviewNodeData | undefined;
      if (!data?.code) return;
      const targetNode = data.generatedNodes?.find((generatedNode) => generatedNode.id === nodeId);
      const semanticTarget = targetNode?.type === 'CreativeControls'
        ? 'GLOBAL_PARAMS 全局主体参数；请修改该字段以及实际阵列、动画或粒子系统中对应的运行逻辑'
        : `节点“${targetNode?.label || nodeId}”`;
      try {
        const response = await fetch('/api/generate/fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: data.code,
            error: `实时参数调整：将${semanticTarget}的参数 ${key} 修改为 ${JSON.stringify(value)}。必须同步修改 GLOBAL_PARAMS、对应 @param 注释和实际运行逻辑，保持其他内容不变。`,
            language: 'threejs',
            model: 'deepseekv4',
          }),
        });
        const result = await response.json();
        if (result.success && result.data?.code) {
          updateLocalPreviewNode(previewId, {
            code: result.data.code,
            language: 'threejs',
            nodes: result.data.nodes || data.generatedNodes || [],
            edges: result.data.edges || data.generatedEdges || [],
            refreshKey: Date.now(),
          });
        }
      } catch {
        // Keep the optimistic inspector value when a live update request fails.
      }
    }, 450);
    previewParamTimersRef.current.set(timerKey, timer);
  }, [setFlowNodes, updateLocalPreviewNode]);

  const failLocalPreviewNode = useCallback((previewId: string) => {
    pendingInteractionSourceRef.current.delete(previewId);
    setPendingPreviewId((current) => (current === previewId ? null : current));
    setFlowNodes((current) => current.map((node) => (
      node.id === previewId
        ? { ...node, data: { ...node.data, isProcessing: false } }
        : node
    )));
  }, [setFlowNodes]);

  const addDetectedInteractionNodes = useCallback((previewId: string, intents: InteractionIntent[]) => {
    const preview = flowNodesRef.current.find((node) => node.id === previewId);
    if (!preview || intents.length === 0) return;
    const existingTypes = new Set(flowNodesRef.current.filter((node) => {
      const data = node.data as TDNodeData;
      return data.params?.autoSourcePreviewId === previewId;
    }).map((node) => (node.data as TDNodeData).nodeType));

    const nextNodesToAdd: Node<TDNodeData>[] = [];
    const nextEdgesToAdd: Edge[] = [];
    intents.forEach((intent, index) => {
      if (existingTypes.has(intent.nodeType)) return;
      const id = `interaction_${intent.nodeType}_${Date.now()}_${index}`;
      const node: Node<TDNodeData> = {
        id,
        type: categoryFromNodeType(intent.nodeType),
        position: {
          x: preview.position.x + getFlowNodeWidth(preview) + 86,
          y: preview.position.y + index * 168,
        },
        data: {
          label: intent.label,
          nodeType: intent.nodeType,
          params: {
            ...completeNodeParams(intent.nodeType),
            ...intent.params,
            autoSourcePreviewId: previewId,
          },
        } satisfies TDNodeData,
      };
      nextNodesToAdd.push(node);
      nextEdgesToAdd.push({
        id: `e-${previewId}-${id}`,
        source: previewId,
        target: id,
        animated: true,
        style: { stroke: '#55b8ff', strokeWidth: 2 },
      });
      existingTypes.add(intent.nodeType);
    });
    if (nextNodesToAdd.length === 0) return;

    setFlowNodes((current) => (
      [...current, ...nextNodesToAdd.filter((node) => !current.some((item) => item.id === node.id))]
    ));
    setFlowEdges((current) => (
      [...current, ...nextEdgesToAdd.filter((edge) => !current.some((item) => item.id === edge.id))]
    ));
    const visionIntent = intents.find((intent) => intent.nodeType === 'faceRecognition' || intent.nodeType === 'gesture');
    if (visionIntent) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('interaction-vision-permission-request', {
          detail: { mode: visionIntent.nodeType === 'faceRecognition' ? 'face' : 'gesture' },
        }));
      }, 0);
    }
    onGraphChange?.(
      flowNodesToNodeData([...flowNodesRef.current, ...nextNodesToAdd]),
      flowEdgesToEdgeData([...flowEdgesRef.current, ...nextEdgesToAdd]),
    );
  }, [onGraphChange, setFlowEdges, setFlowNodes]);

  const buildFrameFromNodes = useCallback((selectedNodes: Node[]): SelectionFrameState | null => {
    const bounds = nodesBounds(selectedNodes);
    if (!bounds) return null;
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (!canvasBounds) return null;
    const topLeft = screenToFlowPosition({ x: canvasBounds.left, y: canvasBounds.top });
    const bottomRight = screenToFlowPosition({ x: canvasBounds.left + 1, y: canvasBounds.top + 1 });
    const zoom = Math.abs(1 / (bottomRight.x - topLeft.x || 1));
    return {
      x: (bounds.x - topLeft.x) * zoom - SELECTION_FRAME_PADDING,
      y: (bounds.y - topLeft.y) * zoom - SELECTION_FRAME_PADDING,
      w: bounds.w * zoom + SELECTION_FRAME_PADDING * 2,
      h: bounds.h * zoom + SELECTION_FRAME_PADDING * 2,
      nodeIds: selectedNodes.map((node) => node.id),
    };
  }, [screenToFlowPosition]);

  const groupSelectedNodes = useCallback(() => {
    setFlowNodes((current) => {
      const selectedIds = new Set([
        ...(selectionFrame?.nodeIds || []),
        ...current.filter((node) => node.selected).map((node) => node.id),
      ]);
      const selectedNodes = current.filter((node) => (
        selectedIds.has(node.id) && canSelectForGroup(node)
      ));
      if (selectedNodes.length < 2) return current;

      const bounds = nodesBounds(selectedNodes);
      if (!bounds) return current;
      const groupPosition = {
        x: bounds.x - GROUP_PADDING,
        y: bounds.y - GROUP_PADDING,
      };
      const groupId = `__group_${Date.now()}`;
      const groupNode: Node = {
        id: groupId,
        type: GROUP_NODE_TYPE,
        position: groupPosition,
        data: { label: '分组', color: 'transparent', nodeCount: selectedNodes.length } satisfies GroupFrameNodeData,
        style: {
          width: bounds.w + GROUP_PADDING * 2,
          height: bounds.h + GROUP_PADDING * 2,
        },
        selected: true,
      };

      setActiveGroupId(groupId);
      setSelectionFrame(null);
      setArrangeMenuOpen(false);
      setGroupMenuOpen(false);
      setColorMenuOpen(false);

      const nextNodes = [
        groupNode,
        ...current.map((node) => {
          if (!selectedIds.has(node.id)) return { ...node, selected: false };
          return {
            ...node,
            parentNode: groupId,
            extent: 'parent' as const,
            position: {
              x: node.position.x - groupPosition.x,
              y: node.position.y - groupPosition.y,
            },
            selected: false,
          };
        }),
      ];
      onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
      return nextNodes;
    });
  }, [onGraphChange, selectionFrame, setFlowNodes]);

  const arrangeSelectedNodes = useCallback((mode: 'grid' | 'horizontal' | 'vertical') => {
    const nodeIds = selectionFrame?.nodeIds || [];
    if (nodeIds.length === 0) return;

    setFlowNodes((current) => {
      const selectedNodes = current.filter((node) => nodeIds.includes(node.id) && canSelectForGroup(node));
      const bounds = nodesBounds(selectedNodes);
      if (!bounds) return current;

      const gap = 24;
      let cursorX = bounds.x;
      let cursorY = bounds.y;
      const maxHeight = Math.max(...selectedNodes.map(nodeHeight));
      const maxWidth = Math.max(...selectedNodes.map(nodeWidth));
      const cols = Math.max(1, Math.ceil(Math.sqrt(selectedNodes.length)));
      const positions = new Map<string, { x: number; y: number }>();

      selectedNodes.forEach((node, index) => {
        if (mode === 'horizontal') {
          positions.set(node.id, { x: cursorX, y: bounds.y });
          cursorX += nodeWidth(node) + gap;
          return;
        }
        if (mode === 'vertical') {
          positions.set(node.id, { x: bounds.x, y: cursorY });
          cursorY += nodeHeight(node) + gap;
          return;
        }
        const col = index % cols;
        const row = Math.floor(index / cols);
        positions.set(node.id, {
          x: bounds.x + col * (maxWidth + gap),
          y: bounds.y + row * (maxHeight + gap),
        });
      });

      const next = current.map((node) => {
        const position = positions.get(node.id);
        return position ? { ...node, position, selected: true } : node;
      });
      setSelectionFrame(buildFrameFromNodes(next.filter((node) => nodeIds.includes(node.id))));
      setArrangeMenuOpen(false);
      return next;
    });
  }, [buildFrameFromNodes, selectionFrame, setFlowNodes]);

  const duplicateSelectedNodes = useCallback(() => {
    const nodeIds = selectionFrame?.nodeIds || [];
    if (nodeIds.length === 0) return;

    const idMap = new Map<string, string>();
    const selectedIds = new Set(nodeIds);
    const stamp = Date.now();
    const copiedNodes = flowNodesRef.current
      .filter((node) => selectedIds.has(node.id) && canSelectForGroup(node))
      .map((node, index) => {
        const id = `${node.id}_copy_${stamp}_${index}`;
        idMap.set(node.id, id);
        return {
          ...node,
          id,
          position: { x: node.position.x + 42, y: node.position.y + 42 },
          selected: true,
        };
      });
    if (copiedNodes.length === 0) return;

    const copiedEdges = flowEdgesRef.current
      .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
      .map((edge, index) => ({
        ...edge,
        id: `${edge.id}_copy_${stamp}_${index}`,
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
      }));
    const copiedIds = new Set(copiedNodes.map((node) => node.id));
    const nextNodes = [
      ...flowNodesRef.current.map((node) => ({ ...node, selected: false })),
      ...copiedNodes,
    ];
    const nextEdges = [...flowEdgesRef.current, ...copiedEdges];
    setFlowNodes(nextNodes);
    setFlowEdges(nextEdges);
    setSelectionFrame(buildFrameFromNodes(nextNodes.filter((node) => copiedIds.has(node.id))));
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(nextEdges));
  }, [buildFrameFromNodes, onGraphChange, selectionFrame, setFlowEdges, setFlowNodes]);

  const ungroupActiveGroup = useCallback(() => {
    if (!activeGroupId) return;
    setFlowNodes((current) => {
      const groupNode = current.find((node) => node.id === activeGroupId);
      if (!groupNode) return current;
      return current
        .filter((node) => node.id !== activeGroupId)
        .map((node) => {
          if (node.parentNode !== activeGroupId) return node;
          return {
            ...node,
            parentNode: undefined,
            extent: undefined,
            position: {
              x: groupNode.position.x + node.position.x,
              y: groupNode.position.y + node.position.y,
            },
            selected: true,
          };
        });
    });
    setActiveGroupId(null);
    setColorMenuOpen(false);
  }, [activeGroupId, setFlowNodes]);

  const updateActiveGroupColor = useCallback((color: string) => {
    if (!activeGroupId) return;
    setFlowNodes((current) =>
      current.map((node) => {
        if (node.id !== activeGroupId) return node;
        const data = node.data as Partial<GroupFrameNodeData>;
        return { ...node, data: { ...data, color } };
      }),
    );
    setColorMenuOpen(false);
  }, [activeGroupId, setFlowNodes]);

  const saveActiveGroupAsTemplate = useCallback(() => {
    if (!activeGroupId) return;
    const groupNode = flowNodesRef.current.find((node) => node.id === activeGroupId);
    if (!groupNode) return;

    const childNodes = flowNodesRef.current.filter((node) => (
      node.parentNode === activeGroupId && !isInternalNodeId(node.id) && !isGroupNode(node)
    ));
    if (childNodes.length < 2) {
      window.alert('至少需要 2 个节点才能保存为创意模板');
      return;
    }

    const name = window.prompt('请输入创意模板名称', '我的创意模板');
    const templateName = name?.trim();
    if (!templateName) return;

    const positionedNodes = childNodes.map((node) => ({
      node,
      x: node.positionAbsolute?.x ?? groupNode.position.x + node.position.x,
      y: node.positionAbsolute?.y ?? groupNode.position.y + node.position.y,
    }));
    const minX = Math.min(...positionedNodes.map((item) => item.x));
    const minY = Math.min(...positionedNodes.map((item) => item.y));
    const maxX = Math.max(...positionedNodes.map((item) => item.x + nodeWidth(item.node)));
    const maxY = Math.max(...positionedNodes.map((item) => item.y + nodeHeight(item.node)));
    const childIds = new Set(childNodes.map((node) => node.id));

    const templateNodes: TemplateNode[] = positionedNodes.map(({ node, x, y }) => {
      const data = node.data as Partial<TDNodeData> & { semanticType?: string };
      const nodeType = data.nodeType || node.type || 'scene';
      return {
        id: node.id,
        type: nodeType,
        label: data.label || getNodeDisplayLabel(nodeType),
        position: { x: x - minX, y: y - minY },
        params: cloneTemplateParams(data.params),
      };
    });

    const templateEdges: TemplateEdge[] = flowEdgesRef.current
      .filter((edge) => childIds.has(edge.source) && childIds.has(edge.target))
      .map((edge) => {
        const edgeData = edge.data as Partial<Pick<TemplateEdge, 'mappings'>> | undefined;
        const label = typeof edge.label === 'string' ? edge.label : '';
        return {
          id: edge.id,
          source: edge.source,
          sourcePort: edge.sourceHandle || 'out',
          target: edge.target,
          targetPort: edge.targetHandle || 'in',
          label,
          mappings: Array.isArray(edgeData?.mappings)
            ? edgeData.mappings
            : [{
              id: `${edge.id}-direct`,
              mode: 'direct',
              input: edge.sourceHandle || 'out',
              output: edge.targetHandle || 'in',
              label: label || '直接连接',
            }],
        };
      });

    savePersonalTemplate({
      id: `personal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      version: '1.0.0',
      name: templateName,
      category: 'personal',
      description: `个人创意模板：${templateName}`,
      tags: ['personal'],
      insertion: {
        surface: 'host-node-canvas',
        renderGroupFrame: false,
        useHostNodeComponents: true,
        useHostEdgeComponent: true,
        useHostInspector: true,
        reuseExistingSystemNodes: false,
        insertAsSingleUndoTransaction: true,
      },
      graph: {
        group: {
          title: templateName,
          width: maxX - minX,
          height: maxY - minY,
          layoutOnly: true,
          renderFrame: false,
        },
        nodes: templateNodes,
        edges: templateEdges,
      },
    });
    window.alert('已保存为创意模板');
  }, [activeGroupId]);

  const handleOrganizeCanvas = useCallback(() => {
    fitView({ padding: 0.16, duration: 260 });
    setOrganizeConfirmOpen(true);
  }, [fitView]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 180 });
  }, [zoomOut]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 180 });
  }, [zoomIn]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        groupSelectedNodes();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [groupSelectedNodes]);

  const startReferenceDrag = useCallback((sourceId: string) => {
    connectSourceRef.current = sourceId;
    setAddMenu(null);
    setReferenceMenu(null);
  }, []);

  const openReferenceMenuAt = useCallback((sourceId: string, clientX: number, clientY: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
    setReferenceMenu({
      sourceId,
      x: clientX - bounds.left,
      y: clientY - bounds.top,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    });
  }, [screenToFlowPosition]);

  useEffect(() => {
    setFlowNodes((current) =>
      current.map((node) => (
        (node.id === PREVIEW_NODE_ID || node.id.startsWith(PREVIEW_NODE_PREFIX))
          ? {
              ...node,
              data: {
                ...node.data,
                onStartReferenceDrag: startReferenceDrag,
                onOpenReferenceMenu: openReferenceMenuAt,
              },
            }
          : node
      )),
    );
  }, [setFlowNodes, startReferenceDrag, openReferenceMenuAt]);

  const createLocalPreviewNode = useCallback((sourceId: string) => {
    if (!previewNode) return null;
    const sourceNode = flowNodesRef.current.find((node) => node.id === sourceId);
    const id = `${PREVIEW_NODE_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const previewFlowNode: Node<PreviewNodeData> = {
      id,
      type: 'preview',
      position: {
        x: (sourceNode?.position.x || 160) + (sourceNode ? getFlowNodeWidth(sourceNode) : 370) + 70,
        y: sourceNode?.position.y || 120,
      },
      draggable: true,
      data: {
        label: '预览输出',
        nodeType: 'preview',
        ...previewNode,
        code: '',
        isProcessing: true,
        onActivate: () => activatePreviewNode(id),
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, previewFlowNode]);
    setFlowEdges((current) => [
      ...current,
      {
        id: `e-${sourceId}-${id}`,
        source: sourceId,
        target: id,
        animated: true,
        style: { stroke: '#55b8ff', strokeWidth: 2 },
      },
    ]);
    setPendingPreviewId(id);
    return id;
  }, [activatePreviewNode, openReferenceMenuAt, previewNode, setFlowEdges, setFlowNodes, startReferenceDrag]);

  const bindPreviewTask = useCallback((
    previewId: string | null,
    task: Promise<PreviewTaskResult | void> | void,
    interactionIntents?: InteractionIntent[],
  ) => {
    if (!previewId || !task) return;
    void Promise.resolve(task)
      .then((result) => {
        if (result?.code) {
          updateLocalPreviewNode(previewId, result);
          if (interactionIntents?.length) addDetectedInteractionNodes(previewId, interactionIntents);
          return;
        }
        failLocalPreviewNode(previewId);
      })
      .catch(() => {
        failLocalPreviewNode(previewId);
      });
  }, [addDetectedInteractionNodes, failLocalPreviewNode, updateLocalPreviewNode]);

  const buildConnectedContext = useCallback((targetId: string) => {
    const nodeMap = new Map(flowNodesRef.current.map((node) => [node.id, node]));
    const visited = new Set<string>();
    const lines: string[] = [];
    let baseCode = '';

    const visitUpstream = (nodeId: string, depth: number) => {
      if (visited.has(nodeId) || depth > 4 || lines.length >= 14) return;
      visited.add(nodeId);
      const node = nodeMap.get(nodeId);
      if (node) {
        const data = node.data as Partial<PreviewNodeData>;
        if (!baseCode && node.type === 'preview' && typeof data.code === 'string' && data.code.trim()) {
          baseCode = data.code;
        }
        lines.push(describeConnectedNode(node));
      }
      flowEdgesRef.current
        .filter((edge) => edge.target === nodeId)
        .forEach((edge) => visitUpstream(edge.source, depth + 1));
    };

    flowEdgesRef.current
      .filter((edge) => edge.target === targetId)
      .forEach((edge) => visitUpstream(edge.source, 1));

    if (lines.length === 0) return { context: '', baseCode: '' };
    const context = [
      '【已连接节点上下文】',
      '下面是同一画布会话分支中的上游节点。按连接关系继承此前指令、代码、参数和视觉结果。',
      ...lines,
      '【连续调整要求】',
      '把用户最新提示视为这个会话分支的下一轮调整指令。若上游包含预览节点，必须在其完整代码上修改，保留未被要求改变的结构、参数、视觉风格、对象命名、动画和交互。',
      "手势/人脸识别禁止自行加载摄像头或模型；必须订阅前端内置 window.__previewVision 的 face/gesture 数据，并使用标准 @node:gesture=手势识别 / @node:faceRecognition=人脸识别 注释协议。",
      '不要直接裸调用 setPointerCapture 或 releasePointerCapture；如必须使用，必须 try/catch 捕获 NotFoundError，避免预览运行时报错。',
    ].join('\n');
    return { context, baseCode };
  }, []);

  // ---- right-click drag → rectangular selection ----
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // only on empty canvas, not on nodes/edges
      if (
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__edge') ||
        target.closest('[data-selection-ui="true"]') ||
        target.closest('.react-flow__controls') ||
        target.closest('.react-flow__minimap')
      ) return;
      e.preventDefault();
      e.stopPropagation();

      const bounds = el.getBoundingClientRect();
      isSelecting.current = true;
      hasSelectionDrag.current = false;
      setSelectionFrame(null);
      setActiveGroupId(null);
      setArrangeMenuOpen(false);
      setGroupMenuOpen(false);
      setColorMenuOpen(false);
      selStart.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      setSelBox({ x: selStart.current.x, y: selStart.current.y, w: 0, h: 0 });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isSelecting.current) return;
      e.preventDefault();
      const bounds = el.getBoundingClientRect();
      const cx = e.clientX - bounds.left;
      const cy = e.clientY - bounds.top;
      if (Math.abs(cx - selStart.current.x) > 5 || Math.abs(cy - selStart.current.y) > 5) {
        hasSelectionDrag.current = true;
      }
      setSelBox({
        x: Math.min(selStart.current.x, cx),
        y: Math.min(selStart.current.y, cy),
        w: Math.abs(cx - selStart.current.x),
        h: Math.abs(cy - selStart.current.y),
      });
    };

    const onMouseUp = (_e: MouseEvent) => {
      if (!isSelecting.current) return;
      isSelecting.current = false;
      ignoreNextContextMenu.current = hasSelectionDrag.current;
      skipNextPaneClickRef.current = hasSelectionDrag.current;

      setSelBox((current) => {
        if (!current || !hasSelectionDrag.current) return null;

        const bounds = el.getBoundingClientRect();
        // convert screen-rect corners to flow coordinates
        const tl = screenToFlowPosition({ x: bounds.left + current.x, y: bounds.top + current.y });
        const br = screenToFlowPosition({ x: bounds.left + current.x + current.w, y: bounds.top + current.y + current.h });
        const fx = Math.min(tl.x, br.x);
        const fy = Math.min(tl.y, br.y);
        const fw = Math.abs(br.x - tl.x);
        const fh = Math.abs(br.y - tl.y);

        setFlowNodes((nds) => {
          const selectedNodes: Node[] = [];
          const next = nds.map((n) => {
            if (!canSelectForGroup(n)) {
              return { ...n, selected: false };
            }
            const inRect =
              n.position.x + nodeWidth(n) >= fx &&
              n.position.x <= fx + fw &&
              n.position.y + nodeHeight(n) >= fy &&
              n.position.y <= fy + fh;
            if (inRect) selectedNodes.push(n);
            return { ...n, selected: inRect };
          });
          setSelectionFrame(selectedNodes.length > 0 ? buildFrameFromNodes(selectedNodes) : null);
          return next;
        });
        return null;
      });
    };

    el.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [buildFrameFromNodes, screenToFlowPosition, setFlowNodes]);

  // ---- blank-canvas context menu ----
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (ignoreNextContextMenu.current) {
      ignoreNextContextMenu.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setContextMenu({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    });
    setReferenceMenu(null);
    setAddMenu(null);
  }, [screenToFlowPosition]);

  // ---- delete key handling ----
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      if (!onGraphChange || deleted.length === 0) return;
      const removedIds = new Set(deleted.map((d) => d.id));
      const remaining = flowNodesRef.current.filter((n) => !removedIds.has(n.id));
      const remainingEdges = flowEdgesRef.current.filter(
        (e) => !removedIds.has(e.source) && !removedIds.has(e.target),
      );
      onGraphChange(flowNodesToNodeData(remaining), flowEdgesToEdgeData(remainingEdges));
    },
    [onGraphChange],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!onGraphChange || deleted.length === 0) return;
      const removedIds = new Set(deleted.map((d) => d.id));
      const remainingEdges = flowEdgesRef.current.filter((e) => !removedIds.has(e.id));
      onGraphChange(flowNodesToNodeData(flowNodesRef.current), flowEdgesToEdgeData(remainingEdges));
    },
    [onGraphChange],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setFlowNodes((nds) => applyNodeChanges(changes, nds)),
    [setFlowNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setFlowEdges((eds) => applyEdgeChanges(changes, eds)),
    [setFlowEdges],
  );

  const updateLinkedImageTargets = useCallback((sourceId: string, file: File, previewUrl: string) => {
    const linkedTargetIds = flowEdgesRef.current
      .filter((edge) => edge.source === sourceId && edge.target.startsWith('__image_to_code_'))
      .map((edge) => edge.target);

    setFlowNodes((current) =>
      current.map((node) => {
        if (node.id === sourceId) {
          return { ...node, data: { ...node.data, file, previewUrl } };
        }
        if (
          node.id.startsWith('__image_to_code_') &&
          (linkedTargetIds.length === 0 || linkedTargetIds.includes(node.id))
        ) {
          return { ...node, data: { ...node.data, linkedFile: file, linkedPreviewUrl: previewUrl } };
        }
        return node;
      }),
    );
  }, [setFlowNodes]);

  const updateAssetNodeFile = useCallback((nodeId: string, file: File, previewUrl: string) => {
    setFlowNodes((current) => current.map((node) => (
      node.id === nodeId
        ? { ...node, data: { ...node.data, file, previewUrl } }
        : node
    )));
  }, [setFlowNodes]);

  const submitAssetToCode = useCallback(
    (nodeId: string, file: File | undefined, instruction: string, model: string, assetKind: AssetCodeKind) => {
      if (!file || !instruction.trim() || !onGenerateText) return;
      const config = assetKindConfig[assetKind];
      const { context, baseCode } = buildConnectedContext(nodeId);
      const displayPrompt = `${config.title}: ${instruction.trim()}`;
      const apiPrompt = [
        `生成${config.title}代码: ${instruction.trim()}`,
        `素材文件: ${file.name}`,
        context,
      ].filter(Boolean).join('\n\n');
      setLastSubmitSourceNodeId(nodeId);
      const previewId = createLocalPreviewNode(nodeId);
      onExpandChat?.();
      bindPreviewTask(previewId, onGenerateText(displayPrompt, model, [file], apiPrompt, baseCode));
    },
    [bindPreviewTask, buildConnectedContext, createLocalPreviewNode, onExpandChat, onGenerateText],
  );

  const submitImageToCode = useCallback(
    (nodeId: string, file: File | undefined, instruction: string, model: string, resolution: string) => {
      if (!file || !instruction.trim() || !onImageToCode) return;
      if (previewNode?.isProcessing) return;
      if (imageSubmitInFlightRef.current) return;
      imageSubmitInFlightRef.current = true;
      setLastSubmitSourceNodeId(nodeId);
      createLocalPreviewNode(nodeId);
      onImageToCode(file, `${instruction.trim()}\nmodel:${model}\nexport:${resolution}`, model);
    },
    [createLocalPreviewNode, onImageToCode, previewNode?.isProcessing],
  );

  const submitTextToCode = useCallback(
    (nodeId: string, instruction: string, model: string, files: File[]) => {
      if (!instruction.trim() || !onGenerateText) return;
      const { context, baseCode } = buildConnectedContext(nodeId);
      const apiPrompt = context ? `${instruction.trim()}\n\n${context}` : instruction.trim();
      const interactionIntents = detectInteractionIntents(instruction);
      setLastSubmitSourceNodeId(nodeId);
      const previewId = createLocalPreviewNode(nodeId);
      onExpandChat?.();
      bindPreviewTask(previewId, onGenerateText(instruction.trim(), model, files, apiPrompt, baseCode), interactionIntents);
    },
    [bindPreviewTask, buildConnectedContext, createLocalPreviewNode, onExpandChat, onGenerateText],
  );

  const submitInteractionPrompt = useCallback(
    (nodeId: string, nodeType: string, instruction: string, model: string) => {
      if (!instruction.trim() || !onGenerateText) return;
      const interactionLabel: Record<string, string> = {
        keyboard: '键盘交互',
        mouse: '鼠标交互',
        gesture: '手势识别',
        faceRecognition: '人脸识别',
      };
      const label = interactionLabel[nodeType] || '交互';
      const { context, baseCode } = buildConnectedContext(nodeId);
      const cameraRequirement = nodeType === 'faceRecognition' || nodeType === 'gesture'
        ? [
            `前端已经提供识别运行时。禁止 import MediaPipe、禁止创建 p5 摄像头、禁止调用 getUserMedia、禁止加载任何识别模型。`,
            `只允许使用 window.__previewVision.subscribe('${nodeType === 'faceRecognition' ? 'face' : 'gesture'}', (data) => { ... }) 获取识别数据并控制场景。`,
            'data 提供 label、command，以及人脸的 mouthScore/browScore/yaw/pitch 或手势的 digit/pinch/palmX/palmY/palmZ。',
          ].join('\n')
        : '';
      const apiPrompt = [
        `请基于当前作品生成一个新的预览节点，必须包含${label}。`,
        `用户提示：${instruction.trim()}`,
        `节点协议：必须添加 // @node:${nodeType}=${label}、@interaction 和 @connect，把${label}连接到被控制对象。`,
        cameraRequirement,
        context,
      ].filter(Boolean).join('\n\n');
      const previewId = createLocalPreviewNode(nodeId);
      if (!previewId) return;
      pendingInteractionSourceRef.current.set(previewId, nodeId);
      if (nodeType === 'faceRecognition' || nodeType === 'gesture') {
        window.dispatchEvent(new CustomEvent('interaction-vision-permission-request', {
          detail: { mode: nodeType === 'faceRecognition' ? 'face' : 'gesture' },
        }));
      }
      onExpandChat?.();
      bindPreviewTask(previewId, onGenerateText(`${label}: ${instruction.trim()}`, model, [], apiPrompt, baseCode));
    },
    [bindPreviewTask, buildConnectedContext, createLocalPreviewNode, onExpandChat, onGenerateText],
  );

  const updateTextEditorContent = useCallback((nodeId: string, content: string) => {
    setFlowNodes((current) => current.map((node) => (
      node.id === nodeId
        ? { ...node, data: { ...node.data, content } }
        : node
    )));
  }, [setFlowNodes]);

  const addTextEditorNode = useCallback((sourceId: string, x: number, y: number) => {
    const id = `__text_editor_${Date.now()}`;
    const editorNode: Node<TextEditorNodeData> = {
      id,
      type: 'textEditor',
      position: { x, y },
      data: {
        label: '文本编辑',
        nodeType: 'textEditor',
        content: '',
        onSubmit: submitTextToCode,
        onContentChange: updateTextEditorContent,
        onExpandChat,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => current.filter((node) => node.id !== sourceId).concat(editorNode));
    setFlowEdges((current) =>
      current
        .filter((edge) => edge.source !== sourceId)
        .map((edge) => (
          edge.target === sourceId
            ? { ...edge, target: id, id: `e-${edge.source}-${id}` }
            : edge
        )),
    );
  }, [onExpandChat, setFlowEdges, setFlowNodes, startReferenceDrag, openReferenceMenuAt, submitTextToCode, updateTextEditorContent]);

  const addTextChoiceNode = useCallback((sourceId: string, x: number, y: number) => {
    const id = `__text_choice_${Date.now()}`;
    const textNode: Node<TextChoiceNodeData> = {
      id,
      type: 'textChoice',
      position: { x, y },
      data: {
        label: '文本节点',
        nodeType: 'textChoice',
        onCreateEditor: addTextEditorNode,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    const edge: Edge = {
      id: `e-${sourceId}-${id}`,
      source: sourceId,
      target: id,
      animated: true,
      style: { stroke: '#55b8ff', strokeWidth: 2 },
    };
    setFlowNodes((current) => [...current, textNode]);
    setFlowEdges((current) => [...current, edge]);
    setAddMenu(null);
    setReferenceMenu(null);
  }, [addTextEditorNode, setFlowEdges, setFlowNodes, startReferenceDrag, openReferenceMenuAt]);

  const addStandaloneTextChoiceNode = useCallback((x: number, y: number) => {
    const id = `__text_choice_${Date.now()}`;
    const textNode: Node<TextChoiceNodeData> = {
      id,
      type: 'textChoice',
      position: { x, y },
      data: {
        label: '文本节点',
        nodeType: 'textChoice',
        onCreateEditor: addTextEditorNode,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, textNode]);
    setAddMenu(null);
    setContextMenu(null);
  }, [addTextEditorNode, setFlowNodes, startReferenceDrag, openReferenceMenuAt]);

  const addDirectTextEditorNode = useCallback((x: number, y: number, sourceId?: string) => {
    const id = `__text_editor_${Date.now()}`;
    const editorNode: Node<TextEditorNodeData> = {
      id,
      type: 'textEditor',
      position: { x, y },
      data: {
        label: '文本编辑',
        nodeType: 'textEditor',
        content: '',
        onSubmit: submitTextToCode,
        onContentChange: updateTextEditorContent,
        onExpandChat,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, editorNode]);
    if (sourceId) {
      setFlowEdges((current) => [
        ...current,
        {
          id: `e-${sourceId}-${id}`,
          source: sourceId,
          target: id,
          animated: true,
          style: { stroke: '#55b8ff', strokeWidth: 2 },
        },
      ]);
    }
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
  }, [onExpandChat, openReferenceMenuAt, setFlowEdges, setFlowNodes, startReferenceDrag, submitTextToCode, updateTextEditorContent]);

  const addTextSourceNode = useCallback((file: File, content: string, x: number, y: number) => {
    const id = `__text_source_${Date.now()}`;
    const textNode: Node<TextSourceNodeData> = {
      id,
      type: 'textSource',
      position: { x, y },
      data: {
        label: '文本节点',
        nodeType: 'textSource',
        fileName: file.name,
        content,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, textNode]);
  }, [setFlowNodes, startReferenceDrag, openReferenceMenuAt]);

  const addImageSourceNode = useCallback((file: File, x: number, y: number) => {
    const id = `__image_source_${Date.now()}`;
    const imageNode: Node<ImageSourceNodeData> = {
      id,
      type: 'imageSource',
      position: { x, y },
      data: {
        label: '图片节点',
        nodeType: 'imageSource',
        file,
        previewUrl: URL.createObjectURL(file),
        onFileChange: updateLinkedImageTargets,
        onSubmit: submitImageToCode,
        onExpandChat,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, imageNode]);
  }, [onExpandChat, setFlowNodes, submitImageToCode, updateLinkedImageTargets, startReferenceDrag, openReferenceMenuAt]);

  const addImageToCodeNodes = useCallback((x: number, y: number, sourceId?: string) => {
    const stamp = Date.now();
    const imageId = `__image_source_${stamp}`;
    const imageNode: Node<ImageSourceNodeData> = {
      id: imageId,
      type: 'imageSource',
      position: { x, y },
      data: {
        label: '图片节点',
        nodeType: 'imageSource',
        onFileChange: updateLinkedImageTargets,
        onSubmit: submitImageToCode,
        onExpandChat,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, imageNode]);
    if (sourceId) {
      setFlowEdges((current) => [
        ...current,
        {
          id: `e-${sourceId}-${imageId}`,
          source: sourceId,
          target: imageId,
          animated: true,
          style: { stroke: '#55b8ff', strokeWidth: 2 },
        },
      ]);
    }
    setAddMenu(null);
    setContextMenu(null);
  }, [setFlowEdges, setFlowNodes, submitImageToCode, updateLinkedImageTargets, onExpandChat, startReferenceDrag, openReferenceMenuAt]);

  const addLinkedImageToCodeNode = useCallback((sourceId: string) => {
    setFlowNodes((current) =>
      current.map((node) => {
        if (node.id !== sourceId) return node;
        return { ...node, data: { ...node.data, openPromptToken: Date.now() } };
      }),
    );
    setAddMenu(null);
    setReferenceMenu(null);
  }, [setFlowNodes]);

  const addAssetToCodeNode = useCallback((assetKind: AssetCodeKind, x: number, y: number, sourceId?: string, file?: File) => {
    const acceptMap: Record<AssetCodeKind, string> = {
      vector: '.svg,.ai,.eps',
      data: '.txt,.csv,.json,.xlsx,.xls',
      model3d: '.obj,.glb,.gltf',
      audio: '.mp3,.wav,.ogg,.m4a,.aac',
    };
    const id = `__asset_to_code_${assetKind}_${Date.now()}`;
    const assetNode: Node<AssetToCodeNodeData> = {
      id,
      type: 'assetToCode',
      position: { x, y },
      data: {
        label: assetKindConfig[assetKind].title,
        nodeType: 'assetToCode',
        assetKind,
        accept: acceptMap[assetKind],
        file,
        previewUrl: file ? URL.createObjectURL(file) : undefined,
        onFileChange: updateAssetNodeFile,
        onSubmit: submitAssetToCode,
        onExpandChat,
        onStartReferenceDrag: startReferenceDrag,
        onOpenReferenceMenu: openReferenceMenuAt,
      },
    };
    setFlowNodes((current) => [...current, assetNode]);
    if (sourceId) {
      setFlowEdges((current) => [
        ...current,
        {
          id: `e-${sourceId}-${id}`,
          source: sourceId,
          target: id,
          animated: true,
          style: { stroke: '#55b8ff', strokeWidth: 2 },
        },
      ]);
    }
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
  }, [onExpandChat, openReferenceMenuAt, setFlowEdges, setFlowNodes, startReferenceDrag, submitAssetToCode, updateAssetNodeFile]);

  const addCodeTestNode = useCallback((x: number, y: number, sourceId?: string) => {
    const newNode: Node<CodeTestNodeData> = {
      id: `code_test_${Date.now()}`,
      type: 'codeTest',
      position: { x, y },
      selected: true,
      data: {
        label: '代码测试节点',
        nodeType: 'codeTest',
        params: {
          draftCode: DEFAULT_CODE_TEST_CODE,
          code: '',
          refreshKey: 0,
        },
      },
    };
    const nextNodes = [...flowNodesRef.current.map((node) => ({ ...node, selected: false })), newNode];
    const nextEdges = sourceId
      ? [
          ...flowEdgesRef.current,
          {
            id: `e-${sourceId}-${newNode.id}`,
            source: sourceId,
            target: newNode.id,
            animated: true,
            style: { stroke: '#55b8ff', strokeWidth: 2 },
          },
        ]
      : flowEdgesRef.current;
    setFlowNodes(nextNodes);
    if (sourceId) {
      setFlowEdges(nextEdges);
    }
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
    onNodeSelect?.({
      id: newNode.id,
      type: 'codeTest',
      label: '代码测试节点',
      params: newNode.data.params || {},
      position: newNode.position,
    });
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(nextEdges));
  }, [onGraphChange, onNodeSelect, setFlowEdges, setFlowNodes]);

  const addSimpleNode = useCallback((nodeType: string, label: string, x: number, y: number, sourceId?: string, params?: Record<string, unknown>) => {
    const sourceParams = sourceId?.startsWith(PREVIEW_NODE_PREFIX) || sourceId === PREVIEW_NODE_ID
      ? { autoSourcePreviewId: sourceId }
      : {};
    const newNode: Node = {
      id: `drag_${Date.now()}`,
      type: categoryFromNodeType(nodeType),
      position: { x, y },
      selected: true,
      data: { label, nodeType, params: { ...completeNodeParams(nodeType), ...sourceParams, ...params } } satisfies TDNodeData,
    };
    const nextNodes = [...flowNodesRef.current.map((node) => ({ ...node, selected: false })), newNode];
    const nextEdges = sourceId
      ? [
          ...flowEdgesRef.current,
          {
            id: `e-${sourceId}-${newNode.id}`,
            source: sourceId,
            target: newNode.id,
            animated: true,
            style: { stroke: '#55b8ff', strokeWidth: 2 },
          },
        ]
      : flowEdgesRef.current;
    setFlowNodes(nextNodes);
    if (sourceId) {
      setFlowEdges(nextEdges);
    }
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
    onNodeSelect?.({
      id: newNode.id,
      type: nodeType,
      label,
      params: (newNode.data as TDNodeData).params || {},
      position: newNode.position,
    });
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(nextEdges));
  }, [onGraphChange, onNodeSelect, setFlowEdges, setFlowNodes]);

  const findReusableTemplateNode = useCallback((semanticType: string, hostType: string): string | null => {
    if (semanticType.startsWith('renderer.')) {
      const renderer = flowNodesRef.current.find((node) => {
        const data = node.data as Partial<TDNodeData>;
        return data.nodeType === 'renderer' || data.nodeType === hostType;
      });
      return renderer?.id || null;
    }
    if (semanticType === 'controller.scene') {
      const controller = flowNodesRef.current.find((node) => {
        const data = node.data as Partial<TDNodeData>;
        return data.nodeType === 'controls' || data.nodeType === 'scene' || data.nodeType === hostType;
      });
      return controller?.id || null;
    }
    return null;
  }, []);

  const insertCreativeTemplate = useCallback((template: CreativeTemplate) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const allowDirectTypes = isPersonalTemplate(template);
    const hostTypes = new Map<string, string>();
    const missing = Array.from(new Set(template.graph.nodes.map((node) => node.type)))
      .filter((semanticType) => !resolveTemplateNodeType(semanticType) && !allowDirectTypes);
    if (missing.length > 0) {
      window.alert(`模板缺少现有节点类型映射：${missing.join('、')}`);
      return;
    }

    for (const node of template.graph.nodes) {
      const hostType = resolveTemplateNodeType(node.type) || (allowDirectTypes ? node.type : null);
      if (!hostType) return;
      hostTypes.set(node.id, hostType);
    }

    const targetCenter = screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
    const sourceCenter = templateNodesCenter(template.graph.nodes);
    const templateInstanceId = templateRuntimeId(`template-instance-${template.id}`);
    const nodeIdMap = new Map<string, string>();
    const createdNodeIds: string[] = [];
    const insertedNodes: Node[] = [];

    for (const templateNode of template.graph.nodes) {
      const hostType = hostTypes.get(templateNode.id);
      if (!hostType) return;
      const shouldReuse = (template.insertion.reuseExistingSystemNodes ?? true)
        && (templateNode.type.startsWith('renderer.') || templateNode.type === 'controller.scene');
      const reusableId = shouldReuse ? findReusableTemplateNode(templateNode.type, hostType) : null;
      if (reusableId) {
        nodeIdMap.set(templateNode.id, reusableId);
        continue;
      }

      const isDirectInternalNode = allowDirectTypes && (hostType === 'imageSource' || hostType === 'preview');
      const id = templateRuntimeId(isDirectInternalNode ? `${INTERNAL_NODE_PREFIX}${templateNode.id}` : templateNode.id);
      nodeIdMap.set(templateNode.id, id);
      createdNodeIds.push(id);
      if (allowDirectTypes && hostType === 'imageSource') {
        insertedNodes.push({
          id,
          type: 'imageSource',
          position: {
            x: targetCenter.x + templateNode.position.x - sourceCenter.x,
            y: targetCenter.y + templateNode.position.y - sourceCenter.y,
          },
          selected: true,
          data: {
            label: templateNode.label,
            nodeType: 'imageSource',
            previewUrl: typeof templateNode.params.previewUrl === 'string' ? templateNode.params.previewUrl : undefined,
            onFileChange: updateLinkedImageTargets,
            onSubmit: submitImageToCode,
            onExpandChat,
            onStartReferenceDrag: startReferenceDrag,
            onOpenReferenceMenu: openReferenceMenuAt,
          } satisfies ImageSourceNodeData,
        });
        continue;
      }
      if (allowDirectTypes && hostType === 'preview') {
        insertedNodes.push({
          id,
          type: 'preview',
          position: {
            x: targetCenter.x + templateNode.position.x - sourceCenter.x,
            y: targetCenter.y + templateNode.position.y - sourceCenter.y,
          },
          selected: true,
          data: {
            label: templateNode.label,
            nodeType: 'preview',
            ...(previewNode || {
              code: '',
              referenceActive: false,
              referenceBackgroundUrl: '',
              isProcessing: false,
              onActivate: () => undefined,
              onDeactivate: () => undefined,
              onFullscreen: () => undefined,
            }),
            code: typeof templateNode.params.code === 'string' ? templateNode.params.code : '',
            refreshKey: Date.now(),
            referenceBackgroundUrl: typeof templateNode.params.referenceBackgroundUrl === 'string' ? templateNode.params.referenceBackgroundUrl : '',
            isProcessing: false,
            isLivePreview: true,
            onActivate: () => activatePreviewNode(id),
            onStartReferenceDrag: startReferenceDrag,
            onOpenReferenceMenu: openReferenceMenuAt,
          } as PreviewNodeData,
        });
        continue;
      }
      insertedNodes.push({
        id,
        type: categoryFromNodeType(hostType),
        position: {
          x: targetCenter.x + templateNode.position.x - sourceCenter.x,
          y: targetCenter.y + templateNode.position.y - sourceCenter.y,
        },
        selected: true,
        data: {
          label: templateNode.label,
          nodeType: hostType,
          params: { ...completeNodeParams(hostType), ...templateNode.params },
          semanticType: templateNode.type,
          templateId: template.id,
          templateVersion: template.version,
          templateInstanceId,
          sourceTemplateNodeId: templateNode.id,
        } as TDNodeData & Record<string, unknown>,
      });
    }

    let nodesToInsert = insertedNodes;
    if (allowDirectTypes && template.tags?.includes('grouped') && insertedNodes.length > 1) {
      const groupBounds = nodesBounds(insertedNodes);
      if (groupBounds) {
        const groupPosition = {
          x: groupBounds.x - GROUP_PADDING,
          y: groupBounds.y - GROUP_PADDING,
        };
        const groupId = templateRuntimeId(`${INTERNAL_NODE_PREFIX}personal-template-group`);
        const groupNode: Node = {
          id: groupId,
          type: GROUP_NODE_TYPE,
          position: groupPosition,
          data: {
            label: template.graph.group.title || template.name,
            color: 'rgba(235, 47, 150, 0.16)',
            nodeCount: insertedNodes.length,
          } satisfies GroupFrameNodeData,
          style: {
            width: groupBounds.w + GROUP_PADDING * 2,
            height: groupBounds.h + GROUP_PADDING * 2,
          },
          selected: true,
        };
        nodesToInsert = [
          groupNode,
          ...insertedNodes.map((node) => ({
            ...node,
            parentNode: groupId,
            extent: 'parent' as const,
            position: {
              x: node.position.x - groupPosition.x,
              y: node.position.y - groupPosition.y,
            },
            selected: false,
          })),
        ];
        setActiveGroupId(groupId);
      }
    }

    const insertedEdges: Edge[] = [];
    for (const templateEdge of template.graph.edges) {
      const source = nodeIdMap.get(templateEdge.source);
      const target = nodeIdMap.get(templateEdge.target);
      if (!source || !target) return;
      insertedEdges.push({
        id: templateRuntimeId(templateEdge.id),
        source,
        target,
        sourceHandle: templateEdge.sourcePort,
        targetHandle: templateEdge.targetPort,
        label: templateEdgeLabel(templateEdge),
        animated: true,
        style: { stroke: '#999', strokeWidth: 2 },
        data: {
          mappings: structuredClone(templateEdge.mappings),
          templateId: template.id,
          templateInstanceId,
          sourceTemplateEdgeId: templateEdge.id,
        },
      });
    }

    const nextNodes = [
      ...flowNodesRef.current.map((node) => ({ ...node, selected: false })),
      ...nodesToInsert,
    ];
    const nextEdges = [...flowEdgesRef.current, ...insertedEdges];
    setFlowNodes(nextNodes);
    setFlowEdges(nextEdges);
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
    if (createdNodeIds.length > 0) {
      const firstNode = insertedNodes[0];
      const firstData = firstNode?.data as TDNodeData | undefined;
      if (firstNode && firstData) {
        onNodeSelect?.({
          id: firstNode.id,
          type: firstData.nodeType,
          label: firstData.label,
          params: firstData.params || {},
          position: firstNode.position,
        });
      }
    }
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(nextEdges));
  }, [
    activatePreviewNode,
    findReusableTemplateNode,
    onExpandChat,
    onGraphChange,
    onNodeSelect,
    openReferenceMenuAt,
    previewNode,
    screenToFlowPosition,
    setFlowEdges,
    setFlowNodes,
    startReferenceDrag,
    submitImageToCode,
    updateLinkedImageTargets,
  ]);

  useEffect(() => {
    const onToolboxAddNode = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeType: string; label: string; params?: Record<string, unknown> }>).detail;
      if (!detail) return;
      const bounds = canvasRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const position = screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      });
      if (detail.nodeType === 'text') {
        addDirectTextEditorNode(position.x, position.y);
        return;
      }
      if (detail.nodeType === 'codeTest') {
        addCodeTestNode(position.x - CODE_TEST_NODE_WIDTH / 2, position.y - CODE_TEST_NODE_HEIGHT / 2);
        return;
      }
      if (detail.nodeType === 'image') {
        addImageToCodeNodes(position.x - IMAGE_SOURCE_NODE_WIDTH / 2, position.y - IMAGE_SOURCE_NODE_HEIGHT / 2);
        return;
      }
      if (detail.nodeType === 'asset_vector') {
        addAssetToCodeNode('vector', position.x, position.y);
        return;
      }
      if (detail.nodeType === 'asset_data') {
        addAssetToCodeNode('data', position.x, position.y);
        return;
      }
      if (detail.nodeType === 'asset_model3d') {
        addAssetToCodeNode('model3d', position.x, position.y);
        return;
      }
      if (detail.nodeType === 'asset_audio') {
        addAssetToCodeNode('audio', position.x, position.y);
        return;
      }
      addSimpleNode(detail.nodeType, detail.label, position.x, position.y, undefined, detail.params);
    };

    window.addEventListener('node-toolbox-add-node', onToolboxAddNode);
    return () => window.removeEventListener('node-toolbox-add-node', onToolboxAddNode);
  }, [addAssetToCodeNode, addCodeTestNode, addDirectTextEditorNode, addImageToCodeNodes, addSimpleNode, screenToFlowPosition]);

  useEffect(() => {
    const onTemplateInsert = (event: Event) => {
      const detail = (event as CustomEvent<{ templateId: string }>).detail;
      if (!detail?.templateId) return;
      insertCreativeTemplate(getTemplate(detail.templateId));
    };

    window.addEventListener('creative-template-insert', onTemplateInsert);
    return () => window.removeEventListener('creative-template-insert', onTemplateInsert);
  }, [insertCreativeTemplate]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target) return;
      connectSourceRef.current = null;
      const newEdge: Edge = {
        id: `e-${Date.now()}`,
        source,
        target,
        sourceHandle: sourceHandle ?? undefined,
        targetHandle: targetHandle ?? undefined,
        animated: true,
        style: { stroke: '#999', strokeWidth: 2 },
      };
      const nextEdges = [...flowEdges, newEdge];
      setFlowEdges(nextEdges);

      if (source.startsWith('__image_source_') && target.startsWith('__image_to_code_')) {
        const sourceNode = flowNodes.find((node) => node.id === source);
        const data = sourceNode?.data as Partial<ImageSourceNodeData> | undefined;
        if (data?.file && data.previewUrl) {
          updateLinkedImageTargets(source, data.file, data.previewUrl);
        }
      }

      // Propagate new edge to parent so it persists
      if (onGraphChange) {
        onGraphChange(flowNodesToNodeData(flowNodes), flowEdgesToEdgeData(nextEdges));
      }
    },
    [setFlowEdges, flowNodes, flowEdges, onGraphChange, updateLinkedImageTargets],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id === PREVIEW_NODE_ID || node.id.startsWith(PREVIEW_NODE_PREFIX) || node.type === 'preview') {
        const data = node.data as PreviewNodeData;
        const inspectionBinding = resolvePreviewInspectionBinding(node.id, flowNodesRef.current, flowEdgesRef.current);
        const generatedNodes = data.generatedNodes || [];
        const creativeControls = generatedNodes.find((generatedNode) => generatedNode.type === 'CreativeControls');
        data.onActivate();
        onNodeSelect?.({
          id: node.id,
          type: 'preview',
          label: data.label || '预览输出',
          params: {},
          position: node.position,
          primaryContentNodeId: creativeControls?.id || generatedNodes[0]?.id || inspectionBinding.primaryContentNodeId,
          inspectableNodeIds: generatedNodes.length > 0 ? generatedNodes.map((generatedNode) => generatedNode.id) : inspectionBinding.inspectableNodeIds,
          inspectableNodes: generatedNodes,
          onPreviewParamChange: (nodeId, key, value) => updatePreviewGeneratedParam(node.id, nodeId, key, value),
        });
        return;
      }
      if (isGroupNode(node)) {
        setActiveGroupId(node.id);
        setSelectionFrame(null);
        setArrangeMenuOpen(false);
        setGroupMenuOpen(false);
        onNodeSelect?.(null);
        return;
      }
      if (isInternalNodeId(node.id)) {
        onNodeSelect?.(null);
        return;
      }
      if (!onNodeSelect) return;
      const data = node.data as TDNodeData;
      onNodeSelect({
        id: node.id,
        type: data.nodeType || '',
        label: data.label || '',
        params: data.params || {},
        position: node.position,
      });
    },
    [onNodeSelect, updatePreviewGeneratedParam],
  );

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const data = node.data as TDNodeData;
    if (data.nodeType === 'vector.svgEditor') {
      openSvgEditor(node.id);
    } else if (data.nodeType === 'typography.textEditor') {
      openTextTool(node.id);
    } else if (data.nodeType === 'utility.batchRename') {
      openBatchRenameTool(node.id);
    } else if (data.nodeType === 'image.smartCutout') {
      openSmartCutoutTool(node.id);
    }
  }, [openSvgEditor, openTextTool, openBatchRenameTool, openSmartCutoutTool]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (!onNodeSelectionChange) return;
    const selection = selectedNodes
      .filter((node) => !isInternalNodeId(node.id) && !isGroupNode(node))
      .map((node) => {
        const data = node.data as TDNodeData;
        return {
          id: node.id,
          type: data.nodeType || '',
          label: data.label || '',
          params: data.params || {},
          position: node.position,
        };
      });
    onNodeSelectionChange(selection);
  }, [onNodeSelectionChange]);

  const onPaneClick = useCallback(() => {
    if (skipNextPaneClickRef.current) {
      skipNextPaneClickRef.current = false;
      return;
    }
    setAddMenu(null);
    setContextMenu(null);
    setReferenceMenu(null);
    setSelectionFrame(null);
    setActiveGroupId(null);
    setArrangeMenuOpen(false);
      setGroupMenuOpen(false);
      setColorMenuOpen(false);
      setActivePreviewBackdrop(null);
      previewNode?.onDeactivate();
      onNodeSelect?.(null);
  }, [onNodeSelect, previewNode]);

  const onConnectStart = useCallback((_event: unknown, params: { nodeId?: string | null }) => {
    connectSourceRef.current = params.nodeId || null;
    setAddMenu(null);
    setReferenceMenu(null);
  }, []);

  const openAddMenuFromConnection = useCallback((sourceId: string, clientX: number, clientY: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const flowPosition = screenToFlowPosition({ x: clientX, y: clientY });
    const menuPosition = placeAddMenu(bounds, clientX, clientY);
    skipNextPaneClickRef.current = true;
    setAddMenu({
      sourceId,
      x: menuPosition.x,
      y: menuPosition.y,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    });
    setContextMenu(null);
    setReferenceMenu(null);
  }, [screenToFlowPosition]);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const sourceId = connectSourceRef.current;
    connectSourceRef.current = null;
    if (!sourceId) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('.react-flow__handle')) return;

    const point = 'changedTouches' in event
      ? event.changedTouches[0]
      : event;
    if (!point) return;
    openAddMenuFromConnection(sourceId, point.clientX, point.clientY);
  }, [openAddMenuFromConnection]);

  useEffect(() => {
    const onPointerRelease = (event: MouseEvent | TouchEvent) => {
      const sourceId = connectSourceRef.current;
      if (!sourceId) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('.react-flow__handle')) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      if (!point) return;
      window.setTimeout(() => {
        if (connectSourceRef.current !== sourceId) return;
        connectSourceRef.current = null;
        openAddMenuFromConnection(sourceId, point.clientX, point.clientY);
      }, 0);
    };

    window.addEventListener('mouseup', onPointerRelease);
    window.addEventListener('touchend', onPointerRelease);
    return () => {
      window.removeEventListener('mouseup', onPointerRelease);
      window.removeEventListener('touchend', onPointerRelease);
    };
  }, [openAddMenuFromConnection]);

  const onPaneDoubleClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const menuPosition = placeAddMenu(bounds, event.clientX, event.clientY);
    setAddMenu({
      x: menuPosition.x,
      y: menuPosition.y,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    });
    setContextMenu(null);
  }, [screenToFlowPosition]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onDoubleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return;
      const bounds = el.getBoundingClientRect();
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const menuPosition = placeAddMenu(bounds, event.clientX, event.clientY);
      setAddMenu({
        x: menuPosition.x,
        y: menuPosition.y,
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
      setContextMenu(null);
    };

    el.addEventListener('dblclick', onDoubleClick, true);
    return () => el.removeEventListener('dblclick', onDoubleClick, true);
  }, [screenToFlowPosition]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const droppedFile = event.dataTransfer.files?.[0];
      if (droppedFile) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        if (isFontFile(droppedFile)) {
          addSimpleNode('file_font', '字体文件', position.x, position.y, undefined, {
            fileName: droppedFile.name,
            format: fontFormat(droppedFile.name),
          });
          return;
        }
        const assetKind = assetKindFromFile(droppedFile);
        if (assetKind) {
          addAssetToCodeNode(assetKind, position.x, position.y, undefined, droppedFile);
          return;
        }
        if (droppedFile.type.startsWith('image/')) {
          addImageSourceNode(droppedFile, position.x, position.y);
          return;
        }
        if (isTextFile(droppedFile)) {
          void droppedFile.text().then((content) => {
            addTextSourceNode(droppedFile, content, position.x, position.y);
          });
          return;
        }
        return;
      }

      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw) return;

      try {
        const { nodeType, label, params }: { nodeType: string; label: string; params?: Record<string, unknown> } = JSON.parse(raw);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        if (nodeType === 'asset_vector') {
          addAssetToCodeNode('vector', position.x, position.y);
          return;
        }
        if (nodeType === 'asset_data') {
          addAssetToCodeNode('data', position.x, position.y);
          return;
        }
        if (nodeType === 'asset_model3d') {
          addAssetToCodeNode('model3d', position.x, position.y);
          return;
        }
        if (nodeType === 'asset_audio') {
          addAssetToCodeNode('audio', position.x, position.y);
          return;
        }
        if (nodeType === 'codeTest') {
          addCodeTestNode(position.x - CODE_TEST_NODE_WIDTH / 2, position.y - CODE_TEST_NODE_HEIGHT / 2);
          return;
        }

        const id = `drag_${Date.now()}`;
        const cat = categoryFromNodeType(nodeType);
        const newNode: Node = {
          id,
          type: cat,
          position,
          data: { label, nodeType, params: { ...completeNodeParams(nodeType), ...params } } satisfies TDNodeData,
        };

        const nextNodes = [...flowNodes, newNode];
        setFlowNodes(nextNodes);

        // Propagate new node to parent so it survives saveNodeParamsOnly
        if (onGraphChange) {
          onGraphChange(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdges));
        }
      } catch {
        // ignore invalid drops
      }
    },
    [screenToFlowPosition, setFlowNodes, flowNodes, flowEdges, onGraphChange, addAssetToCodeNode, addCodeTestNode, addImageSourceNode, addTextSourceNode, addSimpleNode],
  );

  const updateLiveParamDraft = useCallback((nodeId: string, key: string, value: unknown) => {
    setLiveParamDrafts((current) => ({
      ...current,
      [liveParamKey(nodeId, key)]: value,
    }));
  }, []);

  const confirmLiveParam = useCallback((nodeId: string, key: string, fallbackValue: unknown) => {
    const rowKey = liveParamKey(nodeId, key);
    const value = rowKey in liveParamDrafts ? liveParamDrafts[rowKey] : fallbackValue;
    const nextNodes = flowNodesRef.current.map((node) => {
      if (node.id !== nodeId) return node;
      const data = node.data as TDNodeData;
      return {
        ...node,
        data: {
          ...data,
          params: {
            ...(data.params || {}),
            [key]: value,
          },
        },
      };
    });
    flowNodesRef.current = nextNodes;
    setFlowNodes(nextNodes);
    onParamChange?.(nodeId, key, value);
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
    setConfirmedLiveParamKeys((current) => {
      const next = new Set(current);
      next.add(rowKey);
      return next;
    });
    setHasConfirmedLiveParams(true);
  }, [liveParamDrafts, onGraphChange, onParamChange, setFlowNodes]);

  const applyLiveParamPreview = useCallback(() => {
    if (!hasConfirmedLiveParams || !onLiveParamsChange) return;
    onLiveParamsChange();
    setHasConfirmedLiveParams(false);
    setConfirmedLiveParamKeys(new Set());
  }, [hasConfirmedLiveParams, onLiveParamsChange]);

  const updateNodeParamFromNode = useCallback((nodeId: string, key: string, value: unknown) => {
    setFlowNodes((current) => {
      const nextNodes = current.map((node) => {
        if (node.id !== nodeId) return node;
        const data = node.data as TDNodeData;
        return {
          ...node,
          data: {
            ...data,
            params: {
              ...(data.params || {}),
              [key]: value,
            },
          },
        };
      });
      flowNodesRef.current = nextNodes;
      onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
      return nextNodes;
    });
    onParamChange?.(nodeId, key, value);
  }, [onGraphChange, onParamChange, setFlowNodes]);

  const updateCodeTestDraft = useCallback((nodeId: string, code: string) => {
    setFlowNodes((current) => {
      const nextNodes = current.map((node) => {
        if (node.id !== nodeId) return node;
        const data = node.data as CodeTestNodeData;
        return {
          ...node,
          data: {
            ...data,
            params: {
              ...(data.params || {}),
              draftCode: code,
            },
          },
        };
      });
      flowNodesRef.current = nextNodes;
      return nextNodes;
    });
  }, [setFlowNodes]);

  const runCodeTestNode = useCallback((nodeId: string, code: string) => {
    setFlowNodes((current) => {
      const nextNodes = current.map((node) => {
        if (node.id !== nodeId) return node;
        const data = node.data as CodeTestNodeData;
        return {
          ...node,
          data: {
            ...data,
            params: {
              ...(data.params || {}),
              draftCode: code,
              code,
              refreshKey: Date.now(),
            },
          },
        };
      });
      flowNodesRef.current = nextNodes;
      onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
      return nextNodes;
    });
  }, [onGraphChange, setFlowNodes]);

  function openSvgEditor(nodeId: string) {
    const node = flowNodesRef.current.find((item) => item.id === nodeId);
    const data = node?.data as TDNodeData | undefined;
    const document = isSvgDocument(data?.params?.svgDocument)
      ? data.params.svgDocument
      : createEmptyDocument(1080, 1080);
    setSvgEditorSession({ nodeId, document });
  }

  function openTextTool(nodeId: string) {
    const node = flowNodesRef.current.find((item) => item.id === nodeId);
    const data = node?.data as TDNodeData | undefined;
    setTextToolSession({
      nodeId,
      document: isTextDocument(data?.params?.textDocument) ? data.params.textDocument : undefined,
    });
  }

  function openBatchRenameTool(nodeId: string) {
    const node = flowNodesRef.current.find((item) => item.id === nodeId);
    const data = node?.data as TDNodeData | undefined;
    setBatchRenameSession({
      nodeId,
      document: isBatchRenameDocument(data?.params?.batchRenameDocument) ? data.params.batchRenameDocument : undefined,
    });
  }

  function openSmartCutoutTool(nodeId: string) {
    const node = flowNodesRef.current.find((item) => item.id === nodeId);
    const data = node?.data as TDNodeData | undefined;
    setSmartCutoutSession({
      nodeId,
      document: isSmartCutoutDocument(data?.params?.smartCutoutDocument) ? data.params.smartCutoutDocument : undefined,
    });
  }

  const updateTextToolNode = useCallback((nodeId: string, document: TextDocument) => {
    const nextNodes = flowNodesRef.current.map((node) => {
      if (node.id !== nodeId) return node;
      const data = node.data as TDNodeData;
      return {
        ...node,
        data: {
          ...data,
          label: document.text.slice(0, 18) || data.label,
          params: {
            ...(data.params || {}),
            textDocument: document,
            text: document.text,
            svgPreview: document.text,
          },
        },
      };
    });
    flowNodesRef.current = nextNodes;
    setFlowNodes(nextNodes);
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
  }, [onGraphChange, setFlowNodes]);

  const createSvgNodeFromText = useCallback((sourceNodeId: string, document: SvgDocument, label: string) => {
    const sourceNode = flowNodesRef.current.find((node) => node.id === sourceNodeId);
    const outputs = svgEditorAdapter.cook(document);
    const svgNode: Node = {
      id: `drag_${Date.now()}`,
      type: categoryFromNodeType('vector.svgEditor'),
      position: {
        x: (sourceNode?.position.x || 0) + 420,
        y: sourceNode?.position.y || 0,
      },
      selected: true,
      data: {
        label,
        nodeType: 'vector.svgEditor',
        params: {
          svgDocument: outputs.document,
          svgString: outputs.svg,
          vectorPath: outputs.path,
          texture2D: outputs.texture,
          pointArray: outputs.points,
          sourceTextNodeId: sourceNodeId,
        },
      } satisfies TDNodeData,
    };
    const edge: Edge = {
      id: `e-${sourceNodeId}-${svgNode.id}`,
      source: sourceNodeId,
      target: svgNode.id,
      animated: true,
      style: { stroke: '#55b8ff', strokeWidth: 2 },
    };
    const nextNodes = [...flowNodesRef.current.map((node) => ({ ...node, selected: false })), svgNode];
    const nextEdges = [...flowEdgesRef.current, edge];
    flowNodesRef.current = nextNodes;
    flowEdgesRef.current = nextEdges;
    setFlowNodes(nextNodes);
    setFlowEdges(nextEdges);
    setSvgEditorSession({ nodeId: svgNode.id, document });
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(nextEdges));
  }, [onGraphChange, setFlowEdges, setFlowNodes, svgEditorAdapter]);

  const updateBatchRenameNode = useCallback((nodeId: string, document: BatchRenameDocument, assets: RenameAsset[]) => {
    const plan = processRenamePlan(assets, document);
    const renamedAssets = plan.entries.map((entry) => ({
      ...entry.asset,
      displayName: entry.outputName,
      exportName: entry.outputName,
      exportRelativePath: entry.outputRelativePath,
    }));
    const nextNodes = flowNodesRef.current.map((node) => {
      if (node.id !== nodeId) return node;
      const data = node.data as TDNodeData;
      return {
        ...node,
        data: {
          ...data,
          params: {
            ...(data.params || {}),
            batchRenameDocument: document,
            selectedCount: plan.selectedCount,
            ruleCount: plan.ruleCount,
            changedCount: plan.changedCount,
            conflictCount: plan.conflicts.count,
            renamedAssets,
            renamePlan: plan,
            conflicts: plan.conflicts,
          },
        },
      };
    });
    flowNodesRef.current = nextNodes;
    setFlowNodes(nextNodes);
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
  }, [onGraphChange, setFlowNodes]);

  const updateSmartCutoutNode = useCallback((nodeId: string, document: SmartCutoutDocument, result: SmartCutoutResult | null, sourceName?: string) => {
    const nextNodes = flowNodesRef.current.map((node) => {
      if (node.id !== nodeId) return node;
      const data = node.data as TDNodeData;
      return {
        ...node,
        data: {
          ...data,
          params: {
            ...(data.params || {}),
            smartCutoutDocument: document,
            sourceName,
            metadata: result?.metadata,
            imageAsset: result?.transparentPng,
            alphaMask: result?.alphaMask,
            texture2D: result?.objectUrl,
            blob: result?.transparentPng,
          },
        },
      };
    });
    flowNodesRef.current = nextNodes;
    setFlowNodes(nextNodes);
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
  }, [onGraphChange, setFlowNodes]);

  const updateSvgEditorNode = useCallback((nodeId: string, document: SvgDocument) => {
    const outputs = svgEditorAdapter.cook(document);
    const nextNodes = flowNodesRef.current.map((node) => {
      if (node.id !== nodeId) return node;
      const data = node.data as TDNodeData;
      return {
        ...node,
        data: {
          ...data,
          params: {
            ...(data.params || {}),
            svgDocument: outputs.document,
            svgString: outputs.svg,
            vectorPath: outputs.path,
            texture2D: outputs.texture,
            pointArray: outputs.points,
          },
        },
      };
    });
    flowNodesRef.current = nextNodes;
    setFlowNodes(nextNodes);
    onGraphChange?.(flowNodesToNodeData(nextNodes), flowEdgesToEdgeData(flowEdgesRef.current));
    setSvgEditorSession({ nodeId, document });
  }, [onGraphChange, setFlowNodes, svgEditorAdapter]);

  const connectedParamNodes = useMemo<Node[]>(() => [], []);
  const activePreviewId = previewNode?.referenceActive ? latestPreviewId : '';
  const visibleFlowNodes = useMemo(() => flowNodes.map((node) => {
    if (node.type === 'codeTest') {
      return {
        ...node,
        data: {
          ...node.data,
          onCodeChange: updateCodeTestDraft,
          onRun: runCodeTestNode,
        },
      };
    }
    if (node.type === 'preview') {
      return {
        ...node,
        data: {
          ...node.data,
          referenceActive: activePreviewId === node.id,
          activePreviewId,
          isLivePreview: !!node.data.isLivePreview || activePreviewId === node.id,
          generationStatus: node.data.isProcessing ? previewNode?.generationStatus : undefined,
        },
      };
    }
    if (isInternalNodeId(node.id)) return node;
    return {
      ...node,
      data: {
        ...node.data,
        onParamUpdate: updateNodeParamFromNode,
        onInteractionPromptSubmit: submitInteractionPrompt,
        onOpenSvgEditor: openSvgEditor,
        onOpenTextEditor: openTextTool,
        onOpenBatchRename: openBatchRenameTool,
        onOpenSmartCutout: openSmartCutoutTool,
        activePreviewId,
      },
    };
  }), [activePreviewId, flowNodes, openBatchRenameTool, openSmartCutoutTool, openSvgEditor, openTextTool, runCodeTestNode, submitInteractionPrompt, updateCodeTestDraft, updateNodeParamFromNode]);
  const visibleFlowEdges = flowEdges;

  const activeGroup = activeGroupId
    ? flowNodes.find((node) => node.id === activeGroupId && isGroupNode(node))
    : null;
  const activeGroupFrame = activeGroup ? buildFrameFromNodes([activeGroup]) : null;
  const activeGroupData = activeGroup?.data as Partial<GroupFrameNodeData> | undefined;
  const selectedCount = selectionFrame?.nodeIds.length || 0;
  const activeGroupCount = activeGroupData?.nodeCount
    || flowNodes.filter((node) => node.parentNode === activeGroupId).length;
  const canvasMap = useMemo((): { nodes: CanvasMapNodeItem[]; lines: CanvasMapLineItem[]; frame: CanvasMapFrame | null } => {
    const visibleNodes = visibleFlowNodes.filter((node) => !isGroupNode(node));
    if (visibleNodes.length === 0) return { nodes: [], lines: [], frame: null };

    const nodeRects = visibleNodes.map((node) => ({
      node,
      x: node.positionAbsolute?.x ?? node.position.x,
      y: node.positionAbsolute?.y ?? node.position.y,
      w: nodeWidth(node),
      h: nodeHeight(node),
    }));
    const viewportBounds = canvasRef.current && canvasViewport.zoom > 0
      ? {
          x: -canvasViewport.x / canvasViewport.zoom,
          y: -canvasViewport.y / canvasViewport.zoom,
          w: canvasRef.current.clientWidth / canvasViewport.zoom,
          h: canvasRef.current.clientHeight / canvasViewport.zoom,
        }
      : null;

    const minX = Math.min(
      ...nodeRects.map((item) => item.x),
      viewportBounds?.x ?? Infinity,
    );
    const minY = Math.min(
      ...nodeRects.map((item) => item.y),
      viewportBounds?.y ?? Infinity,
    );
    const maxX = Math.max(
      ...nodeRects.map((item) => item.x + item.w),
      viewportBounds ? viewportBounds.x + viewportBounds.w : -Infinity,
    );
    const maxY = Math.max(
      ...nodeRects.map((item) => item.y + item.h),
      viewportBounds ? viewportBounds.y + viewportBounds.h : -Infinity,
    );
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min(
      (CANVAS_MAP_WIDTH - CANVAS_MAP_PADDING * 2) / spanX,
      (CANVAS_MAP_HEIGHT - CANVAS_MAP_PADDING * 2) / spanY,
    );
    const offsetX = (CANVAS_MAP_WIDTH - spanX * scale) / 2;
    const offsetY = (CANVAS_MAP_HEIGHT - spanY * scale) / 2;
    const project = (x: number, y: number) => ({
      x: offsetX + (x - minX) * scale,
      y: offsetY + (y - minY) * scale,
    });

    const mapNodes = nodeRects.map(({ node, x, y, w, h }) => {
      const data = node.data as { label?: string; fileName?: string; previewUrl?: string };
      const topLeft = project(x, y);
      const bottomRight = project(x + w, y + h);
      const kind: CanvasMapNodeItem['kind'] =
        node.id === PREVIEW_NODE_ID
          ? 'preview'
          : node.type === 'imageSource'
            ? 'image'
            : node.type === 'textSource' || node.type === 'textChoice' || node.type === 'textEditor'
              ? 'text'
              : isGroupNode(node)
                ? 'group'
                : 'default';
      return {
        id: node.id,
        x: topLeft.x,
        y: topLeft.y,
        w: Math.max(7, bottomRight.x - topLeft.x),
        h: Math.max(7, bottomRight.y - topLeft.y),
        label: data.label || data.fileName || node.id,
        kind,
        imageUrl: data.previewUrl,
      };
    });
    const mapLines = visibleFlowEdges.map((edge) => {
      const source = nodeRects.find((item) => item.node.id === edge.source);
      const target = nodeRects.find((item) => item.node.id === edge.target);
      if (!source || !target) return null;
      const start = project(source.x + source.w, source.y + source.h / 2);
      const end = project(target.x, target.y + target.h / 2);
      return { id: edge.id, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    }).filter((line): line is CanvasMapLineItem => line !== null);
    const frame = viewportBounds
      ? (() => {
          const topLeft = project(viewportBounds.x, viewportBounds.y);
          const bottomRight = project(viewportBounds.x + viewportBounds.w, viewportBounds.y + viewportBounds.h);
          return {
            x: Math.max(0, topLeft.x),
            y: Math.max(0, topLeft.y),
            w: Math.min(CANVAS_MAP_WIDTH, bottomRight.x) - Math.max(0, topLeft.x),
            h: Math.min(CANVAS_MAP_HEIGHT, bottomRight.y) - Math.max(0, topLeft.y),
          };
        })()
      : null;
    return { nodes: mapNodes, lines: mapLines, frame };
  }, [canvasViewport, visibleFlowEdges, visibleFlowNodes]);

  const backdropPreview = (latestPreviewId !== PREVIEW_NODE_ID ? activePreviewBackdrop : null) || (previewNode
    ? {
        code: previewNode.code,
        refreshKey: previewNode.refreshKey,
        referenceBackgroundUrl: previewNode.referenceBackgroundUrl,
      }
    : null);
  const isBackdropActive = !!previewNode?.referenceActive;

  return (
    <div
      className={`${styles.canvas} ${isBackdropActive ? styles.canvasPreviewActive : ''}`}
      ref={canvasRef}
    >
      {backdropPreview?.code && (
        <div className={`${styles.previewCanvasBackdrop} ${isBackdropActive ? styles.previewCanvasBackdropActive : ''}`}>
          <PreviewWindow
            code={backdropPreview.code}
            refreshKey={backdropPreview.refreshKey}
            referenceActive={isBackdropActive}
            referenceBackgroundUrl={backdropPreview.referenceBackgroundUrl}
          />
        </div>
      )}
      <ReactFlow
        nodes={visibleFlowNodes}
        edges={visibleFlowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        onDoubleClick={onPaneDoubleClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={['Delete', 'Backspace']}
        nodeTypes={nodeTypes}
        zoomOnDoubleClick={false}
        snapToGrid={gridSnapActive}
        snapGrid={[20, 20]}
        onMove={(_, viewport) => {
          setZoomPercent(Math.round(viewport.zoom * 100));
          setCanvasViewport(viewport);
        }}
        onInit={(instance) => {
          const viewport = instance.getViewport();
          setZoomPercent(Math.round(viewport.zoom * 100));
          setCanvasViewport(viewport);
        }}
        fitView
      >
        <Background />
      </ReactFlow>
      {svgEditorSession && (
        <div className={styles.svgEditorOverlay} data-selection-ui="true">
          <SvgEditorNode
            initialDocument={svgEditorSession.document}
            onChange={(document) => updateSvgEditorNode(svgEditorSession.nodeId, document)}
            onClose={() => setSvgEditorSession(null)}
          />
        </div>
      )}
      {textToolSession && (
        <TextEditorToolOverlay
          nodeId={textToolSession.nodeId}
          initialDocument={textToolSession.document}
          onClose={() => setTextToolSession(null)}
          onDocumentChange={(document) => updateTextToolNode(textToolSession.nodeId, document)}
          onCreateSvg={(document, label) => createSvgNodeFromText(textToolSession.nodeId, document, label)}
        />
      )}
      {batchRenameSession && (
        <BatchRenameToolOverlay
          nodeId={batchRenameSession.nodeId}
          initialDocument={batchRenameSession.document}
          onClose={() => setBatchRenameSession(null)}
          onApply={(document, assets) => updateBatchRenameNode(batchRenameSession.nodeId, document, assets)}
        />
      )}
      {smartCutoutSession && (
        <SmartCutoutToolOverlay
          nodeId={smartCutoutSession.nodeId}
          initialDocument={smartCutoutSession.document}
          onClose={() => setSmartCutoutSession(null)}
          onApply={(document, result, sourceName) => updateSmartCutoutNode(smartCutoutSession.nodeId, document, result, sourceName)}
        />
      )}
      {connectedParamNodes.length > 0 && (
        <div
          className={`${styles.liveParamGui} nodrag nowheel`}
          onPointerDownCapture={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={`${styles.liveParamModeTitle} ${hasConfirmedLiveParams ? styles.liveParamModeTitleReady : ''}`}
            onClick={applyLiveParamPreview}
            disabled={!hasConfirmedLiveParams}
          >
            实时预览与参数调整
          </button>
          {connectedParamNodes.map((node) => {
            const data = node.data as TDNodeData;
            const nodeType = data.nodeType || '';
            const params = data.params || {};
            const paramEntries = Object.entries(params).filter(
              ([key, value]) => isLiveAdjustableParam(nodeType, key, value),
            );

            return (
              <div key={node.id} className={styles.liveParamCard}>
                <div className={styles.liveParamTitle}>
                  {getNodeDisplayLabel(nodeType, data.label)}
                </div>
                {paramEntries.map(([key, value]) => {
                  const spec = getNodeParamSpec(nodeType, key);
                  const rowKey = liveParamKey(node.id, key);
                  const draftValue = rowKey in liveParamDrafts ? liveParamDrafts[rowKey] : value;
                  const isConfirmed = confirmedLiveParamKeys.has(rowKey);
                  const isDirty = !sameLiveParamValue(draftValue, value);
                  const confirmButton = (
                    <button
                      type="button"
                      className={`${styles.liveParamConfirm} ${isConfirmed ? styles.liveParamConfirmDone : ''} ${isDirty ? styles.liveParamConfirmDirty : ''}`}
                      onClick={() => confirmLiveParam(node.id, key, value)}
                      title="确认此参数"
                    >
                      ✓
                    </button>
                  );

                  if (spec?.options?.length) {
                    return (
                      <div key={key} className={styles.liveParamRow}>
                        <span>{getParamDisplayLabel(nodeType, key)}</span>
                        <div className={styles.liveParamControlLine}>
                          <select
                            value={String(draftValue)}
                            onChange={(event) => updateLiveParamDraft(node.id, key, event.target.value)}
                          >
                            {spec.options.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                          {confirmButton}
                        </div>
                      </div>
                    );
                  }
                  if (typeof value === 'number') {
                    const range = getLiveNumberRange(nodeType, key, value);
                    return (
                      <div key={key} className={styles.liveParamRow}>
                        <span>{getParamDisplayLabel(nodeType, key)}</span>
                        <div className={styles.liveParamControlLine}>
                          <div className={styles.liveParamNumber}>
                            <input
                              type="range"
                              min={range.min}
                              max={range.max}
                              step={range.step}
                              value={draftValue as number}
                              onChange={(event) => updateLiveParamDraft(node.id, key, normalizeLiveParamValue(value, event.target.value))}
                            />
                            <input
                              type="number"
                              min={range.min}
                              max={range.max}
                              step={range.step}
                              value={draftValue as number}
                              onChange={(event) => updateLiveParamDraft(node.id, key, normalizeLiveParamValue(value, event.target.value))}
                            />
                          </div>
                          {confirmButton}
                        </div>
                      </div>
                    );
                  }
                  if (typeof value === 'boolean') {
                    return (
                      <div key={key} className={styles.liveParamRowInline}>
                        <span>{getParamDisplayLabel(nodeType, key)}</span>
                        <div className={styles.liveParamInlineControl}>
                          <input
                            type="checkbox"
                            checked={draftValue as boolean}
                            onChange={(event) => updateLiveParamDraft(node.id, key, event.target.checked)}
                          />
                          {confirmButton}
                        </div>
                      </div>
                    );
                  }
                  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
                    const draftArray = Array.isArray(draftValue) ? draftValue : value;
                    return (
                      <div key={key} className={styles.liveParamRow}>
                        <span>{getParamDisplayLabel(nodeType, key)}</span>
                        <div className={styles.liveParamControlLine}>
                          <div className={styles.liveParamVector}>
                            {draftArray.map((item, index) => (
                              <input
                                key={`${key}_${index}`}
                                type="number"
                                step={0.1}
                                value={item as number}
                                onChange={(event) => {
                                  const next = [...draftArray];
                                  next[index] = Number(event.target.value);
                                  updateLiveParamDraft(node.id, key, next);
                                }}
                              />
                            ))}
                          </div>
                          {confirmButton}
                        </div>
                      </div>
                    );
                  }
                  if (typeof value === 'string' && (value.startsWith('#') || key.toLowerCase().includes('color'))) {
                    return (
                      <div key={key} className={styles.liveParamRowInline}>
                        <span>{getParamDisplayLabel(nodeType, key)}</span>
                        <div className={styles.liveParamInlineControl}>
                          <input
                            type="color"
                            value={String(draftValue)}
                            onChange={(event) => updateLiveParamDraft(node.id, key, event.target.value)}
                          />
                          {confirmButton}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className={styles.liveParamRow}>
                      <span>{getParamDisplayLabel(nodeType, key)}</span>
                      <div className={styles.liveParamControlLine}>
                        <input
                          type="text"
                          value={String(draftValue)}
                          onChange={(event) => updateLiveParamDraft(node.id, key, event.target.value)}
                        />
                        {confirmButton}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {selBox && (
        <div
          className={styles.selectionBox}
          style={{ left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h }}
        />
      )}
      {selectionFrame && (
        <div
          className={styles.selectionFrame}
          data-selection-ui="true"
          style={{
            left: selectionFrame.x,
            top: selectionFrame.y,
            width: selectionFrame.w,
            height: selectionFrame.h,
          }}
        >
          <div className={styles.selectionLabel}>已选 {selectedCount} 个节点</div>
          <div className={styles.selectionToolbar} style={{ left: Math.max(0, selectionFrame.w / 2 - 306) }}>
            <button
              type="button"
              className={styles.iconTool}
              title="排列"
              onClick={() => setArrangeMenuOpen((open) => !open)}
            >
              <AppstoreOutlined />
            </button>
            <div className={styles.toolDivider} />
            <button type="button" className={styles.textTool} title="保存到素材">
              <BgColorsOutlined />
              <span>保存到素材</span>
            </button>
            <button type="button" className={styles.textTool} title="创建副本" onClick={duplicateSelectedNodes}>
              <CopyOutlined />
              <span>创建副本</span>
            </button>
            <div className={styles.toolDivider} />
            <button type="button" className={styles.iconTool} title="批量下载">
              <DownloadOutlined />
            </button>
            <button
              type="button"
              className={styles.textTool}
              title="打组"
              onClick={groupSelectedNodes}
            >
              <GroupOutlined />
              <span>打组</span>
              <DownOutlined />
            </button>
            {arrangeMenuOpen && (
              <div className={styles.arrangeMenu}>
                <button type="button" onClick={() => arrangeSelectedNodes('grid')}>
                  <AppstoreOutlined /> 宫格排列
                </button>
                <button type="button" onClick={() => arrangeSelectedNodes('horizontal')}>
                  <ColumnWidthOutlined /> 水平排列
                </button>
                <button type="button" onClick={() => arrangeSelectedNodes('vertical')}>
                  <ColumnHeightOutlined /> 垂直排列
                </button>
              </div>
            )}
            {groupMenuOpen && (
              <div className={styles.groupMenu}>
                <button type="button" onClick={groupSelectedNodes}>
                  <GroupOutlined /> 打组
                </button>
                <button type="button" onClick={groupSelectedNodes}>
                  <BorderOuterOutlined /> 合并分镜组
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {activeGroup && activeGroupFrame && (
        <div
          className={styles.selectionFrame}
          data-selection-ui="true"
          style={{
            left: activeGroupFrame.x,
            top: activeGroupFrame.y,
            width: activeGroupFrame.w,
            height: activeGroupFrame.h,
          }}
        >
          <button type="button" className={styles.saveTemplateButton} onClick={saveActiveGroupAsTemplate}>
            <SaveOutlined />
            <span>保存为创意模板</span>
          </button>
          <div className={styles.selectionLabel}>分组 {activeGroupCount} 个节点</div>
          <div className={styles.groupToolbar} style={{ left: Math.max(0, activeGroupFrame.w / 2 - 446) }}>
            <button
              type="button"
              className={styles.colorTool}
              title="底图颜色"
              onClick={() => setColorMenuOpen((open) => !open)}
            >
              <span style={{ background: activeGroupData?.color || 'rgba(255, 255, 255, 0.72)' }} />
            </button>
            <button
              type="button"
              className={styles.iconTool}
              title="排列"
              onClick={() => setArrangeMenuOpen((open) => !open)}
            >
              <AppstoreOutlined />
            </button>
            <div className={styles.toolDivider} />
            <button type="button" className={styles.textTool}>
              <PlayCircleOutlined />
              <span>整组执行</span>
            </button>
            <button type="button" className={styles.textTool} onClick={saveActiveGroupAsTemplate}>
              <SaveOutlined />
              <span>保存模板</span>
            </button>
            <button type="button" className={styles.textTool}>
              <GroupOutlined />
              <span>转分镜组</span>
            </button>
            <button type="button" className={styles.textTool} onClick={ungroupActiveGroup}>
              <UngroupOutlined />
              <span>解组</span>
            </button>
            <button type="button" className={styles.textTool}>
              <DownloadOutlined />
              <span>批量下载</span>
            </button>
            {colorMenuOpen && (
              <div className={styles.colorMenu}>
                {GROUP_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={color === 'transparent' ? styles.noColorSwatch : ''}
                    style={{ background: color === 'transparent' ? undefined : color.replace('0.16', '1') }}
                    onClick={() => updateActiveGroupColor(color)}
                    title={color === 'transparent' ? '无底色' : '设置底色'}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className={styles.canvasUtilityWrap} data-selection-ui="true">
        {organizeConfirmOpen && (
          <div className={styles.organizeConfirm}>
            <div>是否保留此次整理结果？</div>
            <div className={styles.organizeActions}>
              <button type="button" onClick={() => setOrganizeConfirmOpen(false)}>还原</button>
              <button type="button" onClick={() => setOrganizeConfirmOpen(false)}>保留</button>
            </div>
          </div>
        )}
        {canvasMapOpen && (
          <div className={styles.canvasMapPanel}>
            <svg className={styles.canvasMapEdges} viewBox={`0 0 ${CANVAS_MAP_WIDTH} ${CANVAS_MAP_HEIGHT}`}>
              {canvasMap.lines.map((line) => (
                <line
                  key={line.id}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                />
              ))}
            </svg>
            {canvasMap.nodes.map((node) => (
              <div
                key={node.id}
                className={`${styles.canvasMapNode} ${styles[`canvasMapNode_${node.kind}`]}`}
                title={node.label}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.w,
                  height: node.h,
                  backgroundImage: node.imageUrl ? `url(${node.imageUrl})` : undefined,
                }}
              />
            ))}
            {canvasMap.frame && (
              <div
                className={styles.canvasMapViewport}
                style={{
                  left: canvasMap.frame.x,
                  top: canvasMap.frame.y,
                  width: Math.max(8, canvasMap.frame.w),
                  height: Math.max(8, canvasMap.frame.h),
                }}
              />
            )}
          </div>
        )}
        <div className={styles.canvasUtilityBar}>
          <button
            type="button"
            className={styles.canvasUtilityBtn}
            data-tooltip="整理画布 Alt+Shift+F"
            onClick={handleOrganizeCanvas}
          >
            <AppstoreOutlined />
          </button>
          <button
            type="button"
            className={`${styles.canvasUtilityBtn} ${canvasMapOpen ? styles.canvasUtilityActive : ''}`}
            data-tooltip="画布小地图"
            onClick={() => setCanvasMapOpen((open) => !open)}
          >
            <AimOutlined />
          </button>
          <button
            type="button"
            className={`${styles.canvasUtilityBtn} ${gridSnapActive ? styles.canvasUtilityActive : ''}`}
            data-tooltip="网格吸附"
            onClick={() => setGridSnapActive((active) => !active)}
          >
            <LinkOutlined />
          </button>
          <button type="button" className={styles.zoomBtn} onClick={handleZoomOut} aria-label="缩小画布">
            <MinusOutlined />
          </button>
          <span className={styles.zoomValue}>{zoomPercent}%</span>
          <button type="button" className={styles.zoomBtn} onClick={handleZoomIn} aria-label="放大画布">
            <PlusOutlined />
          </button>
        </div>
      </div>
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className={styles.contextPrimary} onClick={() => addImageToCodeNodes(contextMenu.flowX, contextMenu.flowY)}>
            上传
          </button>
          <button type="button" disabled>保存到我的素材</button>
          <button
            type="button"
            onClick={() => {
              setAddMenu({
                x: Math.max(12, Math.min(contextMenu.x + 245, (canvasRef.current?.clientWidth || ADD_MENU_WIDTH + 24) - ADD_MENU_WIDTH - 12)),
                y: Math.max(12, contextMenu.y - 28),
                flowX: contextMenu.flowX,
                flowY: contextMenu.flowY,
              });
            }}
          >
            添加节点
          </button>
          <div className={styles.contextDivider} />
          <button type="button"><span>撤销</span><kbd>⌘Z</kbd></button>
          <button type="button" disabled><span>重做</span><kbd>⇧⌘Z</kbd></button>
          <div className={styles.contextDivider} />
          <button type="button"><span>粘贴</span><kbd>⌘V</kbd></button>
        </div>
      )}
      {addMenu && (
        <div
          className={styles.addMenu}
          style={{ left: addMenu.x, top: addMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.addMenuColumnPrimary}>
            <div className={styles.addMenuTitle}>新增节点菜单</div>
            <button
              type="button"
              onClick={() => {
                addDirectTextEditorNode(addMenu.flowX, addMenu.flowY, addMenu.sourceId);
              }}
            >
              <span>☰</span>文本
            </button>
            <button
              type="button"
              onClick={() => {
                if (addMenu.sourceId?.startsWith('__image_source_')) {
                  addLinkedImageToCodeNode(addMenu.sourceId);
                  return;
                }
                addImageToCodeNodes(addMenu.flowX, addMenu.flowY, addMenu.sourceId);
              }}
            >
              <span>▧</span>图片
            </button>
            <button type="button" onClick={() => addAssetToCodeNode('vector', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
              <span>▧</span>矢量图形
            </button>
            <button type="button" onClick={() => addSimpleNode('vector.svgEditor', 'SVG 编辑器', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
              <span>✎</span>SVG 编辑器
            </button>
            <button type="button" onClick={() => addAssetToCodeNode('data', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
              <span>≡</span>数据
            </button>
            <button type="button" onClick={() => addAssetToCodeNode('model3d', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
              <span>◻</span>3D模型
            </button>
            <button type="button" onClick={() => addAssetToCodeNode('audio', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
              <span>≋</span>音频
            </button>
            <button
              type="button"
              className={styles.addMenuFontItem}
              onClick={() => addSimpleNode('file_font', '字体文件', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}
            >
              <span>Tt</span>字体
            </button>
          </div>
          <div>
            <div className={styles.addMenuTitle}>交互节点</div>
            <button type="button" className={styles.addMenuInteractionItem} onClick={() => addSimpleNode('faceRecognition', '人脸识别', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
              <span>◎</span>人脸识别<small>代码</small><small>数据</small>
            </button>
            <button type="button" className={styles.addMenuInteractionItem} onClick={() => addSimpleNode('gesture', '手势识别', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
              <span>⌁</span>手势识别<small>代码</small><small>数据</small>
            </button>
            <button type="button" className={styles.addMenuInteractionItem} onClick={() => addSimpleNode('mouse', '鼠标交互', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
              <span>⌖</span>鼠标交互<small>代码</small><small>数据</small>
            </button>
            <button type="button" className={styles.addMenuInteractionItem} onClick={() => addSimpleNode('keyboard', '键盘交互', addMenu.flowX, addMenu.flowY, addMenu.sourceId)}>
              <span>☰</span>键盘交互<small>代码</small><small>数据</small>
            </button>
          </div>
        </div>
      )}
      {referenceMenu && (
        <div
          className={styles.referenceMenu}
          style={{ left: referenceMenu.x, top: referenceMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.referenceTitle}>你想要干什么？</div>
          <button
            type="button"
            className={styles.referenceItemActive}
            onClick={() => {
              if (referenceMenu.sourceId.startsWith('__image_source_')) {
                addLinkedImageToCodeNode(referenceMenu.sourceId);
                return;
              }
              addDirectTextEditorNode(referenceMenu.flowX, referenceMenu.flowY, referenceMenu.sourceId);
            }}
          >
            <span>☰</span>
            <strong>{referenceMenu.sourceId.startsWith('__image_source_') ? '图片' : '文本'}</strong>
            <small>根据该素材生成代码、脚本或提示词</small>
          </button>
          <button type="button"><span>▧</span><strong>图片</strong></button>
          <button type="button"><span>▻</span><strong>视频</strong></button>
          <button type="button" disabled><span>⌘</span><strong>视频合成</strong><small>Beta</small></button>
          <button type="button" disabled><span>≋</span><strong>音频</strong></button>
          <button type="button"><span>▣</span><strong>脚本</strong><small>Beta</small></button>
          <div className={styles.referenceDivider} />
          <button type="button" onClick={() => addSimpleNode('CodeBlock', '代码调整', referenceMenu.flowX, referenceMenu.flowY)}>
            <span>⌘</span><strong>代码调整</strong>
          </button>
          <div className={styles.referenceGroupLabel}>新增交互</div>
          <button type="button" onClick={() => addSimpleNode('keyboard', '键盘交互', referenceMenu.flowX, referenceMenu.flowY)}>
            <span>⌨</span><strong>键盘交互</strong>
          </button>
          <button type="button" onClick={() => addSimpleNode('mouse', '鼠标交互', referenceMenu.flowX, referenceMenu.flowY)}>
            <span>◎</span><strong>鼠标交互</strong>
          </button>
          <button type="button" onClick={() => addSimpleNode('camera_interaction', '新增摄像机路径', referenceMenu.flowX, referenceMenu.flowY)}>
            <span>⌁</span><strong>新增摄像机路径</strong>
          </button>
        </div>
      )}
    </div>
  );
}

export function NodeCanvas(props: NodeCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

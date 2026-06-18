export interface Vec2 { x: number; y: number; }

export interface VectorTransform {
  x: number; y: number;
  rotation: number;
  scaleX: number; scaleY: number;
  skewX: number; skewY: number;
}

export type AnchorMode = "corner" | "smooth" | "symmetric";

export interface PathSegment {
  id: string;
  point: Vec2;
  handleIn: Vec2;
  handleOut: Vec2;
  anchorMode: AnchorMode;
}

export interface VectorStyle {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  blendMode: string;
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "miter" | "round" | "bevel";
  dashArray?: number[];
  fillRule?: "nonzero" | "evenodd";
}

export interface BaseVectorNode extends VectorStyle {
  id: string;
  type: VectorNode["type"];
  name: string;
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  transform: VectorTransform;
}

export interface GroupNode extends BaseVectorNode {
  type: "group";
  childIds: string[];
}

export interface PathNode extends BaseVectorNode {
  type: "path";
  closed: boolean;
  segments: PathSegment[];
}

export interface RectangleNode extends BaseVectorNode {
  type: "rectangle";
  width: number;
  height: number;
  radiusX: number;
  radiusY: number;
}

export interface EllipseNode extends BaseVectorNode {
  type: "ellipse";
  radiusX: number;
  radiusY: number;
}

export interface LineNode extends BaseVectorNode {
  type: "line";
  start: Vec2;
  end: Vec2;
}

export interface PolygonNode extends BaseVectorNode {
  type: "polygon";
  radius: number;
  sides: number;
}

export interface StarNode extends BaseVectorNode {
  type: "star";
  points: number;
  outerRadius: number;
  innerRadius: number;
}

export interface TextNode extends BaseVectorNode {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  letterSpacing: number;
  lineHeight: number;
  textAlign: "left" | "center" | "right" | "justify";
  width: number;
  height: number;
}

export interface ImageNode extends BaseVectorNode {
  type: "image";
  assetId: string;
  width: number;
  height: number;
}

export type VectorNode =
  | GroupNode | PathNode | RectangleNode | EllipseNode
  | LineNode | PolygonNode | StarNode | TextNode | ImageNode;

export interface AnchorRef {
  nodeId: string;
  segmentId: string;
  part: "point" | "handleIn" | "handleOut";
}

export interface SvgSelection {
  nodeIds: string[];
  anchorRefs: AnchorRef[];
}

export interface SvgDocument {
  version: 9;
  width: number;
  height: number;
  viewBox: [number, number, number, number];
  rootIds: string[];
  nodes: Record<string, VectorNode>;
  selection: SvgSelection;
}

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface EditorPointerEvent {
  pointerId: number;
  screen: Vec2;
  document: Vec2;
  button: number;
  modifiers: {
    shift: boolean;
    alt: boolean;
    meta: boolean;
    ctrl: boolean;
  };
  targetNodeId?: string;
}

export type ToolId =
  | "select" | "directSelect" | "pen" | "pencil" | "line"
  | "rectangle" | "roundedRectangle" | "ellipse"
  | "polygon" | "star" | "text" | "hand" | "zoom";

export interface SvgVec2 {
  x: number;
  y: number;
}

export interface SvgTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
}

export interface SvgPathSegment {
  id: string;
  point: SvgVec2;
  handleIn: SvgVec2;
  handleOut: SvgVec2;
  anchorMode:
    | "corner"
    | "smooth"
    | "symmetric";
}

export interface SvgBaseNode {
  id: string;
  name: string;
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  transform: SvgTransform;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  blendMode: string;
  fillRule?: "nonzero" | "evenodd";
}

export interface SvgGroupNode
  extends SvgBaseNode {
  type: "group";
  childIds: string[];
}

export interface SvgPathNode
  extends SvgBaseNode {
  type: "path";
  closed: boolean;
  segments: SvgPathSegment[];
}

export type SvgVectorNode =
  | SvgGroupNode
  | SvgPathNode;

export interface SvgDocumentV9 {
  version: 9;
  width: number;
  height: number;
  viewBox: [
    number,
    number,
    number,
    number,
  ];
  rootIds: string[];
  nodes: Record<
    string,
    SvgVectorNode
  >;
  selection: {
    nodeIds: string[];
    anchorRefs: unknown[];
  };
}

export function createSvgId(
  prefix: string,
): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createSvgTransform(): SvgTransform {
  return {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    skewY: 0,
  };
}

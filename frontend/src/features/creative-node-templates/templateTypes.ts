export type TemplateCategory =
  | "image"
  | "svg"
  | "camera"
  | "audio"
  | "face"
  | "gesture"
  | "personal";

export type MappingMode =
  | "direct"
  | "continuous"
  | "threshold"
  | "event"
  | "state";

export interface TemplatePosition {
  x: number;
  y: number;
}

export interface TemplateNode {
  id: string;
  type: string;
  label: string;
  position: TemplatePosition;
  params: Record<string, unknown>;
  ui?: {
    width?: number;
    collapsed?: boolean;
    accent?: string;
  };
}

export interface EdgeMapping {
  id: string;
  mode: MappingMode;
  input: string;
  output: string;
  label: string;
  inputRange?: [number, number];
  outputRange?: [number | string | boolean, number | string | boolean];
  curve?: "linear" | "easeIn" | "easeOut" | "easeInOut" | "exponential" | "step";
  invert?: boolean;
  clamp?: boolean;
  smoothing?: {
    type: "none" | "lerp" | "ema" | "oneEuro";
    amount: number;
  };
  threshold?: {
    operator: ">" | ">=" | "<" | "<=" | "between" | "equals";
    value: unknown;
    hysteresis?: number;
  };
  trigger?: {
    behavior: "continuous" | "onEnter" | "onExit" | "once" | "toggle";
    holdMs?: number;
    cooldownMs?: number;
  };
}

export interface TemplateEdge {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
  label: string;
  mappings: EdgeMapping[];
}

export interface TemplateInsertionPolicy {
  surface: "host-node-canvas";
  renderGroupFrame: false;
  useHostNodeComponents: true;
  useHostEdgeComponent: true;
  useHostInspector: true;
  reuseExistingSystemNodes?: boolean;
  insertAsSingleUndoTransaction?: boolean;
}

export interface CreativeTemplate {
  id: string;
  version: string;
  name: string;
  nameEN?: string;
  category: TemplateCategory;
  description: string;
  tags?: string[];
  difficulty?: "basic" | "intermediate" | "advanced";
  performance?: "low" | "medium" | "high";
  insertion: TemplateInsertionPolicy;
  graph: {
    /** Layout metadata only. Never draw a visible group frame. */
    group: {
      title: string;
      width: number;
      height: number;
      collapsedByDefault?: boolean;
      layoutOnly: true;
      renderFrame: false;
    };
    nodes: TemplateNode[];
    edges: TemplateEdge[];
  };
}

export interface NodeParameterDefinition {
  key: string;
  label: string;
  type: string;
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: unknown[];
}

export interface NodeCatalogItem {
  type: string;
  label: string;
  category: string;
  runtime: string;
  inputs: Array<{ name: string; dataType: string; label: string }>;
  outputs: Array<{ name: string; dataType: string; label: string }>;
  parameterGroups: Array<{
    id: string;
    label: string;
    parameters: NodeParameterDefinition[];
  }>;
}

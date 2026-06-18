export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export interface TransformBuffer {
  count: number;
  positions: Float32Array;
  rotations: Float32Array;
  scales: Float32Array;
  ids: Uint32Array;
}

export interface ParticleStateBuffer {
  count: number;
  positions: Float32Array;
  velocities: Float32Array;
  accelerations: Float32Array;
  initialPositions: Float32Array;
  ages: Float32Array;
  lifetimes: Float32Array;
  ids: Uint32Array;

  /**
   * Optional renderer attributes. Motion strategies do not require them,
   * but renderers consume them when present.
   */
  colors?: Float32Array; // RGB, length = count * 3
  sizes?: Float32Array;  // length = count
}

export interface ScalarSignal {
  value: number;
  normalized: number;
  time: number;
}

export interface FrameContext {
  time: number;
  deltaTime: number;
  frame: number;
  mode?: "preview" | "export";
}

export type ParamMap = Record<string, unknown>;

export type UpdatePolicy = "onDirty" | "perFrame" | "onEvent";
export type DirtyReason = "param" | "input" | "time" | "asset" | "variant";

export interface RuntimeNodeRecord {
  id: string;
  type: string;
  params: ParamMap;
  adapterId: string;
  updatePolicy: UpdatePolicy;
  cacheable: boolean;
  dirty: boolean;
  dirtyReason?: DirtyReason;
  cachedOutput?: unknown;
  revision: number;
}

export interface RuntimeEdge {
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface RuntimeAdapter {
  cook(inputs: Record<string, unknown>, params: ParamMap, context: FrameContext): unknown;
  updateHot?(output: unknown, changedParams: ParamMap): void;
  dispose?(output: unknown): void;
}

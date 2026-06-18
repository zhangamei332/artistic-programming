import type { FrameContext, ParamMap, ParticleStateBuffer, ScalarSignal, TransformBuffer, Vec3 } from "../core/types.js";
import { clamp, cross, normalizeVec3, vecLength } from "../core/math.js";
import { integerParam, numberParam, vec3Param } from "../core/params.js";
import { CurlNoise3D, ValueNoise3D } from "../core/noise3d.js";
import { randomUnitVector3 } from "../core/random.js";


function createDefaultColors(count: number): Float32Array {
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const p = i * 3;
    colors[p] = 1;
    colors[p + 1] = 1;
    colors[p + 2] = 1;
  }
  return colors;
}

export type ParticleMotionVariant =
  | "constantDirection"
  | "randomWalk"
  | "noise"
  | "curlNoise"
  | "vortex"
  | "orbit"
  | "attract"
  | "repel"
  | "flock"
  | "wave"
  | "turbulence";

const valueNoiseCache = new Map<number, [ValueNoise3D, ValueNoise3D, ValueNoise3D]>();
const curlNoiseCache = new Map<number, CurlNoise3D>();

function valueNoiseVector(seed: number, x: number, y: number, z: number): Vec3 {
  let fields = valueNoiseCache.get(seed);
  if (!fields) {
    fields = [new ValueNoise3D(seed), new ValueNoise3D(seed ^ 0x1234abcd), new ValueNoise3D(seed ^ 0x7f4a7c15)];
    valueNoiseCache.set(seed, fields);
  }
  return [fields[0].sample(x, y, z), fields[1].sample(x, y, z), fields[2].sample(x, y, z)];
}

function curlField(seed: number): CurlNoise3D {
  let field = curlNoiseCache.get(seed);
  if (!field) {
    field = new CurlNoise3D(seed);
    curlNoiseCache.set(seed, field);
  }
  return field;
}

export function createParticleState(transforms: TransformBuffer, lifetime = Number.POSITIVE_INFINITY): ParticleStateBuffer {
  const count = transforms.count;
  return {
    count,
    positions: transforms.positions.slice(),
    velocities: new Float32Array(count * 3),
    accelerations: new Float32Array(count * 3),
    initialPositions: transforms.positions.slice(),
    ages: new Float32Array(count),
    lifetimes: new Float32Array(count).fill(lifetime),
    ids: transforms.ids.slice(),
    colors: createDefaultColors(count),
    sizes: new Float32Array(count).fill(1),
  };
}

export function stepParticleMotion(
  variant: ParticleMotionVariant,
  state: ParticleStateBuffer,
  params: ParamMap,
  context: FrameContext,
  curve?: ScalarSignal,
): ParticleStateBuffer {
  state.accelerations.fill(0);
  const curveInfluence = clamp(numberParam(params, "curveInfluence", 1), 0, 1);
  const curveValue = curve && Number.isFinite(curve.value) ? curve.value : 1;
  const modulation = 1 + (curveValue - 1) * curveInfluence;
  const curveTarget = String(params.curveTarget ?? "both");
  const strength = numberParam(params, "strength", 0.8) *
    (curveTarget === "strength" || curveTarget === "both" ? modulation : 1);
  const speed = numberParam(params, "speed", 1) *
    (curveTarget === "speed" || curveTarget === "both" ? modulation : 1);
  const seed = integerParam(params, "seed", 1);

  switch (variant) {
    case "constantDirection": applyConstantDirection(state, params, strength);
      break;
    case "randomWalk": applyRandomWalk(state, params, context, seed, strength);
      break;
    case "noise": applyNoise(state, params, context, seed, strength);
      break;
    case "curlNoise": applyCurlNoise(state, params, context, seed, strength);
      break;
    case "vortex": applyVortex(state, params, strength);
      break;
    case "orbit": applyOrbit(state, params, strength);
      break;
    case "attract": applyAttractRepel(state, params, strength, 1);
      break;
    case "repel": applyAttractRepel(state, params, strength, -1);
      break;
    case "flock": applyFlock(state, params);
      break;
    case "wave": applyWave(state, params, context, strength);
      break;
    case "turbulence": applyTurbulence(state, params, context, seed, strength);
      break;
    default: {
      const unreachable: never = variant;
      throw new Error(`Unsupported particle motion: ${String(unreachable)}`);
    }
  }

  integrate(state, params, context, speed);
  return state;
}

function addAcceleration(state: ParticleStateBuffer, index: number, value: Vec3): void {
  const p = index * 3;
  state.accelerations[p] = (state.accelerations[p] ?? 0) + value[0];
  state.accelerations[p + 1] = (state.accelerations[p + 1] ?? 0) + value[1];
  state.accelerations[p + 2] = (state.accelerations[p + 2] ?? 0) + value[2];
}

function positionAt(state: ParticleStateBuffer, index: number): Vec3 {
  const p = index * 3;
  return [state.positions[p] ?? 0, state.positions[p + 1] ?? 0, state.positions[p + 2] ?? 0];
}

function velocityAt(state: ParticleStateBuffer, index: number): Vec3 {
  const p = index * 3;
  return [state.velocities[p] ?? 0, state.velocities[p + 1] ?? 0, state.velocities[p + 2] ?? 0];
}

function applyConstantDirection(state: ParticleStateBuffer, params: ParamMap, strength: number): void {
  const direction = normalizeVec3(vec3Param(params, "direction", [1, 0, 0]));
  const acceleration = numberParam(params, "acceleration", 1) * strength;
  for (let i = 0; i < state.count; i += 1) {
    addAcceleration(state, i, [direction[0] * acceleration, direction[1] * acceleration, direction[2] * acceleration]);
  }
}

function applyRandomWalk(state: ParticleStateBuffer, params: ParamMap, context: FrameContext, seed: number, strength: number): void {
  const turnRate = numberParam(params, "turnRate", 1);
  for (let i = 0; i < state.count; i += 1) {
    const direction = randomUnitVector3(seed, state.ids[i] ?? i, Math.floor(context.frame * turnRate));
    addAcceleration(state, i, [direction[0] * strength, direction[1] * strength, direction[2] * strength]);
  }
}

function applyNoise(state: ParticleStateBuffer, params: ParamMap, context: FrameContext, seed: number, strength: number): void {
  const scale = numberParam(params, "scale", 0.15);
  const evolutionSpeed = numberParam(params, "evolutionSpeed", 0.2);
  const t = context.time * evolutionSpeed;
  for (let i = 0; i < state.count; i += 1) {
    const [x, y, z] = positionAt(state, i);
    const value = valueNoiseVector(seed, x * scale + t, y * scale, z * scale);
    addAcceleration(state, i, [value[0] * strength, value[1] * strength, value[2] * strength]);
  }
}

function applyCurlNoise(state: ParticleStateBuffer, params: ParamMap, context: FrameContext, seed: number, strength: number): void {
  const scale = numberParam(params, "scale", 0.15);
  const evolutionSpeed = numberParam(params, "evolutionSpeed", 0.2);
  const epsilon = numberParam(params, "epsilon", 0.01);
  const field = curlField(seed);
  const t = context.time * evolutionSpeed;
  for (let i = 0; i < state.count; i += 1) {
    const [x, y, z] = positionAt(state, i);
    const curl = field.sample(x * scale + t, y * scale, z * scale, epsilon);
    addAcceleration(state, i, [curl[0] * strength, curl[1] * strength, curl[2] * strength]);
  }
}

function applyVortex(state: ParticleStateBuffer, params: ParamMap, strength: number): void {
  const center = vec3Param(params, "center", [0, 0, 0]);
  const axis = normalizeVec3(vec3Param(params, "axis", [0, 1, 0]));
  const angularSpeed = numberParam(params, "angularSpeed", 1) * strength;
  const radialPull = numberParam(params, "radialPull", 0.15);
  for (let i = 0; i < state.count; i += 1) {
    const position = positionAt(state, i);
    const radial: Vec3 = [position[0] - center[0], position[1] - center[1], position[2] - center[2]];
    const alongAxis = radial[0] * axis[0] + radial[1] * axis[1] + radial[2] * axis[2];
    const planar: Vec3 = [radial[0] - axis[0] * alongAxis, radial[1] - axis[1] * alongAxis, radial[2] - axis[2] * alongAxis];
    const tangent = normalizeVec3(cross(axis, planar), [1, 0, 0]);
    addAcceleration(state, i, [
      tangent[0] * angularSpeed - planar[0] * radialPull,
      tangent[1] * angularSpeed - planar[1] * radialPull,
      tangent[2] * angularSpeed - planar[2] * radialPull,
    ]);
  }
}

function applyOrbit(state: ParticleStateBuffer, params: ParamMap, strength: number): void {
  const center = vec3Param(params, "center", [0, 0, 0]);
  const axis = normalizeVec3(vec3Param(params, "axis", [0, 1, 0]));
  const tangential = numberParam(params, "angularSpeed", 1) * strength;
  const radialStiffness = numberParam(params, "radialStiffness", 0.3);
  const targetRadius = numberParam(params, "radius", 8);
  for (let i = 0; i < state.count; i += 1) {
    const position = positionAt(state, i);
    const radial: Vec3 = [position[0] - center[0], position[1] - center[1], position[2] - center[2]];
    const radius = vecLength(radial[0], radial[1], radial[2]);
    const radialDirection = normalizeVec3(radial, [1, 0, 0]);
    const tangent = normalizeVec3(cross(axis, radialDirection), [0, 0, 1]);
    const correction = (targetRadius - radius) * radialStiffness;
    addAcceleration(state, i, [
      tangent[0] * tangential + radialDirection[0] * correction,
      tangent[1] * tangential + radialDirection[1] * correction,
      tangent[2] * tangential + radialDirection[2] * correction,
    ]);
  }
}

function applyAttractRepel(state: ParticleStateBuffer, params: ParamMap, strength: number, sign: 1 | -1): void {
  const target = vec3Param(params, sign === 1 ? "attractorPosition" : "repulsorPosition", [0, 0, 0]);
  const radius = Math.max(1e-4, numberParam(params, "radius", 10));
  const falloff = Math.max(0, numberParam(params, "falloff", 2));
  for (let i = 0; i < state.count; i += 1) {
    const position = positionAt(state, i);
    const delta: Vec3 = [target[0] - position[0], target[1] - position[1], target[2] - position[2]];
    const distance = vecLength(delta[0], delta[1], delta[2]);
    if (distance > radius || distance < 1e-6) continue;
    const direction = normalizeVec3(delta);
    const influence = Math.pow(1 - distance / radius, falloff) * strength * sign;
    addAcceleration(state, i, [direction[0] * influence, direction[1] * influence, direction[2] * influence]);
  }
}

class SpatialHashGrid {
  private readonly cells = new Map<string, number[]>();
  public constructor(private readonly cellSize: number) {}
  private key(x: number, y: number, z: number): string { return `${x},${y},${z}`; }
  private coordinate(value: number): number { return Math.floor(value / this.cellSize); }
  public insert(index: number, position: Vec3): void {
    const key = this.key(this.coordinate(position[0]), this.coordinate(position[1]), this.coordinate(position[2]));
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(index); else this.cells.set(key, [index]);
  }
  public query(position: Vec3): number[] {
    const cx = this.coordinate(position[0]);
    const cy = this.coordinate(position[1]);
    const cz = this.coordinate(position[2]);
    const result: number[] = [];
    for (let x = cx - 1; x <= cx + 1; x += 1) {
      for (let y = cy - 1; y <= cy + 1; y += 1) {
        for (let z = cz - 1; z <= cz + 1; z += 1) {
          const bucket = this.cells.get(this.key(x, y, z));
          if (bucket) result.push(...bucket);
        }
      }
    }
    return result;
  }
}

function applyFlock(state: ParticleStateBuffer, params: ParamMap): void {
  const perceptionRadius = Math.max(1e-3, numberParam(params, "perceptionRadius", 2));
  const separationWeight = numberParam(params, "separation", 1.5);
  const alignmentWeight = numberParam(params, "alignment", 1);
  const cohesionWeight = numberParam(params, "cohesion", 1);
  const grid = new SpatialHashGrid(perceptionRadius);
  for (let i = 0; i < state.count; i += 1) grid.insert(i, positionAt(state, i));

  for (let i = 0; i < state.count; i += 1) {
    const position = positionAt(state, i);
    const neighbors = grid.query(position);
    let neighborCount = 0;
    let separation: Vec3 = [0, 0, 0];
    let averageVelocity: Vec3 = [0, 0, 0];
    let center: Vec3 = [0, 0, 0];
    for (const neighbor of neighbors) {
      if (neighbor === i) continue;
      const other = positionAt(state, neighbor);
      const dx = position[0] - other[0];
      const dy = position[1] - other[1];
      const dz = position[2] - other[2];
      const distance = Math.hypot(dx, dy, dz);
      if (distance <= 1e-6 || distance > perceptionRadius) continue;
      const inv = 1 / Math.max(distance * distance, 1e-4);
      separation = [separation[0] + dx * inv, separation[1] + dy * inv, separation[2] + dz * inv];
      const velocity = velocityAt(state, neighbor);
      averageVelocity = [averageVelocity[0] + velocity[0], averageVelocity[1] + velocity[1], averageVelocity[2] + velocity[2]];
      center = [center[0] + other[0], center[1] + other[1], center[2] + other[2]];
      neighborCount += 1;
    }
    if (neighborCount === 0) continue;
    const invCount = 1 / neighborCount;
    averageVelocity = [averageVelocity[0] * invCount, averageVelocity[1] * invCount, averageVelocity[2] * invCount];
    center = [center[0] * invCount, center[1] * invCount, center[2] * invCount];
    const cohesion: Vec3 = [center[0] - position[0], center[1] - position[1], center[2] - position[2]];
    addAcceleration(state, i, [
      separation[0] * separationWeight + averageVelocity[0] * alignmentWeight + cohesion[0] * cohesionWeight,
      separation[1] * separationWeight + averageVelocity[1] * alignmentWeight + cohesion[1] * cohesionWeight,
      separation[2] * separationWeight + averageVelocity[2] * alignmentWeight + cohesion[2] * cohesionWeight,
    ]);
  }
}

function applyWave(state: ParticleStateBuffer, params: ParamMap, context: FrameContext, strength: number): void {
  const direction = normalizeVec3(vec3Param(params, "direction", [0, 1, 0]));
  const amplitude = numberParam(params, "amplitude", 1) * strength;
  const frequency = numberParam(params, "frequency", 1);
  const wavelength = Math.max(1e-4, numberParam(params, "wavelength", 5));
  const phaseSpeed = numberParam(params, "phaseSpeed", 1);
  for (let i = 0; i < state.count; i += 1) {
    const p = i * 3;
    const x = state.initialPositions[p] ?? 0;
    const z = state.initialPositions[p + 2] ?? 0;
    const wave = Math.sin((x + z) / wavelength * Math.PI * 2 + context.time * phaseSpeed) * amplitude * frequency;
    addAcceleration(state, i, [direction[0] * wave, direction[1] * wave, direction[2] * wave]);
  }
}

function applyTurbulence(state: ParticleStateBuffer, params: ParamMap, context: FrameContext, seed: number, strength: number): void {
  const scale = numberParam(params, "scale", 0.12);
  const octaves = Math.max(1, integerParam(params, "octaves", 4));
  const lacunarity = Math.max(1, numberParam(params, "lacunarity", 2));
  const persistence = clamp(numberParam(params, "persistence", 0.5), 0, 1);
  const evolutionSpeed = numberParam(params, "evolutionSpeed", 0.2);
  const field = curlField(seed);
  for (let i = 0; i < state.count; i += 1) {
    const [x, y, z] = positionAt(state, i);
    let frequency = scale;
    let amplitude = 1;
    let total: Vec3 = [0, 0, 0];
    let normalization = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      const curl = field.sample(x * frequency + context.time * evolutionSpeed, y * frequency, z * frequency, 0.01);
      total = [total[0] + curl[0] * amplitude, total[1] + curl[1] * amplitude, total[2] + curl[2] * amplitude];
      normalization += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    const factor = normalization > 0 ? strength / normalization : 0;
    addAcceleration(state, i, [total[0] * factor, total[1] * factor, total[2] * factor]);
  }
}

function integrate(state: ParticleStateBuffer, params: ParamMap, context: FrameContext, speedMultiplier: number): void {
  const dt = clamp(context.deltaTime, 0, 0.05);
  const drag = Math.max(0, numberParam(params, "drag", 0.12));
  const maxSpeed = Math.max(0, numberParam(params, "maxSpeed", 20));
  const velocityDecay = Math.exp(-drag * dt);
  for (let i = 0; i < state.count; i += 1) {
    const p = i * 3;
    let vx = ((state.velocities[p] ?? 0) + (state.accelerations[p] ?? 0) * dt) * velocityDecay;
    let vy = ((state.velocities[p + 1] ?? 0) + (state.accelerations[p + 1] ?? 0) * dt) * velocityDecay;
    let vz = ((state.velocities[p + 2] ?? 0) + (state.accelerations[p + 2] ?? 0) * dt) * velocityDecay;
    const magnitude = Math.hypot(vx, vy, vz);
    if (maxSpeed > 0 && magnitude > maxSpeed) {
      const factor = maxSpeed / magnitude;
      vx *= factor; vy *= factor; vz *= factor;
    }
    state.velocities[p] = vx;
    state.velocities[p + 1] = vy;
    state.velocities[p + 2] = vz;
    state.positions[p] = (state.positions[p] ?? 0) + vx * dt * speedMultiplier;
    state.positions[p + 1] = (state.positions[p + 1] ?? 0) + vy * dt * speedMultiplier;
    state.positions[p + 2] = (state.positions[p + 2] ?? 0) + vz * dt * speedMultiplier;
    state.ages[i] = (state.ages[i] ?? 0) + dt;
    if ((state.ages[i] ?? 0) > (state.lifetimes[i] ?? Number.POSITIVE_INFINITY)) {
      state.positions[p] = state.initialPositions[p] ?? 0;
      state.positions[p + 1] = state.initialPositions[p + 1] ?? 0;
      state.positions[p + 2] = state.initialPositions[p + 2] ?? 0;
      state.velocities[p] = 0;
      state.velocities[p + 1] = 0;
      state.velocities[p + 2] = 0;
      state.ages[i] = 0;
    }
  }
}

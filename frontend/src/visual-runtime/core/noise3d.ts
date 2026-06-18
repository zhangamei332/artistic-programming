import type { Vec3 } from "./types.js";
import { hashUint } from "./random.js";

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class ValueNoise3D {
  public constructor(private readonly seed = 1) {}

  private lattice(x: number, y: number, z: number): number {
    const h = hashUint(
      this.seed ^
      Math.imul(x, 0x8da6b343) ^
      Math.imul(y, 0xd8163841) ^
      Math.imul(z, 0xcb1ab31f),
    );
    return (h / 0xffffffff) * 2 - 1;
  }

  public sample(x: number, y: number, z: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const z1 = z0 + 1;
    const tx = fade(x - x0);
    const ty = fade(y - y0);
    const tz = fade(z - z0);

    const c000 = this.lattice(x0, y0, z0);
    const c100 = this.lattice(x1, y0, z0);
    const c010 = this.lattice(x0, y1, z0);
    const c110 = this.lattice(x1, y1, z0);
    const c001 = this.lattice(x0, y0, z1);
    const c101 = this.lattice(x1, y0, z1);
    const c011 = this.lattice(x0, y1, z1);
    const c111 = this.lattice(x1, y1, z1);

    const x00 = mix(c000, c100, tx);
    const x10 = mix(c010, c110, tx);
    const x01 = mix(c001, c101, tx);
    const x11 = mix(c011, c111, tx);
    const y0v = mix(x00, x10, ty);
    const y1v = mix(x01, x11, ty);
    return mix(y0v, y1v, tz);
  }

  public fbm(x: number, y: number, z: number, octaves = 4, lacunarity = 2, persistence = 0.5): number {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let normalization = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      sum += this.sample(x * frequency, y * frequency, z * frequency) * amplitude;
      normalization += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return normalization > 0 ? sum / normalization : 0;
  }
}

export class CurlNoise3D {
  private readonly nx: ValueNoise3D;
  private readonly ny: ValueNoise3D;
  private readonly nz: ValueNoise3D;

  public constructor(seed = 1) {
    this.nx = new ValueNoise3D(seed ^ 0x13579bdf);
    this.ny = new ValueNoise3D(seed ^ 0x2468ace0);
    this.nz = new ValueNoise3D(seed ^ 0x5a5a5a5a);
  }

  public sample(x: number, y: number, z: number, epsilon = 0.01): Vec3 {
    const e = Math.max(1e-4, epsilon);
    const dNzDy = (this.nz.sample(x, y + e, z) - this.nz.sample(x, y - e, z)) / (2 * e);
    const dNyDz = (this.ny.sample(x, y, z + e) - this.ny.sample(x, y, z - e)) / (2 * e);
    const dNxDz = (this.nx.sample(x, y, z + e) - this.nx.sample(x, y, z - e)) / (2 * e);
    const dNzDx = (this.nz.sample(x + e, y, z) - this.nz.sample(x - e, y, z)) / (2 * e);
    const dNyDx = (this.ny.sample(x + e, y, z) - this.ny.sample(x - e, y, z)) / (2 * e);
    const dNxDy = (this.nx.sample(x, y + e, z) - this.nx.sample(x, y - e, z)) / (2 * e);
    return [dNzDy - dNyDz, dNxDz - dNzDx, dNyDx - dNxDy];
  }
}

import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
import { createSimplex2D, fbm } from "../utils/noise.js";

export const meta = {
  id: "domain-warping",
  name: "域扭曲",
  nameEN: "Domain Warping",
  category: "modifier",
  preview: "/creative-algorithms/previews/domain-warping.gif",
  tags: ["噪声", "液体", "大理石", "扭曲"]
};

export default class DomainWarping extends BaseCanvasAlgorithm {
  static defaults = {
    scale: 0.008,
    warpStrength: 2.2,
    speed: 0.16,
    octaves: 4,
    resolution: 4,
    seed: 37
  };

  reset() {
    this.noiseA = createSimplex2D(this.params.seed);
    this.noiseB = createSimplex2D(this.params.seed + 101);
    this.buffer = document.createElement("canvas");
    this.bctx = this.buffer.getContext("2d");
  }

  onParamsChanged(next) {
    if ("seed" in next) this.reset();
  }

  render() {
    const P = this.params;
    const w = Math.ceil(this.width / P.resolution);
    const h = Math.ceil(this.height / P.resolution);

    if (this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer.width = w;
      this.buffer.height = h;
    }

    const image = this.bctx.createImageData(w, h);
    const t = this.elapsed * P.speed;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x * P.resolution * P.scale;
        const ny = y * P.resolution * P.scale;

        const qx = fbm(this.noiseA, nx + t, ny, P.octaves);
        const qy = fbm(this.noiseB, nx, ny - t, P.octaves);
        const n = fbm(
          this.noiseA,
          nx + qx * P.warpStrength,
          ny + qy * P.warpStrength,
          P.octaves
        ) * 0.5 + 0.5;

        const i = (y * w + x) * 4;
        image.data[i] = 15 + n * 120;
        image.data[i + 1] = 35 + n * 175;
        image.data[i + 2] = 75 + (1 - n) * 165;
        image.data[i + 3] = 255;
      }
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}



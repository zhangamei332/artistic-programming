import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
import { createSimplex2D, fbm } from "../utils/noise.js";

export const meta = {
  id: "simplex-noise",
  name: "单纯形噪声",
  nameEN: "Simplex Noise",
  category: "generator",
  preview: "/creative-algorithms/previews/simplex-noise.gif",
  tags: ["噪声", "纹理", "地形", "动画"]
};

export default class SimplexNoise extends BaseCanvasAlgorithm {
  static defaults = {
    scale: 0.012,
    speed: 0.22,
    octaves: 5,
    resolution: 4,
    seed: 21
  };

  reset() {
    this.noise = createSimplex2D(this.params.seed);
    this.buffer = document.createElement("canvas");
    this.bctx = this.buffer.getContext("2d");
  }

  onParamsChanged(next) {
    if ("seed" in next) this.noise = createSimplex2D(this.params.seed);
  }

  render() {
    const r = this.params.resolution;
    const w = Math.max(1, Math.ceil(this.width / r));
    const h = Math.max(1, Math.ceil(this.height / r));

    if (this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer.width = w;
      this.buffer.height = h;
    }

    const image = this.bctx.createImageData(w, h);
    const time = this.elapsed * this.params.speed;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = fbm(
          this.noise,
          x * r * this.params.scale + time,
          y * r * this.params.scale - time * 0.7,
          this.params.octaves
        ) * 0.5 + 0.5;

        const i = (y * w + x) * 4;
        image.data[i] = 20 + n * 95;
        image.data[i + 1] = 35 + n * 145;
        image.data[i + 2] = 85 + n * 165;
        image.data[i + 3] = 255;
      }
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}



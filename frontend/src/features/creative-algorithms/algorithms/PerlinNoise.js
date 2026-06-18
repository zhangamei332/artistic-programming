import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
import { fbm2D } from "../utils/noise.js";

export const meta = {
  id: "perlin-noise",
  name: "柏林噪声",
  nameEN: "Perlin-style FBM Noise",
  category: "generator",
  preview: "/creative-algorithms/previews/perlin-noise.gif",
  tags: ["噪声", "纹理", "地形", "流动"]
};

export default class PerlinNoise extends BaseCanvasAlgorithm {
  static defaults = { scale: 0.012, speed: 0.22, octaves: 5, pixelSize: 4, seed: 11 };

  reset() {
    this.buffer = document.createElement("canvas");
    this.bctx = this.buffer.getContext("2d");
  }

  onResize() {
    if (!this.buffer) return;
    this.buffer.width = Math.max(1, Math.ceil(this.width / this.params.pixelSize));
    this.buffer.height = Math.max(1, Math.ceil(this.height / this.params.pixelSize));
  }

  update() {}

  render() {
    const { pixelSize, scale, octaves, speed, seed } = this.params;
    const w = Math.max(1, Math.ceil(this.width / pixelSize));
    const h = Math.max(1, Math.ceil(this.height / pixelSize));
    if (this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer.width = w; this.buffer.height = h;
    }
    const image = this.bctx.createImageData(w, h);
    const t = this.elapsed * speed;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = fbm2D(x * scale * pixelSize + t, y * scale * pixelSize - t * 0.6, octaves, seed);
        const i = (y * w + x) * 4;
        image.data[i] = 20 + n * 70;
        image.data[i + 1] = 35 + n * 150;
        image.data[i + 2] = 75 + n * 175;
        image.data[i + 3] = 255;
      }
    }
    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}



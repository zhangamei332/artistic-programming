import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "reaction-diffusion", name: "反应扩散", nameEN: "Gray-Scott Reaction Diffusion",
  category: "simulator", preview: "/creative-algorithms/previews/reaction-diffusion.gif",
  tags: ["有机纹理", "图灵斑图", "细胞"]
};
export default class ReactionDiffusion extends BaseCanvasAlgorithm {
  static defaults = { resolution: 3, feed: 0.055, kill: 0.062, dA: 1.0, dB: 0.5, iterations: 7 };
  reset() {
    this.w = Math.max(20, Math.floor(this.width / this.params.resolution));
    this.h = Math.max(20, Math.floor(this.height / this.params.resolution));
    const n = this.w * this.h;
    this.a = new Float32Array(n); this.b = new Float32Array(n);
    this.na = new Float32Array(n); this.nb = new Float32Array(n);
    this.a.fill(1);
    for (let k = 0; k < 12; k++) {
      const cx = 5 + Math.floor(Math.random() * (this.w - 10));
      const cy = 5 + Math.floor(Math.random() * (this.h - 10));
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) this.b[(cy + y) * this.w + cx + x] = 1;
    }
    this.buffer = document.createElement("canvas"); this.buffer.width = this.w; this.buffer.height = this.h;
    this.bctx = this.buffer.getContext("2d");
  }
  onResize() { if (this.a) this.reset(); }
  update() {
    const { feed, kill, dA, dB, iterations } = this.params;
    const w = this.w, h = this.h;
    for (let it = 0; it < iterations; it++) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, a = this.a[i], b = this.b[i];
        const lapA = -a + .2 * (this.a[i-1]+this.a[i+1]+this.a[i-w]+this.a[i+w]) + .05 * (this.a[i-w-1]+this.a[i-w+1]+this.a[i+w-1]+this.a[i+w+1]);
        const lapB = -b + .2 * (this.b[i-1]+this.b[i+1]+this.b[i-w]+this.b[i+w]) + .05 * (this.b[i-w-1]+this.b[i-w+1]+this.b[i+w-1]+this.b[i+w+1]);
        const reaction = a * b * b;
        this.na[i] = Math.max(0, Math.min(1, a + dA * lapA - reaction + feed * (1 - a)));
        this.nb[i] = Math.max(0, Math.min(1, b + dB * lapB + reaction - (kill + feed) * b));
      }
      [this.a, this.na] = [this.na, this.a]; [this.b, this.nb] = [this.nb, this.b];
    }
  }
  render() {
    const image = this.bctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.a.length; i++) {
      const v = Math.max(0, Math.min(1, this.a[i] - this.b[i]));
      const p = i * 4;
      image.data[p] = 18 + v * 55; image.data[p+1] = 45 + v * 165; image.data[p+2] = 80 + v * 175; image.data[p+3] = 255;
    }
    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}



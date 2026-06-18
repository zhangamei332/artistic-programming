import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "worley-noise",
  name: "Worley 细胞噪声",
  nameEN: "Worley Noise",
  category: "generator",
  preview: "/creative-algorithms/previews/worley-noise.gif",
  tags: ["细胞", "晶体", "裂纹", "纹理"]
};

export default class WorleyNoise extends BaseCanvasAlgorithm {
  static defaults = {
    sites: 28,
    resolution: 4,
    speed: 16,
    edgeScale: 4
  };

  reset() {
    this.points = Array.from({ length: this.params.sites }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * this.params.speed,
      vy: (Math.random() - 0.5) * this.params.speed
    }));

    this.buffer = document.createElement("canvas");
    this.bctx = this.buffer.getContext("2d");
  }

  onParamsChanged(next) {
    if ("sites" in next) this.reset();
  }

  update(dt) {
    for (const p of this.points) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;
    }
  }

  render() {
    const r = this.params.resolution;
    const w = Math.ceil(this.width / r);
    const h = Math.ceil(this.height / r);

    if (this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer.width = w;
      this.buffer.height = h;
    }

    const image = this.bctx.createImageData(w, h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x * r;
        const py = y * r;
        let nearest = Infinity;
        let second = Infinity;

        for (const p of this.points) {
          const d = Math.hypot(px - p.x, py - p.y);
          if (d < nearest) {
            second = nearest;
            nearest = d;
          } else if (d < second) {
            second = d;
          }
        }

        const edge = Math.min(1, (second - nearest) / this.params.edgeScale);
        const cell = Math.min(1, nearest / 50);
        const i = (y * w + x) * 4;

        image.data[i] = 18 + edge * 100;
        image.data[i + 1] = 40 + cell * 120;
        image.data[i + 2] = 85 + edge * 165;
        image.data[i + 3] = 255;
      }
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}



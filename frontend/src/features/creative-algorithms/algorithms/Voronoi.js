import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "voronoi", name: "Voronoi 泰森多边形", nameEN: "Voronoi Diagram",
  category: "generator", preview: "/creative-algorithms/previews/voronoi.gif",
  tags: ["几何", "细胞", "空间分割"]
};
export default class Voronoi extends BaseCanvasAlgorithm {
  static defaults = { sites: 24, resolution: 4, speed: 18 };
  reset() {
    this.points = Array.from({ length: this.params.sites }, (_, i) => ({
      x: Math.random() * this.width, y: Math.random() * this.height,
      vx: (Math.random() - .5) * this.params.speed, vy: (Math.random() - .5) * this.params.speed,
      hue: (i * 137.5) % 360
    }));
    this.buffer = document.createElement("canvas"); this.bctx = this.buffer.getContext("2d");
  }
  onParamsChanged(next) { if ("sites" in next || "resolution" in next) this.reset(); }
  update(dt) {
    for (const p of this.points) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;
    }
  }
  render() {
    const r = this.params.resolution, w = Math.ceil(this.width / r), h = Math.ceil(this.height / r);
    if (this.buffer.width !== w || this.buffer.height !== h) { this.buffer.width = w; this.buffer.height = h; }
    const image = this.bctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = Infinity, pick = this.points[0];
      const px = x * r, py = y * r;
      for (const p of this.points) {
        const d = (p.x - px) ** 2 + (p.y - py) ** 2;
        if (d < best) { best = d; pick = p; }
      }
      const c = this.hslToRgb(pick.hue / 360, .58, .46), i = (y * w + x) * 4;
      image.data[i] = c[0]; image.data[i+1] = c[1]; image.data[i+2] = c[2]; image.data[i+3] = 255;
    }
    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true; this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
    this.ctx.fillStyle = "#fff"; for (const p of this.points) { this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); this.ctx.fill(); }
  }
  hslToRgb(h, s, l) {
    const f = n => {
      const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
}



import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "circle-packing", name: "圆形堆积", nameEN: "Circle Packing",
  category: "generator", preview: "/creative-algorithms/previews/circle-packing.gif",
  tags: ["排布", "填充", "几何"]
};
export default class CirclePacking extends BaseCanvasAlgorithm {
  static defaults = { maxCircles: 180, growth: 18, maxRadius: 28, attemptsPerFrame: 6, gap: 2 };
  reset() { this.circles = []; this.clear(); }
  update(dt) {
    for (let k = 0; k < this.params.attemptsPerFrame && this.circles.length < this.params.maxCircles; k++) {
      const c = { x: Math.random() * this.width, y: Math.random() * this.height, r: 1, growing: true, hue: Math.random() * 360 };
      if (this.valid(c)) this.circles.push(c);
    }
    for (const c of this.circles) {
      if (!c.growing) continue;
      const nr = c.r + this.params.growth * dt;
      if (nr > this.params.maxRadius || !this.valid({ ...c, r: nr }, c)) c.growing = false;
      else c.r = nr;
    }
  }
  valid(c, self = null) {
    if (c.x - c.r < 0 || c.x + c.r > this.width || c.y - c.r < 0 || c.y + c.r > this.height) return false;
    for (const o of this.circles) {
      if (o === self) continue;
      if (Math.hypot(c.x - o.x, c.y - o.y) < c.r + o.r + this.params.gap) return false;
    }
    return true;
  }
  render() {
    this.clear();
    this.ctx.lineWidth = 1.5;
    for (const c of this.circles) {
      this.ctx.strokeStyle = `hsl(${c.hue} 70% 65%)`;
      this.ctx.beginPath(); this.ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); this.ctx.stroke();
    }
  }
}



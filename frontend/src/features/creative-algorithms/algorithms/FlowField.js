import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
import { valueNoise2D } from "../utils/noise.js";
export const meta = {
  id: "flow-field", name: "流场", nameEN: "Flow Field",
  category: "field", preview: "/creative-algorithms/previews/flow-field.gif",
  tags: ["粒子", "向量场", "噪声"]
};
export default class FlowField extends BaseCanvasAlgorithm {
  static defaults = { count: 700, speed: 45, scale: 0.006, trail: 0.08, seed: 9 };
  reset() {
    this.particles = Array.from({ length: this.params.count }, () => ({
      x: Math.random() * this.width, y: Math.random() * this.height,
      px: 0, py: 0, life: Math.random() * 4
    }));
    this.clear();
  }
  onParamsChanged(next) { if ("count" in next) this.reset(); }
  update(dt) {
    const { scale, speed, seed } = this.params;
    for (const p of this.particles) {
      p.px = p.x; p.py = p.y;
      const n = valueNoise2D(p.x * scale, p.y * scale, seed);
      const a = n * Math.PI * 4 + this.elapsed * 0.15;
      p.x += Math.cos(a) * speed * dt;
      p.y += Math.sin(a) * speed * dt;
      p.life += dt;
      if (p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height || p.life > 7) {
        p.x = Math.random() * this.width; p.y = Math.random() * this.height; p.px = p.x; p.py = p.y; p.life = 0;
      }
    }
  }
  render() {
    this.ctx.fillStyle = `rgba(8,10,16,${this.params.trail})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.strokeStyle = "rgba(100,210,245,.65)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (const p of this.particles) { this.ctx.moveTo(p.px, p.py); this.ctx.lineTo(p.x, p.y); }
    this.ctx.stroke();
  }
}



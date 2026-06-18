import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "l-system-tree", name: "L-System 分形树", nameEN: "L-System Tree",
  category: "generator", preview: "/creative-algorithms/previews/l-system-tree.gif",
  tags: ["分形", "植物", "递归", "生长"]
};
export default class LSystemTree extends BaseCanvasAlgorithm {
  static defaults = { depth: 8, angle: 25, length: 0.24, shrink: 0.72, speed: 0.22 };
  reset() {
    this.progress = 0;
    this.build();
  }
  onParamsChanged() { this.reset(); }
  build() {
    this.segments = [];
    const angleStep = this.params.angle * Math.PI / 180;
    const rec = (x, y, len, a, d) => {
      if (d <= 0) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      this.segments.push({ x, y, x2, y2, d });
      rec(x2, y2, len * this.params.shrink, a - angleStep, d - 1);
      rec(x2, y2, len * this.params.shrink, a + angleStep, d - 1);
    };
    rec(this.width / 2, this.height - 8, this.height * this.params.length, -Math.PI / 2, this.params.depth);
  }
  onResize() { if (this.segments) this.reset(); }
  update(dt) { this.progress = (this.progress + dt * this.params.speed) % 1.08; }
  render() {
    this.clear();
    const count = Math.floor(Math.min(1, this.progress) * this.segments.length);
    for (let i = 0; i < count; i++) {
      const s = this.segments[i];
      this.ctx.strokeStyle = `hsl(${100 + s.d * 5} 45% ${38 + s.d * 3}%)`;
      this.ctx.lineWidth = Math.max(1, s.d * .45);
      this.ctx.beginPath(); this.ctx.moveTo(s.x, s.y); this.ctx.lineTo(s.x2, s.y2); this.ctx.stroke();
    }
  }
}



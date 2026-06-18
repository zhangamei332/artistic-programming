import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "lorenz-attractor", name: "洛伦兹吸引子", nameEN: "Lorenz Attractor",
  category: "generator", preview: "/creative-algorithms/previews/lorenz-attractor.gif",
  tags: ["混沌", "数学艺术", "轨迹"]
};
export default class LorenzAttractor extends BaseCanvasAlgorithm {
  static defaults = { sigma: 10, rho: 28, beta: 2.6667, dt: 0.006, steps: 7, scale: 5 };
  reset() { this.p = { x: .1, y: 0, z: 0 }; this.clear(); }
  update() {
    for (let i = 0; i < this.params.steps; i++) {
      const { x, y, z } = this.p, P = this.params;
      this.prev = { ...this.p };
      this.p.x += P.sigma * (y - x) * P.dt;
      this.p.y += (x * (P.rho - z) - y) * P.dt;
      this.p.z += (x * y - P.beta * z) * P.dt;
    }
  }
  render() {
    this.ctx.fillStyle = "rgba(8,10,16,.025)"; this.ctx.fillRect(0,0,this.width,this.height);
    if (!this.prev) return;
    const s = this.params.scale;
    const project = p => [this.width / 2 + p.x * s, this.height - 16 - p.z * s];
    const a = project(this.prev), b = project(this.p);
    this.ctx.strokeStyle = "rgba(250,135,210,.82)"; this.ctx.lineWidth = 1.2;
    this.ctx.beginPath(); this.ctx.moveTo(...a); this.ctx.lineTo(...b); this.ctx.stroke();
  }
}


